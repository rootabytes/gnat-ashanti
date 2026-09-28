// End-to-end API test against a real Postgres. Wipes the database named in TEST_DATABASE_URL.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://gnat:gnat@localhost:5432/gnat_test';
process.env.ADMIN_EMAIL = 'secretary@example.com';
process.env.ADMIN_PASSWORD = 'correct-horse-battery';

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

let base = '';
let server: Server;
let pool: import('pg').Pool;

async function api(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await res.json() : await res.arrayBuffer();
  return { status: res.status, data: data as any, headers: res.headers };
}

before(async () => {
  const db = await import('../src/db');
  pool = db.pool;
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const { migrate } = await import('../src/schema');
  const { seed } = await import('../src/seed');
  await migrate();
  await migrate(); // idempotent
  await seed();
  await seed();
  const { createApp } = await import('../src/server');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

after(async () => {
  server?.close();
  await pool?.end();
});

test('full chairman → admin flow', async () => {
  const meta = await api('GET', '/meta');
  assert.equal(meta.status, 200);
  assert.equal(meta.data.categories.length, 11);
  const ash = meta.data.regions.find((r: any) => r.code === 'ASH');
  assert.ok(ash, 'Ashanti active');
  const pds = (await api('GET', `/regions/${ash.id}/political-districts`)).data;
  assert.equal(pds.length, 43);

  // admin sets a registration key
  const login = await api('POST', '/admin/login', { email: 'Secretary@example.com', password: 'correct-horse-battery' });
  assert.equal(login.status, 200);
  const at = login.data.token;
  assert.equal((await api('POST', '/admin/login', { email: 'secretary@example.com', password: 'nope' })).status, 401);
  assert.equal((await api('PATCH', `/admin/regions/${ash.id}`, { registrationKey: 'torch2026' }, at)).status, 200);

  // registration requires key
  const reg0 = await api('POST', '/register', { regionId: ash.id, districtName: 'Kumasi Metro', chairName: 'Kofi Mensah', chairPhone: '0241234567' });
  assert.equal(reg0.status, 403);
  const badPhone = await api('POST', '/register', { regionId: ash.id, registrationKey: 'TORCH2026', districtName: 'Kumasi Metro', chairName: 'Kofi Mensah', chairPhone: '12345' });
  assert.equal(badPhone.status, 400);
  const reg = await api('POST', '/register', { regionId: ash.id, registrationKey: 'TORCH2026', districtName: 'Kumasi Metro', chairName: 'Kofi Mensah', chairPhone: '024 123 4567' });
  assert.equal(reg.status, 201, JSON.stringify(reg.data));
  assert.match(reg.data.code, /^D-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  const dup = await api('POST', '/register', { regionId: ash.id, registrationKey: 'torch2026', districtName: 'kumasi metro', chairName: 'X Y', chairPhone: '0241234567' });
  assert.equal(dup.status, 409);

  // sign in with the code, typed sloppily
  const acc = await api('POST', '/access', { code: reg.data.code.toLowerCase().replace(/-/g, ' ') });
  assert.equal(acc.status, 200);
  assert.equal(acc.data.role, 'district');
  const dt = acc.data.token;

  let me = (await api('GET', '/district/me', undefined, dt)).data;
  assert.equal(me.chairPhone, '+233241234567');

  // submit too early → validation errors
  const early = await api('POST', '/district/submit', {}, dt);
  assert.equal(early.status, 400);

  const kumasi = pds.find((p: any) => p.name === 'Kumasi');
  const asokwa = pds.find((p: any) => p.name === 'Asokwa');
  assert.equal((await api('PUT', '/district/political-districts', { ids: [kumasi.id, asokwa.id] }, dt)).status, 200);
  assert.equal((await api('PUT', '/district/political-districts', { ids: [999999] }, dt)).status, 400);

  me = (await api('POST', '/district/locals', { name: 'Adum', chairName: 'Ama Owusu', chairPhone: '+233 20 111 2222' }, dt)).data;
  me = (await api('POST', '/district/locals', { name: 'Bantama' }, dt)).data;
  assert.equal(me.locals.length, 2);
  assert.equal((await api('POST', '/district/locals', { name: 'adum' }, dt)).status, 409);
  const adum = me.locals.find((l: any) => l.name === 'Adum');
  assert.match(adum.code, /^L-/);

  // local chairman signs in and fills units
  const lacc = await api('POST', '/access', { code: adum.code });
  assert.equal(lacc.data.role, 'local');
  const lt = lacc.data.token;
  assert.equal((await api('GET', '/district/me', undefined, lt)).status, 401, 'local token cannot use district API');
  const badCat = await api('PUT', '/local/units', { units: [{ name: 'Adum Presby JHS', category: 'Nope' }] }, lt);
  assert.equal(badCat.status, 400);
  const twice = await api('PUT', '/local/units', { units: [{ name: 'A School', category: 'Basic Units' }, { name: 'a school', category: 'Basic Units' }] }, lt);
  assert.equal(twice.status, 400);
  const lu = await api('PUT', '/local/units', {
    units: [
      { name: 'Adum Presby JHS', category: 'Basic Units' },
      { name: 'Metro Education Directorate', category: 'Education Administration Units' },
      { name: 'Shared Academy', category: 'Private Schools' },
    ],
  }, lt);
  assert.equal(lu.status, 200);
  assert.equal(lu.data.units.length, 3);
  assert.equal((await api('POST', '/local/submit', {}, lt)).status, 200);
  assert.equal((await api('PUT', '/local/units', { units: [] }, lt)).status, 409, 'locked after submit');
  assert.equal((await api('POST', '/local/reopen', {}, lt)).status, 200);
  assert.equal((await api('POST', '/local/submit', {}, lt)).status, 200);

  // district fills Bantama on behalf (missing chairman → cannot submit)
  const bant = me.locals.find((l: any) => l.name === 'Bantama');
  assert.equal((await api('PUT', `/district/locals/${bant.id}/units`, { units: [{ name: 'Shared Academy', category: 'Private Schools' }] }, dt)).status, 200);
  assert.equal((await api('POST', `/district/locals/${bant.id}/submit`, {}, dt)).status, 400);
  await api('PATCH', `/district/locals/${bant.id}`, { chairName: 'Yaw Boateng', chairPhone: '0501234567' }, dt);
  assert.equal((await api('POST', `/district/locals/${bant.id}/submit`, {}, dt)).status, 200);

  // reset local code invalidates old token
  await api('POST', `/district/locals/${adum.id}/reset-code`, {}, dt);
  assert.equal((await api('GET', '/local/me', undefined, lt)).status, 401);
  assert.equal((await api('POST', '/access', { code: adum.code })).status, 404);

  // district submits
  const sub = await api('POST', '/district/submit', {}, dt);
  assert.equal(sub.status, 200, JSON.stringify(sub.data));
  assert.equal(sub.data.status, 'submitted');
  assert.equal((await api('POST', '/district/locals', { name: 'Late' }, dt)).status, 409);

  // admin views
  const ov = (await api('GET', '/admin/overview', undefined, at)).data;
  assert.equal(ov.totals.districts, 1);
  assert.equal(ov.totals.locals, 2);
  assert.equal(ov.totals.units, 4);
  assert.equal(ov.totals.politicalCovered, 2);
  assert.equal(ov.unitsByCategory.find((c: any) => c.category === 'Private Schools').count, 2);
  assert.ok(ov.timeline.length >= 1);
  const dups = (await api('GET', '/admin/duplicates', undefined, at)).data;
  assert.equal(dups.length, 1);
  assert.equal(dups[0].entries.length, 2);

  // return and resubmit
  assert.equal((await api('POST', `/admin/districts/${me.id}/status`, { status: 'returned' }, at)).status, 400, 'note required');
  const ret = await api('POST', `/admin/districts/${me.id}/status`, { status: 'returned', note: 'Add Suame too' }, at);
  assert.equal(ret.data.status, 'returned');
  const me2 = (await api('GET', '/district/me', undefined, dt)).data;
  assert.equal(me2.adminNote, 'Add Suame too');
  assert.equal((await api('POST', '/district/submit', {}, dt)).status, 200);
  const appr = await api('POST', `/admin/districts/${me.id}/approve-all`, {}, at);
  assert.equal(appr.data.status, 'approved');
  assert.ok(appr.data.locals.every((l: any) => l.status === 'approved'));
  assert.equal((await api('POST', '/district/reopen', {}, dt)).status, 409, 'approved cannot be reopened by chairman');

  // codes & audit
  const codes = (await api('GET', '/admin/codes', undefined, at)).data;
  assert.equal(codes.length, 3);
  assert.ok((await api('GET', '/admin/audit', undefined, at)).data.length > 5);

  // exports
  const x = await api('GET', '/admin/export.xlsx', undefined, at);
  assert.equal(x.status, 200);
  assert.ok((x.data as ArrayBuffer).byteLength > 5000);
  const csv = await api('GET', '/admin/export.csv?level=units', undefined, at);
  const text = new TextDecoder().decode(csv.data);
  assert.match(text, /Adum Presby JHS/);
  const pdf = await api('GET', '/admin/report.pdf', undefined, at);
  assert.equal(pdf.status, 200);
  assert.equal(new TextDecoder().decode((pdf.data as ArrayBuffer).slice(0, 4)), '%PDF');

  // unauthenticated admin access
  assert.equal((await api('GET', '/admin/overview')).status, 401);
  assert.equal((await api('GET', '/admin/overview', undefined, dt)).status, 401);
});
