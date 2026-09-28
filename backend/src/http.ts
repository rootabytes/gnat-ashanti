import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    const key = String(first?.path[first.path.length - 1] ?? '');
    const label = FIELD_LABELS[key] ?? (key || 'Input');
    throw new HttpError(400, `${label}: ${first?.message ?? 'invalid'}`, r.error.issues);
  }
  return r.data;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  districtName: 'District name',
  chairName: "Chairman's name",
  chairPhone: 'Phone number',
  chairGroup: 'Name / group',
  remarks: 'Remarks',
  category: 'Category',
  units: 'Workplaces',
  email: 'Email',
  password: 'Password',
  next: 'New password',
  note: 'Note',
  registrationKey: 'Registration key',
  gpsAddress: 'GPS address',
};

export function intParam(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Invalid id');
  return n;
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.code === '23505') {
    return res.status(409).json({ error: 'That name is already in use here. Please choose a different one.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That file is too large. Keep it under 2 MB.' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  console.error(JSON.stringify({ level: 'error', msg: 'unhandled', id: req.id, path: req.path, error: String(err?.stack ?? err) }));
  res.status(500).json({ error: `Something went wrong on the server. Please try again. (Ref: ${req.id?.slice(0, 8) ?? 'n/a'})` });
}

// ----- shared validators -----

export const nameStr = z
  .string()
  .trim()
  .min(2, 'is too short')
  .max(150, 'is too long')
  .transform((s) => s.replace(/\s+/g, ' '));

export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, 'is too long')
    .optional()
    .nullable()
    .transform((s) => (s ? s.replace(/\s+/g, ' ') : null));

/** Accepts 024xxxxxxx, +233 24 xxx xxxx, 23324xxxxxxx; stores +233XXXXXXXXX. */
export const ghPhone = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((s, ctx) => {
    if (!s) return null;
    const d = s.replace(/[^\d+]/g, '');
    let local: string | null = null;
    if (/^0\d{9}$/.test(d)) local = d.slice(1);
    else if (/^\+233\d{9}$/.test(d)) local = d.slice(4);
    else if (/^233\d{9}$/.test(d)) local = d.slice(3);
    if (!local) {
      ctx.addIssue({ code: 'custom', message: 'enter a valid Ghana phone number, e.g. 024 123 4567' });
      return z.NEVER;
    }
    return `+233${local}`;
  });

/** Ghana Post GPS digital address: AK-039-5028, ak0395028, "AK 039 5028". Stored as AK-039-5028. */
export function normalizeGps(s: string): string | null {
  // Unseparated digits are ambiguous: prefer the common 3+4 split (lazy first group).
  const m = /^([A-Z]{2})[\s-]*(\d{3,4}?)[\s-]*(\d{3,4})$/.exec(s.trim().toUpperCase());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export const gpsAddress = z
  .string()
  .trim()
  .max(20)
  .optional()
  .nullable()
  .transform((s, ctx) => {
    if (!s) return null;
    const v = normalizeGps(s);
    if (!v) {
      ctx.addIssue({ code: 'custom', message: 'enter a Ghana Post GPS address like AK-039-5028, or leave it blank' });
      return z.NEVER;
    }
    return v;
  });
