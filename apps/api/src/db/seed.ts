import { pool } from './client.js';
import { logger } from '../lib/logger.js';

async function run() {
  logger.info('seed: placeholder — add demo tenant, owner, staff, client here');
  await pool.end();
}

run().catch((err) => {
  logger.error(err, 'seed failed');
  process.exit(1);
});
