import { describe, it, expect } from 'vitest';
import {
  sniffDelimiter,
  parseDelimitedText,
  guessMapping,
  normalizePhone,
  prepareContacts,
  rejectedRowsToCsv,
  PRECISION_LOST,
  type ColumnMapping,
} from './import-parse';

// The exact sheet that produced "No valid rows found" in production.
const BROKER_HEADERS = [
  'Sr.No', 'Broker Name', 'Broker Firm', 'phone', 'Email ID', 'Name of Office Person',
];

describe('sniffDelimiter', () => {
  it('defaults to comma', () => {
    expect(sniffDelimiter('a,b,c')).toBe(',');
  });

  it('detects semicolon exports', () => {
    expect(sniffDelimiter('a;b;c')).toBe(';');
  });

  it('detects tab exports', () => {
    expect(sniffDelimiter('a\tb\tc')).toBe('\t');
  });

  it('ignores delimiters inside quoted headers', () => {
    // One real semicolon; the two commas live inside quotes and must not vote.
    expect(sniffDelimiter('"City, State";"Area, Zone"')).toBe(';');
  });
});

describe('parseDelimitedText', () => {
  it('strips a UTF-8 BOM so the first header still matches', () => {
    const sheet = parseDelimitedText('﻿phone,name\n919876543210,Asha');
    expect(sheet.headers).toEqual(['phone', 'name']);
  });

  it('handles quoted fields, escaped quotes and CRLF', () => {
    const sheet = parseDelimitedText(
      'phone,company\r\n919876543210,"Shah ""Realty"", Mumbai"\r\n',
    );
    expect(sheet.rows).toEqual([['919876543210', 'Shah "Realty", Mumbai']]);
  });

  it('handles newlines embedded in quoted fields', () => {
    const sheet = parseDelimitedText('phone,name\n919876543210,"Asha\nPatel"');
    expect(sheet.rows[0][1]).toBe('Asha\nPatel');
  });

  it('parses semicolon-delimited files', () => {
    const sheet = parseDelimitedText('phone;name\n919876543210;Asha');
    expect(sheet.headers).toEqual(['phone', 'name']);
    expect(sheet.rows).toEqual([['919876543210', 'Asha']]);
  });

  it('pads short rows to the header width', () => {
    const sheet = parseDelimitedText('phone,name,email\n919876543210,Asha');
    expect(sheet.rows[0]).toEqual(['919876543210', 'Asha', '']);
  });

  it('names blank headers so they stay selectable', () => {
    const sheet = parseDelimitedText('phone,,email\n919876543210,x,a@b.co');
    expect(sheet.headers[1]).toBe('Column 2');
  });

  it('returns an empty sheet for empty input', () => {
    expect(parseDelimitedText('   ')).toEqual({ headers: [], rows: [] });
  });
});

describe('guessMapping', () => {
  it('maps the broker sheet that used to fail', () => {
    const mapping = guessMapping(BROKER_HEADERS);
    expect(mapping.phone).toBe(3);
    expect(mapping.email).toBe(4);
    expect(mapping.company).toBe(2);
    // "Broker Name" wins over "Name of Office Person" — it is the contact.
    expect(mapping.name).toBe(1);
  });

  it('prefers an exact header over a substring match', () => {
    const mapping = guessMapping(['Company Name', 'Name']);
    expect(mapping.name).toBe(1);
  });

  it('never assigns one column to two fields', () => {
    const mapping = guessMapping(['Contact Number']);
    const used = Object.values(mapping).filter((v): v is number => v !== null);
    expect(new Set(used).size).toBe(used.length);
  });

  it('recognises common mobile header spellings', () => {
    expect(guessMapping(['Mobile Number']).phone).toBe(0);
    expect(guessMapping(['WhatsApp No.']).phone).toBe(0);
    expect(guessMapping(['Mob']).phone).toBe(0);
  });

  it('leaves unmatched fields null', () => {
    expect(guessMapping(['phone']).company).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('adds the default dial code to a bare 10-digit number', () => {
    expect(normalizePhone('9876543210')).toBe('919876543210');
  });

  it('strips the domestic trunk zero', () => {
    expect(normalizePhone('09876543210')).toBe('919876543210');
  });

  it('keeps an already-international number', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('919876543210');
  });

  it('treats a 00 prefix as +', () => {
    expect(normalizePhone('00919876543210')).toBe('919876543210');
  });

  it('expands scientific notation when no digits were lost', () => {
    expect(normalizePhone('9.19876543210E+11')).toBe('919876543210');
  });

  it('refuses rounded scientific notation instead of inventing digits', () => {
    // Excel's General format shows 919876500011 as 9.19877E+11. Expanding that
    // yields 919877000000 — a real number belonging to someone else.
    expect(normalizePhone('9.19877E+11')).toBe(PRECISION_LOST);
  });

  it('strips formatting characters', () => {
    expect(normalizePhone('(987) 654-3210')).toBe('919876543210');
  });

  it('honours a non-Indian default dial code', () => {
    expect(normalizePhone('2025550147', '1')).toBe('12025550147');
  });

  it('rejects values that cannot be phone numbers', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('N/A')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('1234567890123456')).toBeNull();
  });
});

describe('prepareContacts', () => {
  const sheet = parseDelimitedText(
    [
      'Sr.No,Broker Name,Broker Firm,phone,Email ID,Name of Office Person',
      '1,Asha Patel,Patel Realty,9876543210,asha@patel.co,Ramesh',
      '2,Vikram Shah,Shah Estates,+91 98765 00011,not-an-email,Suresh',
      '3,No Number,Ghost Firm,,ghost@x.co,Nobody',
      '4,Dup Asha,Patel Realty,09876543210,asha2@patel.co,Ramesh',
    ].join('\n'),
  );
  const mapping = guessMapping(sheet.headers);

  it('imports the rows that used to be rejected wholesale', () => {
    const result = prepareContacts(sheet, mapping);
    expect(result.valid).toHaveLength(2);
    expect(result.valid[0]).toEqual({
      phone: '919876543210',
      name: 'Asha Patel',
      email: 'asha@patel.co',
      company: 'Patel Realty',
    });
  });

  it('keeps the contact but drops an invalid email', () => {
    const result = prepareContacts(sheet, mapping);
    expect(result.valid[1].email).toBeNull();
    expect(result.valid[1].phone).toBe('919876500011');
  });

  it('reports a missing number with its spreadsheet row number', () => {
    const result = prepareContacts(sheet, mapping);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].rowNumber).toBe(4);
    expect(result.rejected[0].reason).toBe('Missing mobile number');
  });

  it('collapses duplicates that normalise to the same number', () => {
    const result = prepareContacts(sheet, mapping);
    expect(result.duplicatesInFile).toBe(1);
  });

  it('skips numbers already in the account', () => {
    const result = prepareContacts(sheet, mapping, {
      existingPhones: new Set(['919876543210']),
    });
    expect(result.valid).toHaveLength(1);
    expect(result.rejected.some((r) => r.reason === 'Already in your contacts')).toBe(true);
  });

  it('tells the user how to fix an Excel-rounded number', () => {
    const rounded = parseDelimitedText('phone\n9.19877E+11');
    const result = prepareContacts(rounded, { phone: 0, name: null, email: null, company: null });
    expect(result.valid).toHaveLength(0);
    expect(result.rejected[0].reason).toContain('format that column as Text');
  });

  it('explains why an unparseable number failed', () => {
    const bad = parseDelimitedText('phone\nN/A');
    const result = prepareContacts(bad, { phone: 0, name: null, email: null, company: null });
    expect(result.rejected[0].reason).toBe('"N/A" is not a valid mobile number');
  });

  it('ignores optional fields left unmapped', () => {
    const onlyPhone: ColumnMapping = { phone: 3, name: null, email: null, company: null };
    const result = prepareContacts(sheet, onlyPhone);
    expect(result.valid[0]).toEqual({
      phone: '919876543210', name: null, email: null, company: null,
    });
  });
});

describe('rejectedRowsToCsv', () => {
  it('escapes quotes so the error file reopens cleanly in Excel', () => {
    const csv = rejectedRowsToCsv(['phone'], [
      { rowNumber: 2, reason: 'Missing mobile number', raw: ['say "hi"'] },
    ]);
    expect(csv.split('\r\n')[0]).toBe('"Row","Reason","phone"');
    expect(csv).toContain('"say ""hi"""');
  });
});
