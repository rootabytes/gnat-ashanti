import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * One JSON line per request, tagged with a request id that is also returned in
 * the X-Request-Id header, so a chairman's error report can be found in the
 * Railway logs. Bodies and query strings are never logged: they carry names,
 * phone numbers and access codes.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id');
  req.id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (req.path === '/api/health') return;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const line = {
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      msg: 'request',
      id: req.id,
      method: req.method,
      path: req.path.replace(/\/\d+(?=\/|$)/g, '/:id'),
      status: res.statusCode,
      ms: Math.round(ms),
      role: req.session?.role,
    };
    console.log(JSON.stringify(line));
  });
  next();
}
