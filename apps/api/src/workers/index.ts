import type { Worker } from 'bullmq';
import { startPlatformEventWorker } from './platformEvents.worker.js';

/**
 * Worker barrel. `startAllWorkers()` boots one Worker per queue in a single
 * process — see ../../worker.ts for the entry point.
 *
 * The API server must never import this module: workers and the HTTP server
 * are deliberately separate processes so a worker crash can't take down the
 * API (and vice versa).
 */

export { startPlatformEventWorker } from './platformEvents.worker.js';

export function startAllWorkers(): Worker[] {
  return [startPlatformEventWorker()];
}
