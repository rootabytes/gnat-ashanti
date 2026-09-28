import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../audit';
import { requireRole } from '../auth';
import { query } from '../db';
import { ghPhone, nameStr, optionalText, parse } from '../http';
import { localDetail, reopenLocal, replaceUnits, submitLocal, unitsSchema } from '../services';

export const localRouter = Router();
localRouter.use(requireRole('local'));

const sid = (req: any) => (req.session as { localId: number }).localId;

localRouter.get('/me', async (req, res) => {
  res.json(await localDetail(sid(req), false));
});

const detailsSchema = z.object({
  chairName: nameStr.optional(),
  chairPhone: ghPhone,
  remarks: optionalText(1000),
});

localRouter.patch('/me', async (req, res) => {
  const b = parse(detailsSchema, req.body);
  await query(
    `UPDATE locals SET chair_name = COALESCE($2, chair_name), chair_phone = COALESCE($3, chair_phone),
       remarks = $4, updated_at = now() WHERE id = $1`,
    [sid(req), b.chairName ?? null, b.chairPhone, b.remarks],
  );
  res.json(await localDetail(sid(req), false));
});

localRouter.put('/units', async (req, res) => {
  const { units } = parse(unitsSchema, req.body);
  await replaceUnits(sid(req), units);
  await audit(req, 'local.units', { type: 'local', id: sid(req) }, { count: units.length });
  res.json(await localDetail(sid(req), false));
});

localRouter.post('/submit', async (req, res) => {
  await submitLocal(sid(req));
  await audit(req, 'local.submit', { type: 'local', id: sid(req) });
  res.json(await localDetail(sid(req), false));
});

localRouter.post('/reopen', async (req, res) => {
  await reopenLocal(sid(req));
  await audit(req, 'local.reopen', { type: 'local', id: sid(req) });
  res.json(await localDetail(sid(req), false));
});
