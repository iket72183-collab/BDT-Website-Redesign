import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';

/**
 * platform-events WORKER (processor) tests. BullMQ + Redis + Prisma mocked —
 * `processPlatformEvent` is exercised directly.
 */

const { bullmqMock, queueIndexMock, prismaMock, loggerMock, pushMock, messageMock } = vi.hoisted(() => ({
  bullmqMock: { Worker: vi.fn() },
  queueIndexMock: {
    QUEUE_NAMES: { platformEvents: 'platform-events' },
    redisConnection: {},
  },
  prismaMock: { platformEvent: { create: vi.fn() } },
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  pushMock: { checkPushReceipts: vi.fn() },
  messageMock: { retryAgencyEmail: vi.fn() },
}));

vi.mock('bullmq', () => bullmqMock);
vi.mock('../../queues/index.js', () => queueIndexMock);
vi.mock('../../lib/db.js', () => ({ rawPrisma: prismaMock, db: prismaMock }));
vi.mock('../../config/env.js', () => ({ config: { worker: { concurrency: 5 } } }));
vi.mock('../../lib/logger.js', () => ({ logger: loggerMock }));
vi.mock('../../services/pushService.js', () => pushMock);
vi.mock('../../services/messageService.js', () => messageMock);

import { processPlatformEvent } from '../platformEvents.worker.js';

const job = (over: Record<string, unknown> = {}) =>
  ({
    data: {
      tenantId: 't1',
      userId: 'u1',
      eventType: 'booking.created',
      payload: { bookingId: 'bk1' },
      occurredAt: '2026-06-01T12:00:00.000Z',
      ...over,
    },
  }) as unknown as Job<never>;

beforeEach(() => {
  prismaMock.platformEvent.create.mockReset().mockResolvedValue({});
  loggerMock.error.mockReset();
  loggerMock.info.mockReset();
  pushMock.checkPushReceipts.mockReset().mockResolvedValue({ checked: 0, deregistered: 0, errors: 0 });
  messageMock.retryAgencyEmail.mockReset().mockResolvedValue(undefined);
});

describe('processPlatformEvent', () => {
  it('persists the event to platform_events', async () => {
    await processPlatformEvent(job());
    expect(prismaMock.platformEvent.create).toHaveBeenCalledTimes(1);
  });

  it('maps job data onto prisma.create, folding occurredAt into the payload', async () => {
    await processPlatformEvent(job());
    expect(prismaMock.platformEvent.create).toHaveBeenCalledWith({
      data: {
        eventType: 'booking.created',
        tenantId: 't1',
        userId: 'u1',
        payload: { bookingId: 'bk1', occurredAt: '2026-06-01T12:00:00.000Z' },
      },
    });
  });

  it('coerces a missing tenantId / userId to null', async () => {
    await processPlatformEvent(job({ tenantId: undefined, userId: undefined }));
    expect(prismaMock.platformEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: null, userId: null }) }),
    );
  });

  it('swallows a DB failure — never throws (attempts:1, analytics is best-effort)', async () => {
    prismaMock.platformEvent.create.mockRejectedValue(new Error('db down'));
    await expect(processPlatformEvent(job())).resolves.toBeUndefined();
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'booking.created' }),
      'platform_event.persist_failed',
    );
  });

  it('routes a check-push-receipts job to pushService, not to platform_events', async () => {
    const receiptJob = {
      name: 'check-push-receipts',
      data: { receiptIds: ['r1', 'r2'] },
    } as unknown as Job<never>;

    await processPlatformEvent(receiptJob);

    expect(pushMock.checkPushReceipts).toHaveBeenCalledWith(['r1', 'r2']);
    expect(prismaMock.platformEvent.create).not.toHaveBeenCalled();
  });

  it('routes agency email retry jobs to messageService', async () => {
    const retryJob = {
      name: 'deliver-agency-message-email',
      data: { messageId: 'msg_1' },
    } as unknown as Job<never>;

    await processPlatformEvent(retryJob);

    expect(messageMock.retryAgencyEmail).toHaveBeenCalledWith('msg_1');
    expect(prismaMock.platformEvent.create).not.toHaveBeenCalled();
  });
});
