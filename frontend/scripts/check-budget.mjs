// Performance budget: what a chairman's phone downloads to open the form.
// Sums the gzipped entry script, the scripts it preloads and the CSS, as linked
// from dist/index.html. Lazy pages (admin, privacy, about, demo) are not counted.
// Run after `npm run build`; exits 1 when over budget.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const BUDGET_KB = { js: 110, css: 12 };
const dist = path.join(import.meta.dirname, '..', 'dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(js|css))"/g)].map((m) => ({ file: m[1], kind: m[2] }));
if (!refs.some((r) => r.kind === 'js')) {
  console.error('No entry script found in dist/index.html. Run `npm run build` first.');
  process.exit(1);
}

const totals = { js: 0, css: 0 };
for (const r of refs) {
  const gz = zlib.gzipSync(fs.readFileSync(path.join(dist, r.file)), { level: 9 }).length / 1024;
  totals[r.kind] += gz;
  console.log(`${r.file.padEnd(40)} ${gz.toFixed(1).padStart(6)} KB gzipped`);
}

let failed = false;
for (const kind of ['js', 'css']) {
  const ok = totals[kind] <= BUDGET_KB[kind];
  failed ||= !ok;
  console.log(`${ok ? '✓' : '✗'} ${kind.toUpperCase()} ${totals[kind].toFixed(1)} KB of ${BUDGET_KB[kind]} KB budget`);
}
process.exit(failed ? 1 : 0);
