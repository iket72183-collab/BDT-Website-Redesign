import { Pool, type PoolClient } from 'pg';
import { config } from '../config/env.js';

export const pool = new Pool({
  connectionString: config.db.url,
  max: config.db.maxConnections,
});

/**
 * Run a callback with a checked-out client that has `app.tenant_id` and
 * `app.user_id` set as session-local GUCs. RLS policies in schema.sql read
 * these to scope every SELECT/INSERT/UPDATE/DELETE to the current tenant.
 *
 * Always use this for tenant-scoped queries — never `pool.query` directly,
 * because pooled connections may carry GUCs from a prior request.
 */
export async function withTenantClient<T>(
  args: { tenantId: string; userId?: string | undefined },
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [args.tenantId]);
    if (args.userId) {
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [args.userId]);
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
