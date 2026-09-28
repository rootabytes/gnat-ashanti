import bcrypt from 'bcryptjs';
import { config } from './config';
import { one, pool } from './db';
import { ASHANTI_POLITICAL_DISTRICTS, GNAT_REGIONS } from './reference';

export async function seed(): Promise<void> {
  for (const r of GNAT_REGIONS) {
    // Insert only: an admin may have edited political_regions/active since.
    await pool.query(
      `INSERT INTO regions (name, code, political_regions, active) VALUES ($1,$2,$3,$4)
       ON CONFLICT (code) DO NOTHING`,
      [r.name, r.code, r.political, r.active],
    );
  }
  const ash = await one<{ id: number }>(`SELECT id FROM regions WHERE code = 'ASH'`);
  if (ash) {
    for (const d of ASHANTI_POLITICAL_DISTRICTS) {
      await pool.query(`INSERT INTO political_districts (region_id, name, kind) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [
        ash.id,
        d.name,
        d.kind,
      ]);
    }
  }

  if (config.adminEmail && config.adminPassword) {
    const email = config.adminEmail.toLowerCase().trim();
    const existing = await one('SELECT id FROM admins WHERE email = $1', [email]);
    if (!existing) {
      const hash = await bcrypt.hash(config.adminPassword, 12);
      // The password sits in plain text in the host's variables, so it only works once.
      await pool.query('INSERT INTO admins (email, name, password_hash, region_id, must_change_password) VALUES ($1,$2,$3,NULL,TRUE)', [
        email,
        config.adminName,
        hash,
      ]);
      console.log(`[seed] created admin ${email}`);
    }
  } else {
    const any = await one('SELECT id FROM admins LIMIT 1');
    // The demo creates its own admins after this (demo.ts).
    if (!any && !config.demoMode) console.warn('[seed] No admin exists. Set ADMIN_EMAIL and ADMIN_PASSWORD and restart.');
  }
}
