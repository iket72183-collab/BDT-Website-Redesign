import { Worker, type Job } from 'bullmq';
import { QUEUE_NAMES, redisConnection } from '../queues/index.js';
import type { PlatformEventJobData } from '../queues/platformEvents.js';
import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { rawPrisma } from '../lib/db.js';
import { checkPushReceipts } from '../services/pushService.js';
import { retryAgencyEmail } from '../services/messageService.js';

/**
 * platform-events worker — drains async audit/analytics writes.
 *
 * Uses `rawPrisma` (no tenant scope — events span tenants and may be
 * tenant-less). The `occurredAt` timestamp is folded into the payload since
 * the `platform_events` table only has a `created_at` column.
 *
 * Failure policy: a dropped analytics row is acceptable — the processor logs
 * and swallows DB errors rather than throwing. Jobs are also queued with
 * `attempts: 1` (see the producer) so BullMQ wouldn't retry anyway.
 */

export async function processPlatformEvent(job: Job<PlatformEventJobData>): Promise<void> {
  // The platform-events queue also carries delayed Expo push-receipt checks.
  if (job.name === 'check-push-receipts') {
    const { receiptIds } = job.data as unknown as { receiptIds?: string[] };
    const result = await checkPushReceipts(receiptIds ?? []);
    logger.info(result, 'push.receipts_checked');
    return;
  }
  if (job.name === 'deliver-agency-message-email') {
    const { messageId } = job.data as unknown as { messageId?: string };
    if (messageId) await retryAgencyEmail(messageId);
    logger.info({ messageId }, 'message.email_retry_processed');
    return;
  }

  const { tenantId, userId, eventType, payload, occurredAt } = job.data;
  try {
    await rawPrisma.platformEvent.create({
      data: {
        eventType,
        tenantId: tenantId ?? null,
        userId: userId ?? null,
        payload: { ...payload, occurredAt },
      },
    });
  } catch (err) {
    // Analytics is best-effort — never retry, never crash the worker.
    logger.error({ err, eventType }, 'platform_event.persist_failed');
  }
}

export function startPlatformEventWorker(): Worker<PlatformEventJobData> {
  const worker = new Worker<PlatformEventJobData>(
    QUEUE_NAMES.platformEvents,
    processPlatformEvent,
    { connection: redisConnection, concurrency: config.worker.concurrency },
  );
  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err }, 'platform_event.job_failed'),
  );
  worker.on('error', (err) => logger.error({ err }, 'platform_event.worker_error'));
  logger.info('Worker started: platform-events');
  return worker;
}
