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

  // the super admin signs in with the seeded temporary password
  const login = await api('POST', '/admin/login', { email: 'Secretary@example.com', password: 'correct-horse-battery' });
  assert.equal(login.status, 200);
  const sa = login.data.token;
  assert.equal((await api('POST', '/admin/login', { email: 'secretary@example.com', password: 'nope' })).status, 401);

  // the seeded password is temporary: nothing but /me and /password until it is changed
  assert.equal(login.data.mustChangePassword, true);
  assert.equal((await api('GET', '/admin/admins', undefined, sa)).status, 403);
  assert.equal((await api('GET', '/admin/me', undefined, sa)).data.must_change_password, true);
  assert.equal(
    (await api('POST', '/admin/password', { current: 'correct-horse-battery', next: 'correct-horse-battery' }, sa)).status,
    400,
    'must differ',
  );
  assert.equal((await api('POST', '/admin/password', { current: 'correct-horse-battery', next: 'a-brand-new-password' }, sa)).status, 200);
  assert.equal((await api('GET', '/admin/admins', undefined, sa)).status, 200);
  assert.equal(
    (await api('POST', '/admin/login', { email: 'secretary@example.com', password: 'a-brand-new-password' })).data.mustChangePassword,
    false,
  );

  // the super admin is not cleared for regional data, so adds the Regional Secretary, who does the regional work
  assert.equal((await api('GET', '/admin/overview', undefined, sa)).status, 403);
  const invite = await api('POST', '/admin/admins', { name: 'Regional Secretary', phone: '024 600 0001', regionId: ash.id }, sa);
  assert.equal(invite.status, 201, JSON.stringify(invite.data));
  let at = (await api('POST', '/admin/login', { login: '0246000001', password: invite.data.tempPassword })).data.token;
  at = (await api('PATCH', '/admin/me', { email: 'regional@example.com' }, at)).data.token;
  assert.equal(
    (await api('POST', '/admin/password', { current: invite.data.tempPassword, next: 'regional-own-password' }, at)).status,
    200,
  );
  assert.equal((await api('GET', '/admin/overview', undefined, at)).status, 200);
  assert.equal((await api('PATCH', `/admin/regions/${ash.id}`, { registrationKey: 'torch2026' }, at)).status, 200);

  // registration requires key
  const reg0 = await api('POST', '/register', {
    regionId: ash.id,
    districtName: 'Kumasi Metro',
    chairName: 'Kofi Mensah',
    chairPhone: '0241234567',
  });
  assert.equal(reg0.status, 403);
  const badPhone = await api('POST', '/register', {
    regionId: ash.id,
    registrationKey: 'TORCH2026',
    districtName: 'Kumasi Metro',
    chairName: 'Kofi Mensah',
    chairPhone: '12345',
  });
  assert.equal(badPhone.status, 400);
  const reg = await api('POST', '/register', {
    regionId: ash.id,
    registrationKey: 'TORCH2026',
    districtName: 'Kumasi Metro',
    chairName: 'Kofi Mensah',
    chairPhone: '024 123 4567',
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.data));
  assert.match(reg.data.code, /^D-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  const dup = await api('POST', '/register', {
    regionId: ash.id,
    registrationKey: 'torch2026',
    districtName: 'kumasi metro',
    chairName: 'X Y',
    chairPhone: '0241234567',
  });
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

  await api('POST', '/district/locals', { name: 'Adum', chairName: 'Ama Owusu', chairPhone: '+233 20 111 2222' }, dt);
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
  const twice = await api(
    'PUT',
    '/local/units',
    {
      units: [
        { name: 'A School', category: 'Basic Units' },
        { name: 'a school', category: 'Basic Units' },
      ],
    },
    lt,
  );
  assert.equal(twice.status, 400);
  const badGps = await api('PUT', '/local/units', { units: [{ name: 'A School', category: 'Basic Units', gpsAddress: 'Kumasi' }] }, lt);
  assert.equal(badGps.status, 400);
  assert.match(badGps.data.error, /GPS address/);
  const lu = await api(
    'PUT',
    '/local/units',
    {
      units: [
        { name: 'Adum Presby JHS', category: 'Basic Units', gpsAddress: 'ak 039 5028' },
        { name: 'Metro Education Directorate', category: 'Education Administration Units' },
        { name: 'Shared Academy', category: 'Private Schools' },
      ],
    },
    lt,
  );
  assert.equal(lu.status, 200);
  assert.equal(lu.data.units.length, 3);
  assert.equal(lu.data.units[0].gpsAddress, 'AK-039-5028');
  assert.equal(lu.data.units[1].gpsAddress, null);
  assert.equal((await api('POST', '/local/submit', {}, lt)).status, 200);
  assert.equal((await api('PUT', '/local/units', { units: [] }, lt)).status, 409, 'locked after submit');
  assert.equal((await api('POST', '/local/reopen', {}, lt)).status, 200);
  assert.equal((await api('POST', '/local/submit', {}, lt)).status, 200);

  // district fills Bantama on behalf (missing chairman → cannot submit)
  const bant = me.locals.find((l: any) => l.name === 'Bantama');
  assert.equal(
    (await api('PUT', `/district/locals/${bant.id}/units`, { units: [{ name: 'Shared Academy', category: 'Private Schools' }] }, dt))
      .status,
    200,
  );
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
  assert.match(text, /AK-039-5028/);
  const pdf = await api('GET', '/admin/report.pdf', undefined, at);
  assert.equal(pdf.status, 200);
  assert.equal(new TextDecoder().decode((pdf.data as ArrayBuffer).slice(0, 4)), '%PDF');

  // unauthenticated admin access
  assert.equal((await api('GET', '/admin/overview')).status, 401);
  assert.equal((await api('GET', '/admin/overview', undefined, dt)).status, 401);
});

async function upload(path: string, body: Uint8Array | string, token: string) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', authorization: `Bearer ${token}` },
    body,
  });
  return { status: res.status, data: (await res.json()) as any };
}

test('workplace import from CSV and the Excel template', async () => {
  const reg = await api('POST', '/register', {
    regionId: (await api('GET', '/meta')).data.regions[0].id,
    registrationKey: 'torch2026',
    districtName: 'Import Test',
    chairName: 'Esi Owusu',
    chairPhone: '0241110000',
  });
  const dt = reg.data.token;
  const me = (await api('POST', '/district/locals', { name: 'Kejetia' }, dt)).data;
  const lt = (await api('POST', '/access', { code: me.locals[0].code })).data.token;

  const csv = [
    'Workplace name,Category,GPS address',
    '"Kejetia Islamic JHS, Block A",basic units,AK0395028',
    'Kejetia M/A Primary,Nope,not-gps',
    'kejetia m/a primary,,',
    'Metro Office,Education Admin,',
  ].join('\r\n');
  const r = await upload('/local/units/import', csv, lt);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.units, [
    { name: 'Kejetia Islamic JHS, Block A', category: 'Basic Units', gpsAddress: 'AK-039-5028' },
    { name: 'Kejetia M/A Primary', category: null, gpsAddress: null },
    { name: 'Metro Office', category: 'Education Administration Units', gpsAddress: null },
  ]);
  assert.equal(r.data.notes.length, 3, 'duplicate, category and GPS notes');
  assert.equal((await api('GET', '/local/me', undefined, lt)).data.units.length, 0, 'import only parses');

  // round trip through the downloadable template
  const ExcelJS = (await import('exceljs')).default;
  const tpl = await fetch(`${base}/units-template.xlsx`);
  assert.equal(tpl.status, 200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await tpl.arrayBuffer());
  const ws = wb.getWorksheet('Workplaces')!;
  ws.addRow(['Adum Presby JHS', 'Private Schools', 'AK-039-5028']);
  ws.addRow(['Bantama Clinic School', 'NaCCA (National Council for Curriculum and Assessment)']);
  const x = await upload('/district/units/import', new Uint8Array(await wb.xlsx.writeBuffer()), dt);
  assert.equal(x.status, 200, JSON.stringify(x.data));
  assert.deepEqual(
    x.data.units.map((u: any) => u.category),
    ['Private Schools', 'NaCCA'],
  );

  assert.equal((await upload('/local/units/import', 'x', lt)).status, 400, 'no names');
  assert.equal((await upload('/local/units/import', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), lt)).status, 400, 'old .xls');
  assert.equal((await upload('/local/units/import', csv, '')).status, 401);
});

test('super admin adds an admin who signs in by phone, then adds their email and password', async () => {
  const sa = (await api('POST', '/admin/login', { login: 'secretary@example.com', password: 'a-brand-new-password' })).data.token;
  const ash = (await api('GET', '/meta')).data.regions[0];

  const add = await api('POST', '/admin/admins', { name: 'Assistant Secretary', phone: '024 777 8888', regionId: ash.id }, sa);
  assert.equal(add.status, 201, JSON.stringify(add.data));
  assert.equal(add.data.phone, '+233247778888');
  assert.equal(add.data.email, null);
  assert.match(add.data.tempPassword, /^Gnat-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal((await api('POST', '/admin/admins', { name: 'Twice', phone: '0247778888', regionId: ash.id }, sa)).status, 409);
  assert.equal((await api('POST', '/admin/admins', { name: 'No Phone', regionId: ash.id }, sa)).status, 400);

  // signs in with the phone number in any format, but can only set up the account
  const first = await api('POST', '/admin/login', { login: '+233 24 777 8888', password: add.data.tempPassword });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.equal(first.data.mustChangePassword, true);
  let t = first.data.token;
  assert.equal((await api('GET', '/admin/overview', undefined, t)).status, 403);
  assert.equal((await api('GET', '/admin/admins', undefined, t)).status, 403, 'not the super admin');
  const noEmail = await api('POST', '/admin/password', { current: add.data.tempPassword, next: 'assistant-own-password' }, t);
  assert.equal(noEmail.status, 400);
  assert.match(noEmail.data.error, /email/);
  assert.equal((await api('PATCH', '/admin/me', { email: 'secretary@example.com' }, t)).status, 409, 'email taken');
  const prof = await api('PATCH', '/admin/me', { email: 'Assistant@Example.com', name: 'Yaw Assistant' }, t);
  assert.equal(prof.status, 200, JSON.stringify(prof.data));
  t = prof.data.token;
  assert.equal((await api('POST', '/admin/password', { current: add.data.tempPassword, next: 'assistant-own-password' }, t)).status, 200);
  assert.equal((await api('GET', '/admin/overview', undefined, t)).status, 200);
  assert.equal((await api('GET', '/admin/me', undefined, t)).data.name, 'Yaw Assistant');

  // from now on: email or phone with his own password; the temporary one is dead
  assert.equal((await api('POST', '/admin/login', { login: 'assistant@example.com', password: 'assistant-own-password' })).status, 200);
  assert.equal((await api('POST', '/admin/login', { login: '0247778888', password: 'assistant-own-password' })).status, 200);
  assert.equal((await api('POST', '/admin/login', { login: '0247778888', password: add.data.tempPassword })).status, 401);

  // forgotten password: the super admin issues a new temporary one
  const reset = await api('POST', `/admin/admins/${add.data.id}/reset-password`, {}, sa);
  assert.equal(reset.status, 200);
  assert.equal((await api('POST', '/admin/login', { login: 'assistant@example.com', password: 'assistant-own-password' })).status, 401);
  assert.equal(
    (await api('POST', '/admin/login', { login: 'assistant@example.com', password: reset.data.tempPassword })).data.mustChangePassword,
    true,
  );

  // an unused temporary password expires
  await pool.query(`UPDATE admins SET password_expires_at = now() - interval '1 minute' WHERE id = $1`, [add.data.id]);
  const expired = await api('POST', '/admin/login', { login: 'assistant@example.com', password: reset.data.tempPassword });
  assert.equal(expired.status, 401);
  assert.match(expired.data.error, /expired/);

  // removing: never yourself
  const me = (await api('GET', '/admin/me', undefined, sa)).data;
  assert.equal((await api('DELETE', `/admin/admins/${me.id}`, undefined, sa)).status, 400);
  assert.equal((await api('DELETE', `/admin/admins/${add.data.id}`, undefined, sa)).status, 200);
  assert.equal((await api('POST', '/admin/login', { login: '0247778888', password: reset.data.tempPassword })).status, 401);
});

test('the super admin manages admins and sees the system, but never regional data', async () => {
  const sa = (await api('POST', '/admin/login', { login: 'secretary@example.com', password: 'a-brand-new-password' })).data.token;
  const ash = (await api('GET', '/meta')).data.regions[0];
  const rt = (await api('POST', '/admin/login', { login: 'regional@example.com', password: 'regional-own-password' })).data.token;
  const districtId = (await pool.query('SELECT id FROM districts WHERE region_id = $1 LIMIT 1', [ash.id])).rows[0].id;
  const localId = (await pool.query('SELECT l.id FROM locals l JOIN districts d ON d.id = l.district_id LIMIT 1')).rows[0].id;

  const regional: [string, string, unknown?][] = [
    ['GET', '/admin/overview'],
    ['GET', '/admin/duplicates'],
    ['GET', '/admin/tree'],
    ['GET', '/admin/codes'],
    ['GET', '/admin/audit'],
    ['GET', `/admin/districts/${districtId}`],
    ['GET', `/admin/locals/${localId}`],
    ['POST', '/admin/districts', { name: 'Sneaky' }],
    ['POST', `/admin/districts/${districtId}/status`, { status: 'approved' }],
    ['POST', `/admin/districts/${districtId}/reset-code`],
    ['DELETE', `/admin/locals/${localId}`],
    ['GET', '/admin/political-districts'],
    ['GET', '/admin/export.xlsx'],
    ['GET', '/admin/export.csv?level=units'],
    ['GET', '/admin/report.pdf'],
    ['PATCH', `/admin/regions/${ash.id}`, { registrationKey: 'mine' }],
  ];
  for (const [method, path, body] of regional) {
    const r = await api(method, `${path}${path.includes('?') ? '&' : '?'}regionId=${ash.id}`, body, sa);
    assert.equal(r.status, 403, `${method} ${path} must be refused to the super admin`);
    if (method === 'GET')
      assert.equal((await api('GET', path, undefined, rt)).status, 200, `${path} still works for the Regional Secretary`);
  }

  // /me shows the regions but not their settings
  const me = (await api('GET', '/admin/me', undefined, sa)).data;
  assert.equal(me.region_id, null);
  assert.ok(me.regions.length >= 10);
  assert.equal(me.regions[0].registration_key, undefined);

  // system status: working parts and accounts, nothing collected by the regions
  const sys = await api('GET', '/admin/system', undefined, sa);
  assert.equal(sys.status, 200);
  assert.equal(sys.data.database.ok, true);
  assert.ok(sys.data.admins.total >= 2);
  assert.equal(sys.data.regions.find((r: any) => r.code === 'ASH').admins >= 1, true);
  const text = JSON.stringify(sys.data);
  for (const leak of ['Kumasi Metro', 'Adum', 'Kofi Mensah', '+233241234567', 'Presby'])
    assert.ok(!text.includes(leak), `system status leaks ${leak}`);

  // activity: admin account events and the super admin's own actions, not the regions' work
  const act = await api('GET', '/admin/activity', undefined, sa);
  assert.equal(act.status, 200);
  const actions = act.data.map((a: any) => a.action);
  assert.ok(actions.includes('admin.create'));
  assert.ok(actions.includes('admin.login'));
  assert.ok(!actions.some((a: string) => /^(district|local|export|political)\./.test(a)), 'no regional events');
  assert.ok(!JSON.stringify(act.data).includes('Kumasi Metro'));

  // regional admins can't use the super admin's views; the super admin can still open or close a region
  assert.equal((await api('GET', '/admin/system', undefined, rt)).status, 403);
  assert.equal((await api('GET', '/admin/activity', undefined, rt)).status, 403);
  assert.equal((await api('PATCH', `/admin/regions/${ash.id}`, { active: true }, sa)).status, 200);
  assert.equal((await api('PATCH', `/admin/regions/${ash.id}`, { active: false }, rt)).status, 403);
});

test('demo guard: no demo routes, and demo mode refuses a database with real data', async () => {
  assert.equal((await api('GET', '/demo')).status, 404);
  assert.equal((await api('GET', '/meta')).data.demo, false);
  const { config } = await import('../src/config');
  const { prepareDatabase } = await import('../src/demo');
  config.demoMode = true;
  try {
    await assert.rejects(prepareDatabase(), /already holds data/);
  } finally {
    config.demoMode = false;
  }
});

test('OpenAPI spec lists every route the server has', async () => {
  const spec = (await api('GET', '/openapi.json')).data;
  assert.equal(spec.openapi, '3.1.0');
  const documented = new Set<string>();
  for (const [p, ops] of Object.entries<any>(spec.paths)) for (const m of Object.keys(ops)) documented.add(`${m} ${p}`);

  const { publicRouter } = await import('../src/routes/public');
  const { districtRouter } = await import('../src/routes/district');
  const { localRouter } = await import('../src/routes/local');
  const { adminRouter } = await import('../src/routes/admin');
  const { demoRouter } = await import('../src/demo');
  const mounted: [string, any][] = [
    ['/api', publicRouter],
    ['/api/district', districtRouter],
    ['/api/local', localRouter],
    ['/api/admin', adminRouter],
    ['/api/demo', demoRouter],
  ];
  const actual = new Set<string>(['get /api/health', 'get /api/openapi.json']);
  for (const [prefix, router] of mounted) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const path = `${prefix}${layer.route.path}`.replace(/\/$/, '').replace(/:(\w+)/g, '{$1}');
      for (const m of Object.keys(layer.route.methods)) actual.add(`${m} ${path}`);
    }
  }
  assert.deepEqual(
    [...actual].filter((r) => !documented.has(r)),
    [],
    'routes missing from openapi.ts',
  );
  assert.deepEqual(
    [...documented].filter((r) => !actual.has(r)),
    [],
    'documented routes that do not exist',
  );
  assert.equal(spec.paths['/api/register'].post.requestBody.content['application/json'].schema.properties.districtName.type, 'string');
});
