import { pool } from './db';

// Migrations are append-only: never edit a shipped entry, add a new one.
const migrations: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
    CREATE TABLE regions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      political_regions TEXT[] NOT NULL DEFAULT '{}',
      active BOOLEAN NOT NULL DEFAULT FALSE,
      registration_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE political_districts (
      id SERIAL PRIMARY KEY,
      region_id INT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'District',
      UNIQUE (region_id, name)
    );

    CREATE TABLE districts (
      id SERIAL PRIMARY KEY,
      region_id INT NOT NULL REFERENCES regions(id),
      name TEXT NOT NULL,
      chair_name TEXT,
      chair_phone TEXT,
      chair_group TEXT,
      code_lookup TEXT NOT NULL UNIQUE,
      code_enc TEXT NOT NULL,
      code_version INT NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','returned','approved')),
      admin_note TEXT,
      verified BOOLEAN NOT NULL DEFAULT FALSE,
      remarks TEXT,
      submitted_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX districts_region_name_uq ON districts (region_id, lower(name));

    CREATE TABLE district_political_districts (
      district_id INT NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
      political_district_id INT NOT NULL REFERENCES political_districts(id) ON DELETE CASCADE,
      PRIMARY KEY (district_id, political_district_id)
    );

    CREATE TABLE locals (
      id SERIAL PRIMARY KEY,
      district_id INT NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      chair_name TEXT,
      chair_phone TEXT,
      code_lookup TEXT NOT NULL UNIQUE,
      code_enc TEXT NOT NULL,
      code_version INT NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','returned','approved')),
      admin_note TEXT,
      remarks TEXT,
      submitted_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX locals_district_name_uq ON locals (district_id, lower(name));

    CREATE TABLE basic_units (
      id SERIAL PRIMARY KEY,
      local_id INT NOT NULL REFERENCES locals(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      sort INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX basic_units_local_idx ON basic_units (local_id);

    CREATE TABLE admins (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      region_id INT REFERENCES regions(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login_at TIMESTAMPTZ
    );

    CREATE TABLE audit_log (
      id BIGSERIAL PRIMARY KEY,
      actor_type TEXT NOT NULL,
      actor_id INT,
      actor_label TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INT,
      region_id INT,
      detail JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
    CREATE INDEX audit_log_action_idx ON audit_log (action);
    `,
  },
];

export async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    // Serialise concurrent boots (e.g. two replicas starting together).
    await client.query('SELECT pg_advisory_lock(727001)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const done = new Set(
      (await client.query<{ version: number }>('SELECT version FROM schema_migrations')).rows.map((r) => r.version),
    );
    for (const m of migrations) {
      if (done.has(m.version)) continue;
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [m.version]);
        await client.query('COMMIT');
        console.log(`[migrate] applied ${m.version}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => {});
    client.release();
  }
}
