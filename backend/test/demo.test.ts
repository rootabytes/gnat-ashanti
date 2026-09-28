// Demo mode against a fresh database. Wipes the database named in TEST_DATABASE_URL.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://gnat:gnat@localhost:5432/gnat_test';
process.env.DEMO_MODE = 'true';
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD;

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
  return { status: res.status, data: (await res.json()) as any };
}

before(async () => {
  const db = await import('../src/db');
  pool = db.pool;
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const { migrate } = await import('../src/schema');
  const { prepareDatabase, resetDemo } = await import('../src/demo');
  const { seed } = await import('../src/seed');
  await migrate();
  await prepareDatabase();
  await prepareDatabase(); // a restart is fine
  await seed();
  await resetDemo();
  const { createApp } = await import('../src/server');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

after(async () => {
  server?.close();
  await pool?.end();
});

test('every demo role can sign in, and reset restores the data', async () => {
  assert.equal((await api('GET', '/meta')).data.demo, true);
  const demo = (await api('GET', '/demo')).data;
  assert.equal(demo.admins.length, 1, 'Regional Secretary only; the national admin is switched off');
  assert.equal(demo.districts.length, 4);
  assert.deepEqual(new Set(demo.districts.map((d: any) => d.status)), new Set(['draft', 'submitted', 'approved', 'returned']));

  for (const a of demo.admins) {
    const login = await api('POST', '/admin/login', { email: a.email, password: demo.password });
    assert.equal(login.status, 200, a.email);
    assert.equal(login.data.mustChangePassword, false);
    const ov = await api('GET', '/admin/overview', undefined, login.data.token);
    assert.equal(ov.data.totals.districts, 4);
    const change = await api('POST', '/admin/password', { current: demo.password, next: 'hijacked-password' }, login.data.token);
    assert.equal(change.status, 403, 'demo passwords stay published');
  }

  const kumasi = demo.districts.find((d: any) => d.name === 'Kumasi Metro');
  const d = await api('POST', '/access', { code: kumasi.code });
  assert.equal(d.data.role, 'district');
  const bantama = demo.locals.find((l: any) => l.name === 'Bantama');
  const l = await api('POST', '/access', { code: bantama.code });
  assert.equal(l.data.role, 'local');
  const lme = (await api('GET', '/local/me', undefined, l.data.token)).data;
  assert.equal(lme.units[1].gpsAddress, 'AK-051-2210');

  // registration with the published key
  const ash = (await api('GET', '/meta')).data.regions[0];
  const reg = await api('POST', '/register', {
    regionId: ash.id,
    registrationKey: demo.registrationKey,
    districtName: 'Tester District',
    chairName: 'Test Person',
    chairPhone: '0240000000',
  });
  assert.equal(reg.status, 201);

  // a tester deletes a district; reset brings everything back with new codes
  const admin = (await api('POST', '/admin/login', { email: demo.admins[0].email, password: demo.password })).data.token;
  const tree = (await api('GET', '/admin/tree', undefined, admin)).data;
  const obuasi = tree.districts.find((x: any) => x.name === 'Obuasi');
  const del = await api('DELETE', `/admin/districts/${obuasi.id}`, { confirm: 'Obuasi' }, admin);
  assert.equal(del.status, 200, JSON.stringify(del.data));
  assert.equal((await api('GET', '/demo')).data.districts.length, 4, '4 - Obuasi + Tester District');

  assert.equal((await api('POST', '/demo/reset')).status, 200);
  const fresh = (await api('GET', '/demo')).data;
  assert.deepEqual(fresh.districts.map((x: any) => x.name).sort(), ['Ejisu', 'Kumasi Metro', 'Obuasi', 'Offinso']);
  assert.equal((await api('GET', '/district/me', undefined, d.data.token)).status, 401, 'old sessions end on reset');
  assert.notEqual(fresh.districts.find((x: any) => x.name === 'Kumasi Metro').code, kumasi.code);
});

test('real mode refuses the demo database', async () => {
  const { config } = await import('../src/config');
  const { prepareDatabase } = await import('../src/demo');
  config.demoMode = false;
  try {
    await assert.rejects(prepareDatabase(), /belongs to the demo site/);
  } finally {
    config.demoMode = true;
  }
});
