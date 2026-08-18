// src/lib/export/csv.test.ts
//
// These cases are all drawn from what real customer data contains:
// commas in names, newlines in messages, Hindi text, and — the one that
// matters most — a cell that a spreadsheet would execute.

import { describe, it, expect } from 'vitest'
import { csvCell, toCsv, csvFilename, type CsvColumn } from './csv'

describe('csvCell — escaping', () => {
  it('leaves an ordinary value alone', () => {
    expect(csvCell('Rajesh')).toBe('Rajesh')
    expect(csvCell(42)).toBe('42')
  })

  it('quotes a value containing a comma', () => {
    // "Sharma, Rajesh" would otherwise become two columns.
    expect(csvCell('Sharma, Rajesh')).toBe('"Sharma, Rajesh"')
  })

  it('escapes embedded quotes by doubling them', () => {
    expect(csvCell('He said "yes"')).toBe('"He said ""yes"""')
  })

  it('quotes a value containing a newline', () => {
    // Chat messages contain these constantly.
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"')
    expect(csvCell('line one\r\nline two')).toBe('"line one\r\nline two"')
  })

  it('renders empty for null and undefined', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
    expect(csvCell('')).toBe('')
  })

  it('renders dates as ISO, and survives an invalid one', () => {
    expect(csvCell(new Date('2026-08-13T09:30:00Z'))).toBe('2026-08-13T09:30:00.000Z')
    expect(csvCell(new Date('nonsense'))).toBe('')
  })

  it('keeps JSON columns as JSON', () => {
    expect(csvCell({ page_url: 'https://x.com' })).toBe('"{""page_url"":""https://x.com""}"')
  })

  it('passes non-Latin text through unchanged', () => {
    expect(csvCell('राजेश शर्मा')).toBe('राजेश शर्मा')
    expect(csvCell('परफेक्ट 😊')).toBe('परफेक्ट 😊')
  })
})

describe('csvCell — formula injection', () => {
  it('neutralises the classic payloads', () => {
    // A customer types this into a chat; the merchant exports the
    // thread; without the apostrophe it executes on their machine.
    expect(csvCell('=1+1')).toBe("'=1+1")
    expect(csvCell('=HYPERLINK("http://evil.test","click")')).toBe(
      '"\'=HYPERLINK(""http://evil.test"",""click"")"',
    )
    expect(csvCell('@SUM(A1:A9)')).toBe("'@SUM(A1:A9)")
    // No comma, quote or newline here, so it is neutralised but needs
    // no wrapping — a bare apostrophe is not a CSV metacharacter.
    expect(csvCell('=cmd|\' /c calc\'!A1')).toBe('\'=cmd|\' /c calc\'!A1')
  })

  it('neutralises a leading tab or carriage return', () => {
    expect(csvCell('\t=1+1')).toMatch(/^"?'/)
  })

  it('leaves phone numbers readable', () => {
    // A blanket rule would put a stray apostrophe on every phone number
    // in the file. Digits and punctuation cannot carry a payload.
    expect(csvCell('+919818816485')).toBe('+919818816485')
    expect(csvCell('+91 98188 16485')).toBe('+91 98188 16485')
    expect(csvCell('-42')).toBe('-42')
    expect(csvCell('(022) 1234-5678')).toBe('(022) 1234-5678')
  })

  it('still catches a signed value that is not a number', () => {
    expect(csvCell('+HYPERLINK("x")')).toMatch(/^"?'/)
    expect(csvCell('-2+3+cmd|x')).toMatch(/^"?'/)
  })
})

describe('toCsv', () => {
  interface Row { name: string; phone: string; note: string | null }
  const columns: CsvColumn<Row>[] = [
    { header: 'Name', value: (r) => r.name },
    { header: 'Phone', value: (r) => r.phone },
    { header: 'Note', value: (r) => r.note },
  ]

  it('writes a header row and one line per record', () => {
    const csv = toCsv(
      [
        { name: 'Rajesh', phone: '+919000000001', note: null },
        { name: 'Sharma, A', phone: '+919000000002', note: 'said "hello"' },
      ],
      columns,
    )
    const lines = csv.replace('﻿', '').trimEnd().split('\r\n')
    expect(lines[0]).toBe('Name,Phone,Note')
    expect(lines[1]).toBe('Rajesh,+919000000001,')
    expect(lines[2]).toBe('"Sharma, A",+919000000002,"said ""hello"""')
  })

  it('starts with a UTF-8 BOM so Excel reads Hindi correctly', () => {
    expect(toCsv([], columns).startsWith('﻿')).toBe(true)
  })

  it('uses CRLF line endings', () => {
    const csv = toCsv([{ name: 'A', phone: 'B', note: 'C' }], columns)
    expect(csv).toContain('\r\n')
  })

  it('produces a header-only file for no rows', () => {
    expect(toCsv([], columns).replace('﻿', '')).toBe('Name,Phone,Note\r\n')
  })

  it('does not lose every other row when one accessor throws', () => {
    const risky: CsvColumn<Row>[] = [
      { header: 'Name', value: (r) => r.name },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { header: 'Bad', value: (r) => (r as any).missing.deep },
    ]
    const csv = toCsv([{ name: 'A', phone: '', note: null }, { name: 'B', phone: '', note: null }], risky)
    const lines = csv.replace('﻿', '').trimEnd().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe('A,')
    expect(lines[2]).toBe('B,')
  })
})

describe('csvFilename', () => {
  it('stamps the date and time so files sort in order', () => {
    expect(csvFilename('contacts', new Date(2026, 7, 13, 9, 5))).toBe('contacts_2026-08-13_0905.csv')
  })

  it('strips characters that break filesystems', () => {
    expect(csvFilename('chat history / all')).toMatch(/^chat-history-all_/)
  })

  it('falls back when the prefix reduces to nothing', () => {
    expect(csvFilename('///')).toMatch(/^export_/)
  })
})
