import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { one } from './db';
import { HttpError } from './http';

export type Session =
  | { role: 'admin'; adminId: number; regionId: number | null; name: string }
  | { role: 'district'; districtId: number; regionId: number; cv: number }
  | { role: 'local'; localId: number; districtId: number; regionId: number; cv: number };

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

export function signSession(s: Session): string {
  return jwt.sign(s, config.jwtSecret, { expiresIn: s.role === 'admin' ? '12h' : '30d' });
}

function readToken(req: Request): Session | null {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  try {
    const { iat, exp, ...rest } = jwt.verify(h.slice(7), config.jwtSecret) as Session & { iat: number; exp: number };
    return rest as Session;
  } catch {
    return null;
  }
}

export function requireRole(role: Session['role']) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const s = readToken(req);
    if (!s || s.role !== role) return next(new HttpError(401, 'Please sign in again.'));
    // A reset access code must lock out every device that used the old one.
    if (s.role === 'district') {
      const row = await one('SELECT code_version FROM districts WHERE id = $1', [s.districtId]);
      if (!row || row.code_version !== s.cv) return next(new HttpError(401, 'Your access code has changed. Please sign in with the new code.'));
    } else if (s.role === 'local') {
      const row = await one('SELECT code_version FROM locals WHERE id = $1', [s.localId]);
      if (!row || row.code_version !== s.cv) return next(new HttpError(401, 'Your access code has changed. Please sign in with the new code.'));
    } else {
      const row = await one('SELECT id FROM admins WHERE id = $1', [s.adminId]);
      if (!row) return next(new HttpError(401, 'Please sign in again.'));
    }
    req.session = s;
    next();
  };
}
