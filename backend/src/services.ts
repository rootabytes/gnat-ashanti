import { z } from 'zod';
import { decryptCode } from './crypto';
import { one, query, tx } from './db';
import { HttpError, nameStr } from './http';
import { WORKPLACE_CATEGORIES } from './reference';

export type Status = 'draft' | 'submitted' | 'returned' | 'approved';

export const isEditable = (s: Status) => s === 'draft' || s === 'returned';

export const MAX_UNITS_PER_LOCAL = 400;

export const unitsSchema = z.object({
  units: z
    .array(
      z.object({
        name: nameStr,
        category: z.enum(WORKPLACE_CATEGORIES, { message: 'choose a category from the list' }),
      }),
    )
    .max(MAX_UNITS_PER_LOCAL, `at most ${MAX_UNITS_PER_LOCAL} workplaces per local`),
});

export async function getLocalRow(localId: number) {
  const row = await one(
    `SELECT l.*, d.name AS district_name, d.region_id, r.name AS region_name
     FROM locals l JOIN districts d ON d.id = l.district_id JOIN regions r ON r.id = d.region_id
     WHERE l.id = $1`,
    [localId],
  );
  if (!row) throw new HttpError(404, 'Local not found');
  return row;
}

export async function localDetail(localId: number, includeCode: boolean) {
  const l = await getLocalRow(localId);
  const units = await query('SELECT id, name, category FROM basic_units WHERE local_id = $1 ORDER BY sort, id', [localId]);
  return {
    id: l.id,
    name: l.name,
    districtId: l.district_id,
    districtName: l.district_name,
    regionId: l.region_id,
    regionName: l.region_name,
    chairName: l.chair_name,
    chairPhone: l.chair_phone,
    remarks: l.remarks,
    status: l.status as Status,
    adminNote: l.admin_note,
    submittedAt: l.submitted_at,
    updatedAt: l.updated_at,
    code: includeCode ? decryptCode(l.code_enc) : undefined,
    units,
  };
}

export async function replaceUnits(localId: number, units: { name: string; category: string }[]) {
  const l = await getLocalRow(localId);
  if (!isEditable(l.status)) throw new HttpError(409, 'This local has been submitted and is locked. Reopen it to make changes.');

  const seen = new Set<string>();
  for (const u of units) {
    const k = u.name.toLowerCase();
    if (seen.has(k)) throw new HttpError(400, `"${u.name}" is listed twice.`);
    seen.add(k);
  }

  await tx(async (c) => {
    await c.query('DELETE FROM basic_units WHERE local_id = $1', [localId]);
    for (let i = 0; i < units.length; i++) {
      await c.query('INSERT INTO basic_units (local_id, name, category, sort) VALUES ($1,$2,$3,$4)', [
        localId,
        units[i].name,
        units[i].category,
        i,
      ]);
    }
    await c.query('UPDATE locals SET updated_at = now() WHERE id = $1', [localId]);
  });
}

export async function submitLocal(localId: number) {
  const l = await getLocalRow(localId);
  if (!isEditable(l.status)) throw new HttpError(409, 'This local has already been submitted.');
  const problems: string[] = [];
  if (!l.chair_name) problems.push("Enter the local chairman's name.");
  if (!l.chair_phone) problems.push("Enter the local chairman's phone number.");
  const n = await one<{ n: number }>('SELECT count(*)::int AS n FROM basic_units WHERE local_id = $1', [localId]);
  if (!n?.n) problems.push('Add at least one basic unit or workplace.');
  if (problems.length) throw new HttpError(400, problems.join(' '), problems);
  await query(`UPDATE locals SET status = 'submitted', submitted_at = now(), updated_at = now() WHERE id = $1`, [localId]);
}

/** Chairman pulls back a submission the admin has not approved yet. */
export async function reopenLocal(localId: number) {
  const l = await getLocalRow(localId);
  if (l.status !== 'submitted') throw new HttpError(409, 'Only a submitted (not yet approved) local can be reopened.');
  await query(`UPDATE locals SET status = 'draft', updated_at = now() WHERE id = $1`, [localId]);
}

export async function getDistrictRow(districtId: number) {
  const d = await one(
    `SELECT d.*, r.name AS region_name, r.code AS region_code FROM districts d JOIN regions r ON r.id = d.region_id WHERE d.id = $1`,
    [districtId],
  );
  if (!d) throw new HttpError(404, 'District not found');
  return d;
}

export async function districtDetail(districtId: number, opts: { includeCodes: boolean; includeUnits: boolean }) {
  const d = await getDistrictRow(districtId);
  const political = await query(
    `SELECT pd.id, pd.name, pd.kind FROM district_political_districts dpd
     JOIN political_districts pd ON pd.id = dpd.political_district_id
     WHERE dpd.district_id = $1 ORDER BY pd.name`,
    [districtId],
  );
  const locals = await query(
    `SELECT l.id, l.name, l.chair_name, l.chair_phone, l.status, l.admin_note, l.submitted_at, l.updated_at, l.code_enc,
            (SELECT count(*)::int FROM basic_units b WHERE b.local_id = l.id) AS unit_count
     FROM locals l WHERE l.district_id = $1 ORDER BY l.name`,
    [districtId],
  );
  let unitsByLocal: Record<number, any[]> = {};
  if (opts.includeUnits && locals.length) {
    const units = await query(
      `SELECT b.id, b.local_id, b.name, b.category FROM basic_units b JOIN locals l ON l.id = b.local_id
       WHERE l.district_id = $1 ORDER BY b.local_id, b.sort, b.id`,
      [districtId],
    );
    unitsByLocal = units.reduce<Record<number, any[]>>((acc, u) => {
      (acc[u.local_id] ??= []).push({ id: u.id, name: u.name, category: u.category });
      return acc;
    }, {});
  }
  return {
    id: d.id,
    name: d.name,
    regionId: d.region_id,
    regionName: d.region_name,
    regionCode: d.region_code,
    chairName: d.chair_name,
    chairPhone: d.chair_phone,
    chairGroup: d.chair_group,
    remarks: d.remarks,
    status: d.status as Status,
    adminNote: d.admin_note,
    verified: d.verified,
    submittedAt: d.submitted_at,
    approvedAt: d.approved_at,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    code: opts.includeCodes ? decryptCode(d.code_enc) : undefined,
    politicalDistricts: political,
    locals: locals.map((l) => ({
      id: l.id,
      name: l.name,
      chairName: l.chair_name,
      chairPhone: l.chair_phone,
      status: l.status as Status,
      adminNote: l.admin_note,
      submittedAt: l.submitted_at,
      updatedAt: l.updated_at,
      unitCount: l.unit_count,
      code: opts.includeCodes ? decryptCode(l.code_enc) : undefined,
      units: opts.includeUnits ? (unitsByLocal[l.id] ?? []) : undefined,
    })),
  };
}

export async function submitDistrict(districtId: number) {
  const d = await getDistrictRow(districtId);
  if (!isEditable(d.status)) throw new HttpError(409, 'This district has already been submitted.');
  const problems: string[] = [];
  if (!d.chair_name) problems.push("Enter the district chairman's name.");
  if (!d.chair_phone) problems.push("Enter the district chairman's phone number.");
  const pd = await one<{ n: number }>('SELECT count(*)::int AS n FROM district_political_districts WHERE district_id = $1', [
    districtId,
  ]);
  if (!pd?.n) problems.push('Select at least one political administrative district.');
  const ln = await one<{ n: number }>('SELECT count(*)::int AS n FROM locals WHERE district_id = $1', [districtId]);
  if (!ln?.n) problems.push('Add at least one GNAT local.');
  if (problems.length) throw new HttpError(400, problems.join(' '), problems);
  await query(`UPDATE districts SET status = 'submitted', submitted_at = now(), updated_at = now() WHERE id = $1`, [districtId]);
}

export async function reopenDistrict(districtId: number) {
  const d = await getDistrictRow(districtId);
  if (d.status !== 'submitted') throw new HttpError(409, 'Only a submitted (not yet approved) district can be reopened.');
  await query(`UPDATE districts SET status = 'draft', updated_at = now() WHERE id = $1`, [districtId]);
}
