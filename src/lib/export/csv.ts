  // src/lib/export/csv.ts
//
// Turns rows into a CSV file that Excel opens correctly and safely.
//
// ── WHY THIS IS NOT A ONE-LINER ──────────────────────────────────────
// `rows.map(r => Object.values(r).join(','))` produces a file that is
// wrong in four separate ways, and every one of them shows up in real
// customer data:
//
//   1. A contact named  Sharma, Rajesh  splits into two columns.
//   2. A message containing a newline — most of them do — splits into
//      two rows and shifts every column after it.
//   3. A name in Hindi or an emoji arrives as mojibake, because Excel
//      assumes the system codepage unless the file opens with a BOM.
//   4. A cell beginning with = is executed as a formula on open. That
//      is CSV injection: a customer can type a formula into a chat, the
//      merchant exports the thread, and it runs on their machine.
//
// This module exists so those four are handled once, in a place with
// tests, rather than in each page that offers a download.

/** One output column: where the value comes from, and what to call it. */
export interface CsvColumn<T> {
  header: string
  value: (row: T) => unknown
}

const NEEDS_QUOTING = /[",\r\n]/

/**
 * Characters that make Excel and Google Sheets treat a cell as a
 * formula. `=` and `@` are always dangerous; `+` and `-` are dangerous
 * only when what follows could be a function call rather than a number.
 */
const FORMULA_START = /^[=@]/
const SIGN_START = /^[+\-]/

/**
 * A value that is only digits and phone punctuation cannot carry a
 * formula payload — attacks need letters (HYPERLINK, cmd) or a DDE
 * pipe. Recognising these keeps +91 98188 16485 readable instead of
 * exporting it as '+91 98188 16485 with a stray apostrophe on every
 * single row, which is what a blanket rule would do.
 */
const PHONE_LIKE = /^[+\-]?[\d\s()\-.]+$/

/** Format one value as a CSV field: neutralised, escaped, quoted. */
export function csvCell(raw: unknown): string {
  if (raw === null || raw === undefined) return ''

  let text: string
  if (raw instanceof Date) {
    text = Number.isNaN(raw.getTime()) ? '' : raw.toISOString()
  } else if (typeof raw === 'object') {
    // JSONB columns (leads.extra, tags) are worth keeping rather than
    // rendering as [object Object].
    try {
      text = JSON.stringify(raw)
    } catch {
      text = ''
    }
  } else {
    text = String(raw)
  }

  if (text === '') return ''

  // ── Formula neutralisation ──
  // A leading apostrophe stops the spreadsheet evaluating the cell. It
  // is applied before quoting so the apostrophe ends up inside the
  // quoted field rather than outside it.
  const dangerous =
    FORMULA_START.test(text) || (SIGN_START.test(text) && !PHONE_LIKE.test(text))
  if (dangerous) text = `'${text}`

  // A tab or carriage return at the start is the other known trigger.
  if (/^[\t\r]/.test(text)) text = `'${text}`

  if (NEEDS_QUOTING.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/**
 * Build the complete CSV text for a set of rows.
 *
 * CRLF line endings and a UTF-8 BOM, both because Excel wants them —
 * without the BOM, any non-Latin name in the file is unreadable.
 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines: string[] = []

  lines.push(columns.map((c) => csvCell(c.header)).join(','))

  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(safeValue(c, row))).join(','))
  }

  return '﻿' + lines.join('\r\n') + '\r\n'
}

/**
 * One bad accessor must not cost the merchant the whole export. A row
 * with an unexpected shape yields an empty cell, and the other 4,000
 * rows still download.
 */
function safeValue<T>(column: CsvColumn<T>, row: T): unknown {
  try {
    return column.value(row)
  } catch {
    return ''
  }
}

/** A filename that sorts chronologically and is safe on every OS. */
export function csvFilename(prefix: string, at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp =
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
    `_${pad(at.getHours())}${pad(at.getMinutes())}`
  const clean = prefix.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  return `${clean || 'export'}_${stamp}.csv`
}

/**
 * Hand the finished file to the browser.
 *
 * Browser-only — it touches document and URL. Kept beside the builder
 * so a page needs one import to offer a download, and guarded so that
 * importing this module on the server cannot throw.
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Revoking immediately can cancel the download in Safari; a tick is
  // enough for the browser to have taken the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
