import { chromium, devices } from 'playwright';
import { closeGuide } from './guide.mjs';
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
// The Regional Secretary's account, added by the super admin below (a11y.mjs and race.mjs use it too).
const REGIONAL_EMAIL = 'regional@gnatashanti.org';
const REGIONAL_PASSWORD = 'Regional-2026!';

// 1. The super admin (the seeded account) sets up, sees only the system, and adds the Regional Secretary
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
await admin.getByText('Everything is working').waitFor();
// First time in: the super admin guide walks through every step and ends with its PDF.
{
  const guide = admin.getByRole('dialog', { name: 'Super Admin guide' });
  await guide.getByRole('button', { name: 'Show me' }).click();
  while (await guide.getByRole('button', { name: 'Next' }).isVisible()) await guide.getByRole('button', { name: 'Next' }).click();
  await shot(admin, '00b-admin-guide-end');
  for (const name of ['Printable guide (PDF)']) {
    const href = await guide.getByRole('link', { name }).getAttribute('href');
    const res = await fetch(`${WEB}${href}`);
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('pdf')) errors.push(`guide: ${href} did not return a PDF`);
  }
  await guide.getByRole('button', { name: 'Get started' }).click();
  await guide.waitFor({ state: 'hidden' });
  await admin.reload();
  await admin.getByText('Everything is working').waitFor();
  if (await guide.isVisible()) errors.push('guide: opened again after it was closed');
  console.log('✓ super admin guide on first sign-in, with working PDFs, only once');
}
await shot(admin, '00c-super-system');
// The super admin's own pages show no regional data; a region opens only from the Region menu,
// with a notice that the visit is recorded in that region's activity log.
for (const name of ['Districts', 'Structure', 'Access codes', 'Downloads']) {
  if (await admin.getByRole('link', { name, exact: true }).count()) errors.push(`super admin System page shows ${name}`);
}
await admin.getByLabel('Region', { exact: true }).selectOption({ label: 'Ashanti' });
await admin.getByText('Support access: Ashanti Region').waitFor();
await admin.getByText('Ashanti Region overview').waitFor();
await shot(admin, '00d-super-in-region');
{
  const token = JSON.parse(await admin.evaluate(() => localStorage.getItem('gnat.admin'))).token;
  const ash = (await (await fetch('http://localhost:4000/api/meta')).json()).regions.find((r) => r.code === 'ASH');
  for (const path of ['/admin/tree', '/admin/codes']) {
    const none = await fetch(`http://localhost:4000/api${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (none.status !== 400) errors.push(`super admin got ${none.status} from ${path} without a region, expected 400`);
    const inAsh = await fetch(`http://localhost:4000/api${path}?regionId=${ash.id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (inAsh.status !== 200) errors.push(`super admin got ${inAsh.status} from ${path} in Ashanti, expected 200`);
  }
}
await admin.getByRole('link', { name: 'System', exact: true }).click();
await admin.getByText('Everything is working').waitFor();
console.log('✓ super admin opens a region from the Region menu, with the support-access notice');

// The super admin adds the Regional Secretary by WhatsApp number...
await admin.getByRole('link', { name: 'Admins' }).click();
await admin.getByLabel('Name', { exact: true }).fill('Regional Secretary');
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
watch(asst, 'regional-phone');
await asst.goto(`${WEB}/admin`);
await asst.getByLabel('Email or phone number').fill('0247778888');
await asst.getByLabel('Password', { exact: true }).fill(tempPw);
await asst.getByRole('button', { name: 'Sign in' }).click();
await asst.getByText('Set up your account').waitFor();
await asst.getByLabel('Email').fill(REGIONAL_EMAIL);
await asst.getByLabel('Temporary password', { exact: true }).fill(tempPw);
await asst.getByLabel('New password', { exact: true }).fill(REGIONAL_PASSWORD);
await asst.getByLabel('New password again', { exact: true }).fill(REGIONAL_PASSWORD);
await asst.getByRole('button', { name: 'Save and continue' }).click();
await asst.getByText('Ashanti Region overview').waitFor();
await closeGuide(asst, 'Regional Secretary');
await asst.context().close();
console.log('✓ Regional Secretary added, signed in by phone, set his own email and password');

// The super admin's Activity shows the new admin signing in.
await admin.getByRole('link', { name: 'System activity' }).click();
await admin.getByText('Regional Secretary signed in').first().waitFor();
console.log('✓ super admin activity shows admin sign-ins');

// The Regional Secretary does the regional work on a laptop, signing in with his email.
const regional = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
watch(regional, 'regional');
await regional.goto(`${WEB}/admin`);
await regional.getByLabel('Email or phone number').fill(REGIONAL_EMAIL);
await regional.getByLabel('Password', { exact: true }).fill(REGIONAL_PASSWORD);
await regional.getByRole('button', { name: 'Sign in' }).click();
await regional.getByText('Ashanti Region overview').waitFor();
await closeGuide(regional, 'Regional Secretary');
await regional.getByRole('link', { name: 'Settings' }).click();
await regional.getByLabel('Registration key').fill('torch2026');
await regional.getByRole('button', { name: 'Save key' }).click();
await regional.getByText('Registration key saved').waitFor();
console.log('✓ Regional Secretary sets the registration key');

// 2. District Secretary registers on a phone
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
await d.getByRole('link', { name: 'About', exact: true }).click();
await d.getByRole('heading', { name: 'At no cost to GNAT Ashanti' }).waitFor();
await shot(d, '01c-about');
await d.goto(`${WEB}/`);
console.log('✓ footer credit + privacy notice + about');
await d.getByRole('link', { name: 'Register district' }).click();
await d.getByLabel('Registration key').fill('torch2026');
await d.getByLabel('GNAT District name').fill('Kumasi Metro');
await d.getByLabel('Your full name (District Secretary)').fill('Kwame Asante');
await d.getByLabel('Your phone number').fill('024 555 1234');
await d.getByRole('button', { name: 'Register and get my code' }).click();
await d.getByText('Your district is registered').waitFor();
const dcode = (await d.locator('.code-font').first().textContent()).trim();
await shot(d, '02-registered');
await d.getByRole('button', { name: /Start filling/ }).click();
await closeGuide(d, 'District Secretary');
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
  if (c) await d.getByLabel("Local Secretary's full name").fill(c);
  if (p) await d.getByLabel("Local Secretary's phone").fill(p);
  await d.getByRole('button', { name: 'Add Local Secretary' }).click();
  await d.getByRole('dialog').getByText(`Send ${n} its code`).waitFor();
  if (n === 'Adum') await shot(d, '04-share-code');
  await d.getByRole('dialog').getByLabel('Close').click();
}
// a Local Secretary added by mistake is removed again (nothing listed yet, so the local goes too)
await d.getByLabel('Local name').fill('Mistake');
await d.getByLabel("Local Secretary's full name").fill('Wrong Person');
await d.getByRole('button', { name: 'Add Local Secretary' }).click();
await d.getByRole('dialog').getByLabel('Close').click();
await d.locator('li', { hasText: 'Mistake' }).getByRole('button', { name: 'Remove secretary' }).click();
await d.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
await d.getByText('Mistake removed').waitFor();
if (await d.locator('li', { hasText: 'Wrong Person' }).count()) errors.push('removed Local Secretary still listed');
console.log('✓ Local Secretary added and removed');
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

// 4. Local secretary opens the WhatsApp link
const phone2 = await browser.newContext({ ...devices['iPhone 13'] });
const l = await phone2.newPage();
watch(l, 'local');
await l.goto(`${WEB}/?code=${encodeURIComponent(adumCode)}`);
await l.getByRole('heading', { name: 'Adum Local' }).waitFor();
await closeGuide(l, 'Local Secretary');
await l.getByRole('heading', { name: 'Basic units / workplaces' }).waitFor(); // secretary already set → lands on step 2
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
console.log('✓ local secretary submitted');

// 5. District submits
await d.goto(`${WEB}/district?step=3`);
await d.getByRole('button', { name: 'Submit district' }).click();
await d.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
await d.getByText('District submitted. Thank you!').waitFor();
await shot(d, '09-district-submitted');
console.log('✓ district submitted');

// 6. The Regional Secretary reviews
await regional.getByRole('link', { name: 'Overview' }).click();
await regional.reload();
await regional.getByText('waiting for your review').waitFor();
await shot(admin, '10-admin-overview');
await regional.getByRole('link', { name: 'Districts', exact: true }).click();
await regional.getByRole('link', { name: 'Review' }).click();
await regional.getByText('Review actions').waitFor();
await regional.getByRole('button', { name: 'Expand all' }).click();
await shot(admin, '11-admin-review');
await regional.getByRole('button', { name: /Approve district \+/ }).click();
await regional.getByText('District and locals approved').waitFor();
await regional.getByRole('link', { name: 'Structure' }).click();
await regional.getByLabel('Search structure').fill('komfo');
await shot(admin, '12-structure');
await regional.getByRole('link', { name: 'Downloads' }).click();
for (const name of ['Download Excel', 'Download PDF']) {
  const [dl] = await Promise.all([regional.waitForEvent('download'), regional.getByRole('button', { name }).click()]);
  await dl.saveAs(`${OUT}/${dl.suggestedFilename()}`);
  console.log('✓ downloaded', dl.suggestedFilename());
}
await regional.getByRole('link', { name: 'Access codes' }).click();
await regional.getByText(dcode).waitFor();
console.log('✓ codes page shows district code');
// code slips for handing out at a meeting (print is stubbed; the print stylesheet is emulated)
await regional.evaluate(() => {
  window.print = () => {};
});
await regional.getByRole('button', { name: 'Print code slips' }).click();
await regional.emulateMedia({ media: 'print' });
const slips = await regional.getByText('Enter this access code:').count();
await shot(admin, '12b-code-slips');
await regional.emulateMedia({ media: 'screen' });
if (slips < 4) errors.push(`expected a slip per code, got ${slips}`);
console.log(`✓ ${slips} code slips`);

// the Regional Secretary adds a District Secretary from the menu, gets the code to send, then removes them
await regional.getByRole('button', { name: 'Add District Secretary' }).first().click();
await regional.getByLabel('GNAT district name').fill('Oforikrom');
await regional.getByLabel("District Secretary's full name").fill('Abena Sarpong');
await regional.getByLabel("District Secretary's phone").fill('0249990000');
await regional.getByRole('dialog').getByRole('button', { name: 'Add District Secretary' }).click();
await regional.getByRole('dialog').getByText('Send Oforikrom its code').waitFor();
await shot(admin, '12c-district-secretary-added');
await regional.getByRole('dialog').getByLabel('Close').click();
await regional.getByRole('link', { name: 'Districts', exact: true }).click();
await regional.locator('li', { hasText: 'Oforikrom' }).getByRole('button', { name: 'Remove secretary' }).click();
await regional.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
await regional.getByText('Oforikrom removed').waitFor();
console.log('✓ District Secretary added and removed');

// mobile admin on a phone set to dark mode: the site stays white (brand: red, sky blue, white)
const dark = await browser.newContext({ ...devices['Pixel 7'], colorScheme: 'dark' });
const dm = await dark.newPage();
watch(dm, 'dark');
await dm.goto(`${WEB}/admin`);
await dm.getByLabel('Email').fill(REGIONAL_EMAIL);
await dm.getByLabel('Password', { exact: true }).fill(REGIONAL_PASSWORD);
await dm.getByRole('button', { name: 'Sign in' }).click();
await dm.getByText('Ashanti Region overview').waitFor();
await closeGuide(dm, 'Regional Secretary');
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
