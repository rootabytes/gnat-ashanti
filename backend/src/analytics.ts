import { query } from './db';
import { CATEGORY_LABELS, WORKPLACE_CATEGORIES } from './reference';

const STATUSES = ['draft', 'submitted', 'returned', 'approved'] as const;

function statusCounts(rows: { status: string; n: number }[]) {
  const out: Record<string, number> = { draft: 0, submitted: 0, returned: 0, approved: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export async function overview(regionId: number) {
  const [dStatus, lStatus, perDistrict, byCategory, coverage, timeline, recent] = await Promise.all([
    query<{ status: string; n: number }>('SELECT status, count(*)::int AS n FROM districts WHERE region_id = $1 GROUP BY status', [
      regionId,
    ]),
    query<{ status: string; n: number }>(
      `SELECT l.status, count(*)::int AS n FROM locals l JOIN districts d ON d.id = l.district_id
       WHERE d.region_id = $1 GROUP BY l.status`,
      [regionId],
    ),
    query(
      `SELECT d.id, d.name, d.status, d.verified, d.chair_name, d.chair_phone, d.updated_at, d.submitted_at,
         (SELECT count(*)::int FROM locals l WHERE l.district_id = d.id) AS locals,
         (SELECT count(*)::int FROM locals l WHERE l.district_id = d.id AND l.status IN ('submitted','approved')) AS locals_done,
         (SELECT count(*)::int FROM basic_units b JOIN locals l ON l.id = b.local_id WHERE l.district_id = d.id) AS units,
         (SELECT count(*)::int FROM district_political_districts x WHERE x.district_id = d.id) AS political
       FROM districts d WHERE d.region_id = $1 ORDER BY d.name`,
      [regionId],
    ),
    query<{ category: string; n: number }>(
      `SELECT b.category, count(*)::int AS n FROM basic_units b JOIN locals l ON l.id = b.local_id
       JOIN districts d ON d.id = l.district_id WHERE d.region_id = $1 GROUP BY b.category`,
      [regionId],
    ),
    query(
      `SELECT pd.id, pd.name, pd.kind,
         COALESCE(array_agg(d.name ORDER BY d.name) FILTER (WHERE d.id IS NOT NULL), '{}') AS gnat_districts
       FROM political_districts pd
       LEFT JOIN district_political_districts x ON x.political_district_id = pd.id
       LEFT JOIN districts d ON d.id = x.district_id
       WHERE pd.region_id = $1 GROUP BY pd.id ORDER BY pd.name`,
      [regionId],
    ),
    query<{ day: string; action: string; n: number }>(
      `SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'Africa/Accra'), 'YYYY-MM-DD') AS day, action, count(*)::int AS n
       FROM audit_log WHERE region_id = $1 AND action IN ('district.submit','local.submit','district.register')
         AND created_at > now() - interval '90 days'
       GROUP BY 1, 2 ORDER BY 1`,
      [regionId],
    ),
    query(
      `SELECT a.id, a.actor_type, a.actor_label, a.action, a.entity_type, a.entity_id, a.detail, a.created_at,
         CASE WHEN a.entity_type = 'district' THEN (SELECT name FROM districts WHERE id = a.entity_id)
              WHEN a.entity_type = 'local' THEN (SELECT name FROM locals WHERE id = a.entity_id) END AS entity_name
       FROM audit_log a WHERE a.region_id = $1 ORDER BY a.created_at DESC LIMIT 25`,
      [regionId],
    ),
  ]);

  const catMap = new Map(byCategory.map((c) => [c.category, c.n]));
  const districtStatus = statusCounts(dStatus);
  const localStatus = statusCounts(lStatus);

  const days = new Map<string, { day: string; districts: number; locals: number; registrations: number }>();
  for (const t of timeline) {
    const row = days.get(t.day) ?? { day: t.day, districts: 0, locals: 0, registrations: 0 };
    if (t.action === 'district.submit') row.districts += t.n;
    else if (t.action === 'local.submit') row.locals += t.n;
    else row.registrations += t.n;
    days.set(t.day, row);
  }

  return {
    totals: {
      districts: STATUSES.reduce((s, k) => s + districtStatus[k], 0),
      locals: STATUSES.reduce((s, k) => s + localStatus[k], 0),
      units: byCategory.reduce((s, c) => s + c.n, 0),
      politicalDistricts: coverage.length,
      politicalCovered: coverage.filter((c) => c.gnat_districts.length > 0).length,
    },
    districtStatus,
    localStatus,
    unitsByCategory: WORKPLACE_CATEGORIES.map((c) => ({ category: c, label: CATEGORY_LABELS[c], count: catMap.get(c) ?? 0 })),
    perDistrict: perDistrict.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      verified: d.verified,
      chairName: d.chair_name,
      chairPhone: d.chair_phone,
      updatedAt: d.updated_at,
      submittedAt: d.submitted_at,
      locals: d.locals,
      localsDone: d.locals_done,
      units: d.units,
      political: d.political,
    })),
    coverage: coverage.map((c) => ({ id: c.id, name: c.name, kind: c.kind, gnatDistricts: c.gnat_districts as string[] })),
    timeline: [...days.values()],
    recent,
  };
}

/** Workplaces with the same name listed under more than one local. */
export async function duplicates(regionId: number) {
  return query(
    `SELECT lower(regexp_replace(b.name, '[^a-zA-Z0-9]+', '', 'g')) AS key, min(b.name) AS name,
       json_agg(json_build_object('unitId', b.id, 'local', l.name, 'localId', l.id, 'district', d.name, 'districtId', d.id, 'category', b.category)
         ORDER BY d.name, l.name) AS entries
     FROM basic_units b JOIN locals l ON l.id = b.local_id JOIN districts d ON d.id = l.district_id
     WHERE d.region_id = $1
     GROUP BY 1 HAVING count(DISTINCT l.id) > 1 ORDER BY 2`,
    [regionId],
  );
}

/** Flat rows used by every export. */
export async function flatRows(regionId: number) {
  const districts = await query(
    `SELECT d.id, d.name, d.status, d.verified, d.chair_name, d.chair_phone, d.chair_group, d.remarks, d.submitted_at, d.updated_at,
       COALESCE((SELECT string_agg(pd.name, '; ' ORDER BY pd.name) FROM district_political_districts x
         JOIN political_districts pd ON pd.id = x.political_district_id WHERE x.district_id = d.id), '') AS political,
       (SELECT count(*)::int FROM locals l WHERE l.district_id = d.id) AS locals,
       (SELECT count(*)::int FROM basic_units b JOIN locals l ON l.id = b.local_id WHERE l.district_id = d.id) AS units
     FROM districts d WHERE d.region_id = $1 ORDER BY d.name`,
    [regionId],
  );
  const locals = await query(
    `SELECT l.id, d.name AS district, l.name, l.status, l.chair_name, l.chair_phone, l.remarks, l.submitted_at, l.updated_at,
       (SELECT count(*)::int FROM basic_units b WHERE b.local_id = l.id) AS units
     FROM locals l JOIN districts d ON d.id = l.district_id WHERE d.region_id = $1 ORDER BY d.name, l.name`,
    [regionId],
  );
  const units = await query(
    `SELECT d.name AS district, l.name AS local, b.name, b.category
     FROM basic_units b JOIN locals l ON l.id = b.local_id JOIN districts d ON d.id = l.district_id
     WHERE d.region_id = $1 ORDER BY d.name, l.name, b.sort, b.id`,
    [regionId],
  );
  const mapping = await query(
    `SELECT d.name AS district, pd.name AS political, pd.kind FROM district_political_districts x
     JOIN districts d ON d.id = x.district_id JOIN political_districts pd ON pd.id = x.political_district_id
     WHERE d.region_id = $1 ORDER BY d.name, pd.name`,
    [regionId],
  );
  return { districts, locals, units, mapping };
}
