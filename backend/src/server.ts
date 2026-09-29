import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { pool } from './db';
import { demoRouter, prepareDatabase, resetDemo } from './demo';
import { errorHandler } from './http';
import { requestLogger } from './logging';
import { adminRouter } from './routes/admin';
import { districtRouter } from './routes/district';
import { localRouter } from './routes/local';
import { publicRouter } from './routes/public';
import { openApiSpec } from './openapi';
import { trustProxy } from './proxy';
import { migrate } from './schema';
import { seed } from './seed';

/** Exact origins, or a wildcard like https://*.gnat-mapping.pages.dev for Cloudflare preview deploys. */
function originAllowed(origin: string): boolean {
  return config.allowedOrigins.some((o) => {
    if (o === '*' || o === origin) return true;
    const m = /^(https?:\/\/)\*\.(.+)$/.exec(o);
    return !!m && origin.startsWith(m[1]) && origin.endsWith(`.${m[2]}`);
  });
}

export function createApp() {
  const app = express();
  app.set('trust proxy', trustProxy); // Railway's edge, plus Cloudflare when the domain is proxied
  app.disable('x-powered-by');
  if (process.env.NODE_ENV !== 'test') app.use(requestLogger);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || originAllowed(origin)),
      exposedHeaders: ['Content-Disposition', 'X-Request-Id'],
      maxAge: 86400,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  let spec: unknown;
  app.get('/api/openapi.json', (_req, res) => {
    spec ??= openApiSpec();
    res.json(spec);
  });

  app.use('/api', publicRouter);
  app.use('/api/district', districtRouter);
  app.use('/api/local', localRouter);
  app.use('/api/admin', adminRouter);
  if (config.demoMode) app.use('/api/demo', demoRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);
  return app;
}

async function main() {
  await migrate();
  await prepareDatabase();
  await seed();
  if (config.demoMode) await resetDemo();
  const server = createApp().listen(config.port, () =>
    console.log(`[gnat-mapping] API listening on :${config.port}${config.demoMode ? ' (DEMO MODE)' : ''}`),
  );
  const shutdown = () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
