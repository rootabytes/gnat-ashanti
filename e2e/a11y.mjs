// Accessibility audit (axe-core, WCAG 2.1 A/AA) of the pages people use.
// Runs after flow.mjs, which creates the data and sets the admin password.
// Fails on serious or critical problems; lists moderate ones as warnings.
import AxeBuilder from '@axe-core/playwright';
import { chromium, devices } from 'playwright';
import { closeGuide } from './guide.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:4173';
const API = process.env.API_URL ?? 'http://localhost:4000/api';
const EMAIL = 'secretary@gnatashanti.org';
const PASSWORD = 'GnatAshanti-2026!';

const api = (p, o = {}) =>
  fetch(API + p, { ...o, headers: { 'content-type': 'application/json', ...(o.headers ?? {}) } }).then((r) => r.json());
const { token } = await api('/admin/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
const codes = await api('/admin/codes', { headers: { authorization: `Bearer ${token}` } });
const localCode = codes.find((c) => c.kind === 'local' && c.name === 'Ayalolo')?.code;
const districtCode = codes.find((c) => c.kind === 'district')?.code;
const meta = await api('/meta');

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failed = 0;

async function audit(ctx, name, url, ready) {
  const page = await ctx.newPage();
  await page.goto(url);
  await ready(page);
  await page.waitForTimeout(300); // let transitions settle
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const warn = r.violations.filter((v) => !bad.includes(v));
  console.log(`${bad.length ? '✗' : '✓'} ${name}${warn.length ? ` (${warn.length} minor)` : ''}`);
  for (const v of [...bad, ...warn]) {
    console.log(`    ${v.impact}: ${v.id} — ${v.help}`);
    for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.target.join(' ')}`);
  }
  failed += bad.length;
  await page.close();
}

for (const scheme of ['light', 'dark']) {
  const phone = await browser.newContext({ ...devices['Pixel 7'], colorScheme: scheme });
  const tag = scheme === 'dark' ? ' [dark]' : '';
  await audit(phone, `home${tag}`, `${WEB}/`, (p) => p.getByRole('heading', { name: /Structure/ }).waitFor());
  await audit(phone, `register${tag}`, `${WEB}/register`, (p) => p.getByRole('button', { name: 'Register and get my code' }).waitFor());
  await audit(phone, `privacy${tag}`, `${WEB}/privacy`, (p) => p.getByRole('heading', { name: 'Privacy notice' }).waitFor());
  if (localCode) {
    await audit(phone, `local form${tag}`, `${WEB}/?code=${localCode}`, (p) =>
      p.getByRole('heading', { name: 'Basic units / workplaces' }).waitFor(),
    );
  }
  if (districtCode) {
    await audit(phone, `district form${tag}`, `${WEB}/?code=${districtCode}`, (p) =>
      p
        .getByRole('heading', { name: /District$/ })
        .first()
        .waitFor(),
    );
  }
  if (meta.demo) await audit(phone, `demo${tag}`, `${WEB}/demo`, (p) => p.getByRole('heading', { name: 'Try every role' }).waitFor());
  await phone.close();

  const desk = await browser.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: scheme });
  const login = await desk.newPage();
  await login.goto(`${WEB}/admin`);
  await login.getByLabel('Email').fill(EMAIL);
  await login.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await login.getByRole('button', { name: 'Sign in' }).click();
  await login.getByText('Region overview').waitFor();
  await closeGuide(login, 'Super Admin');
  await login.close();
  for (const [name, path, text] of [
    ['admin overview', '/admin', 'Region overview'],
    ['admin districts', '/admin/districts', 'Districts'],
    ['admin structure', '/admin/structure', 'Structure'],
    ['admin settings', '/admin/settings', 'Change your password'],
  ]) {
    await audit(desk, `${name}${tag}`, `${WEB}${path}`, (p) => p.getByText(text).first().waitFor());
  }
  await desk.close();
}

await browser.close();
console.log(failed ? `\n${failed} serious accessibility problem(s)` : '\nNo serious accessibility problems');
process.exit(failed ? 1 : 0);
