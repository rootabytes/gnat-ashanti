import { chromium, devices } from 'playwright';
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await b.newContext({ ...devices['Pixel 7'] });
const api = (p, o = {}) =>
  fetch('http://localhost:4000/api' + p, { ...o, headers: { 'content-type': 'application/json', ...(o.headers ?? {}) } }).then((r) =>
    r.json(),
  );
// A chairman of Ayalolo (created by flow.mjs) signs in via the admin code list.
// flow.mjs replaced the temporary admin password with this one.
const { token: at } = await api('/admin/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'secretary@gnatashanti.org', password: 'GnatAshanti-2026!' }),
});
const codes = await api('/admin/codes', { headers: { authorization: 'Bearer ' + at } });
const code = codes.find((c) => c.name === 'Ayalolo').code;
const p = await ctx.newPage();
await p.goto(`http://localhost:4173/?code=${code}`);
await p.getByRole('heading', { name: 'Ayalolo Local' }).waitFor();
await p.getByRole('heading', { name: 'Basic units / workplaces' }).waitFor();
await p.getByLabel('Workplace name').fill('Race Condition Basic');
await p.getByRole('button', { name: 'Add', exact: true }).click();
await p.getByRole('button', { name: 'Review', exact: true }).click(); // immediately, before the 900 ms autosave
await p.waitForTimeout(1500);
const { token } = await api('/access', { method: 'POST', body: JSON.stringify({ code }) });
const me = await api('/local/me', { headers: { authorization: 'Bearer ' + token } });
console.log(
  'server has:',
  me.units.map((u) => u.name),
);
const saved = me.units.some((u) => u.name === 'Race Condition Basic');
console.log(saved ? 'PASS: saved despite leaving immediately' : 'FAIL: the workplace was lost');
await b.close();
process.exit(saved ? 0 : 1);
