import express, { Router } from 'express';
import { z } from 'zod';
import { audit } from '../audit';
import { requireRole } from '../auth';
import { query } from '../db';
import { ghPhone, nameStr, optionalText, parse } from '../http';
import { parseUnitsFile } from '../importUnits';
import { getLocalRow, localDetail, renameEntity, reopenLocal, replaceUnits, submitLocal, unitsSchema } from '../services';

export const localRouter = Router();
localRouter.use(requireRole('local'));

const sid = (req: any) => (req.session as { localId: number }).localId;

localRouter.get('/me', async (req, res) => {
  res.json(await localDetail(sid(req), false));
});

export const detailsSchema = z.object({
  /** The local's own name: can be corrected until the local is approved. */
  name: nameStr.optional(),
  chairName: nameStr.optional(),
  chairPhone: ghPhone,
  remarks: optionalText(1000),
});

localRouter.patch('/me', async (req, res) => {
  const b = parse(detailsSchema, req.body);
  const renamed = await renameEntity('local', await getLocalRow(sid(req)), b.name);
  if (renamed) await audit(req, 'local.rename', { type: 'local', id: sid(req) }, renamed);
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

/** Reads an uploaded Excel/CSV list. Nothing is saved: the editor shows the rows first. */
localRouter.post('/units/import', express.raw({ type: () => true, limit: '2mb' }), async (req, res) => {
  res.json(await parseUnitsFile(req.body));
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
