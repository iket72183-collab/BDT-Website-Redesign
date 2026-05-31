import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './client.js';
import { logger } from '../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    const { rows } = await client.query<{ id: string }>('SELECT id FROM _migrations');
    const applied = new Set(rows.map((r) => r.id));

    for (const file of files) {
      if (applied.has(file)) continue;
      logger.info({ file }, 'applying migration');
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (id) VALUES ($1)', [file]);
      await client.query('COMMIT');
    }
    logger.info('migrations complete');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  logger.error(err, 'migration failed');
  process.exit(1);
});
