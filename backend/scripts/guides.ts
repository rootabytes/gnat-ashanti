// Makes the printable role guides (A4 PDFs) from frontend/src/lib/guides.ts, the same text
// as the on-screen guide. Output goes to frontend/public/guides/, so the website serves them.
//   npm --prefix backend run guides
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { guidesFor, GUIDES_UPDATED } from '../../frontend/src/lib/guides';
import { MAIN_REGION, REGION_SITES } from '../../frontend/src/lib/sites';
import type { Guide } from '../../frontend/src/lib/guides';

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, '..', 'frontend', 'public');
const FONTS = path.join(ROOT, 'assets', 'fonts');
const LOGO = path.join(ROOT, 'assets', 'gnat-logo.png');

const SKY = '#0369A1';
const SKY_BRIGHT = '#0EA5E9';
const SKY_LIGHT = '#E0F2FE';
const RED = '#E0302A';
const INK = '#1F2430';
const GREY = '#5B5B6E';

const updated = new Date(`${GUIDES_UPDATED}T12:00:00Z`);
const updatedLabel = updated.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function makeGuide(g: Guide, guides: Record<string, Guide>) {
  const file = path.join(PUBLIC, g.pdf);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 42, bottom: 46, left: 48, right: 48 },
    bufferPages: true,
    // Fixed dates so re-running the script only changes a PDF when its text changes.
    info: {
      Title: `GNAT Mapping: ${g.name} guide`,
      Author: 'GNAT Mapping',
      Creator: 'Rootabytes',
      CreationDate: updated,
      ModDate: updated,
    },
  });
  const out = fs.createWriteStream(file);
  doc.pipe(out);
  doc.registerFont('Inter', path.join(FONTS, 'Inter-400.woff'));
  doc.registerFont('Inter-Semi', path.join(FONTS, 'Inter-600.woff'));
  doc.registerFont('Inter-Bold', path.join(FONTS, 'Inter-700.woff'));

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;

  // Header: logo, names, GNAT colour bar.
  doc.image(LOGO, left, 36, { width: 56 });
  doc
    .font('Inter-Bold')
    .fontSize(11)
    .fillColor(SKY)
    .text('Ghana National Association of Teachers', left + 70, 42);
  doc
    .font('Inter-Bold')
    .fontSize(21)
    .fillColor(INK)
    .text(`${g.name} guide`, left + 70, 58);
  doc
    .font('Inter')
    .fontSize(10)
    .fillColor(RED)
    .text('GNAT Structure Mapping', left + 70, 86);
  doc
    .rect(left, 106, width * 0.75, 3)
    .fillColor(SKY_BRIGHT)
    .fill();
  doc
    .rect(left + width * 0.75, 106, width * 0.25, 3)
    .fillColor(RED)
    .fill();

  doc.font('Inter-Semi').fontSize(12).fillColor(INK).text(g.summary, left, 124, { width });
  doc.moveDown(0.3);
  doc
    .font('Inter')
    .fontSize(10)
    .fillColor(GREY)
    .text(`Website: ${g.site}${g.role === 'admin' || g.role === 'super' ? '/admin' : ''}`, { width });
  doc.moveDown(0.7);

  // Numbered steps.
  const numW = 26;
  const textX = left + numW + 12;
  const textW = width - numW - 12;
  g.steps.forEach((s, i) => {
    doc.font('Inter-Bold').fontSize(12);
    const titleH = doc.heightOfString(s.title, { width: textW });
    doc.font('Inter').fontSize(10.5);
    const bodyH = doc.heightOfString(s.body, { width: textW, lineGap: 2 });
    if (doc.y + titleH + bodyH + 8 > bottom()) doc.addPage();
    const y = doc.y;
    doc
      .circle(left + numW / 2, y + numW / 2 - 4, numW / 2)
      .fillColor(SKY)
      .fill();
    doc
      .font('Inter-Bold')
      .fontSize(12)
      .fillColor('#FFFFFF')
      .text(String(i + 1), left, y + 2, { width: numW, align: 'center' });
    doc.font('Inter-Bold').fontSize(12).fillColor(INK).text(s.title, textX, y, { width: textW });
    doc.moveDown(0.15);
    doc.font('Inter').fontSize(10.5).fillColor('#333844').text(s.body, textX, doc.y, { width: textW, lineGap: 2 });
    doc.y = Math.max(doc.y, y + numW) + 8;
  });

  // Tips box.
  const pad = 14;
  const tipW = width - pad * 2 - 14;
  doc.font('Inter').fontSize(10.5);
  const tipsH = g.tips.reduce((h, t) => h + doc.heightOfString(t, { width: tipW, lineGap: 2 }) + 6, 0);
  const related = g.related ? guides[g.related] : null;
  const boxH = pad * 2 + 20 + tipsH + (related ? 22 : 0);
  if (doc.y + boxH > bottom()) doc.addPage();
  const by = doc.y + 4;
  doc.roundedRect(left, by, width, boxH, 6).fillColor(SKY_LIGHT).fill();
  doc
    .font('Inter-Bold')
    .fontSize(12)
    .fillColor(SKY)
    .text('Good to know', left + pad, by + pad);
  let ty = by + pad + 22;
  for (const t of g.tips) {
    doc
      .circle(left + pad + 3, ty + 6, 2.2)
      .fillColor(SKY)
      .fill();
    doc
      .font('Inter')
      .fontSize(10.5)
      .fillColor('#333844')
      .text(t, left + pad + 14, ty, { width: tipW, lineGap: 2 });
    ty = doc.y + 6;
  }
  if (related) {
    doc
      .font('Inter-Semi')
      .fontSize(10.5)
      .fillColor(SKY)
      .text(`See also the ${related.name} guide.`, left + pad, ty + 2, { width: tipW });
  }

  // Footer on every page.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const fy = doc.page.height - 32;
    doc.page.margins.bottom = 0; // let the footer sit inside the bottom margin without a page break
    doc
      .font('Inter')
      .fontSize(8.5)
      .fillColor(GREY)
      .text(`GNAT Mapping · ${g.name} guide · Updated ${updatedLabel} · Built by Rootabytes · Page ${i + 1} of ${range.count}`, left, fy, {
        width,
        align: 'center',
        lineBreak: false,
      });
  }
  doc.end();
  return new Promise<string>((resolve, reject) => out.on('finish', () => resolve(file)).on('error', reject));
}

async function main() {
  // One set per region address (Eastern's in guides/eastern/); the super admin's guide only once.
  for (const code of Object.keys(REGION_SITES)) {
    const guides = guidesFor(code);
    for (const g of Object.values(guides)) {
      if (g.role === 'super' && code !== MAIN_REGION) continue;
      const file = await makeGuide(g, guides);
      console.log(`✓ ${path.relative(path.join(ROOT, '..'), file)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
