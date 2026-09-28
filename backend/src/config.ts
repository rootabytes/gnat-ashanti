function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

const isProd = process.env.NODE_ENV === 'production';

if (isProd && (process.env.JWT_SECRET ?? '').length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', isProd ? undefined : 'postgres://gnat:gnat@localhost:5432/gnat'),
  // Signs session tokens and derives the keys that look up and encrypt access
  // codes (crypto.ts). Changing it after launch signs everyone out AND makes
  // every issued access code stop working, so set it once and leave it.
  jwtSecret: required('JWT_SECRET', isProd ? undefined : 'dev-only-secret-change-me'),
  // Comma-separated list of browser origins allowed to call the API.
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // First admin account, created on boot if no admin with this email exists.
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  adminName: process.env.ADMIN_NAME ?? 'Regional Secretary',
};
