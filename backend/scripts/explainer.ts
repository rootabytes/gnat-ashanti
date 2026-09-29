// Makes "How GNAT Mapping works", a two-page A4 PDF for the Regional Secretary: page 1 is who adds
// whom and what each person does, page 2 answers plain questions about the data. Same look as the
// role guides. Keep it true to what the code does, like the privacy notice (frontend/src/pages/Privacy.tsx),
// and name buttons exactly as they appear on screen.
//   npm --prefix backend run guides
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { GUIDES_UPDATED, SITE } from '../../frontend/src/lib/guides';
import { IN_KIND, ROOTABYTES } from '../../frontend/src/lib/org';

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, '..', 'frontend', 'public', 'guides', 'GNAT-Mapping-How-It-Works.pdf');
const FONTS = path.join(ROOT, 'assets', 'fonts');
const LOGO = path.join(ROOT, 'assets', 'gnat-logo.png');

const SKY = '#0369A1';
const SKY_BRIGHT = '#0EA5E9';
const SKY_LIGHT = '#E0F2FE';
const RED = '#E0302A';
const RED_LIGHT = '#FDECEB';
const INK = '#1F2430';
const BODY = '#333844';
const GREY = '#5B5B6E';
const LINE = '#D5DCE6';

const updated = new Date(`${GUIDES_UPDATED}T12:00:00Z`);
const updatedLabel = updated.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

interface Rung {
  who: string;
  /** "You" rungs are the Regional Secretary's own jobs, drawn in red. */
  you?: boolean;
  does: string;
  how: string;
}

const LADDER: Rung[] = [
  {
    who: 'You, the Regional Secretary',
    you: true,
    does: 'Add the District Secretaries',
    how: 'Tap Add District Secretary. Enter the GNAT district, the secretary’s name and WhatsApp number, then send them the code that appears.',
  },
  {
    who: 'Each District Secretary',
    does: 'Adds their Local Secretaries',
    how: 'Opens their code, ticks the political districts the GNAT district covers, then taps Add Local Secretary for each local and sends each code.',
  },
  {
    who: 'Each Local Secretary',
    does: 'Lists the schools and workplaces',
    how: 'Opens their code, types each workplace (or imports an Excel sheet) and taps Submit local.',
  },
  {
    who: 'You, the Regional Secretary',
    you: true,
    does: 'Check, approve and download',
    how: 'Open each submitted district. Approve it, or return it with a note saying what to fix. Downloads gives Excel, CSV and a PDF report.',
  },
];

const COLLECTED: [string, string][] = [
  ['District and Local Secretaries', 'Name and phone number.'],
  ['Workplaces', 'Name, category and Ghana Post GPS address (if given).'],
  ['Admins (you)', 'Name, phone number, email address and password.'],
  ['Activity', 'Who changed or downloaded what, and when.'],
];

const PROTECTED = [
  'Everything travels encrypted between the phone and the system.',
  'Access codes and passwords are stored scrambled. Nobody can read a password, not even Rootabytes.',
  'A code that is reset or removed stops working at once.',
  'Repeated wrong codes or passwords are blocked for a while.',
  'A copy of the database is saved every day.',
];

const ACCESS: [string, string][] = [
  ['You and your region’s admins', 'Everything in your region. Nothing from other regions.'],
  ['District Secretary', 'Their own district and its locals.'],
  ['Local Secretary', 'Their own local only.'],
  ['Rootabytes (super admin)', 'Runs the system. It is not shown any regional data.'],
];

const YOUR_PART = [
  'Keep downloads within GNAT: they contain names and phone numbers.',
  'Send each code only to the person it is for, and remove secretaries who leave.',
];

function main() {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 42, bottom: 50, left: 48, right: 48 },
    bufferPages: true,
    info: {
      Title: 'GNAT Mapping: how it works',
      Author: 'GNAT Ashanti Region',
      Creator: 'Rootabytes',
      CreationDate: updated,
      ModDate: updated,
    },
  });
  const out = fs.createWriteStream(FILE);
  doc.pipe(out);
  doc.registerFont('Inter', path.join(FONTS, 'Inter-400.woff'));
  doc.registerFont('Inter-Semi', path.join(FONTS, 'Inter-600.woff'));
  doc.registerFont('Inter-Bold', path.join(FONTS, 'Inter-700.woff'));

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;

  const header = (title: string, sub: string) => {
    doc.image(LOGO, left, 36, { width: 56 });
    doc
      .font('Inter-Bold')
      .fontSize(11)
      .fillColor(SKY)
      .text('Ghana National Association of Teachers', left + 70, 42);
    doc
      .font('Inter-Bold')
      .fontSize(22)
      .fillColor(INK)
      .text(title, left + 70, 57);
    doc
      .font('Inter')
      .fontSize(11)
      .fillColor(RED)
      .text(sub, left + 70, 86);
    doc
      .rect(left, 108, width * 0.75, 3)
      .fillColor(SKY_BRIGHT)
      .fill();
    doc
      .rect(left + width * 0.75, 108, width * 0.25, 3)
      .fillColor(RED)
      .fill();
    doc.x = left;
    doc.y = 126;
  };

  const heading = (text: string) => {
    doc.moveDown(0.8);
    const y = doc.y;
    doc
      .rect(left, y + 2, 4, 15)
      .fillColor(RED)
      .fill();
    doc
      .font('Inter-Bold')
      .fontSize(14.5)
      .fillColor(SKY)
      .text(text, left + 12, y, { width: width - 12 });
    doc.x = left;
    doc.moveDown(0.3);
  };

  const para = (text: string, color = BODY) => {
    doc.font('Inter').fontSize(11).fillColor(color).text(text, left, doc.y, { width, lineGap: 2.5 });
  };

  const bullets = (items: string[]) => {
    for (const t of items) {
      doc.font('Inter').fontSize(11);
      if (doc.y + doc.heightOfString(t, { width: width - 16, lineGap: 2.5 }) > bottom()) doc.addPage();
      const y = doc.y;
      doc
        .circle(left + 4, y + 7, 2.6)
        .fillColor(SKY)
        .fill();
      doc
        .font('Inter')
        .fontSize(11)
        .fillColor(BODY)
        .text(t, left + 16, y, { width: width - 16, lineGap: 2.5 });
      doc.y += 3;
    }
    doc.x = left;
  };

  const table = (rows: [string, string][], kw = 175) => {
    const vw = width - kw - 20;
    rows.forEach(([k, v], i) => {
      doc.font('Inter').fontSize(11);
      const vh = doc.heightOfString(v, { width: vw, lineGap: 2 });
      doc.font('Inter-Semi');
      const h = Math.max(vh, doc.heightOfString(k, { width: kw - 8 })) + 10;
      const y = doc.y;
      if (i % 2 === 0) doc.rect(left, y, width, h).fillColor('#F4F9FD').fill();
      doc
        .font('Inter-Semi')
        .fontSize(11)
        .fillColor(INK)
        .text(k, left + 8, y + 5, { width: kw - 8 });
      doc
        .font('Inter')
        .fontSize(11)
        .fillColor(BODY)
        .text(v, left + kw + 12, y + 5, { width: vw, lineGap: 2 });
      doc
        .moveTo(left, y + h)
        .lineTo(left + width, y + h)
        .lineWidth(0.6)
        .strokeColor(LINE)
        .stroke();
      doc.y = y + h;
    });
    doc.x = left;
  };

  // ---------- Page 1: who does what ----------
  header('How GNAT Mapping works', 'For the Regional Secretary');
  doc
    .font('Inter-Semi')
    .fontSize(12.5)
    .fillColor(INK)
    .text(
      'The system builds GNAT’s map of the region: its districts, locals, and the schools and workplaces in each. It starts with you adding people, one level at a time.',
      left,
      doc.y,
      { width, lineGap: 2.5 },
    );

  heading('Who does what, in order');
  const numW = 30;
  const cardX = left + numW + 12;
  const cardW = width - numW - 12;
  const pad = 10;
  LADDER.forEach((r, i) => {
    const colour = r.you ? RED : SKY;
    doc.font('Inter').fontSize(10.5);
    const howH = doc.heightOfString(r.how, { width: cardW - pad * 2, lineGap: 2 });
    const h = pad + 14 + 19 + howH + pad;
    const y = doc.y;
    doc
      .roundedRect(cardX, y, cardW, h, 6)
      .fillColor(r.you ? RED_LIGHT : SKY_LIGHT)
      .fill();
    doc
      .circle(left + numW / 2, y + h / 2, numW / 2)
      .fillColor(colour)
      .fill();
    doc
      .font('Inter-Bold')
      .fontSize(14)
      .fillColor('#FFFFFF')
      .text(String(i + 1), left, y + h / 2 - 9, { width: numW, align: 'center' });
    doc
      .font('Inter-Semi')
      .fontSize(9.5)
      .fillColor(r.you ? '#B42318' : SKY)
      .text(r.who.toUpperCase(), cardX + pad, y + pad, { width: cardW - pad * 2, characterSpacing: 0.4 });
    doc
      .font('Inter-Bold')
      .fontSize(14)
      .fillColor(INK)
      .text(r.does, cardX + pad, y + pad + 14, { width: cardW - pad * 2 });
    doc
      .font('Inter')
      .fontSize(10.5)
      .fillColor(BODY)
      .text(r.how, cardX + pad, y + pad + 33, { width: cardW - pad * 2, lineGap: 2 });
    doc.y = y + h;
    if (i < LADDER.length - 1) {
      // a short down arrow between the steps
      const ax = left + numW / 2;
      doc
        .moveTo(ax, doc.y + 1)
        .lineTo(ax, doc.y + 9)
        .lineWidth(1.6)
        .strokeColor(GREY)
        .stroke();
      doc
        .polygon([ax - 4, doc.y + 8], [ax + 4, doc.y + 8], [ax, doc.y + 13])
        .fillColor(GREY)
        .fill();
      doc.y += 15;
    }
  });
  doc.x = left;

  heading('Where each form is');
  const chips: [string, string][] = [
    ['In progress', '#5B5B6E'],
    ['Submitted', '#6D28D9'],
    ['Approved', '#15803D'],
  ];
  let cx = left;
  const cy = doc.y + 2;
  doc.font('Inter-Semi').fontSize(11);
  chips.forEach(([label, colour], i) => {
    const w = doc.widthOfString(label) + 22;
    doc.roundedRect(cx, cy, w, 24, 12).fillColor(colour).fill();
    doc
      .font('Inter-Semi')
      .fontSize(11)
      .fillColor('#FFFFFF')
      .text(label, cx, cy + 6, { width: w, align: 'center', lineBreak: false });
    cx += w;
    if (i < chips.length - 1) {
      doc
        .font('Inter-Bold')
        .fontSize(13)
        .fillColor(GREY)
        .text('›', cx + 6, cy + 3, { lineBreak: false });
      cx += 22;
    }
  });
  doc.x = left;
  doc.y = cy + 34;
  para(
    'A submitted form is locked while you check it. A returned form goes back with your note for the secretary to fix and submit again. An approved district is final.',
  );

  heading('When a secretary changes');
  para(
    'Tap Remove secretary: their code stops working at once, and everything already filled in is kept. Then tap Add secretary and send the new person their code. District Secretaries do the same for their Local Secretaries.',
  );

  // Who pays: nobody at GNAT Ashanti. Two small lines fit in the space left on page 1.
  doc.moveDown(0.2);
  doc
    .font('Inter')
    .fontSize(9)
    .fillColor(GREY)
    .text(
      `At no cost to ${IN_KIND.partner}: ${ROOTABYTES.name}’ in-kind contribution to their partnership, in recognition of ${IN_KIND.partner}’s endorsement of ${IN_KIND.app}. More: ${SITE}/about`,
      left,
      doc.y,
      { width, lineGap: 1.5 },
    );

  // ---------- Page 2: the data ----------
  doc.addPage();
  header('Your data, in plain words', 'How it is collected, kept and protected');
  const qa = (q: string) => {
    doc.moveDown(0.55);
    doc.font('Inter-Bold').fontSize(13).fillColor(SKY).text(q, left, doc.y, { width });
    doc.moveDown(0.25);
  };

  qa('What is collected?');
  table(COLLECTED);
  doc.moveDown(0.35);
  para('Nothing else: no ID numbers, photos, locations of people, adverts or tracking.', GREY);

  qa('Where is it kept?');
  para(
    'Secretaries type everything on their phones and it goes straight into one database run by Railway. The website is delivered by Cloudflare. Their secure servers are outside Ghana.',
  );

  qa('How is it protected?');
  bullets(PROTECTED);

  qa('Who can see it?');
  table(ACCESS);

  qa('How long is it kept?');
  para(
    'Secretaries’ names and phone numbers are deleted or anonymised within 12 months after you approve the final structure. The approved list of districts, locals and workplaces is kept as GNAT’s record.',
  );

  qa('What is my part?');
  bullets(YOUR_PART);

  if (doc.y + 40 > bottom()) doc.addPage();
  doc.moveDown(0.6);
  doc
    .font('Inter')
    .fontSize(9.5)
    .fillColor(GREY)
    .text(
      `Built and run by ${ROOTABYTES.legalName}, ${ROOTABYTES.location}, registered with the Data Protection Commission of Ghana${
        ROOTABYTES.dpcRegistration ? ` (${ROOTABYTES.dpcRegistration})` : ''
      } under the Data Protection Act, 2012 (Act 843). Questions: ${ROOTABYTES.dpoEmail} or ${ROOTABYTES.phone}. Privacy notice: ${SITE}/privacy`,
      left,
      doc.y,
      { width, lineGap: 1.5 },
    );

  // Footer on every page.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0; // let the footer sit inside the bottom margin without a page break
    doc
      .font('Inter')
      .fontSize(8.5)
      .fillColor(GREY)
      .text(
        `GNAT Mapping · How it works · Updated ${updatedLabel} · Built by Rootabytes · Page ${i + 1} of ${range.count}`,
        left,
        doc.page.height - 32,
        { width, align: 'center', lineBreak: false },
      );
  }
  doc.end();
  return new Promise<void>((resolve, reject) => out.on('finish', resolve).on('error', reject));
}

main()
  .then(() => console.log(`✓ ${path.relative(path.join(ROOT, '..'), FILE)}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
