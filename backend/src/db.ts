import { Pool, PoolClient, QueryResultRow } from 'pg';
import { config } from './config';

const needsSsl = /sslmode=require/.test(config.databaseUrl) || process.env.PGSSL === 'true';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

// An idle client losing its connection (e.g. a database restart) must not crash the API.
pool.on('error', (e) => console.error(JSON.stringify({ level: 'error', msg: 'pg pool error', error: e.message })));

export async function query<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function one<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
