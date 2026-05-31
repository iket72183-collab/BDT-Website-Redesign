import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * pushService unit tests. The Expo SDK, Prisma, and the BullMQ queue are all
 * mocked — no network, no Redis, no DB. The Expo mock's chunkers do REAL
 * chunking so the >100-token batching path is genuinely exercised.
 */

const { sendAsyncMock, getReceiptsMock, isTokenMock, prismaMock, queueMock, loggerMock } =
  vi.hoisted(() => ({
    sendAsyncMock: vi.fn(),
    getReceiptsMock: vi.fn(),
    isTokenMock: vi.fn(),
    prismaMock: {
      devicePushToken: { findMany: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    },
    queueMock: { add: vi.fn() },
    loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }));

vi.mock('expo-server-sdk', () => {
  function Expo() {
    return {
      chunkPushNotifications: (msgs: unknown[]) => {
        const out: unknown[][] = [];
        for (let i = 0; i < msgs.length; i += 100) out.push(msgs.slice(i, i + 100));
        return out;
      },
      chunkPushNotificationReceiptIds: (ids: unknown[]) => [ids],
      sendPushNotificationsAsync: sendAsyncMock,
      getPushNotificationReceiptsAsync: getReceiptsMock,
    };
  }
  Expo.isExpoPushToken = isTokenMock;
  return { Expo };
});
vi.mock('../../lib/db.js', () => ({ rawPrisma: prismaMock, db: prismaMock }));
vi.mock('../../lib/logger.js', () => ({ logger: loggerMock }));
vi.mock('../../queues/index.js', () => ({ platformEventsQueue: queueMock }));

import {
  sendPushNotification,
  checkPushReceipts,
  registerToken,
  deregisterToken,
} from '../pushService.js';

const VALID = 'ExponentPushToken[valid000]';

beforeEach(() => {
  sendAsyncMock.mockReset().mockResolvedValue([{ status: 'ok', id: 'receipt_1' }]);
  getReceiptsMock.mockReset().mockResolvedValue({});
  // Realistic token check — only ExponentPushToken[...] strings are valid.
  isTokenMock.mockReset().mockImplementation(
    (t: unknown) => typeof t === 'string' && t.startsWith('ExponentPushToken['),
  );
  prismaMock.devicePushToken.findMany.mockReset().mockResolvedValue([]);
  prismaMock.devicePushToken.upsert.mockReset().mockResolvedValue({ id: 'tok_1' });
  prismaMock.devicePushToken.updateMany.mockReset().mockResolvedValue({ count: 1 });
  queueMock.add.mockReset().mockResolvedValue({});
  loggerMock.error.mockReset();
  loggerMock.warn.mockReset();
});

describe('sendPushNotification', () => {
  it('returns {sent:0} and calls nothing when the user has no tokens', async () => {
    prismaMock.devicePushToken.findMany.mockResolvedValue([]);
    const res = await sendPushNotification({ userId: 'u1', title: 'T', body: 'B' });
    expect(res).toEqual({ sent: 0, failed: 0, tickets: [] });
    expect(sendAsyncMock).not.toHaveBeenCalled();
  });

  it('silently skips a token that is not a valid Expo token', async () => {
    prismaMock.devicePushToken.findMany.mockResolvedValue([{ token: 'not-an-expo-token' }]);
    const res = await sendPushNotification({ userId: 'u1', title: 'T', body: 'B' });
    expect(res.sent).toBe(0);
    expect(sendAsyncMock).not.toHaveBeenCalled();
  });

  it('sends via the Expo SDK for a valid token and enqueues a receipt check', async () => {
    prismaMock.devicePushToken.findMany.mockResolvedValue([{ token: VALID }]);
    const res = await sendPushNotification({ userId: 'u1', title: 'T', body: 'B' });

    expect(sendAsyncMock).toHaveBeenCalledTimes(1);
    expect(res.sent).toBe(1);
    expect(queueMock.add).toHaveBeenCalledWith(
      'check-push-receipts',
      { receiptIds: ['receipt_1'] },
      expect.objectContaining({ attempts: 1 }),
    );
  });

  it('chunks correctly when a user has more than 100 devices', async () => {
    const tokens = Array.from({ length: 150 }, (_, i) => ({ token: `ExponentPushToken[d${i}]` }));
    prismaMock.devicePushToken.findMany.mockResolvedValue(tokens);
    await sendPushNotification({ userId: 'u1', title: 'T', body: 'B' });
    // 150 messages → 100 + 50 → two sendPushNotificationsAsync calls.
    expect(sendAsyncMock).toHaveBeenCalledTimes(2);
  });
});

describe('checkPushReceipts', () => {
  it('deactivates the token when Expo reports DeviceNotRegistered', async () => {
    getReceiptsMock.mockResolvedValue({
      receipt_1: {
        status: 'error',
        message: '"ExponentPushToken[stale99]" is not a registered push recipient',
        details: { error: 'DeviceNotRegistered' },
      },
    });
    const res = await checkPushReceipts(['receipt_1']);
    expect(prismaMock.devicePushToken.updateMany).toHaveBeenCalledWith({
      where: { token: 'ExponentPushToken[stale99]' },
      data: { isActive: false },
    });
    expect(res.deregistered).toBe(1);
  });

  it('logs other receipt errors without throwing or deactivating', async () => {
    getReceiptsMock.mockResolvedValue({
      receipt_1: { status: 'error', message: 'too big', details: { error: 'MessageTooBig' } },
    });
    await expect(checkPushReceipts(['receipt_1'])).resolves.toMatchObject({ errors: 1 });
    expect(prismaMock.devicePushToken.updateMany).not.toHaveBeenCalled();
  });
});

describe('registerToken / deregisterToken', () => {
  it('upserts the device token row', async () => {
    await registerToken('u1', 't1', VALID, 'ios', "Isaac's iPhone");
    expect(prismaMock.devicePushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: VALID },
        update: expect.objectContaining({ userId: 'u1', tenantId: 't1' }),
      }),
    );
  });

  it('soft-deregisters by setting isActive false (does not delete)', async () => {
    const res = await deregisterToken('u1', VALID);
    expect(prismaMock.devicePushToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', token: VALID },
      data: { isActive: false },
    });
    expect(res).toEqual({ deregistered: 1 });
  });
});
