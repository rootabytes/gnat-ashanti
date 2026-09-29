import express, { Router } from 'express';
import { z } from 'zod';
import { audit } from '../audit';
import { requireRole } from '../auth';
import { newCode } from '../crypto';
import { one, query, tx } from '../db';
import { ghPhone, HttpError, intParam, nameStr, optionalText, parse } from '../http';
import { parseUnitsFile } from '../importUnits';
import {
  districtDetail,
  getDistrictRow,
  isEditable,
  localDetail,
  reopenDistrict,
  reopenLocal,
  replaceUnits,
  submitDistrict,
  submitLocal,
  unitsSchema,
} from '../services';

export const districtRouter = Router();
districtRouter.use(requireRole('district'));

const sid = (req: any) => (req.session as { districtId: number }).districtId;

async function detail(req: any) {
  return districtDetail(sid(req), { includeCodes: true, includeUnits: false });
}

async function requireEditable(districtId: number) {
  const d = await getDistrictRow(districtId);
  if (!isEditable(d.status)) {
    throw new HttpError(409, 'Your district has been submitted and is locked. Reopen it to make changes.');
  }
  return d;
}

/** Ensures the local belongs to the signed-in district. */
async function ownLocal(req: any) {
  const id = intParam(req.params.id);
  const l = await one('SELECT id FROM locals WHERE id = $1 AND district_id = $2', [id, sid(req)]);
  if (!l) throw new HttpError(404, 'Local not found in your district');
  return id;
}

districtRouter.get('/me', async (req, res) => {
  res.json(await detail(req));
});

export const detailsSchema = z.object({
  chairName: nameStr.optional(),
  chairPhone: ghPhone,
  chairGroup: optionalText(150),
  remarks: optionalText(1000),
});

districtRouter.patch('/me', async (req, res) => {
  const b = parse(detailsSchema, req.body);
  await query(
    `UPDATE districts SET chair_name = COALESCE($2, chair_name), chair_phone = COALESCE($3, chair_phone),
       chair_group = $4, remarks = $5, updated_at = now() WHERE id = $1`,
    [sid(req), b.chairName ?? null, b.chairPhone, b.chairGroup, b.remarks],
  );
  res.json(await detail(req));
});

export const politicalSchema = z.object({ ids: z.array(z.number().int().positive()).max(60) });

districtRouter.put('/political-districts', async (req, res) => {
  const { ids } = parse(politicalSchema, req.body);
  const d = await requireEditable(sid(req));
  const valid = await query<{ id: number }>('SELECT id FROM political_districts WHERE region_id = $1 AND id = ANY($2::int[])', [
    d.region_id,
    ids,
  ]);
  if (valid.length !== new Set(ids).size) throw new HttpError(400, 'One of the selected districts is not in your region.');
  await tx(async (c) => {
    await c.query('DELETE FROM district_political_districts WHERE district_id = $1', [d.id]);
    for (const v of valid) {
      await c.query('INSERT INTO district_political_districts (district_id, political_district_id) VALUES ($1,$2)', [d.id, v.id]);
    }
    await c.query('UPDATE districts SET updated_at = now() WHERE id = $1', [d.id]);
  });
  await audit(req, 'district.political', { type: 'district', id: d.id }, { ids });
  res.json(await detail(req));
});

export const localSchema = z.object({
  name: nameStr,
  chairName: optionalText(150),
  chairPhone: ghPhone,
});

districtRouter.post('/locals', async (req, res) => {
  const b = parse(localSchema, req.body);
  const d = await requireEditable(sid(req));
  const n = await one<{ n: number }>('SELECT count(*)::int AS n FROM locals WHERE district_id = $1', [d.id]);
  if ((n?.n ?? 0) >= 300) throw new HttpError(400, 'A district can have at most 300 locals.');
  const c = newCode('L');
  const l = await one(
    `INSERT INTO locals (district_id, name, chair_name, chair_phone, code_lookup, code_enc)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [d.id, b.name, b.chairName, b.chairPhone, c.lookup, c.enc],
  );
  await query('UPDATE districts SET updated_at = now() WHERE id = $1', [d.id]);
  await audit(req, 'local.create', { type: 'local', id: l.id }, { name: b.name });
  res.status(201).json(await detail(req));
});

districtRouter.patch('/locals/:id', async (req, res) => {
  const id = await ownLocal(req);
  const b = parse(localSchema.partial({ name: true }), req.body);
  // Renaming changes the district's list, so it needs the district to be open.
  // Contact details can be corrected at any time.
  if (b.name) await requireEditable(sid(req));
  await query(
    `UPDATE locals SET name = COALESCE($2, name), chair_name = COALESCE($3, chair_name),
       chair_phone = COALESCE($4, chair_phone), updated_at = now() WHERE id = $1`,
    [id, b.name ?? null, b.chairName, b.chairPhone],
  );
  res.json(await detail(req));
});

districtRouter.delete('/locals/:id', async (req, res) => {
  const id = await ownLocal(req);
  await requireEditable(sid(req));
  const l = await one('SELECT name FROM locals WHERE id = $1', [id]);
  await query('DELETE FROM locals WHERE id = $1', [id]);
  await audit(req, 'local.delete', { type: 'local', id }, { name: l?.name });
  res.json(await detail(req));
});

/**
 * Removes a Local Secretary: their code stops working at once and their name and phone are cleared,
 * keeping the local's workplaces for a new secretary. A local with no workplaces yet is deleted
 * instead, while the district is still open to changes.
 */
districtRouter.post('/locals/:id/remove-secretary', async (req, res) => {
  const id = await ownLocal(req);
  const l = await one<{ name: string; units: number }>(
    'SELECT l.name, (SELECT count(*)::int FROM basic_units u WHERE u.local_id = l.id) AS units FROM locals l WHERE l.id = $1',
    [id],
  );
  const d = await getDistrictRow(sid(req));
  if (!l!.units && isEditable(d.status)) {
    await query('DELETE FROM locals WHERE id = $1', [id]);
    await audit(req, 'local.delete', { type: 'local', id }, { name: l!.name });
  } else {
    const c = newCode('L');
    await query(
      `UPDATE locals SET chair_name = NULL, chair_phone = NULL, code_lookup = $2, code_enc = $3,
         code_version = code_version + 1, updated_at = now() WHERE id = $1`,
      [id, c.lookup, c.enc],
    );
    await audit(req, 'local.remove_secretary', { type: 'local', id }, { name: l!.name });
  }
  res.json(await detail(req));
});

districtRouter.post('/locals/:id/reset-code', async (req, res) => {
  const id = await ownLocal(req);
  const c = newCode('L');
  await query('UPDATE locals SET code_lookup = $2, code_enc = $3, code_version = code_version + 1 WHERE id = $1', [id, c.lookup, c.enc]);
  await audit(req, 'local.reset_code', { type: 'local', id });
  res.json(await detail(req));
});

// The District Secretary can fill in a local on its secretary's behalf.
districtRouter.get('/locals/:id', async (req, res) => {
  res.json(await localDetail(await ownLocal(req), true));
});

districtRouter.put('/locals/:id/units', async (req, res) => {
  const id = await ownLocal(req);
  const { units } = parse(unitsSchema, req.body);
  await replaceUnits(id, units);
  await audit(req, 'local.units', { type: 'local', id }, { count: units.length, by: 'district' });
  res.json(await localDetail(id, true));
});

districtRouter.post('/units/import', express.raw({ type: () => true, limit: '2mb' }), async (req, res) => {
  res.json(await parseUnitsFile(req.body));
});

districtRouter.post('/locals/:id/submit', async (req, res) => {
  const id = await ownLocal(req);
  await submitLocal(id);
  await audit(req, 'local.submit', { type: 'local', id }, { by: 'district' });
  res.json(await localDetail(id, true));
});

districtRouter.post('/locals/:id/reopen', async (req, res) => {
  const id = await ownLocal(req);
  await reopenLocal(id);
  await audit(req, 'local.reopen', { type: 'local', id }, { by: 'district' });
  res.json(await localDetail(id, true));
});

districtRouter.post('/submit', async (req, res) => {
  await submitDistrict(sid(req));
  await audit(req, 'district.submit', { type: 'district', id: sid(req) });
  res.json(await detail(req));
});

districtRouter.post('/reopen', async (req, res) => {
  await reopenDistrict(sid(req));
  await audit(req, 'district.reopen', { type: 'district', id: sid(req) });
  res.json(await detail(req));
});
