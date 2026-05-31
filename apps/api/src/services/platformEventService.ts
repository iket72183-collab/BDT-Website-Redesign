import type { Prisma } from '@prisma/client';
import { rawPrisma } from '../lib/db.js';
import { getContext } from '../lib/tenantContext.js';
import { logger } from '../lib/logger.js';

/**
 * Append-only audit log. Every write operation in a service should emit
 * one of these — payload is JSONB so capture the changing fields.
 *
 * Uses the RAW client because we want to emit events even when there's no
 * tenant scope (e.g. platform-admin actions, system jobs).
 */
export async function logEvent(eventType: string, payload?: Prisma.InputJsonValue): Promise<void> {
  const ctx = getContext();
  try {
    await rawPrisma.platformEvent.create({
      data: {
        eventType,
        tenantId: ctx?.tenantId ?? null,
        userId: ctx?.userId ?? null,
        // Omit the key entirely when absent — `exactOptionalPropertyTypes`
        // forbids an explicit `undefined` on an optional Prisma input field.
        ...(payload !== undefined ? { payload } : {}),
      },
    });
  } catch (err) {
    logger.error(
      { err, eventType, tenantId: ctx?.tenantId ?? null, userId: ctx?.userId ?? null },
      'platform_event.persist_failed',
    );
    // Audit failure must not block the action being audited.
  }
}
