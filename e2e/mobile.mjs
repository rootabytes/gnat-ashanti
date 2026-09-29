// Every screen on small and large phones, in Chrome (Android) and WebKit (iPhone Safari):
// no sideways scrolling, nothing cut off at the edge, tap targets big enough, and no
// input small enough to make iPhones zoom in when tapped.
// Runs against the demo site (API with DEMO_MODE=true), which has data in every status.
import { chromium, devices, webkit } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:4173';
const OUT = (await import('node:url')).fileURLToPath(new URL('./screenshots', import.meta.url));
const SHOTS = process.env.MOBILE_SHOTS === '1';

const PHONES = [
  { name: 'small-android', engine: chromium, device: { ...devices['Galaxy S5'], viewport: { width: 320, height: 640 } } },
  { name: 'android', engine: chromium, device: devices['Galaxy S5'] },
  { name: 'iphone-se', engine: webkit, device: devices['iPhone SE'] },
  { name: 'iphone-pro-max', engine: webkit, device: devices['iPhone 15 Pro Max'] },
];

const failures = [];

/** Runs in the page: returns layout problems on the current screen. */
function audit() {
  const vw = document.documentElement.clientWidth;
  const problems = [];
  const describe = (el) => {
    const text = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ');
    return `<${el.tagName.toLowerCase()}> "${text.slice(0, 40)}"`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return (
      r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[aria-hidden="true"], .sr-only')
    );
  };
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true;
    }
    return false;
  };

  if (document.documentElement.scrollWidth > vw + 1)
    problems.push(`page scrolls sideways: ${document.documentElement.scrollWidth}px wide on a ${vw}px screen`);
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el) || inScroller(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      // Report the outermost offender only.
      const parentOff = el.parentElement && el.parentElement.getBoundingClientRect().right > vw + 1;
      if (!parentOff) problems.push(`past the screen edge: ${describe(el)} (${Math.round(r.left)}–${Math.round(r.right)}px)`);
    }
  }
  for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    // WCAG 2.2 target size: at least 24×24 CSS px. Links inside a sentence are exempt, and so is a
    // checkbox or radio whose label (which also toggles it) can be tapped.
    const inSentence = el.tagName === 'A' && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const labelled = (el.type === 'checkbox' || el.type === 'radio') && el.labels?.length > 0;
    if (!inSentence && !labelled && (r.height < 24 || r.width < 24))
      problems.push(`tap target too small: ${describe(el)} ${Math.round(r.width)}×${Math.round(r.height)}px`);
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && !['checkbox', 'radio', 'file'].includes(el.type)) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) problems.push(`iPhone zooms in on this field (font ${fs}px, needs 16px): ${describe(el)}`);
    }
  }
  return problems;
}

async function check(page, phone, screen) {
  await page.waitForLoadState('networkidle');
  const problems = await page.evaluate(audit);
  for (const p of problems) failures.push(`[${phone.name}] ${screen}: ${p}`);
  if (SHOTS)
    await page.screenshot({ path: `${OUT}/m-${phone.name}-${screen.replace(/[^a-z0-9]+/gi, '-')}.png`, fullPage: true }).catch(() => {});
  console.log(`${problems.length ? '✗' : '✓'} [${phone.name}] ${screen}`);
}

for (const phone of PHONES) {
  const browser = await phone.engine.launch();
  const ctx = await browser.newContext({ ...phone.device });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => failures.push(`[${phone.name}] pageerror: ${e.message}`));
  const card = (title) => page.locator('section', { has: page.getByRole('heading', { name: title }) });
  const signIn = async (section, row) => {
    await page.goto(`${WEB}/demo`);
    const scope = row ? card(section).locator('li', { hasText: row }) : card(section);
    await scope.getByRole('button', { name: 'Sign in' }).first().click();
  };
  // A first sign-in opens the role guide: check its layout too, then close it to check the screen.
  const skipGuide = async (role) => {
    const guide = page.getByRole('dialog', { name: `${role} guide` });
    await guide.waitFor();
    await check(page, phone, `${role} guide`);
    await guide.getByRole('button', { name: 'Skip guide' }).click();
    await guide.waitFor({ state: 'hidden' });
  };

  for (const path of ['/', '/privacy', '/about', '/register', '/demo']) {
    await page.goto(`${WEB}${path}`);
    await check(page, phone, path);
  }

  await signIn('Local Secretaries', 'Bantama');
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  await skipGuide('Local Secretary');
  await check(page, phone, 'local secretary');

  await signIn('District Secretaries', 'Kumasi Metro');
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  await skipGuide('District Secretary');
  await check(page, phone, 'district secretary');

  await signIn('Regional Secretary');
  await page.getByText('Ashanti Region overview').waitFor();
  await skipGuide('Regional Secretary');
  await check(page, phone, 'admin overview');
  for (const [path, screen] of [
    ['/admin/districts', 'admin districts'],
    ['/admin/structure', 'admin structure'],
    ['/admin/codes', 'admin codes'],
    ['/admin/downloads', 'admin downloads'],
    ['/admin/activity', 'admin activity'],
    ['/admin/settings', 'admin settings'],
  ]) {
    await page.goto(`${WEB}${path}`);
    await page.getByRole('heading', { level: 1 }).first().waitFor();
    await check(page, phone, screen);
  }
  await page.goto(`${WEB}/admin/districts`);
  await page.getByRole('link', { name: /Ejisu/ }).first().click();
  await page.getByRole('heading', { name: /Ejisu/ }).first().waitFor();
  await check(page, phone, 'admin district review');

  await browser.close();
}

if (failures.length) {
  // One line per problem, with the phones it happens on.
  const byProblem = new Map();
  for (const f of failures) {
    const [, phone, rest] = /^\[([^\]]+)\] (.*)$/.exec(f);
    byProblem.set(rest, [...new Set([...(byProblem.get(rest) ?? []), phone])]);
  }
  const lines = [...byProblem].map(([problem, phones]) => `${problem}  [${phones.join(', ')}]`);
  console.error(`\n${lines.length} phone layout problem(s):\n${lines.join('\n')}`);
  process.exit(1);
}
console.log('\nAll screens fit every phone.');
