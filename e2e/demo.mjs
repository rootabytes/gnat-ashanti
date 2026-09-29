// The demo site: every role signs in with one tap, and the page is accessible.
// Needs the API started with DEMO_MODE=true on its own database (see README.md).
import AxeBuilder from '@axe-core/playwright';
import { chromium, devices } from 'playwright';
import { closeGuide } from './guide.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:4173';
const OUT = (await import('node:url')).fileURLToPath(new URL('./screenshots', import.meta.url));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
p.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

await p.goto(`${WEB}/`);
await p.getByText('Demo site.').waitFor();
await p.getByRole('link', { name: /Testing the system/ }).click();
await p.getByRole('heading', { name: 'Try every role' }).waitFor();
await p.screenshot({ path: `${OUT}/20-demo.png`, fullPage: true });
const axe = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
for (const v of axe.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) errors.push(`a11y: ${v.id} ${v.help}`);

const card = (title) => p.locator('section', { has: p.getByRole('heading', { name: title }) });

await card('Regional Secretary').getByRole('button', { name: 'Sign in' }).first().click();
await p.getByText('Ashanti Region overview').waitFor();
await closeGuide(p, 'Regional Secretary');
console.log('✓ Regional Secretary');

await p.goto(`${WEB}/demo`);
await card('District Chairmen').locator('li', { hasText: 'Kumasi Metro' }).getByRole('button', { name: 'Sign in' }).click();
await p.getByRole('heading', { name: 'Kumasi Metro District' }).waitFor();
await closeGuide(p, 'District Chairman');
console.log('✓ District Chairman');

await p.goto(`${WEB}/demo`);
await card('Local Chairmen').locator('li', { hasText: 'Bantama' }).getByRole('button', { name: 'Sign in' }).click();
await p.getByRole('heading', { name: 'Bantama Local' }).waitFor();
await closeGuide(p, 'Local Chairman');
await p.getByLabel('GPS address of Bantama M/A JHS').waitFor();
console.log('✓ Local Chairman');

await p.goto(`${WEB}/demo`);
const before = await card('District Chairmen').locator('.code-font').first().textContent();
await p.getByRole('button', { name: 'Reset demo data' }).click();
await p.getByRole('dialog').getByRole('button', { name: 'Reset' }).click();
await p.getByText('Demo data reset').waitFor();
const after = await card('District Chairmen').locator('.code-font').first().textContent();
if (before === after) errors.push('reset did not issue new codes');
console.log('✓ reset');

await browser.close();
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
process.exit(errors.length ? 1 : 0);
