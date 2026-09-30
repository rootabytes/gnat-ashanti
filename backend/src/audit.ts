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
  // The super admin working in a region (?regionId=) is recorded in that region's log, by name and role.
  const superIn = (req as any).superRegionId as number | undefined;
  const regionId = entity.regionId ?? superIn ?? (s && 'regionId' in s ? s.regionId : null);
  const adminLabel = s?.role === 'admin' ? (superIn ? `${s.name} (super admin)` : s.name) : null;
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_type, actor_id, actor_label, action, entity_type, entity_id, region_id, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [actorType, actorId, actorLabel ?? adminLabel, action, entity.type, entity.id, regionId, detail ?? null],
    );
  } catch (e) {
    // Never fail a secretary's save because the log write failed.
    console.error('[audit] write failed', e);
  }
}
