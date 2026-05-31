/**
 * BDT Connect worker process — entry point.
 *
 * Runs SEPARATELY from the API server (`pnpm --filter @bdt/api worker`).
 * Keeping it a distinct process means a crash in job processing never takes
 * down HTTP, and the two can be scaled / deployed independently.
 *
 * It boots one BullMQ Worker per queue inside this single process — see
 * src/workers/index.ts.
 */
import { startAllWorkers } from './src/workers/index.js';
import { closeQueues } from './src/queues/index.js';
import { logger } from './src/lib/logger.js';

async function main(): Promise<void> {
  logger.info('Starting BDT Connect workers');
  const workers = startAllWorkers();
  logger.info({ count: workers.length }, 'All workers running');

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down workers');
    // worker.close() stops pulling new jobs and waits for in-flight ones.
    await Promise.all(workers.map((w) => w.close().catch(() => undefined)));
    await closeQueues();
    logger.info('Workers stopped cleanly');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Worker startup failed');
  process.exit(1);
});
