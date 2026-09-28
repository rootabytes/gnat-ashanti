import ExcelJS from 'exceljs';
import path from 'node:path';
import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { flatRows, overview } from './analytics';
import { CATEGORY_LABELS, WorkplaceCategory } from './reference';

const NAVY = '25256B';
const RED = 'E0302A';
const STATUS_LABEL: Record<string, string> = { draft: 'In progress', submitted: 'Submitted', returned: 'Returned', approved: 'Approved' };

const fmtDate = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const stamp = () => new Date().toISOString().slice(0, 10);
const safe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '_');

function styleHeader(ws: ExcelJS.Worksheet) {
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } };
  h.alignment = { vertical: 'middle' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}

export async function sendXlsx(res: Response, regionId: number, regionName: string) {
  const [data, ov] = await Promise.all([flatRows(regionId), overview(regionId)]);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GNAT Mapping';
  wb.created = new Date();

  const sum = wb.addWorksheet('Summary');
  sum.columns = [{ width: 42 }, { width: 16 }];
  sum.addRow([`GNAT ${regionName} Region: Mapping Summary`]).font = { bold: true, size: 14, color: { argb: `FF${NAVY}` } };
  sum.addRow([`Generated ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Accra' })}`]);
  sum.addRow([]);
  const kv: [string, number | string][] = [
    ['GNAT districts registered', ov.totals.districts],
    ['  of which submitted or approved', ov.districtStatus.submitted + ov.districtStatus.approved],
    ['GNAT locals', ov.totals.locals],
    ['  of which submitted or approved', ov.localStatus.submitted + ov.localStatus.approved],
    ['Basic units / workplaces', ov.totals.units],
    ['Political districts covered', `${ov.totals.politicalCovered} of ${ov.totals.politicalDistricts}`],
  ];
  kv.forEach((r) => sum.addRow(r));
  sum.addRow([]);
  sum.addRow(['Workplaces by category', 'Count']).font = { bold: true };
  ov.unitsByCategory.forEach((c) => sum.addRow([c.label, c.count]));

  const ds = wb.addWorksheet('GNAT Districts');
  ds.columns = [
    { header: 'GNAT District', key: 'name', width: 28 },
    { header: 'Political Admin. District(s)', key: 'political', width: 48 },
    { header: 'Chairman', key: 'chair_name', width: 24 },
    { header: 'Phone', key: 'chair_phone', width: 16 },
    { header: 'Name / Group', key: 'chair_group', width: 22 },
    { header: 'Locals', key: 'locals', width: 8 },
    { header: 'Workplaces', key: 'units', width: 11 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Verified', key: 'verified', width: 9 },
    { header: 'Submitted', key: 'submitted_at', width: 12 },
    { header: 'Remarks', key: 'remarks', width: 40 },
  ];
  data.districts.forEach((d) =>
    ds.addRow({ ...d, status: STATUS_LABEL[d.status], verified: d.verified ? 'Yes' : 'No', submitted_at: fmtDate(d.submitted_at) }),
  );
  styleHeader(ds);

  const mp = wb.addWorksheet('District Mapping');
  mp.columns = [
    { header: 'GNAT District', key: 'district', width: 28 },
    { header: 'Political Admin. District', key: 'political', width: 30 },
    { header: 'Type', key: 'kind', width: 14 },
  ];
  data.mapping.forEach((r) => mp.addRow(r));
  styleHeader(mp);

  const ls = wb.addWorksheet('GNAT Locals');
  ls.columns = [
    { header: 'GNAT District', key: 'district', width: 28 },
    { header: 'GNAT Local', key: 'name', width: 28 },
    { header: 'Chairman', key: 'chair_name', width: 24 },
    { header: 'Phone', key: 'chair_phone', width: 16 },
    { header: 'Workplaces', key: 'units', width: 11 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Submitted', key: 'submitted_at', width: 12 },
    { header: 'Remarks', key: 'remarks', width: 40 },
  ];
  data.locals.forEach((l) => ls.addRow({ ...l, status: STATUS_LABEL[l.status], submitted_at: fmtDate(l.submitted_at) }));
  styleHeader(ls);

  const us = wb.addWorksheet('Basic Units');
  us.columns = [
    { header: 'GNAT Region', key: 'region', width: 14 },
    { header: 'GNAT District', key: 'district', width: 28 },
    { header: 'GNAT Local', key: 'local', width: 28 },
    { header: 'Basic Unit / Workplace', key: 'name', width: 42 },
    { header: 'Category', key: 'category', width: 40 },
  ];
  data.units.forEach((u) =>
    us.addRow({ ...u, region: regionName, category: CATEGORY_LABELS[u.category as WorkplaceCategory] ?? u.category }),
  );
  styleHeader(us);

  const cv = wb.addWorksheet('Coverage');
  cv.columns = [
    { header: 'Political Admin. District', key: 'name', width: 30 },
    { header: 'Type', key: 'kind', width: 14 },
    { header: 'GNAT District(s)', key: 'gnat', width: 48 },
    { header: 'Covered', key: 'covered', width: 10 },
  ];
  ov.coverage.forEach((c) =>
    cv.addRow({ name: c.name, kind: c.kind, gnat: c.gnatDistricts.join('; '), covered: c.gnatDistricts.length ? 'Yes' : 'NO' }),
  );
  styleHeader(cv);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="GNAT_${safe(regionName)}_Mapping_${stamp()}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  // Leading =,+,-,@ would run as a formula when opened in Excel.
  const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export async function sendCsv(res: Response, regionId: number, regionName: string, level: string) {
  const data = await flatRows(regionId);
  let header: string[];
  let rows: unknown[][];
  if (level === 'districts') {
    header = ['GNAT District', 'Political Admin. District(s)', 'Chairman', 'Phone', 'Name / Group', 'Locals', 'Workplaces', 'Status', 'Submitted'];
    rows = data.districts.map((d) => [d.name, d.political, d.chair_name, d.chair_phone, d.chair_group, d.locals, d.units, STATUS_LABEL[d.status], fmtDate(d.submitted_at)]);
  } else if (level === 'locals') {
    header = ['GNAT District', 'GNAT Local', 'Chairman', 'Phone', 'Workplaces', 'Status', 'Submitted'];
    rows = data.locals.map((l) => [l.district, l.name, l.chair_name, l.chair_phone, l.units, STATUS_LABEL[l.status], fmtDate(l.submitted_at)]);
  } else {
    header = ['GNAT Region', 'GNAT District', 'GNAT Local', 'Basic Unit / Workplace', 'Category'];
    rows = data.units.map((u) => [regionName, u.district, u.local, u.name, CATEGORY_LABELS[u.category as WorkplaceCategory] ?? u.category]);
    level = 'units';
  }
  const body = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="GNAT_${safe(regionName)}_${level}_${stamp()}.csv"`);
  res.send('﻿' + body); // BOM so Excel opens it as UTF-8
}

export async function sendPdf(res: Response, regionId: number, regionName: string) {
  const [data, ov] = await Promise.all([flatRows(regionId), overview(regionId)]);
  const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true, info: { Title: `GNAT ${regionName} Mapping Report` } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="GNAT_${safe(regionName)}_Mapping_Report_${stamp()}.pdf"`);
  doc.pipe(res);

  const navy = `#${NAVY}`;
  const red = `#${RED}`;
  const grey = '#5B5B6E';
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  const logo = path.join(__dirname, '..', 'assets', 'gnat-logo.png');
  if (fs.existsSync(logo)) doc.image(logo, left, 36, { width: 58 });
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(18).text('Ghana National Association of Teachers', left + 72, 44);
  doc.fontSize(13).fillColor(red).text(`${regionName} Region: Structure Mapping Report`, left + 72, 68);
  doc.font('Helvetica').fontSize(9).fillColor(grey)
    .text(`Generated ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Accra' })}`, left + 72, 88);
  doc.moveTo(left, 112).lineTo(left + width, 112).strokeColor(navy).lineWidth(1.2).stroke();
  doc.y = 124;

  // KPI tiles
  const tiles: [string, string][] = [
    ['GNAT Districts', String(ov.totals.districts)],
    ['GNAT Locals', String(ov.totals.locals)],
    ['Workplaces', String(ov.totals.units)],
    ['Political districts covered', `${ov.totals.politicalCovered}/${ov.totals.politicalDistricts}`],
  ];
  const tw = (width - 18) / 4;
  const ty = doc.y;
  tiles.forEach(([label, value], i) => {
    const x = left + i * (tw + 6);
    doc.roundedRect(x, ty, tw, 54, 4).fillColor('#F1F1F8').fill();
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(20).text(value, x + 10, ty + 8, { width: tw - 20 });
    doc.fillColor(grey).font('Helvetica').fontSize(8.5).text(label, x + 10, ty + 34, { width: tw - 20 });
  });
  doc.y = ty + 70;

  const section = (title: string) => {
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.moveDown(0.4).fillColor(navy).font('Helvetica-Bold').fontSize(12).text(title, left);
    doc.moveDown(0.3);
  };

  section('Submission progress');
  const prog: [string, Record<string, number>][] = [['Districts', ov.districtStatus], ['Locals', ov.localStatus]];
  prog.forEach(([label, s]) => {
    doc.font('Helvetica').fontSize(9.5).fillColor('#222')
      .text(`${label}: ${s.approved} approved, ${s.submitted} submitted, ${s.returned} returned, ${s.draft} in progress`, left);
  });

  section('Workplaces by category');
  const maxCat = Math.max(1, ...ov.unitsByCategory.map((c) => c.count));
  const labelW = 170;
  const barMax = width - labelW - 40;
  for (const c of ov.unitsByCategory) {
    const y = doc.y;
    doc.font('Helvetica').fontSize(8.5).fillColor('#222').text(c.category, left, y, { width: labelW - 6, lineBreak: false });
    const w = (c.count / maxCat) * barMax;
    if (w > 0) doc.rect(left + labelW, y + 1, w, 8).fillColor(navy).fill();
    doc.fillColor('#222').text(String(c.count), left + labelW + w + 4, y, { lineBreak: false });
    doc.y = y + 13;
  }

  section('GNAT districts');
  const cols = [
    { h: 'GNAT District', w: 120 },
    { h: 'Political Admin. District(s)', w: 170 },
    { h: 'Locals', w: 42 },
    { h: 'Workplaces', w: 58 },
    { h: 'Status', w: width - 390 },
  ];
  const drawHead = () => {
    const y = doc.y;
    doc.rect(left, y, width, 16).fillColor(navy).fill();
    let x = left;
    cols.forEach((c) => {
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8.5).text(c.h, x + 4, y + 4, { width: c.w - 8, lineBreak: false });
      x += c.w;
    });
    doc.y = y + 18;
  };
  drawHead();
  data.districts.forEach((d, i) => {
    const cells = [d.name, d.political || '(none selected)', String(d.locals), String(d.units), STATUS_LABEL[d.status]];
    doc.font('Helvetica').fontSize(8.5);
    const h = Math.max(...cells.map((c, j) => doc.heightOfString(c, { width: cols[j].w - 8 }))) + 6;
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHead();
    }
    const y = doc.y;
    if (i % 2 === 1) doc.rect(left, y, width, h).fillColor('#F6F6FA').fill();
    let x = left;
    cells.forEach((c, j) => {
      doc.fillColor('#222').text(c, x + 4, y + 3, { width: cols[j].w - 8 });
      x += cols[j].w;
    });
    doc.y = y + h;
  });
  if (!data.districts.length) doc.font('Helvetica-Oblique').fontSize(9).fillColor(grey).text('No districts registered yet.', left);

  const gaps = ov.coverage.filter((c) => !c.gnatDistricts.length);
  section(`Political districts not yet covered (${gaps.length})`);
  doc.font('Helvetica').fontSize(9).fillColor('#222')
    .text(gaps.length ? gaps.map((g) => `${g.name} (${g.kind})`).join(', ') : 'All political districts are covered.', left, doc.y, { width });

  // Appendix: full structure
  doc.addPage();
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(14).text('Appendix: Full structure', left);
  doc.moveDown(0.5);
  const unitsByLocal = new Map<string, { name: string; category: string }[]>();
  data.units.forEach((u) => {
    const k = `${u.district}\u0000${u.local}`;
    if (!unitsByLocal.has(k)) unitsByLocal.set(k, []);
    unitsByLocal.get(k)!.push(u);
  });
  for (const d of data.districts) {
    if (doc.y > doc.page.height - 120) doc.addPage();
    doc.moveDown(0.4).fillColor(red).font('Helvetica-Bold').fontSize(11).text(`${d.name}  `, left, doc.y, { continued: true })
      .fillColor(grey).font('Helvetica').fontSize(8.5).text(`${STATUS_LABEL[d.status]} · Chairman: ${d.chair_name ?? '-'}`);
    if (d.political) doc.fillColor(grey).fontSize(8.5).text(`Covers: ${d.political}`, left, doc.y, { width });
    for (const l of data.locals.filter((x) => x.district === d.name)) {
      if (doc.y > doc.page.height - 80) doc.addPage();
      doc.moveDown(0.2).fillColor(navy).font('Helvetica-Bold').fontSize(9.5).text(`${l.name}`, left + 12, doc.y, { continued: true })
        .fillColor(grey).font('Helvetica').fontSize(8).text(`   ${STATUS_LABEL[l.status]} · ${l.units} workplace(s)`);
      const us = unitsByLocal.get(`${d.name}\u0000${l.name}`) ?? [];
      doc.fillColor('#222').font('Helvetica').fontSize(8.5);
      for (const u of us) {
        if (doc.y > doc.page.height - 60) doc.addPage();
        doc.text(`• ${u.name}  `, left + 24, doc.y, { continued: true, width: width - 24 }).fillColor(grey).text(`(${u.category})`).fillColor('#222');
      }
    }
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7.5).fillColor(grey)
      .text(`GNAT ${regionName} · Mapping Report · Page ${i + 1} of ${range.count}`, left, doc.page.height - 28, { width, align: 'center' });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
}
