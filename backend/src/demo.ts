import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { PoolClient } from 'pg';
import { config } from './config';
import { decryptCode, newCode } from './crypto';
import { one, query, tx } from './db';
import { ASHANTI_POLITICAL_DISTRICTS, GNAT_REGIONS } from './reference';

// The demo site lets testers try every role with one tap. Its passwords and
// access codes are shown on a public page, so it must never share a database
// with real chairmen's data. prepareDatabase() enforces that both ways.

export const DEMO_PASSWORD = 'GnatDemo-2026';
export const DEMO_REGISTRATION_KEY = 'demo2026';
const DEMO_EMAIL_DOMAIN = '@demo.example.org';
export const isDemoEmail = (email: string) => email.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN);

const ADMINS = [
  {
    email: `ashanti.secretary${DEMO_EMAIL_DOMAIN}`,
    name: 'Demo Regional Secretary',
    label: 'Regional Secretary (Ashanti)',
    regional: true,
  },
  // Off while only Ashanti is collecting data. Uncomment to demo the national view
  // (region switcher, open/close regions, add admins) once more regions open.
  // { email: `national.admin${DEMO_EMAIL_DOMAIN}`, name: 'Demo National Admin', label: 'National admin (all regions)', regional: false },
];

type St = 'draft' | 'submitted' | 'returned' | 'approved';
interface DemoLocal {
  name: string;
  chair?: [string, string];
  status: St;
  units: [string, string, string?][];
}
interface DemoDistrict {
  name: string;
  chair: [string, string];
  status: St;
  note?: string;
  verified?: boolean;
  daysAgo: number;
  political: string[];
  locals: DemoLocal[];
}

// Fictional people with unassigned-looking numbers (+233 20 000 0xxx).
const DISTRICTS: DemoDistrict[] = [
  {
    name: 'Kumasi Metro',
    chair: ['Kwabena Owusu', '+233200000101'],
    status: 'draft',
    daysAgo: 2,
    political: ['Kumasi', 'Asokwa'],
    locals: [
      {
        name: 'Adum',
        chair: ['Ama Serwaa', '+233200000201'],
        status: 'submitted',
        units: [
          ['Adum Presby JHS', 'Basic Units', 'AK-039-5028'],
          ['St. Cyprian Anglican Basic School', 'Basic Units'],
          ['Kumasi Metro Education Directorate', 'Education Administration Units', 'AK-039-1177'],
          ['Bright Future Academy', 'Private Schools'],
        ],
      },
      {
        name: 'Bantama',
        chair: ['Yaw Mensah', '+233200000202'],
        status: 'draft',
        units: [
          ['Bantama Methodist Primary', 'Basic Units'],
          ['Bantama M/A JHS', 'Basic Units', 'AK-051-2210'],
        ],
      },
      { name: 'Suame', status: 'draft', units: [] },
    ],
  },
  {
    name: 'Ejisu',
    chair: ['Akosua Frimpong', '+233200000102'],
    status: 'submitted',
    daysAgo: 5,
    political: ['Ejisu', 'Juaben'],
    locals: [
      {
        name: 'Ejisu Central',
        chair: ['Kofi Boateng', '+233200000203'],
        status: 'submitted',
        units: [
          ['Ejisu Roman Catholic JHS', 'Basic Units', 'AE-0012-3345'],
          ['Ejisu Municipal Education Office', 'Education Administration Units'],
          ['Catholic Education Unit, Ejisu', 'Religious Mission Administrations'],
        ],
      },
      {
        name: 'Besease',
        chair: ['Abena Ofori', '+233200000204'],
        status: 'submitted',
        units: [
          ['Besease D/A Basic School', 'Basic Units'],
          ['Besease Community Learning Centre', 'Non-Formal Education'],
        ],
      },
    ],
  },
  {
    name: 'Obuasi',
    chair: ['Yaa Asantewaa Darko', '+233200000103'],
    status: 'approved',
    verified: true,
    daysAgo: 9,
    political: ['Obuasi', 'Obuasi East'],
    locals: [
      {
        name: 'Obuasi Central',
        chair: ['Kwame Addo', '+233200000205'],
        status: 'approved',
        units: [
          ['Obuasi Government JHS', 'Basic Units', 'AO-0001-0420'],
          ['Obuasi Municipal Education Office', 'Education Administration Units'],
        ],
      },
    ],
  },
  {
    name: 'Offinso',
    chair: ['Nana Agyeman', '+233200000104'],
    status: 'returned',
    daysAgo: 7,
    political: ['Offinso'],
    note: 'Please add the Kokote local and the chairman phone numbers.',
    locals: [
      {
        name: 'Offinso Township',
        chair: ['Esi Amponsah', '+233200000206'],
        status: 'returned',
        units: [['Offinso SDA Basic School', 'Basic Units']],
      },
    ],
  },
];

/** Refuses to run the demo on a database with real data, and real mode on the demo database. */
export async function prepareDatabase(): Promise<void> {
  const mode = (await one<{ value: string }>(`SELECT value FROM app_meta WHERE key = 'mode'`))?.value ?? null;
  if (config.demoMode) {
    if (mode === 'demo') return;
    const used = await one<{ n: number }>('SELECT (SELECT count(*) FROM districts) + (SELECT count(*) FROM admins) AS n');
    if (Number(used?.n) > 0) {
      throw new Error(
        'DEMO_MODE=true but this database already holds data. The demo publishes its passwords, so give it its own empty database.',
      );
    }
    await query(`INSERT INTO app_meta (key, value) VALUES ('mode', 'demo')`);
  } else if (mode === 'demo') {
    throw new Error(
      'This database belongs to the demo site, whose passwords are public. Point DATABASE_URL at a new database for real data.',
    );
  }
}

/** Wipes everything testers changed and loads the fictional data again. */
export async function resetDemo(): Promise<void> {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(727002)');
    await c.query('TRUNCATE districts, political_districts, audit_log CASCADE');
    await c.query('DELETE FROM admins WHERE email IS DISTINCT FROM $1', [config.adminEmail?.toLowerCase().trim() ?? '']);
    for (const r of GNAT_REGIONS) {
      await c.query('UPDATE regions SET active = $2, political_regions = $3, registration_key = $4 WHERE code = $1', [
        r.code,
        r.active,
        r.political,
        r.code === 'ASH' ? DEMO_REGISTRATION_KEY : null,
      ]);
    }
    const ash = (await c.query(`SELECT id FROM regions WHERE code = 'ASH'`)).rows[0].id as number;
    for (const d of ASHANTI_POLITICAL_DISTRICTS) {
      await c.query('INSERT INTO political_districts (region_id, name, kind) VALUES ($1,$2,$3)', [ash, d.name, d.kind]);
    }
    for (const a of ADMINS) {
      await c.query('INSERT INTO admins (email, name, password_hash, region_id) VALUES ($1,$2,$3,$4)', [
        a.email,
        a.name,
        hash,
        a.regional ? ash : null,
      ]);
    }
    for (const d of DISTRICTS) await insertDistrict(c, ash, d);
    await c.query(`INSERT INTO audit_log (actor_type, actor_label, action, region_id) VALUES ('public', 'Demo', 'demo.reset', $1)`, [ash]);
  });
}

async function insertDistrict(c: PoolClient, regionId: number, d: DemoDistrict) {
  const code = newCode('D');
  const at = `now() - interval '${d.daysAgo} days'`;
  const done = d.status !== 'draft';
  const row = (
    await c.query(
      `INSERT INTO districts (region_id, name, chair_name, chair_phone, code_lookup, code_enc, status, admin_note, verified,
         created_at, submitted_at, approved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, ${at}, ${done ? `${at} + interval '1 day'` : 'NULL'}, ${d.status === 'approved' ? 'now()' : 'NULL'})
       RETURNING id`,
      [regionId, d.name, d.chair[0], d.chair[1], code.lookup, code.enc, d.status, d.note ?? null, d.verified ?? false],
    )
  ).rows[0];
  await c.query(
    `INSERT INTO district_political_districts (district_id, political_district_id)
     SELECT $1, id FROM political_districts WHERE region_id = $2 AND name = ANY($3)`,
    [row.id, regionId, d.political],
  );
  for (const l of d.locals) {
    const lc = newCode('L');
    const loc = (
      await c.query(
        `INSERT INTO locals (district_id, name, chair_name, chair_phone, code_lookup, code_enc, status, admin_note, created_at, submitted_at, approved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, ${at}, ${l.status !== 'draft' ? `${at} + interval '1 day'` : 'NULL'}, ${l.status === 'approved' ? 'now()' : 'NULL'})
         RETURNING id`,
        [row.id, l.name, l.chair?.[0] ?? null, l.chair?.[1] ?? null, lc.lookup, lc.enc, l.status, l.status === 'returned' ? d.note : null],
      )
    ).rows[0];
    for (const [i, [name, category, gps]] of l.units.entries()) {
      await c.query('INSERT INTO basic_units (local_id, name, category, sort, gps_address) VALUES ($1,$2,$3,$4,$5)', [
        loc.id,
        name,
        category,
        i,
        gps ?? null,
      ]);
    }
  }
}

export const demoRouter = Router();

/** Everything the demo page needs to sign in as each role. Only mounted when DEMO_MODE=true. */
demoRouter.get('/', async (_req, res) => {
  const districts = await query(`SELECT id, name, status, chair_name, code_enc FROM districts ORDER BY created_at DESC, name`);
  const locals = await query(
    `SELECT l.name, l.status, l.chair_name, l.code_enc, d.name AS district FROM locals l JOIN districts d ON d.id = l.district_id
     ORDER BY d.created_at DESC, l.name`,
  );
  res.json({
    password: DEMO_PASSWORD,
    registrationKey: DEMO_REGISTRATION_KEY,
    admins: ADMINS.map(({ email, label }) => ({ email, label })),
    districts: districts.map((d) => ({ name: d.name, status: d.status, chairName: d.chair_name, code: decryptCode(d.code_enc) })),
    locals: locals.map((l) => ({
      name: l.name,
      district: l.district,
      status: l.status,
      chairName: l.chair_name,
      code: decryptCode(l.code_enc),
    })),
  });
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'The demo was reset several times this hour. Please wait a little.' },
});

demoRouter.post('/reset', resetLimiter, async (_req, res) => {
  await resetDemo();
  res.json({ ok: true });
});
