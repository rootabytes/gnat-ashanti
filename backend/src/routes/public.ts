import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { audit } from '../audit';
import { signSession } from '../auth';
import { codeLookup, newCode } from '../crypto';
import { one, query } from '../db';
import { ghPhone, HttpError, nameStr, optionalText, parse } from '../http';
import { CATEGORY_LABELS, WORKPLACE_CATEGORIES } from '../reference';

export const publicRouter = Router();

// Generous limits: many teachers in one town can share a mobile carrier IP.
const accessLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' } });
const registerLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Too many registrations from this network. Please try again later.' } });

publicRouter.get('/meta', async (_req, res) => {
  const regions = await query(
    `SELECT id, name, code, (registration_key IS NOT NULL AND registration_key <> '') AS requires_key
     FROM regions WHERE active ORDER BY name`,
  );
  res.json({
    categories: WORKPLACE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
    regions: regions.map((r) => ({ id: r.id, name: r.name, code: r.code, requiresKey: r.requires_key })),
  });
});

publicRouter.get('/regions/:id/political-districts', async (req, res) => {
  const rows = await query(
    `SELECT pd.id, pd.name, pd.kind FROM political_districts pd JOIN regions r ON r.id = pd.region_id
     WHERE r.id = $1 AND r.active ORDER BY pd.name`,
    [Number(req.params.id) || 0],
  );
  res.json(rows);
});

const registerSchema = z.object({
  regionId: z.number().int().positive(),
  registrationKey: z.string().trim().max(100).optional().nullable(),
  districtName: nameStr,
  chairName: nameStr,
  chairPhone: ghPhone.refine((v) => !!v, 'is required'),
  chairGroup: optionalText(150),
});

publicRouter.post('/register', registerLimiter, async (req, res) => {
  const body = parse(registerSchema, req.body);
  const region = await one('SELECT * FROM regions WHERE id = $1 AND active', [body.regionId]);
  if (!region) throw new HttpError(400, 'That region is not collecting data yet.');
  if (region.registration_key && region.registration_key.trim().toLowerCase() !== (body.registrationKey ?? '').trim().toLowerCase()) {
    throw new HttpError(403, 'The registration key is not correct. Ask the Regional Secretary for it.');
  }
  const exists = await one('SELECT id FROM districts WHERE region_id = $1 AND lower(name) = lower($2)', [region.id, body.districtName]);
  if (exists) {
    throw new HttpError(
      409,
      `${body.districtName} is already registered. If you are its chairman, ask the Regional Secretary for your access code.`,
    );
  }
  const c = newCode('D');
  const d = await one(
    `INSERT INTO districts (region_id, name, chair_name, chair_phone, chair_group, code_lookup, code_enc)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, code_version`,
    [region.id, body.districtName, body.chairName, body.chairPhone, body.chairGroup, c.lookup, c.enc],
  );
  const token = signSession({ role: 'district', districtId: d.id, regionId: region.id, cv: d.code_version });
  await audit(req, 'district.register', { type: 'district', id: d.id, regionId: region.id }, { name: body.districtName }, body.chairName);
  res.status(201).json({ token, code: c.code, role: 'district', name: body.districtName });
});

const accessSchema = z.object({ code: z.string().trim().min(6).max(40) });

publicRouter.post('/access', accessLimiter, async (req, res) => {
  const { code } = parse(accessSchema, req.body);
  const lookup = codeLookup(code);
  const d = await one(
    `SELECT d.id, d.name, d.region_id, d.code_version FROM districts d JOIN regions r ON r.id = d.region_id
     WHERE d.code_lookup = $1`,
    [lookup],
  );
  if (d) {
    return res.json({
      role: 'district',
      name: d.name,
      token: signSession({ role: 'district', districtId: d.id, regionId: d.region_id, cv: d.code_version }),
    });
  }
  const l = await one(
    `SELECT l.id, l.name, l.district_id, l.code_version, d.region_id FROM locals l JOIN districts d ON d.id = l.district_id
     WHERE l.code_lookup = $1`,
    [lookup],
  );
  if (l) {
    return res.json({
      role: 'local',
      name: l.name,
      token: signSession({ role: 'local', localId: l.id, districtId: l.district_id, regionId: l.region_id, cv: l.code_version }),
    });
  }
  throw new HttpError(404, 'That code was not recognised. Check it and try again, or ask whoever gave it to you.');
});
