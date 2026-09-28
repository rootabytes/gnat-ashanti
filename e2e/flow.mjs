import { chromium, devices } from 'playwright';
const WEB = process.env.WEB_URL ?? 'http://localhost:4173';
const OUT = process.env.OUT ?? (await import('node:url')).fileURLToPath(new URL('./screenshots', import.meta.url));
await import('node:fs').then((fs) => fs.mkdirSync(OUT, { recursive: true }));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const watch = (p, tag) => {
  p.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && errors.push(`${tag} console: ${m.text()}`));
};
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });

// 1. Admin sets a registration key
const adminCtx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const admin = await adminCtx.newPage(); watch(admin, 'admin');
await admin.goto(`${WEB}/admin`);
await admin.getByLabel('Email').fill('secretary@gnatashanti.org');
await admin.getByLabel('Password').fill('Secretary2026!');
await admin.getByRole('button', { name: 'Sign in' }).click();
await admin.getByText('Ashanti Region overview').waitFor();
await admin.getByRole('link', { name: 'Settings' }).click();
await admin.getByLabel('Registration key').fill('torch2026');
await admin.getByRole('button', { name: 'Save key' }).click();
await admin.getByText('Registration key saved').waitFor();
console.log('✓ admin login + key');

// 2. District chairman registers on a phone
const phone = await browser.newContext({ ...devices['Pixel 7'] });
const d = await phone.newPage(); watch(d, 'district');
await d.goto(`${WEB}/`);
await shot(d, '01-home-mobile');
await d.getByRole('link', { name: 'Register district' }).click();
await d.getByLabel('Registration key').fill('torch2026');
await d.getByLabel('GNAT District name').fill('Kumasi Metro');
await d.getByLabel('Your full name (District Chairman)').fill('Kwame Asante');
await d.getByLabel('Your phone number').fill('024 555 1234');
await d.getByRole('button', { name: 'Register and get my code' }).click();
await d.getByText('Your district is registered').waitFor();
const dcode = (await d.locator('.code-font').first().textContent()).trim();
await shot(d, '02-registered');
await d.getByRole('button', { name: /Start filling/ }).click();
// step 1 prefilled → political districts
await d.getByText('01 · Political administrative district(s)').waitFor();
await d.getByLabel('Search political districts').fill('Kumasi');
await d.getByRole('checkbox').first().check();
await d.getByLabel('Search political districts').fill('Asokwa');
await d.getByRole('checkbox').first().check();
await d.getByLabel('Search political districts').fill('');
await shot(d, '03-political');
await d.getByRole('button', { name: 'Save & continue' }).click();
await d.getByText('02 · GNAT Locals').waitFor();
for (const [n, c, p] of [['Adum', 'Ama Owusu', '0201112222'], ['Bantama', '', ''], ['Ayalolo', 'Kofi Boateng', '0547778888']]) {
  await d.getByLabel('Local name').fill(n);
  if (c) await d.getByLabel('Local Chairman (optional)').fill(c);
  if (p) await d.getByLabel('Chairman phone (optional)').fill(p);
  await d.getByRole('button', { name: 'Add local' }).click();
  await d.getByRole('dialog').getByText(`Send ${n} its code`).waitFor();
  if (n === 'Adum') await shot(d, '04-share-code');
  await d.getByRole('dialog').getByLabel('Close').click();
}
const adumCode = await (async () => {
  const r = await d.request.get('http://localhost:4000/api/district/me', { headers: { Authorization: 'Bearer ' + JSON.parse(await d.evaluate(() => localStorage.getItem('gnat.chair'))).token } });
  return (await r.json()).locals.find((l) => l.name === 'Adum').code;
})();
await shot(d, '05-locals');
console.log('✓ district registered, 3 locals', dcode, adumCode);

// 3. District fills Bantama on behalf
await d.locator('li', { hasText: 'Bantama' }).getByRole('link', { name: 'Fill workplaces' }).click();
await d.getByText('You are filling this local on behalf').waitFor();
await d.getByLabel('Full name').fill('Yaw Mensah');
await d.getByLabel('Phone number').fill('0501234567');
await d.getByRole('button', { name: 'Save & continue' }).click();
await d.getByRole('heading', { name: 'Basic units / workplaces' }).waitFor();
await d.getByLabel('Workplace name').fill('Bantama Methodist JHS');
await d.getByRole('button', { name: 'Add', exact: true }).click();
await d.getByLabel('Workplace name').fill('Komfo Anokye SHS');
await d.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Basic Units');
await d.getByRole('button', { name: 'Add', exact: true }).click();
await d.locator('[role=status]', { hasText: 'Saved' }).waitFor();
await d.getByRole('button', { name: 'Review', exact: true }).click();
await d.getByRole('button', { name: 'Submit local' }).click();
await d.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
await d.getByText('Submitted. Thank you!').first().waitFor();
console.log('✓ district filled Bantama on behalf');

// 4. Local chairman opens the WhatsApp link
const phone2 = await browser.newContext({ ...devices['iPhone 13'] });
const l = await phone2.newPage(); watch(l, 'local');
await l.goto(`${WEB}/?code=${encodeURIComponent(adumCode)}`);
await l.getByRole('heading', { name: 'Adum Local' }).waitFor();
await l.getByRole('heading', { name: 'Basic units / workplaces' }).waitFor(); // chairman already set → lands on step 2
await l.getByRole('button', { name: /Paste many at once/ }).click();
await l.getByLabel('List of workplaces, one per line').fill('1. Adum Presby JHS\n2. Kumasi Anglican Basic\n- St. Peter\'s R/C Basic\nAdum Presby JHS');
await l.getByRole('button', { name: 'Add all' }).click();
await l.getByLabel('Workplace name').fill('Metro Education Directorate');
await l.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Education Administration Units');
await l.getByRole('button', { name: 'Add', exact: true }).click();
await l.getByLabel('Workplace name').fill('Komfo Anokye SHS');
await l.getByRole('button', { name: 'Add', exact: true }).click();
await l.locator('[role=status]', { hasText: 'Saved' }).waitFor();
await shot(l, '06-local-units');
// offline autosave
await phone2.setOffline(true);
await l.getByLabel('Workplace name').fill('Offline Added School');
await l.getByRole('button', { name: 'Add', exact: true }).click();
await l.getByText('Offline: kept on this phone', { exact: false }).waitFor();
await shot(l, '07-offline');
await phone2.setOffline(false);
await l.locator('[role=status]', { hasText: 'Saved' }).waitFor({ timeout: 10000 });
console.log('✓ offline draft synced on reconnect');
await l.getByRole('button', { name: 'Review', exact: true }).click();
await l.getByRole('button', { name: 'Submit local' }).click();
await l.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
await l.getByText('Submitted. Thank you!').first().waitFor();
await shot(l, '08-local-submitted');
console.log('✓ local chairman submitted');

// 5. District submits
await d.goto(`${WEB}/district?step=3`);
await d.getByRole('button', { name: 'Submit district' }).click();
await d.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
await d.getByText('District submitted. Thank you!').waitFor();
await shot(d, '09-district-submitted');
console.log('✓ district submitted');

// 6. Admin reviews
await admin.getByRole('link', { name: 'Overview' }).click();
await admin.reload();
await admin.getByText('waiting for your review').waitFor();
await shot(admin, '10-admin-overview');
await admin.getByRole('link', { name: 'Districts', exact: true }).click();
await admin.getByRole('link', { name: 'Review' }).click();
await admin.getByText('Review actions').waitFor();
await admin.getByRole('button', { name: 'Expand all' }).click();
await shot(admin, '11-admin-review');
await admin.getByRole('button', { name: /Approve district \+/ }).click();
await admin.getByText('District and locals approved').waitFor();
await admin.getByRole('link', { name: 'Structure' }).click();
await admin.getByLabel('Search structure').fill('komfo');
await shot(admin, '12-structure');
await admin.getByRole('link', { name: 'Downloads' }).click();
for (const name of ['Download Excel', 'Download PDF']) {
  const [dl] = await Promise.all([admin.waitForEvent('download'), admin.getByRole('button', { name }).click()]);
  await dl.saveAs(`${OUT}/${dl.suggestedFilename()}`);
  console.log('✓ downloaded', dl.suggestedFilename());
}
await admin.getByRole('link', { name: 'Access codes' }).click();
await admin.getByText(dcode).waitFor();
console.log('✓ codes page shows district code');

// dark mode + mobile admin
const dark = await browser.newContext({ ...devices['Pixel 7'], colorScheme: 'dark' });
const dm = await dark.newPage(); watch(dm, 'dark');
await dm.goto(`${WEB}/admin`);
await dm.getByLabel('Email').fill('secretary@gnatashanti.org');
await dm.getByLabel('Password').fill('Secretary2026!');
await dm.getByRole('button', { name: 'Sign in' }).click();
await dm.getByText('Ashanti Region overview').waitFor();
await dm.waitForTimeout(500);
await shot(dm, '13-admin-mobile-dark');
const overflow = await dm.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
console.log('mobile horizontal overflow:', overflow);

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
