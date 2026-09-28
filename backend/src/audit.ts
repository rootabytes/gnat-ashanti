import type { Request } from 'express';
import { pool } from './db';

export async function audit(
  req: Request,
  action: string,
  entity: { type: string; id: number | null; regionId?: number | null },
  detail?: Record<string, unknown>,
  actorLabel?: string,
): Promise<void> {
  const s = req.session;
  const actorType = s?.role ?? 'public';
  const actorId = s ? (s.role === 'admin' ? s.adminId : s.role === 'district' ? s.districtId : s.localId) : null;
  const regionId = entity.regionId ?? (s && 'regionId' in s ? s.regionId : null);
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_type, actor_id, actor_label, action, entity_type, entity_id, region_id, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [actorType, actorId, actorLabel ?? (s?.role === 'admin' ? s.name : null), action, entity.type, entity.id, regionId, detail ?? null],
    );
  } catch (e) {
    // Never fail a chairman's save because the log write failed.
    console.error('[audit] write failed', e);
  }
}
