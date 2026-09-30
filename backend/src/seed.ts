import bcrypt from 'bcryptjs';
import { config } from './config';
import { one, pool } from './db';
import { GNAT_REGIONS, POLITICAL_DISTRICTS } from './reference';

export async function seed(): Promise<void> {
  for (const r of GNAT_REGIONS) {
    // Insert only: an admin may have edited political_regions/active since.
    await pool.query(
      `INSERT INTO regions (name, code, political_regions, active) VALUES ($1,$2,$3,$4)
       ON CONFLICT (code) DO NOTHING`,
      [r.name, r.code, r.political, r.active],
    );
  }
  for (const [code, list] of Object.entries(POLITICAL_DISTRICTS)) {
    // Only into an empty list: once loaded, the region's admins own it, and an MMDA
    // they removed must not come back on the next restart.
    const r = await one<{ id: number }>(
      `SELECT id FROM regions r WHERE code = $1 AND NOT EXISTS (SELECT 1 FROM political_districts WHERE region_id = r.id)`,
      [code],
    );
    if (!r) continue;
    for (const d of list) {
      await pool.query(`INSERT INTO political_districts (region_id, name, kind) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [
        r.id,
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
