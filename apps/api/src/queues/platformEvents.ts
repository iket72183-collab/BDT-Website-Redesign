import { platformEventsQueue } from './index.js';
import { logger } from '../lib/logger.js';

/**
 * platform-events producer.
 *
 * Offloads audit/analytics writes off the request path. Fire-and-forget: the
 * caller never awaits the DB write, and a queue failure is logged + swallowed
 * (losing an analytics row must never fail a user request).
 *
 * NOTE: this is an OPT-IN async path. The synchronous
 * `platformEventService.logEvent()` still exists and is unchanged — callers
 * that need the event written transactionally keep using it. New high-volume
 * call sites should prefer `enqueuePlatformEvent`.
 */

export interface PlatformEventJobData {
  tenantId?: string | null;
  userId?: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  /** ISO timestamp of when the event actually occurred. */
  occurredAt: string;
}

export async function enqueuePlatformEvent(
  eventType: string,
  payload: Record<string, unknown> = {},
  tenantId?: string | null,
  userId?: string | null,
): Promise<void> {
  const data: PlatformEventJobData = {
    tenantId: tenantId ?? null,
    userId: userId ?? null,
    eventType,
    payload,
    occurredAt: new Date().toISOString(),
  };
  try {
    // attempts:1 — analytics is not worth retrying; a failed write is dropped.
    await platformEventsQueue.add('log-event', data, { attempts: 1 });
  } catch (err) {
    logger.error({ err, eventType }, 'platform_event.enqueue_failed');
  }
}
