import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceRequest } from '@prisma/client';

/**
 * notifyClientStatusUpdate — client push when BDT advances a request status.
 *
 * Coverage (per spec):
 *   1. in_progress → notifies (correct title/body/data).
 *   2. completed   → notifies (correct title/body/data).
 *   3. pending     → does NOT notify (and never queries tokens).
 *   4. cancelled   → does NOT notify.
 *   5. push send failure → swallowed; status update path never sees a throw.
 *   6. no active device tokens for the tenant → returns silently, no error.
 */

const { rawPrismaMock, pushMock, loggerMock, emailMock } = vi.hoisted(() => ({
  rawPrismaMock: {
    devicePushToken: { findMany: vi.fn() },
    tenant: { findUnique: vi.fn() },
  },
  pushMock: { sendPushToMany: vi.fn() },
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  emailMock: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({ rawPrisma: rawPrismaMock }));
vi.mock('../../lib/logger.js', () => ({ logger: loggerMock }));
vi.mock('../pushService.js', () => pushMock);
// Mocked so importing the module doesn't pull in the real Resend/config stack.
vi.mock('../notificationService.js', () => ({ sendEmail: emailMock }));

import { notifyClientStatusUpdate } from '../requestNotificationService.js';

const baseRequest: ServiceRequest = {
  id: 'req_1',
  tenantId: 'tenant_1',
  type: 'website_update',
  title: 'Homepage tweak',
  description: 'Please refresh the hero copy.',
  status: 'pending',
  attachments: [],
  addOn: false,
  createdAt: new Date('2026-05-29T12:00:00Z'),
  updatedAt: new Date('2026-05-29T12:00:00Z'),
};

function makeReq(type: ServiceRequest['type'] = 'website_update'): ServiceRequest {
  return { ...baseRequest, type };
}

beforeEach(() => {
  rawPrismaMock.devicePushToken.findMany.mockReset().mockResolvedValue([{ userId: 'user_1' }]);
  rawPrismaMock.tenant.findUnique
    .mockReset()
    .mockResolvedValue({ businessName: 'Acme Salon', owner: { email: 'owner@acme.com' } });
  pushMock.sendPushToMany.mockReset().mockResolvedValue({ sent: 1, failed: 0, tickets: [] });
  emailMock.mockReset().mockResolvedValue(undefined);
  loggerMock.error.mockReset();
});

describe('notifyClientStatusUpdate', () => {
  it('notifies the client on in_progress with the right copy + payload', async () => {
    await notifyClientStatusUpdate(makeReq('website_update'), 'in_progress');

    expect(rawPrismaMock.devicePushToken.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant_1', isActive: true },
      select: { userId: true },
    });
    expect(pushMock.sendPushToMany).toHaveBeenCalledTimes(1);
    const [userIds, params] = pushMock.sendPushToMany.mock.calls[0]!;
    expect(userIds).toEqual(['user_1']);
    expect(params.title).toBe("We're on it! 🚀");
    expect(params.body).toBe('Your website update request is now in progress.');
    expect(params.data).toEqual({
      requestId: 'req_1',
      type: 'request_status_update',
      status: 'in_progress',
    });
  });

  it('notifies the client on completed with the right copy + payload', async () => {
    await notifyClientStatusUpdate(makeReq('social_media'), 'completed');

    const [, params] = pushMock.sendPushToMany.mock.calls[0]!;
    expect(params.title).toBe('Request completed ✅');
    expect(params.body).toBe('Your social media request has been completed.');
    expect(params.data).toEqual({
      requestId: 'req_1',
      type: 'request_status_update',
      status: 'completed',
    });
  });

  it('does NOT notify on pending (and never queries tokens)', async () => {
    await notifyClientStatusUpdate(makeReq(), 'pending');
    expect(pushMock.sendPushToMany).not.toHaveBeenCalled();
    expect(rawPrismaMock.devicePushToken.findMany).not.toHaveBeenCalled();
  });

  it('does NOT notify on cancelled', async () => {
    await notifyClientStatusUpdate(makeReq(), 'cancelled');
    expect(pushMock.sendPushToMany).not.toHaveBeenCalled();
    expect(rawPrismaMock.devicePushToken.findMany).not.toHaveBeenCalled();
  });

  it('swallows a push send failure (never throws) and logs it', async () => {
    pushMock.sendPushToMany.mockRejectedValueOnce(new Error('expo unreachable'));
    await expect(notifyClientStatusUpdate(makeReq(), 'completed')).resolves.toBeUndefined();
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('returns silently when the tenant has no active device tokens', async () => {
    rawPrismaMock.devicePushToken.findMany.mockResolvedValue([]);
    await expect(notifyClientStatusUpdate(makeReq(), 'in_progress')).resolves.toBeUndefined();
    expect(pushMock.sendPushToMany).not.toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it('de-duplicates user ids across multiple devices', async () => {
    rawPrismaMock.devicePushToken.findMany.mockResolvedValue([
      { userId: 'user_1' },
      { userId: 'user_1' },
      { userId: 'user_2' },
    ]);
    await notifyClientStatusUpdate(makeReq(), 'in_progress');
    const [userIds] = pushMock.sendPushToMany.mock.calls[0]!;
    expect(userIds).toEqual(['user_1', 'user_2']);
  });

  // --- Client email --------------------------------------------------------

  it('emails the client on in_progress with the right subject + recipient', async () => {
    await notifyClientStatusUpdate(makeReq('website_update'), 'in_progress');
    expect(emailMock).toHaveBeenCalledTimes(1);
    const msg = emailMock.mock.calls[0]![0];
    expect(msg.to).toBe('owner@acme.com');
    expect(msg.subject).toBe("We're working on your request — BDT Connect");
    expect(msg.text).toContain('Hi Acme Salon,');
    expect(msg.text).toContain('website update request');
    expect(msg.text).toContain('Homepage tweak');
  });

  it('emails the client on completed with the right subject + recipient', async () => {
    await notifyClientStatusUpdate(makeReq('social_media'), 'completed');
    expect(emailMock).toHaveBeenCalledTimes(1);
    const msg = emailMock.mock.calls[0]![0];
    expect(msg.to).toBe('owner@acme.com');
    expect(msg.subject).toBe('Your request is complete — BDT Connect');
    expect(msg.text).toContain('social media request has been completed');
  });

  it('does NOT email on pending', async () => {
    await notifyClientStatusUpdate(makeReq(), 'pending');
    expect(emailMock).not.toHaveBeenCalled();
  });

  it('does NOT email on cancelled', async () => {
    await notifyClientStatusUpdate(makeReq(), 'cancelled');
    expect(emailMock).not.toHaveBeenCalled();
  });

  it('still fires push when the email send fails, and never throws', async () => {
    emailMock.mockRejectedValueOnce(new Error('resend down'));
    await expect(notifyClientStatusUpdate(makeReq(), 'completed')).resolves.toBeUndefined();
    expect(pushMock.sendPushToMany).toHaveBeenCalledTimes(1);
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('skips email when the client has no email, but still pushes', async () => {
    rawPrismaMock.tenant.findUnique.mockResolvedValue({
      businessName: 'Acme Salon',
      owner: { email: null },
    });
    await notifyClientStatusUpdate(makeReq(), 'in_progress');
    expect(emailMock).not.toHaveBeenCalled();
    expect(pushMock.sendPushToMany).toHaveBeenCalledTimes(1);
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it('skips both channels when the tenant is not found, without error', async () => {
    rawPrismaMock.tenant.findUnique.mockResolvedValue(null);
    rawPrismaMock.devicePushToken.findMany.mockResolvedValue([]);
    await expect(notifyClientStatusUpdate(makeReq(), 'completed')).resolves.toBeUndefined();
    expect(emailMock).not.toHaveBeenCalled();
    expect(pushMock.sendPushToMany).not.toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });
});
