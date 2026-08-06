import { describe, it, expect } from 'vitest';
import { readXlsx, looksLikeXlsx, XlsxError } from './xlsx-reader';

// ── A minimal ZIP writer, so these tests need no binary fixture and no
// dependency. Real Excel files use DEFLATE, so entries are written that way by
// default; `stored` covers the uncompressed branch of the reader.

interface ZipFile { name: string; content: string; stored?: boolean }

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function makeZip(files: ZipFile[]): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const raw = encoder.encode(file.content);
    const method = file.stored ? 0 : 8;
    const data = file.stored ? raw : await deflateRaw(raw);

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(8, method, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, raw.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(10, method, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, raw.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((sum, c) => sum + c.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, offset, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out.buffer;
}

const WORKBOOK_XML = `<?xml version="1.0"?>
<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Brokers" sheetId="1" r:id="rId1"/>
    <sheet name="Second Sheet" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`;

const RELS_XML = `<?xml version="1.0"?>
<Relationships>
  <Relationship Id="rId1" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Target="worksheets/sheet2.xml"/>
</Relationships>`;

const SHARED_STRINGS_XML = `<?xml version="1.0"?>
<sst count="6">
  <si><t>Broker Name</t></si>
  <si><t>phone</t></si>
  <si><t>Asha Patel</t></si>
  <si><t>Priya &quot;Big&quot; Nair</t></si>
  <si><r><t>Nair </t></r><r><t>&amp; Co</t></r></si>
  <si><t>caf&#233;</t></si>
</sst>`;

// A2 is a shared string, B2 a raw number, C2 inline, D2 boolean.
// Row 3 skips column B entirely to exercise cell-reference placement.
const SHEET1_XML = `<?xml version="1.0"?>
<worksheet><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
  <row r="2">
    <c r="A2" t="s"><v>2</v></c>
    <c r="B2"><v>919876500011</v></c>
    <c r="C2" t="inlineStr"><is><t>inline value</t></is></c>
    <c r="D2" t="b"><v>1</v></c>
  </row>
  <row r="3"><c r="A3" t="s"><v>3</v></c><c r="C3" t="s"><v>4</v></c></row>
  <row r="4"><c r="A4" t="s"><v>5</v></c><c r="B4" t="e"><v>#DIV/0!</v></c></row>
</sheetData></worksheet>`;

const SHEET2_XML = `<?xml version="1.0"?>
<worksheet><sheetData>
  <row r="1"><c r="A1" t="inlineStr"><is><t>phone</t></is></c></row>
  <row r="2"><c r="A2"><v>919999888877</v></c></row>
</sheetData></worksheet>`;

function workbookFiles(overrides: Partial<Record<string, string>> = {}): ZipFile[] {
  return [
    { name: 'xl/workbook.xml', content: overrides['xl/workbook.xml'] ?? WORKBOOK_XML },
    { name: 'xl/_rels/workbook.xml.rels', content: RELS_XML },
    { name: 'xl/sharedStrings.xml', content: SHARED_STRINGS_XML },
    { name: 'xl/worksheets/sheet1.xml', content: SHEET1_XML },
    { name: 'xl/worksheets/sheet2.xml', content: SHEET2_XML },
  ];
}

describe('looksLikeXlsx', () => {
  it('recognises the ZIP local-header magic', async () => {
    expect(looksLikeXlsx(await makeZip(workbookFiles()))).toBe(true);
  });

  it('rejects plain text', () => {
    expect(looksLikeXlsx(new TextEncoder().encode('phone,name').buffer as ArrayBuffer)).toBe(false);
  });

  it('rejects a buffer too short to hold a signature', () => {
    expect(looksLikeXlsx(new ArrayBuffer(2))).toBe(false);
  });
});

describe('readXlsx', () => {
  it('lists sheets in workbook order', async () => {
    const workbook = await readXlsx(await makeZip(workbookFiles()));
    expect(workbook.sheetNames).toEqual(['Brokers', 'Second Sheet']);
  });

  it('resolves shared strings, including rich-text runs', async () => {
    const workbook = await readXlsx(await makeZip(workbookFiles()));
    const rows = workbook.readSheet('Brokers').rows;
    expect(rows[0]).toEqual(['Broker Name', 'phone']);
    // Split across two <r> runs in sharedStrings.
    expect(rows[2][2]).toBe('Nair & Co');
  });

  it('keeps a 12-digit mobile exactly, with no float rounding', async () => {
    const workbook = await readXlsx(await makeZip(workbookFiles()));
    // The bug this reader exists to prevent: 919876500011 must not become
    // 919877000000 via Excel's 6-significant-digit display format.
    expect(workbook.readSheet('Brokers').rows[1][1]).toBe('919876500011');
  });

  it('decodes named and numeric XML entities', async () => {
    const workbook = await readXlsx(await makeZip(workbookFiles()));
    const rows = workbook.readSheet('Brokers').rows;
    expect(rows[2][0]).toBe('Priya "Big" Nair');
    expect(rows[3][0]).toBe('café');
  });

  it('reads inline strings and booleans', async () => {
    const workbook = await readXlsx(await makeZip(workbookFiles()));
    const row = workbook.readSheet('Brokers').rows[1];
    expect(row[2]).toBe('inline value');
    expect(row[3]).toBe('TRUE');
  });

  it('places cells by reference so a skipped column stays aligned', async () => {
    const workbook = await readXlsx(await makeZip(workbookFiles()));
    // Row 3 has A and C but no B — C must land at index 2, not 1.
    expect(workbook.readSheet('Brokers').rows[2]).toEqual(['Priya "Big" Nair', '', 'Nair & Co']);
  });

  it('blanks error cells rather than importing "#DIV/0!"', async () => {
    const workbook = await readXlsx(await makeZip(workbookFiles()));
    expect(workbook.readSheet('Brokers').rows[3][1]).toBe('');
  });

  it('reads a second sheet by name', async () => {
    const workbook = await readXlsx(await makeZip(workbookFiles()));
    expect(workbook.readSheet('Second Sheet').rows[1][0]).toBe('919999888877');
  });

  it('supports uncompressed (stored) entries', async () => {
    const stored = workbookFiles().map((f) => ({ ...f, stored: true }));
    const workbook = await readXlsx(await makeZip(stored));
    expect(workbook.readSheet('Brokers').rows[1][1]).toBe('919876500011');
  });

  it('falls back to sheetN.xml when relationships are missing', async () => {
    const files = workbookFiles().filter((f) => f.name !== 'xl/_rels/workbook.xml.rels');
    const workbook = await readXlsx(await makeZip(files));
    expect(workbook.readSheet('Brokers').rows[0][0]).toBe('Broker Name');
  });

  it('works without a shared-string table', async () => {
    const files = workbookFiles()
      .filter((f) => f.name !== 'xl/sharedStrings.xml')
      .map((f) => (f.name === 'xl/worksheets/sheet1.xml'
        ? { ...f, content: '<worksheet><sheetData><row r="1"><c r="A1"><v>42</v></c></row></sheetData></worksheet>' }
        : f));
    const workbook = await readXlsx(await makeZip(files));
    expect(workbook.readSheet('Brokers').rows[0][0]).toBe('42');
  });

  it('rejects a file that is not a ZIP', async () => {
    const notZip = new TextEncoder().encode('phone,name\n1,2').buffer as ArrayBuffer;
    await expect(readXlsx(notZip)).rejects.toBeInstanceOf(XlsxError);
  });

  it('rejects a ZIP that is not a workbook', async () => {
    const zip = await makeZip([{ name: 'readme.txt', content: 'hello' }]);
    await expect(readXlsx(zip)).rejects.toThrow(/not an Excel workbook/);
  });

  it('reports an unknown sheet name', async () => {
    const workbook = await readXlsx(await makeZip(workbookFiles()));
    expect(() => workbook.readSheet('Nope')).toThrow(/was not found/);
  });
});
