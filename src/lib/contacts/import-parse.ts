// src/lib/contacts/import-parse.ts
//
// PURPOSE: Everything needed to turn an uploaded contact file into rows we can
// insert — and nothing that touches React or Supabase, so it stays unit-testable.
//
// The old importer failed on real-world files for three reasons, all fixed here:
//   1. It only read `.csv` as text, so an .xlsx upload parsed as binary garbage
//      and produced the misleading "ensure CSV has a phone column" error.
//   2. It hard-split on `,`, so semicolon/tab exports (common from Excel in
//      non-US locales) collapsed into a single unusable column.
//   3. It matched headers by exact name, so "Broker Name" / "Email ID" were
//      silently dropped instead of being offered as a mapping choice.

/** A field on the `contacts` table an uploaded column can be mapped onto. */
export type ContactField = 'phone' | 'name' | 'email' | 'company';

export interface ContactFieldSpec {
  field: ContactField;
  label: string;
  required: boolean;
  /** Lowercased header fragments that suggest this field. Order matters: earlier = stronger. */
  aliases: string[];
}

export const CONTACT_FIELDS: ContactFieldSpec[] = [
  {
    field: 'phone',
    label: 'Mobile Number',
    required: true,
    aliases: [
      'phone', 'mobile', 'whatsapp', 'contact number', 'contact no', 'mob',
      'cell', 'msisdn', 'number', 'tel',
    ],
  },
  {
    field: 'name',
    label: 'Name',
    required: false,
    aliases: ['name', 'full name', 'customer', 'client', 'person', 'contact person'],
  },
  {
    field: 'email',
    label: 'Email',
    required: false,
    aliases: ['email', 'e-mail', 'mail'],
  },
  {
    field: 'company',
    label: 'Company',
    required: false,
    aliases: ['company', 'firm', 'organisation', 'organization', 'business', 'org'],
  },
];

/** Column index per field; `null` means "not mapped". */
export type ColumnMapping = Record<ContactField, number | null>;

export interface Sheet {
  /** Header row, trimmed. Blank headers become `Column N` so they stay selectable. */
  headers: string[];
  /** Data rows, already padded to `headers.length`. */
  rows: string[][];
  /** Present when the file had multiple sheets, so the UI can offer a switcher. */
  sheetNames?: string[];
  activeSheet?: string;
}

export interface PreparedContact {
  phone: string;
  name: string | null;
  email: string | null;
  company: string | null;
}

export interface RejectedRow {
  /** 1-based row number as the user sees it in Excel (header = row 1). */
  rowNumber: number;
  reason: string;
  raw: string[];
}

export interface PrepareResult {
  valid: PreparedContact[];
  rejected: RejectedRow[];
  /** Rows dropped because the same number appeared earlier in the same file. */
  duplicatesInFile: number;
}

// ── Delimited text ────────────────────────────────────────────────────────

const DELIMITERS = [',', ';', '\t', '|'] as const;

/**
 * PURPOSE: pick the delimiter by counting candidates outside quoted spans on the
 * header line. Counting inside quotes would let a value like "Mumbai, MH" vote.
 */
export function sniffDelimiter(headerLine: string): string {
  let best = ',';
  let bestCount = 0;

  for (const delimiter of DELIMITERS) {
    let count = 0;
    let inQuotes = false;
    for (const char of headerLine) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === delimiter && !inQuotes) count++;
    }
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

/**
 * PURPOSE: RFC-4180 style parse — handles quoted fields, "" escapes, embedded
 * newlines, CRLF, and a UTF-8 BOM (Excel writes one, and it would otherwise
 * corrupt the first header).
 */
export function parseDelimitedText(input: string): Sheet {
  const text = input.replace(/^﻿/, '');
  if (!text.trim()) return { headers: [], rows: [] };

  const firstBreak = text.search(/\r?\n/);
  const delimiter = sniffDelimiter(firstBreak === -1 ? text : text.slice(0, firstBreak));

  const records: string[][] = [];
  let record: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      record.push(value);
      value = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      record.push(value);
      records.push(record);
      record = [];
      value = '';
    } else {
      value += char;
    }
  }
  record.push(value);
  records.push(record);

  return toSheet(records);
}

// ── Spreadsheets ──────────────────────────────────────────────────────────

/**
 * PURPOSE: read a real .xlsx/.xls workbook.
 *
 * SheetJS is imported lazily so the ~400 KB parser only reaches users who
 * actually pick a spreadsheet — a CSV upload never pays for it.
 *
 * `raw: true` is essential and easy to get wrong. With `raw: false` SheetJS
 * returns Excel's *displayed* text, and a mobile typed into a General-format
 * cell displays as "9.19877E+11" — six significant digits. Expanding that gives
 * 919877000000, a real-looking number belonging to someone else. Reading the
 * underlying value instead keeps every digit: JS integers are exact well past
 * 15 digits, and `String()` only switches to exponent form at 1e21.
 */
export async function parseWorkbook(buffer: ArrayBuffer, sheetName?: string): Promise<Sheet> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, cellNF: false });

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) return { headers: [], rows: [] };

  const active = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
  const worksheet = workbook.Sheets[active];

  const records = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  });

  const sheet = toSheet(records.map((row) => row.map((cell) => String(cell ?? ''))));
  return { ...sheet, sheetNames, activeSheet: active };
}

const SPREADSHEET_EXTENSIONS = /\.(xlsx|xlsm|xlsb|xls|ods)$/i;

export function isSpreadsheetFile(fileName: string): boolean {
  return SPREADSHEET_EXTENSIONS.test(fileName.trim());
}

/** PURPOSE: single entry point the UI calls — dispatches on file extension. */
export async function readContactFile(file: File, sheetName?: string): Promise<Sheet> {
  if (isSpreadsheetFile(file.name)) {
    return parseWorkbook(await file.arrayBuffer(), sheetName);
  }
  return parseDelimitedText(await file.text());
}

// ── Shared shaping ────────────────────────────────────────────────────────

/**
 * PURPOSE: normalise raw records into a header + padded body, skipping the
 * fully-blank leading rows that spreadsheets accumulate above real data.
 */
function toSheet(records: string[][]): Sheet {
  const meaningful = records.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  if (meaningful.length === 0) return { headers: [], rows: [] };

  const [headerRow, ...body] = meaningful;
  const headers = headerRow.map((header, index) => {
    const clean = String(header ?? '').trim().replace(/^["']|["']$/g, '');
    return clean || `Column ${index + 1}`;
  });

  const rows = body.map((row) => {
    const padded = headers.map((_, index) => String(row[index] ?? '').trim());
    return padded;
  });

  return { headers, rows };
}

// ── Header → field guessing ───────────────────────────────────────────────

function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * PURPOSE: pre-select a sensible mapping so most files import in one click,
 * while still letting the user override every choice.
 *
 * Scores exact alias matches above substring matches, so a sheet with both
 * "Name of Office Person" and "Broker Name" doesn't pick arbitrarily — and a
 * column is never assigned to two fields.
 */
export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { phone: null, name: null, email: null, company: null };
  const taken = new Set<number>();
  const normalised = headers.map(normaliseHeader);

  for (const spec of CONTACT_FIELDS) {
    let bestIndex: number | null = null;
    let bestScore = 0;

    normalised.forEach((header, index) => {
      if (taken.has(index) || !header) return;

      for (let a = 0; a < spec.aliases.length; a++) {
        const alias = spec.aliases[a];
        // Later aliases are weaker; exact beats "contains".
        const rank = spec.aliases.length - a;
        let score = 0;
        if (header === alias) score = 1000 + rank;
        else if (header.includes(alias)) score = 100 + rank;

        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
    });

    if (bestIndex !== null) {
      mapping[spec.field] = bestIndex;
      taken.add(bestIndex);
    }
  }

  return mapping;
}

// ── Phone normalisation ───────────────────────────────────────────────────

/**
 * Sentinel for a number Excel already rounded away — distinct from "not a phone
 * number" because the user can fix it by re-exporting the column as Text.
 */
export const PRECISION_LOST = '__precision_lost__';

/**
 * PURPOSE: turn whatever the sheet holds into the bare international digits the
 * WhatsApp Cloud API expects (no `+`, no spaces).
 *
 * Returns null when the value cannot be a real mobile number, so the caller can
 * report the row instead of inserting junk that fails at send time.
 */
export function normalizePhone(input: string, defaultDialCode = '91'): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  // A CSV exported from Excel can contain "9.19877E+11" where a mobile used to
  // be. Those six significant digits are all that survived — expanding them
  // would invent the remaining six and hand us a stranger's live number, so we
  // refuse instead. `PRECISION_LOST` tells the caller to explain the fix.
  const scientific = raw.match(/^(\d)(?:\.(\d+))?e\+?(\d+)$/i);
  if (scientific) {
    const significantDigits = 1 + (scientific[2]?.length ?? 0);
    const totalDigits = Number(scientific[3]) + 1;
    if (significantDigits < totalDigits) return PRECISION_LOST;
    return normalizePhone(Number(raw).toFixed(0), defaultDialCode);
  }

  const hadPlus = raw.trimStart().startsWith('+');
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // "00" is the other way of writing "+".
  if (!hadPlus && digits.startsWith('00')) digits = digits.slice(2);

  if (!hadPlus) {
    // Domestic trunk prefix: 0 98765 43210.
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    // Bare national number — attach the default country code.
    if (digits.length === 10) digits = `${defaultDialCode}${digits}`;
  }

  // Shortest real E.164 numbers are 8 digits incl. country code; longest is 15.
  if (digits.length < 8 || digits.length > 15) return null;

  return digits;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── Row preparation ───────────────────────────────────────────────────────

export interface PrepareOptions {
  defaultDialCode?: string;
  /** Numbers already in the account — used to skip re-importing known contacts. */
  existingPhones?: Set<string>;
}

/**
 * PURPOSE: apply the mapping to every row and split the file into what we can
 * insert and what we must report back, with a per-row reason for each rejection.
 */
export function prepareContacts(
  sheet: Sheet,
  mapping: ColumnMapping,
  options: PrepareOptions = {},
): PrepareResult {
  const { defaultDialCode = '91', existingPhones } = options;

  const valid: PreparedContact[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Set<string>();
  let duplicatesInFile = 0;

  const read = (row: string[], field: ContactField): string => {
    const index = mapping[field];
    if (index === null || index < 0) return '';
    return (row[index] ?? '').trim();
  };

  sheet.rows.forEach((row, index) => {
    // +2: the header occupies row 1 and spreadsheets are 1-based.
    const rowNumber = index + 2;

    if (row.every((cell) => cell === '')) return;

    const attempted = read(row, 'phone');
    const phone = normalizePhone(attempted, defaultDialCode);

    if (phone === PRECISION_LOST) {
      rejected.push({
        rowNumber,
        reason: `Excel rounded "${attempted}" — format that column as Text and export again`,
        raw: row,
      });
      return;
    }

    if (!phone) {
      rejected.push({
        rowNumber,
        reason: attempted ? `"${attempted}" is not a valid mobile number` : 'Missing mobile number',
        raw: row,
      });
      return;
    }

    if (seen.has(phone)) {
      duplicatesInFile++;
      return;
    }
    seen.add(phone);

    if (existingPhones?.has(phone)) {
      rejected.push({ rowNumber, reason: 'Already in your contacts', raw: row });
      return;
    }

    const email = read(row, 'email');
    valid.push({
      phone,
      name: read(row, 'name') || null,
      // Keep the contact rather than failing the row over a bad email.
      email: email && EMAIL_PATTERN.test(email) ? email : null,
      company: read(row, 'company') || null,
    });
  });

  return { valid, rejected, duplicatesInFile };
}

/** PURPOSE: let the user download exactly which rows failed, and why. */
export function rejectedRowsToCsv(headers: string[], rejected: RejectedRow[]): string {
  const escape = (cell: string) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
  const lines = [['Row', 'Reason', ...headers].map(escape).join(',')];
  for (const row of rejected) {
    lines.push([String(row.rowNumber), row.reason, ...row.raw].map(escape).join(','));
  }
  return lines.join('\r\n');
}
