import { Queue, type QueueOptions, type RedisOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * BullMQ queue layer — the single place Redis is touched.
 *
 *   platform-events → async audit/analytics writes + delayed Expo push-receipt
 *                     checks.
 *
 * The API process only ENQUEUES. The worker process (../workers) CONSUMES.
 * Both import this module so the connection config lives in one place.
 *
 * Crash isolation: Redis being unreachable must never take down the API.
 */

export const QUEUE_NAMES = {
  platformEvents: 'platform-events',
} as const;

/**
 * Upstash + most managed Redis providers require TLS — the URL scheme is
 * `rediss://` (note the extra `s`). ioredis doesn't auto-enable TLS based
 * on the URL; we have to opt in explicitly. Plain `redis://` URLs (local
 * docker, Railway's bundled Redis) stay TLS-off.
 */
function buildRedisOptions(): RedisOptions {
  const opts: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
  if (config.redis.url.startsWith('rediss://')) {
    // Empty `tls` object = "use TLS with default validation". Upstash
    // certificates chain to standard CAs so no extra config needed.
    opts.tls = {};
  }
  return opts;
}

export const redisConnection = new Redis(config.redis.url, buildRedisOptions());

redisConnection.on('error', (err: Error) => {
  logger.error({ err: err.message }, 'redis.connection_error');
});

export const defaultJobOptions: QueueOptions['defaultJobOptions'] = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

const queueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions,
};

export const platformEventsQueue = new Queue(QUEUE_NAMES.platformEvents, queueOptions);

export const allQueues = [platformEventsQueue];

/** Close every queue + the Redis connection. Call on graceful shutdown. */
export async function closeQueues(): Promise<void> {
  await Promise.all(allQueues.map((q) => q.close().catch(() => undefined)));
  await redisConnection.quit().catch(() => undefined);
}
