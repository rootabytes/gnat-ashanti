import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { duplicates, overview } from '../analytics';
import { audit } from '../audit';
import { requireRole, signSession } from '../auth';
import { config } from '../config';
import { decryptCode, generateTempPassword, newCode } from '../crypto';
import { one, query } from '../db';
import { sendCsv, sendPdf, sendXlsx } from '../exports';
import { ghPhone, HttpError, intParam, nameStr, optionalText, parse } from '../http';
import { isDemoEmail } from '../demo';
import { districtDetail, localDetail } from '../services';

export const adminRouter = Router();

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

// Only failed attempts count: it stops password guessing without locking out an admin on several devices.
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait 15 minutes.' },
});

/** `login` is an email address or a Ghana phone number (`email` is accepted as an older name for it). */
export const loginSchema = z.object({ login: z.string().trim().min(3).max(200), password: z.string().min(1).max(200) });

/** Finds an admin by email, or by phone number in any common Ghana format. */
async function findAdminBySignIn(login: string) {
  if (login.includes('@')) return one('SELECT * FROM admins WHERE email = $1', [login.toLowerCase()]);
  const phone = ghPhone.safeParse(login);
  return phone.success && phone.data ? one('SELECT * FROM admins WHERE phone = $1', [phone.data]) : undefined;
}

adminRouter.post('/login', loginLimiter, async (req, res) => {
  const b = parse(loginSchema, { login: req.body?.login ?? req.body?.email, password: req.body?.password });
  const a = await findAdminBySignIn(b.login);
  const ok = await bcrypt.compare(b.password, a?.password_hash ?? DUMMY_HASH);
  if (!a || !ok) throw new HttpError(401, 'Email, phone number or password is not correct.');
  if (a.password_expires_at && new Date(a.password_expires_at) < new Date()) {
    throw new HttpError(401, 'This temporary password has expired. Ask the super admin to send you a new one.');
  }
  await query('UPDATE admins SET last_login_at = now() WHERE id = $1', [a.id]);
  const token = signSession({ role: 'admin', adminId: a.id, regionId: a.region_id, name: a.name });
  req.session = { role: 'admin', adminId: a.id, regionId: a.region_id, name: a.name };
  await audit(req, 'admin.login', { type: 'admin', id: a.id, regionId: a.region_id });
  res.json({ token, name: a.name, email: a.email, mustChangePassword: a.must_change_password });
});

adminRouter.use(requireRole('admin'));

const admin = (req: any) => req.session as { adminId: number; regionId: number | null; name: string };

/** Admins tied to a region only ever see that region; regional-level admins pick one with ?regionId. */
async function region(req: any): Promise<{ id: number; name: string; code: string }> {
  const a = admin(req);
  const requested = req.query.regionId ? Number(req.query.regionId) : null;
  const id = a.regionId ?? requested;
  const r = id
    ? await one('SELECT id, name, code FROM regions WHERE id = $1', [id])
    : await one(`SELECT id, name, code FROM regions WHERE active ORDER BY (code = 'ASH') DESC, name LIMIT 1`);
  if (!r) throw new HttpError(404, 'Region not found');
  return r;
}

async function districtInScope(req: any, id: number) {
  const a = admin(req);
  const d = await one('SELECT id, region_id, name FROM districts WHERE id = $1', [id]);
  if (!d || (a.regionId && d.region_id !== a.regionId)) throw new HttpError(404, 'District not found');
  return d;
}

async function localInScope(req: any, id: number) {
  const a = admin(req);
  const l = await one(
    'SELECT l.id, l.name, l.district_id, d.region_id FROM locals l JOIN districts d ON d.id = l.district_id WHERE l.id = $1',
    [id],
  );
  if (!l || (a.regionId && l.region_id !== a.regionId)) throw new HttpError(404, 'Local not found');
  return l;
}

const ADMIN_FIELDS = 'id, email, phone, name, region_id, must_change_password';
const isDemoAdmin = (a: { email: string | null }) => config.demoMode && !!a.email && isDemoEmail(a.email);

adminRouter.get('/me', async (req, res) => {
  const a = await one(`SELECT ${ADMIN_FIELDS} FROM admins WHERE id = $1`, [admin(req).adminId]);
  const regions = await query(
    `SELECT id, name, code, active, political_regions, registration_key FROM regions
     ${a.region_id ? 'WHERE id = $1' : ''} ORDER BY active DESC, name`,
    a.region_id ? [a.region_id] : [],
  );
  res.json({ ...a, demo: isDemoAdmin(a), regions });
});

export const profileSchema = z.object({
  name: nameStr.optional(),
  email: z.string().trim().toLowerCase().email('enter a valid email address').max(200).optional(),
  phone: ghPhone,
});

/** An admin keeps their own name, email and phone up to date (at first sign-in: adds their email). */
adminRouter.patch('/me', async (req, res) => {
  const b = parse(profileSchema, req.body);
  const cur = await one(`SELECT ${ADMIN_FIELDS} FROM admins WHERE id = $1`, [admin(req).adminId]);
  if (isDemoAdmin(cur)) throw new HttpError(403, 'Demo accounts keep their published sign-in details.');
  try {
    await query('UPDATE admins SET name = COALESCE($2, name), email = COALESCE($3, email), phone = COALESCE($4, phone) WHERE id = $1', [
      cur.id,
      b.name ?? null,
      b.email ?? null,
      b.phone ?? null,
    ]);
  } catch (e: any) {
    if (e?.code === '23505') throw new HttpError(409, 'That email or phone number is already used by another admin.');
    throw e;
  }
  const a = await one(`SELECT ${ADMIN_FIELDS} FROM admins WHERE id = $1`, [cur.id]);
  await audit(req, 'admin.profile', { type: 'admin', id: a.id, regionId: a.region_id }, { name: a.name, email: a.email, phone: a.phone });
  // A fresh token carries the new name into the activity log.
  const token = signSession({ role: 'admin', adminId: a.id, regionId: a.region_id, name: a.name });
  res.json({ token, name: a.name, email: a.email });
});

adminRouter.get('/overview', async (req, res) => {
  const r = await region(req);
  res.json({ region: r, ...(await overview(r.id)) });
});

adminRouter.get('/duplicates', async (req, res) => {
  const r = await region(req);
  res.json(await duplicates(r.id));
});

/** The whole region as Region → District → Local → Unit, for the structure view. */
adminRouter.get('/tree', async (req, res) => {
  const r = await region(req);
  const [districts, political, locals, units] = await Promise.all([
    query('SELECT id, name, status, chair_name, chair_phone FROM districts WHERE region_id = $1 ORDER BY name', [r.id]),
    query(
      `SELECT x.district_id, pd.name FROM district_political_districts x JOIN political_districts pd ON pd.id = x.political_district_id
       JOIN districts d ON d.id = x.district_id WHERE d.region_id = $1 ORDER BY pd.name`,
      [r.id],
    ),
    query(
      `SELECT l.id, l.district_id, l.name, l.status, l.chair_name, l.chair_phone FROM locals l JOIN districts d ON d.id = l.district_id
       WHERE d.region_id = $1 ORDER BY l.name`,
      [r.id],
    ),
    query(
      `SELECT b.id, b.local_id, b.name, b.category, b.gps_address FROM basic_units b JOIN locals l ON l.id = b.local_id JOIN districts d ON d.id = l.district_id
       WHERE d.region_id = $1 ORDER BY b.sort, b.id`,
      [r.id],
    ),
  ]);
  const unitsBy = new Map<number, any[]>();
  units.forEach((u) =>
    (unitsBy.get(u.local_id) ?? unitsBy.set(u.local_id, []).get(u.local_id)!).push({
      id: u.id,
      name: u.name,
      category: u.category,
      gpsAddress: u.gps_address,
    }),
  );
  const localsBy = new Map<number, any[]>();
  locals.forEach((l) =>
    (localsBy.get(l.district_id) ?? localsBy.set(l.district_id, []).get(l.district_id)!).push({
      id: l.id,
      name: l.name,
      status: l.status,
      chairName: l.chair_name,
      chairPhone: l.chair_phone,
      units: unitsBy.get(l.id) ?? [],
    }),
  );
  const polBy = new Map<number, string[]>();
  political.forEach((p) => (polBy.get(p.district_id) ?? polBy.set(p.district_id, []).get(p.district_id)!).push(p.name));
  res.json({
    region: r,
    districts: districts.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      chairName: d.chair_name,
      chairPhone: d.chair_phone,
      politicalDistricts: polBy.get(d.id) ?? [],
      locals: localsBy.get(d.id) ?? [],
    })),
  });
});

adminRouter.get('/districts/:id', async (req, res) => {
  const d = await districtInScope(req, intParam(req.params.id));
  res.json(await districtDetail(d.id, { includeCodes: true, includeUnits: true }));
});

adminRouter.get('/locals/:id', async (req, res) => {
  const l = await localInScope(req, intParam(req.params.id));
  res.json(await localDetail(l.id, true));
});

export const createDistrictSchema = z.object({
  name: nameStr,
  chairName: optionalText(150),
  chairPhone: ghPhone,
  chairGroup: optionalText(150),
});

adminRouter.post('/districts', async (req, res) => {
  const r = await region(req);
  const b = parse(createDistrictSchema, req.body);
  const c = newCode('D');
  const d = await one(
    `INSERT INTO districts (region_id, name, chair_name, chair_phone, chair_group, code_lookup, code_enc, verified)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING id`,
    [r.id, b.name, b.chairName, b.chairPhone, b.chairGroup, c.lookup, c.enc],
  );
  await audit(req, 'district.create', { type: 'district', id: d.id, regionId: r.id }, { name: b.name });
  res.status(201).json(await districtDetail(d.id, { includeCodes: true, includeUnits: true }));
});

export const editDistrictSchema = z.object({
  name: nameStr.optional(),
  chairName: optionalText(150),
  chairPhone: ghPhone,
  chairGroup: optionalText(150),
  verified: z.boolean().optional(),
});

adminRouter.patch('/districts/:id', async (req, res) => {
  const d = await districtInScope(req, intParam(req.params.id));
  const b = parse(editDistrictSchema, req.body);
  await query(
    `UPDATE districts SET name = COALESCE($2, name), chair_name = COALESCE($3, chair_name), chair_phone = COALESCE($4, chair_phone),
       chair_group = COALESCE($5, chair_group), verified = COALESCE($6, verified), updated_at = now() WHERE id = $1`,
    [d.id, b.name ?? null, b.chairName, b.chairPhone, b.chairGroup, b.verified ?? null],
  );
  await audit(req, 'district.edit', { type: 'district', id: d.id, regionId: d.region_id }, b);
  res.json(await districtDetail(d.id, { includeCodes: true, includeUnits: true }));
});

adminRouter.delete('/districts/:id', async (req, res) => {
  const d = await districtInScope(req, intParam(req.params.id));
  await query('DELETE FROM districts WHERE id = $1', [d.id]);
  await audit(req, 'district.delete', { type: 'district', id: d.id, regionId: d.region_id }, { name: d.name });
  res.json({ ok: true });
});

export const statusSchema = z.object({
  status: z.enum(['approved', 'returned', 'draft']),
  note: optionalText(1000),
});

adminRouter.post('/districts/:id/status', async (req, res) => {
  const d = await districtInScope(req, intParam(req.params.id));
  const b = parse(statusSchema, req.body);
  if (b.status === 'returned' && !b.note) throw new HttpError(400, 'Please say what needs correcting when returning a submission.');
  await query(
    `UPDATE districts SET status = $2, admin_note = $3, approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE NULL END,
       updated_at = now() WHERE id = $1`,
    [d.id, b.status, b.note],
  );
  await audit(req, `district.${b.status}`, { type: 'district', id: d.id, regionId: d.region_id }, { note: b.note });
  res.json(await districtDetail(d.id, { includeCodes: true, includeUnits: true }));
});

adminRouter.post('/locals/:id/status', async (req, res) => {
  const l = await localInScope(req, intParam(req.params.id));
  const b = parse(statusSchema, req.body);
  if (b.status === 'returned' && !b.note) throw new HttpError(400, 'Please say what needs correcting when returning a submission.');
  await query(
    `UPDATE locals SET status = $2, admin_note = $3, approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE NULL END,
       updated_at = now() WHERE id = $1`,
    [l.id, b.status, b.note],
  );
  await audit(req, `local.${b.status}`, { type: 'local', id: l.id, regionId: l.region_id }, { note: b.note });
  res.json(await districtDetail(l.district_id, { includeCodes: true, includeUnits: true }));
});

/** Approve a district together with every submitted local in it. */
adminRouter.post('/districts/:id/approve-all', async (req, res) => {
  const d = await districtInScope(req, intParam(req.params.id));
  await query(
    `UPDATE districts SET status = 'approved', admin_note = NULL, approved_at = now(), updated_at = now() WHERE id = $1 AND status = 'submitted'`,
    [d.id],
  );
  await query(
    `UPDATE locals SET status = 'approved', admin_note = NULL, approved_at = now(), updated_at = now() WHERE district_id = $1 AND status = 'submitted'`,
    [d.id],
  );
  await audit(req, 'district.approve_all', { type: 'district', id: d.id, regionId: d.region_id });
  res.json(await districtDetail(d.id, { includeCodes: true, includeUnits: true }));
});

adminRouter.delete('/locals/:id', async (req, res) => {
  const l = await localInScope(req, intParam(req.params.id));
  await query('DELETE FROM locals WHERE id = $1', [l.id]);
  await audit(req, 'local.delete', { type: 'local', id: l.id, regionId: l.region_id }, { name: l.name });
  res.json(await districtDetail(l.district_id, { includeCodes: true, includeUnits: true }));
});

adminRouter.post('/districts/:id/reset-code', async (req, res) => {
  const d = await districtInScope(req, intParam(req.params.id));
  const c = newCode('D');
  await query('UPDATE districts SET code_lookup = $2, code_enc = $3, code_version = code_version + 1 WHERE id = $1', [
    d.id,
    c.lookup,
    c.enc,
  ]);
  await audit(req, 'district.reset_code', { type: 'district', id: d.id, regionId: d.region_id });
  res.json(await districtDetail(d.id, { includeCodes: true, includeUnits: true }));
});

adminRouter.post('/locals/:id/reset-code', async (req, res) => {
  const l = await localInScope(req, intParam(req.params.id));
  const c = newCode('L');
  await query('UPDATE locals SET code_lookup = $2, code_enc = $3, code_version = code_version + 1 WHERE id = $1', [l.id, c.lookup, c.enc]);
  await audit(req, 'local.reset_code', { type: 'local', id: l.id, regionId: l.region_id });
  res.json(await districtDetail(l.district_id, { includeCodes: true, includeUnits: true }));
});

/** Every access code in the region, for printing or sharing. */
adminRouter.get('/codes', async (req, res) => {
  const r = await region(req);
  const rows = await query(
    `SELECT 'district' AS kind, d.id, d.name, NULL AS district, d.chair_name, d.chair_phone, d.status, d.code_enc
       FROM districts d WHERE d.region_id = $1
     UNION ALL
     SELECT 'local', l.id, l.name, d.name, l.chair_name, l.chair_phone, l.status, l.code_enc
       FROM locals l JOIN districts d ON d.id = l.district_id WHERE d.region_id = $1
     ORDER BY 4 NULLS FIRST, 3`,
    [r.id],
  );
  res.json(rows.map(({ code_enc, ...x }) => ({ ...x, code: decryptCode(code_enc) })));
});

adminRouter.get('/audit', async (req, res) => {
  const r = await region(req);
  const limit = Math.min(500, Number(req.query.limit) || 100);
  res.json(
    await query(
      `SELECT a.*, CASE WHEN a.entity_type = 'district' THEN (SELECT name FROM districts WHERE id = a.entity_id)
                        WHEN a.entity_type = 'local' THEN (SELECT name FROM locals WHERE id = a.entity_id) END AS entity_name
       FROM audit_log a WHERE a.region_id = $1 ORDER BY a.created_at DESC LIMIT $2`,
      [r.id, limit],
    ),
  );
});

// ----- settings -----

export const regionSchema = z.object({
  registrationKey: z.string().trim().max(100).optional().nullable(),
  active: z.boolean().optional(),
  politicalRegions: z.array(z.string().trim().min(2).max(60)).max(10).optional(),
});

adminRouter.patch('/regions/:id', async (req, res) => {
  const a = admin(req);
  const id = intParam(req.params.id);
  if (a.regionId && a.regionId !== id) throw new HttpError(404, 'Region not found');
  const b = parse(regionSchema, req.body);
  if (b.active !== undefined && a.regionId) throw new HttpError(403, 'Only the super admin can open or close regions.');
  await query(
    `UPDATE regions SET registration_key = CASE WHEN $2::boolean THEN $3 ELSE registration_key END,
       active = COALESCE($4, active), political_regions = COALESCE($5, political_regions) WHERE id = $1`,
    [id, b.registrationKey !== undefined, b.registrationKey || null, b.active ?? null, b.politicalRegions ?? null],
  );
  await audit(
    req,
    'region.edit',
    { type: 'region', id, regionId: id },
    { ...b, registrationKey: b.registrationKey ? '(set)' : b.registrationKey },
  );
  res.json(await one('SELECT id, name, code, active, political_regions, registration_key FROM regions WHERE id = $1', [id]));
});

adminRouter.get('/political-districts', async (req, res) => {
  const r = await region(req);
  res.json(await query('SELECT id, name, kind FROM political_districts WHERE region_id = $1 ORDER BY name', [r.id]));
});

export const politicalDistrictSchema = z.object({ name: nameStr, kind: z.enum(['Metropolitan', 'Municipal', 'District']) });

adminRouter.post('/political-districts', async (req, res) => {
  const r = await region(req);
  const b = parse(politicalDistrictSchema, req.body);
  const row = await one('INSERT INTO political_districts (region_id, name, kind) VALUES ($1,$2,$3) RETURNING *', [r.id, b.name, b.kind]);
  await audit(req, 'political.create', { type: 'political', id: row.id, regionId: r.id }, b);
  res.status(201).json(row);
});

adminRouter.delete('/political-districts/:id', async (req, res) => {
  const r = await region(req);
  const id = intParam(req.params.id);
  const used = await one('SELECT count(*)::int AS n FROM district_political_districts WHERE political_district_id = $1', [id]);
  if (used?.n) throw new HttpError(409, `This district is mapped by ${used.n} GNAT district(s). Remove it from them first.`);
  await query('DELETE FROM political_districts WHERE id = $1 AND region_id = $2', [id, r.id]);
  res.json({ ok: true });
});

export const passwordSchema = z.object({ current: z.string().min(1), next: z.string().min(10, 'must be at least 10 characters').max(200) });

adminRouter.post('/password', async (req, res) => {
  const b = parse(passwordSchema, req.body);
  const a = await one('SELECT email, password_hash FROM admins WHERE id = $1', [admin(req).adminId]);
  if (isDemoAdmin(a)) throw new HttpError(403, 'Demo accounts keep their published password so every tester can sign in.');
  if (!(await bcrypt.compare(b.current, a.password_hash))) throw new HttpError(400, 'Current password is not correct.');
  if (b.current === b.next) throw new HttpError(400, 'New password: choose a different password from the current one.');
  // Every admin needs an email: it is how they sign in and how they are reached.
  if (!a.email) throw new HttpError(400, 'Add your email address first.');
  await query('UPDATE admins SET password_hash = $2, must_change_password = FALSE, password_expires_at = NULL WHERE id = $1', [
    admin(req).adminId,
    await bcrypt.hash(b.next, 12),
  ]);
  await audit(req, 'admin.password', { type: 'admin', id: admin(req).adminId, regionId: admin(req).regionId });
  res.json({ ok: true });
});

// ----- admin accounts (super admin only: an admin with no region sees every region) -----

/** How long a temporary password sent on WhatsApp keeps working if it is never replaced. */
const TEMP_PASSWORD_DAYS = 7;

function requireSuper(req: any) {
  if (admin(req).regionId) throw new HttpError(403, 'Only the super admin can manage admins.');
}

const ADMIN_LIST = `SELECT a.id, a.email, a.phone, a.name, a.region_id, r.name AS region_name, a.last_login_at,
    a.must_change_password, a.password_expires_at
  FROM admins a LEFT JOIN regions r ON r.id = a.region_id`;

/** A new temporary password: works for TEMP_PASSWORD_DAYS and only opens the account set-up screen. */
async function issueTempPassword() {
  const tempPassword = generateTempPassword();
  return { tempPassword, hash: await bcrypt.hash(tempPassword, 12) };
}

adminRouter.get('/admins', async (req, res) => {
  requireSuper(req);
  res.json(await query(`${ADMIN_LIST} ORDER BY a.region_id NULLS FIRST, a.id`));
});

export const createAdminSchema = z.object({
  name: nameStr,
  phone: ghPhone.refine((v) => !!v, 'is required: the sign-in details are sent there'),
  email: z.string().trim().toLowerCase().email('enter a valid email address').max(200).optional().nullable(),
  regionId: z.number().int().positive().nullable(),
});

/** Adds an admin and returns a temporary password for the super admin to send them on WhatsApp. */
adminRouter.post('/admins', async (req, res) => {
  requireSuper(req);
  const b = parse(createAdminSchema, req.body);
  const { tempPassword, hash } = await issueTempPassword();
  let row;
  try {
    row = await one(
      `INSERT INTO admins (email, phone, name, password_hash, region_id, must_change_password, password_expires_at)
       VALUES ($1,$2,$3,$4,$5,TRUE, now() + interval '${TEMP_PASSWORD_DAYS} days') RETURNING id`,
      [b.email || null, b.phone, b.name, hash, b.regionId],
    );
  } catch (e: any) {
    if (e?.code === '23505') throw new HttpError(409, 'An admin with that phone number or email already exists.');
    throw e;
  }
  await audit(req, 'admin.create', { type: 'admin', id: row.id, regionId: b.regionId }, { name: b.name, phone: b.phone });
  res.status(201).json({ ...(await one(`${ADMIN_LIST} WHERE a.id = $1`, [row.id])), tempPassword });
});

/** Forgotten password or lost message: a new temporary password to send again. */
adminRouter.post('/admins/:id/reset-password', async (req, res) => {
  requireSuper(req);
  const id = intParam(req.params.id);
  if (id === admin(req).adminId) throw new HttpError(400, 'Change your own password under Your account.');
  const { tempPassword, hash } = await issueTempPassword();
  const row = await one(
    `UPDATE admins SET password_hash = $2, must_change_password = TRUE, password_expires_at = now() + interval '${TEMP_PASSWORD_DAYS} days'
     WHERE id = $1 RETURNING id, region_id`,
    [id, hash],
  );
  if (!row) throw new HttpError(404, 'Admin not found');
  await audit(req, 'admin.reset_password', { type: 'admin', id, regionId: row.region_id });
  res.json({ ...(await one(`${ADMIN_LIST} WHERE a.id = $1`, [id])), tempPassword });
});

adminRouter.delete('/admins/:id', async (req, res) => {
  requireSuper(req);
  const id = intParam(req.params.id);
  if (id === admin(req).adminId) throw new HttpError(400, 'You cannot remove your own account.');
  const row = await one('DELETE FROM admins WHERE id = $1 RETURNING id, name, region_id', [id]);
  if (!row) throw new HttpError(404, 'Admin not found');
  await audit(req, 'admin.remove', { type: 'admin', id, regionId: row.region_id }, { name: row.name });
  res.json({ ok: true });
});

// ----- exports -----

adminRouter.get('/export.xlsx', async (req, res) => {
  const r = await region(req);
  await audit(req, 'export.xlsx', { type: 'region', id: r.id, regionId: r.id });
  await sendXlsx(res, r.id, r.name);
});

adminRouter.get('/export.csv', async (req, res) => {
  const r = await region(req);
  await audit(req, 'export.csv', { type: 'region', id: r.id, regionId: r.id }, { level: req.query.level });
  await sendCsv(res, r.id, r.name, String(req.query.level ?? 'units'));
});

adminRouter.get('/report.pdf', async (req, res) => {
  const r = await region(req);
  await audit(req, 'export.pdf', { type: 'region', id: r.id, regionId: r.id });
  await sendPdf(res, r.id, r.name);
});
