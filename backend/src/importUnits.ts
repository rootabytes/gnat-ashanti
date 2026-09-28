import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { HttpError, normalizeGps } from './http';
import { CATEGORY_LABELS, WORKPLACE_CATEGORIES, WorkplaceCategory } from './reference';
import { MAX_UNITS_PER_LOCAL } from './services';

// Chairmen who already keep their schools in a spreadsheet upload it instead of
// typing 200 names on a phone. The file is only parsed here: the rows go back to
// the editor for the chairman to check, and are saved through the normal units API.

export interface ImportedUnit {
  name: string;
  category: WorkplaceCategory | null;
  gpsAddress: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

const CATEGORY_KEYS = new Map<string, WorkplaceCategory>();
for (const c of WORKPLACE_CATEGORIES) {
  CATEGORY_KEYS.set(norm(c), c);
  CATEGORY_KEYS.set(norm(CATEGORY_LABELS[c]), c);
}

export function matchCategory(input: string): WorkplaceCategory | null {
  const k = norm(input);
  if (!k) return null;
  const exact = CATEGORY_KEYS.get(k);
  if (exact) return exact;
  // "Religious Mission" → Religious Mission Administrations, "Education Admin" → Education Administration Units
  if (k.length >= 5) {
    const hits = WORKPLACE_CATEGORIES.filter((c) => norm(c).startsWith(k) || norm(CATEGORY_LABELS[c]).startsWith(k));
    if (hits.length === 1) return hits[0];
  }
  return null;
}

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, commas/semicolons/tabs. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? undefined : text.indexOf('\n'));
  const sep = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function readXlsx(buf: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new HttpError(400, 'That file could not be read. Save it as an Excel workbook (.xlsx) or CSV and try again.');
  }
  const ws = wb.getWorksheet('Workplaces') ?? wb.worksheets.find((w) => w.state === 'visible' && w.actualRowCount > 0);
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (r) => {
    const cells: string[] = [];
    for (let c = 1; c <= Math.min(r.cellCount, 20); c++) cells.push(r.getCell(c).text ?? '');
    rows.push(cells);
  });
  return rows;
}

/** Works out which column is which from a header row, if the sheet has one. */
function columns(rows: string[][]): { start: number; name: number; category: number; gps: number } {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const h = rows[i].map(norm);
    const name = h.findIndex((c) => /workplace|school|unit|institution|name/.test(c) && !/chair|local|district/.test(c));
    if (name === -1) continue;
    const category = h.findIndex((c) => /categor|type/.test(c));
    const gps = h.findIndex((c) => /gps|digitaladdress|ghanapost|address/.test(c));
    return { start: i + 1, name, category, gps };
  }
  return { start: 0, name: 0, category: 1, gps: 2 };
}

export async function parseUnitsFile(buf: Buffer): Promise<{ units: ImportedUnit[]; notes: string[] }> {
  if (!buf?.length) throw new HttpError(400, 'The file is empty.');
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b; // "PK": .xlsx is a zip
  if (!isZip && buf.subarray(0, 8).includes(0)) {
    throw new HttpError(400, 'Old .xls files are not supported. In Excel choose File → Save As → Excel Workbook (.xlsx).');
  }
  const rows = isZip ? await readXlsx(buf) : parseCsv(buf.toString('utf8').replace(/^\uFEFF/, ''));
  const col = columns(rows);
  const units: ImportedUnit[] = [];
  const notes: string[] = [];
  const seen = new Set<string>();
  let dupes = 0;
  let badGps = 0;
  let unknownCat = 0;
  for (const r of rows.slice(col.start)) {
    const name = (r[col.name] ?? '').trim().replace(/\s+/g, ' ');
    if (name.length < 2) continue;
    if (name.length > 150) {
      notes.push(`Skipped a name longer than 150 characters: “${name.slice(0, 40)}…”`);
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      dupes++;
      continue;
    }
    seen.add(key);
    const rawCat = col.category >= 0 ? (r[col.category] ?? '').trim() : '';
    const category = matchCategory(rawCat);
    if (rawCat && !category) unknownCat++;
    const rawGps = col.gps >= 0 ? (r[col.gps] ?? '').trim() : '';
    const gpsAddress = rawGps ? normalizeGps(rawGps) : null;
    if (rawGps && !gpsAddress) badGps++;
    units.push({ name, category, gpsAddress });
    if (units.length > MAX_UNITS_PER_LOCAL) {
      throw new HttpError(
        400,
        `The file has more than ${MAX_UNITS_PER_LOCAL} workplaces. A local can hold at most ${MAX_UNITS_PER_LOCAL}.`,
      );
    }
  }
  if (!units.length) throw new HttpError(400, 'No workplace names were found. Put one name per row in the first column.');
  if (dupes) notes.push(`${dupes} repeated name${dupes === 1 ? ' was' : 's were'} skipped.`);
  if (unknownCat) notes.push(`${unknownCat} categor${unknownCat === 1 ? 'y was' : 'ies were'} not recognised. Choose them below.`);
  if (badGps)
    notes.push(
      `${badGps} GPS address${badGps === 1 ? ' was' : 'es were'} not in the AK-039-5028 format and ${badGps === 1 ? 'was' : 'were'} left blank.`,
    );
  return { units, notes };
}

/** The spreadsheet chairmen can fill in: a category dropdown and a GPS column. */
export async function sendUnitsTemplate(res: Response) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GNAT Mapping';
  const ws = wb.addWorksheet('Workplaces');
  ws.columns = [
    { header: 'Workplace name', key: 'name', width: 42 },
    { header: 'Category', key: 'category', width: 42 },
    { header: 'Ghana Post GPS address (optional)', key: 'gps', width: 30 },
  ];
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const lists = wb.addWorksheet('Categories', { state: 'veryHidden' });
  WORKPLACE_CATEGORIES.forEach((c, i) => (lists.getCell(i + 1, 1).value = c));
  for (let r = 2; r <= MAX_UNITS_PER_LOCAL + 1; r++) {
    ws.getCell(r, 2).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Categories!$A$1:$A$${WORKPLACE_CATEGORIES.length}`],
      showErrorMessage: true,
      errorTitle: 'Category',
      error: 'Choose a category from the list.',
    };
  }

  const help = wb.addWorksheet('How to fill');
  help.columns = [{ width: 100 }];
  [
    'GNAT Mapping: workplaces template',
    '',
    '1. On the "Workplaces" sheet, put one school or workplace per row.',
    '2. Choose its category from the dropdown. You can also leave it blank and choose on the website.',
    '3. The Ghana Post GPS address (e.g. AK-039-5028) is optional.',
    '4. Save the file, then on the website open your local and tap "Import from Excel".',
    '',
    'You will see the list before anything is saved, and you can still edit it.',
  ].forEach((t, i) => (help.getCell(i + 1, 1).value = t));
  help.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF0369A1' } };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="GNAT_Workplaces_Template.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}
