import { chromium, devices } from 'playwright';
const WEB = process.env.WEB_URL ?? 'http://localhost:4173';
const OUT = process.env.OUT ?? (await import('node:url')).fileURLToPath(new URL('./screenshots', import.meta.url));
await import('node:fs').then((fs) => fs.mkdirSync(OUT, { recursive: true }));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const watch = (p, tag) => {
  p.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  // ERR_INTERNET_DISCONNECTED is the offline step below doing its job.
  p.on(
    'console',
    (m) => m.type() === 'error' && !m.text().includes('ERR_INTERNET_DISCONNECTED') && errors.push(`${tag} console: ${m.text()}`),
  );
};
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
// The API starts with ADMIN_PASSWORD=Secretary2026! (see README); the first sign-in replaces it.
const TEMP_PASSWORD = 'Secretary2026!';
const PASSWORD = 'GnatAshanti-2026!';

// 1. Admin sets a registration key
const adminCtx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const admin = await adminCtx.newPage();
watch(admin, 'admin');
await admin.goto(`${WEB}/admin`);
await admin.getByLabel('Email').fill('secretary@gnatashanti.org');
await admin.getByLabel('Password', { exact: true }).fill(TEMP_PASSWORD);
await admin.getByRole('button', { name: 'Sign in' }).click();
// The seeded password is temporary: nothing else opens until it is replaced.
await admin.getByText('Set up your account').waitFor();
await shot(admin, '00-admin-first-password');
await admin.getByLabel('Temporary password', { exact: true }).fill(TEMP_PASSWORD);
await admin.getByLabel('New password', { exact: true }).fill(PASSWORD);
await admin.getByLabel('New password again', { exact: true }).fill(PASSWORD);
await admin.getByRole('button', { name: 'Save and continue' }).click();
await admin.getByText('Ashanti Region overview').waitFor();

// The super admin adds the Assistant Regional Secretary by WhatsApp number...
await admin.getByRole('link', { name: 'Settings' }).click();
await admin.getByLabel('Name', { exact: true }).fill('Assistant Regional Secretary');
await admin.getByLabel('WhatsApp number').fill('024 777 8888');
await admin.getByRole('button', { name: 'Add admin' }).click();
const invite = admin.getByRole('dialog');
await invite.getByText('Temporary password').first().waitFor();
const tempPw = (await invite.locator('.code-font').textContent()).trim();
const waHref = await invite.getByRole('link', { name: /WhatsApp/ }).getAttribute('href');
if (!waHref.startsWith('https://wa.me/233247778888?text=') || !decodeURIComponent(waHref).includes(tempPw)) {
  errors.push('the admin invite WhatsApp link is wrong');
}
await shot(admin, '00b-admin-invite');
await invite.getByRole('button', { name: 'Done' }).click();
// ...who signs in with that number on his phone, then adds his email and own password.
const asst = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage();
watch(asst, 'assistant');
await asst.goto(`${WEB}/admin`);
await asst.getByLabel('Email or phone number').fill('0247778888');
await asst.getByLabel('Password', { exact: true }).fill(tempPw);
await asst.getByRole('button', { name: 'Sign in' }).click();
await asst.getByText('Set up your account').waitFor();
await asst.getByLabel('Email').fill('assistant@gnatashanti.org');
await asst.getByLabel('Temporary password', { exact: true }).fill(tempPw);
await asst.getByLabel('New password', { exact: true }).fill('Assistant-2026!');
await asst.getByLabel('New password again', { exact: true }).fill('Assistant-2026!');
await asst.getByRole('button', { name: 'Save and continue' }).click();
await asst.getByText('Ashanti Region overview').waitFor();
await asst.context().close();
console.log('✓ assistant admin added, signed in by phone, set his own email and password');
await admin.getByRole('link', { name: 'Overview' }).click();
await admin.getByRole('link', { name: 'Settings' }).click();
await admin.getByLabel('Registration key').fill('torch2026');
await admin.getByRole('button', { name: 'Save key' }).click();
await admin.getByText('Registration key saved').waitFor();
console.log('✓ admin login + key');

// 2. District chairman registers on a phone
const phone = await browser.newContext({ ...devices['Pixel 7'] });
const d = await phone.newPage();
watch(d, 'district');
await d.goto(`${WEB}/`);
await shot(d, '01-home-mobile');
const built = d.getByRole('link', { name: 'Built by Rootabytes' });
if ((await built.getAttribute('href')) !== 'https://rootabytes.com') errors.push('footer: the Built by Rootabytes link is wrong');
await d.getByRole('link', { name: 'Privacy notice' }).first().click();
await d.getByRole('heading', { name: 'Privacy notice' }).waitFor();
await d.getByText('Data Protection Commission of Ghana', { exact: false }).first().waitFor();
await shot(d, '01b-privacy');
await d.goto(`${WEB}/`);
console.log('✓ footer credit + privacy notice');
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
for (const [n, c, p] of [
  ['Adum', 'Ama Owusu', '0201112222'],
  ['Bantama', '', ''],
  ['Ayalolo', 'Kofi Boateng', '0547778888'],
]) {
  await d.getByLabel('Local name').fill(n);
  if (c) await d.getByLabel('Local Chairman (optional)').fill(c);
  if (p) await d.getByLabel('Chairman phone (optional)').fill(p);
  await d.getByRole('button', { name: 'Add local' }).click();
  await d.getByRole('dialog').getByText(`Send ${n} its code`).waitFor();
  if (n === 'Adum') await shot(d, '04-share-code');
  await d.getByRole('dialog').getByLabel('Close').click();
}
const adumCode = await (async () => {
  const r = await d.request.get('http://localhost:4000/api/district/me', {
    headers: { Authorization: 'Bearer ' + JSON.parse(await d.evaluate(() => localStorage.getItem('gnat.chair'))).token },
  });
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
await d.getByLabel('Ghana Post GPS address (optional)').fill('ak0395028');
await d.getByRole('button', { name: 'Add', exact: true }).click();
if ((await d.getByLabel('GPS address of Komfo Anokye SHS').inputValue()) !== 'AK-039-5028') errors.push('GPS address was not normalised');
await d.locator('[role=status]', { hasText: 'Saved' }).waitFor();
await d.getByRole('button', { name: 'Review', exact: true }).click();
await d.getByRole('button', { name: 'Submit local' }).click();
await d.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
await d.getByText('Submitted. Thank you!').first().waitFor();
console.log('✓ district filled Bantama on behalf');

// 4. Local chairman opens the WhatsApp link
const phone2 = await browser.newContext({ ...devices['iPhone 13'] });
const l = await phone2.newPage();
watch(l, 'local');
await l.goto(`${WEB}/?code=${encodeURIComponent(adumCode)}`);
await l.getByRole('heading', { name: 'Adum Local' }).waitFor();
await l.getByRole('heading', { name: 'Basic units / workplaces' }).waitFor(); // chairman already set → lands on step 2
await l.getByRole('button', { name: /Paste many at once/ }).click();
await l
  .getByLabel('List of workplaces, one per line')
  .fill("1. Adum Presby JHS\n2. Kumasi Anglican Basic\n- St. Peter's R/C Basic\nAdum Presby JHS");
await l.getByRole('button', { name: 'Add all' }).click();
await l.getByLabel('Workplace name').fill('Metro Education Directorate');
await l.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Education Administration Units');
await l.getByRole('button', { name: 'Add', exact: true }).click();
await l.getByLabel('Workplace name').fill('Komfo Anokye SHS');
await l.getByRole('button', { name: 'Add', exact: true }).click();
await l.locator('[role=status]', { hasText: 'Saved' }).waitFor();
// Excel/CSV import: the rows are shown first, and names already on the list are skipped
await l.locator('input[type=file]').setInputFiles({
  name: 'schools.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from(
    ['Workplace name,Category,GPS address', 'Asafo Market Basic,Basic Units,AK-040-1122', 'Adum Presby JHS,,', 'New Hope Academy,,'].join(
      '\n',
    ),
  ),
});
await l.getByRole('dialog').getByText('already on your list will be skipped', { exact: false }).waitFor();
await l
  .getByRole('dialog')
  .getByLabel(/Category for the 1 without one/)
  .selectOption('Private Schools');
await shot(l, '06a-import-preview');
await l.getByRole('dialog').getByRole('button', { name: 'Add 2 workplaces' }).click();
await l.getByLabel('Name of workplace 7').waitFor();
await l.locator('[role=status]', { hasText: 'Saved' }).waitFor();
console.log('✓ imported 2 workplaces from CSV');
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
// code slips for handing out at a meeting (print is stubbed; the print stylesheet is emulated)
await admin.evaluate(() => {
  window.print = () => {};
});
await admin.getByRole('button', { name: 'Print code slips' }).click();
await admin.emulateMedia({ media: 'print' });
const slips = await admin.getByText('Enter this access code:').count();
await shot(admin, '12b-code-slips');
await admin.emulateMedia({ media: 'screen' });
if (slips < 4) errors.push(`expected a slip per code, got ${slips}`);
console.log(`✓ ${slips} code slips`);

// mobile admin on a phone set to dark mode: the site stays white (brand: red, sky blue, white)
const dark = await browser.newContext({ ...devices['Pixel 7'], colorScheme: 'dark' });
const dm = await dark.newPage();
watch(dm, 'dark');
await dm.goto(`${WEB}/admin`);
await dm.getByLabel('Email').fill('secretary@gnatashanti.org');
await dm.getByLabel('Password', { exact: true }).fill(PASSWORD);
await dm.getByRole('button', { name: 'Sign in' }).click();
await dm.getByText('Ashanti Region overview').waitFor();
await dm.waitForTimeout(500);
await shot(dm, '13-admin-mobile-dark');
const bg = await dm.evaluate(() => getComputedStyle(document.body).backgroundColor);
if (bg !== 'rgb(244, 249, 253)') errors.push(`dark-mode phone got background ${bg}, expected the white theme`);
const overflow = await dm.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
console.log('mobile horizontal overflow:', overflow);
if (overflow) errors.push('the admin dashboard scrolls sideways on a phone');

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
