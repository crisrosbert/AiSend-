// src/lib/contacts/xlsx-reader.ts
//
// PURPOSE: read an .xlsx workbook with NO third-party dependency.
//
// An .xlsx file is just a ZIP archive of XML. Everything needed to open one is
// already in the platform: DecompressionStream inflates the entries, and the
// handful of XML shapes we care about are matched directly. That keeps the
// project dependency-free, so deploys can never break on a missing package.
//
// Reading the XML also preserves phone numbers exactly. Excel stores a numeric
// cell as its literal decimal text (<v>919876500011</v>), so there is no float
// round-trip and no "9.19877E+11" precision loss to undo.
//
// Scope: .xlsx / .xlsm (ZIP + OOXML). The legacy binary .xls format and .ods
// are deliberately not supported — callers should ask for a re-save.

export interface WorkbookSheet {
  name: string;
  /** Row-major cell text. Ragged: trailing empty cells are not padded. */
  rows: string[][];
}

export interface Workbook {
  sheetNames: string[];
  /** Reads one sheet by name. Sheets are parsed on demand, not up front. */
  readSheet(name: string): WorkbookSheet;
}

export class XlsxError extends Error {}

// ── ZIP ───────────────────────────────────────────────────────────────────

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL_FILE = 0x02014b50;
const EOCD_MIN_SIZE = 22;

/**
 * PURPOSE: locate the End Of Central Directory record, which is the only fixed
 * anchor in a ZIP. It sits at the very end, but a trailing comment can push it
 * back by up to 64 KB, so scan backwards for its signature.
 */
function findEocd(view: DataView): number {
  const maxCommentSize = 0xffff;
  const earliest = Math.max(0, view.byteLength - EOCD_MIN_SIZE - maxCommentSize);
  for (let offset = view.byteLength - EOCD_MIN_SIZE; offset >= earliest; offset--) {
    if (view.getUint32(offset, true) === SIG_EOCD) return offset;
  }
  throw new XlsxError('Not a valid .xlsx file (no ZIP end-of-directory record).');
}

/** PURPOSE: list every entry in the archive, without decompressing any of them. */
function readCentralDirectory(buffer: ArrayBuffer): Map<string, ZipEntry> {
  const view = new DataView(buffer);
  const eocd = findEocd(view);

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();

  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== SIG_CENTRAL_FILE) break;

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));
    entries.set(name, { name, compressionMethod, compressedSize, localHeaderOffset });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

/**
 * PURPOSE: pull one entry's bytes out.
 *
 * The central directory's name/extra lengths describe the *central* header —
 * the local header repeats them with its own (often different) extra field, so
 * the data offset must be computed from the local header itself.
 */
async function readEntry(buffer: ArrayBuffer, entry: ZipEntry): Promise<string> {
  const view = new DataView(buffer);
  const local = entry.localHeaderOffset;

  const nameLength = view.getUint16(local + 26, true);
  const extraLength = view.getUint16(local + 28, true);
  const dataStart = local + 30 + nameLength + extraLength;

  const compressed = new Uint8Array(buffer, dataStart, entry.compressedSize);

  // Method 0 = stored verbatim; 8 = raw DEFLATE (no zlib wrapper).
  if (entry.compressionMethod === 0) return new TextDecoder().decode(compressed);
  if (entry.compressionMethod !== 8) {
    throw new XlsxError(`Unsupported ZIP compression in "${entry.name}".`);
  }

  if (typeof DecompressionStream === 'undefined') {
    throw new XlsxError('This browser cannot open .xlsx files. Please save your file as CSV.');
  }

  const stream = new Blob([compressed as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));

  return new Response(stream).text();
}

// ── XML ───────────────────────────────────────────────────────────────────
//
// DOMParser exists only in the browser, so these read the narrow, well-formed
// subset OOXML actually emits. That keeps the reader identical in the browser
// and under test.

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
};

function decodeXml(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const value = code[1] === 'x' || code[1] === 'X'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`));
  return match ? decodeXml(match[1]) : null;
}

/** PURPOSE: concatenate every <t> in a fragment — rich text splits one string across runs. */
function joinTextNodes(fragment: string): string {
  let out = '';
  const pattern = /<t\b[^>]*\/>|<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(fragment)) !== null) out += decodeXml(match[1] ?? '');
  return out;
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const pattern = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) strings.push(joinTextNodes(match[1] ?? ''));
  return strings;
}

/** PURPOSE: "BC" → 54. Cell refs are base-26 with A=1, so subtract one at the end. */
function columnToIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A';
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function parseSheet(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(xml)) !== null) {
    const row: string[] = [];
    const body = rowMatch[1] ?? '';

    const cellPattern = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    let nextIndex = 0;

    while ((cellMatch = cellPattern.exec(body)) !== null) {
      const cellAttrs = cellMatch[1] ?? '';
      const cellBody = cellMatch[2] ?? '';

      // Honour the cell reference so gaps stay in the right columns.
      const ref = attr(`<c${cellAttrs}>`, 'r');
      const index = ref ? columnToIndex(ref) : nextIndex;
      while (row.length < index) row.push('');
      nextIndex = index + 1;

      row.push(readCellValue(cellAttrs, cellBody, sharedStrings));
    }

    rows.push(row);
  }

  return rows;
}

function readCellValue(cellAttrs: string, cellBody: string, sharedStrings: string[]): string {
  const type = attr(`<c${cellAttrs}>`, 't') ?? 'n';

  if (type === 'inlineStr') return joinTextNodes(cellBody);

  const valueMatch = cellBody.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
  if (!valueMatch) return '';
  const raw = decodeXml(valueMatch[1]);

  switch (type) {
    case 's': {
      const index = Number(raw);
      return sharedStrings[index] ?? '';
    }
    case 'b':
      return raw === '1' ? 'TRUE' : 'FALSE';
    case 'e':
      return '';
    default:
      // Numbers arrive as their exact decimal text — return it untouched so a
      // long mobile number keeps every digit.
      return raw;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

const SHEET_NAME_PATTERN = /<sheet\b[^>]*\/>|<sheet\b[^>]*>/g;

/**
 * PURPOSE: open an .xlsx workbook from raw bytes.
 *
 * Entries are inflated up front (workbook + shared strings + every sheet) so
 * the returned object is synchronous and easy to use from React state.
 */
export async function readXlsx(buffer: ArrayBuffer): Promise<Workbook> {
  const entries = readCentralDirectory(buffer);

  const workbookEntry = entries.get('xl/workbook.xml');
  if (!workbookEntry) {
    throw new XlsxError('This file is not an Excel workbook (xl/workbook.xml is missing).');
  }

  const workbookXml = await readEntry(buffer, workbookEntry);

  // rId → target path, so sheet order and names map to the right XML part.
  const relsEntry = entries.get('xl/_rels/workbook.xml.rels');
  const relsXml = relsEntry ? await readEntry(buffer, relsEntry) : '';
  const relTargets = new Map<string, string>();
  for (const tag of relsXml.match(/<Relationship\b[^>]*>/g) ?? []) {
    const id = attr(tag, 'Id');
    const target = attr(tag, 'Target');
    if (id && target) relTargets.set(id, target.replace(/^\/?xl\//, '').replace(/^\//, ''));
  }

  const sheetNames: string[] = [];
  const sheetPaths = new Map<string, string>();
  let fallbackIndex = 0;

  for (const tag of workbookXml.match(SHEET_NAME_PATTERN) ?? []) {
    const name = attr(tag, 'name');
    if (!name) continue;
    fallbackIndex++;

    const relId = attr(tag, 'r:id') ?? attr(tag, 'id');
    const target = relId ? relTargets.get(relId) : undefined;

    sheetNames.push(name);
    sheetPaths.set(name, `xl/${target ?? `worksheets/sheet${fallbackIndex}.xml`}`);
  }

  if (sheetNames.length === 0) throw new XlsxError('This workbook has no sheets.');

  const sharedEntry = entries.get('xl/sharedStrings.xml');
  const sharedStrings = sharedEntry
    ? parseSharedStrings(await readEntry(buffer, sharedEntry))
    : [];

  const parsed = new Map<string, string[][]>();
  for (const name of sheetNames) {
    const path = sheetPaths.get(name)!;
    const entry = entries.get(path);
    parsed.set(name, entry ? parseSheet(await readEntry(buffer, entry), sharedStrings) : []);
  }

  return {
    sheetNames,
    readSheet(name: string): WorkbookSheet {
      const rows = parsed.get(name);
      if (!rows) throw new XlsxError(`Sheet "${name}" was not found in this workbook.`);
      return { name, rows };
    },
  };
}

/** PURPOSE: an .xlsx always begins with the ZIP local-header magic "PK\x03\x04". */
export function looksLikeXlsx(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const head = new Uint8Array(buffer, 0, 4);
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
}
