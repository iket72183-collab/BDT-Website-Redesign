import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Webhook two-phase idempotency tests (P4).
 *
 * Covers:
 *   - Bad signature → 400, nothing persisted.
 *   - Already-succeeded event → 200 with `duplicate: true`, handler not re-run.
 *   - Handler succeeds → 200, claimed row marked status='succeeded'.
 *   - Handler fails on a CRITICAL event → 500 (Stripe retries), row marked
 *     'failed' so the next retry re-runs the handler.
 *   - Handler fails on a non-critical event → 200 (no retry storm), row
 *     marked 'failed'.
 *
 * Strategy: call `handlePlatformWebhook` directly with mock req/res. No
 * Express server, no supertest — just the function under test plus its
 * mocked dependencies.
 */

const { stripeMock, prismaMock, loggerMock } = vi.hoisted(() => ({
  stripeMock: {
    webhooks: { constructEvent: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
  },
  prismaMock: {
    processedStripeEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    tenant: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    subscriptionEvent: { create: vi.fn() },
    socialAccount: { updateMany: vi.fn() },
  },
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/stripe.js', () => ({ stripe: stripeMock }));
vi.mock('../../lib/db.js', () => ({ rawPrisma: prismaMock, db: prismaMock }));
vi.mock('../../lib/logger.js', () => ({ logger: loggerMock }));
vi.mock('../../config/env.js', () => ({
  config: {
    nodeEnv: 'test',
    logLevel: 'silent',
    stripe: { webhookSecret: 'whsec_test' },
    jwt: {
      secret: 'a'.repeat(48),
      accessSecret: 'a'.repeat(48),
      refreshSecret: 'a'.repeat(48),
      issuer: 'bdt-connect-api',
      audience: 'bdt-connect-client',
    },
  },
}));
vi.mock('../../services/platformEventService.js', () => ({ logEvent: vi.fn() }));
vi.mock('../../services/notificationService.js', () => ({ notify: vi.fn() }));
vi.mock('../../services/stripeService.js', () => ({
  mapStripeSubStatus: (s: string) => (s === 'active' ? 'active' : 'cancelled'),
  tierFromPriceId: () => null,
  tierRank: () => 0,
}));
vi.mock('../../lib/tenantContext.js', () => ({
  runAsTenant: (_ctx: unknown, fn: () => Promise<unknown>) => fn(),
}));

import { handlePlatformWebhook } from '../webhooks.js';
import type { Request, Response } from 'express';

interface FakeRes {
  statusCode: number;
  body: unknown;
  status: (code: number) => FakeRes;
  json: (body: unknown) => FakeRes;
  send: (body: unknown) => FakeRes;
}

function mockReq(headers: Record<string, string> = {}, body: unknown = Buffer.from('{}')): Request {
  return {
    body,
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  } as never;
}

function mockRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(b)      { res.body = b; return res; },
    send(b)      { res.body = b; return res; },
  };
  return res;
}

function makeEvent(type: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_test_1',
    type,
    data: { object: { id: 'sub_123', customer: 'cus_x', subscription: 'sub_123', ...overrides } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.tenant.findFirst.mockResolvedValue({ id: 't1', subscriptionTier: 'premium' });
  prismaMock.tenant.findUnique.mockResolvedValue({ ownerId: 'u1' });
  prismaMock.tenant.update.mockResolvedValue({});
  prismaMock.subscriptionEvent.create.mockResolvedValue({});
  prismaMock.socialAccount.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.processedStripeEvent.findUnique.mockResolvedValue(null);
  prismaMock.processedStripeEvent.create.mockResolvedValue({});
  prismaMock.processedStripeEvent.update.mockResolvedValue({});
  prismaMock.processedStripeEvent.updateMany.mockResolvedValue({ count: 1 });
  stripeMock.subscriptions.retrieve.mockResolvedValue({
    id: 'sub_123',
    customer: 'cus_x',
    status: 'active',
    items: { data: [{ price: { id: 'price_premium' } }] }
  });
});

describe('handlePlatformWebhook', () => {
  it('returns 400 when signature verification fails', async () => {
    stripeMock.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('bad sig');
    });
    const req = mockReq({ 'stripe-signature': 'garbage' });
    const res = mockRes();
    await handlePlatformWebhook(req, res as unknown as Response);
    expect(res.statusCode).toBe(400);
    expect(prismaMock.processedStripeEvent.create).not.toHaveBeenCalled();
  });

  it('skips replays of already-succeeded events', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(makeEvent('invoice.paid'));
    prismaMock.processedStripeEvent.findUnique.mockResolvedValue({ status: 'succeeded' });
    const req = mockReq({ 'stripe-signature': 'ok' });
    const res = mockRes();
    await handlePlatformWebhook(req, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ duplicate: true });
    expect(prismaMock.tenant.update).not.toHaveBeenCalled();
    expect(prismaMock.processedStripeEvent.create).not.toHaveBeenCalled();
    expect(prismaMock.processedStripeEvent.update).not.toHaveBeenCalled();
  });

  it('marks succeeded after a handler runs cleanly', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(makeEvent('invoice.paid'));
    const req = mockReq({ 'stripe-signature': 'ok' });
    const res = mockRes();

    await handlePlatformWebhook(req, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.tenant.update).toHaveBeenCalled();
    expect(prismaMock.processedStripeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'processing' }),
      }),
    );
    expect(prismaMock.processedStripeEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'succeeded' }),
      }),
    );
  });

  it('returns 500 + marks failed on a CRITICAL event failure (so Stripe retries)', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(makeEvent('invoice.paid'));
    prismaMock.tenant.update.mockRejectedValue(new Error('DB down'));
    const req = mockReq({ 'stripe-signature': 'ok' });
    const res = mockRes();

    await handlePlatformWebhook(req, res as unknown as Response);

    expect(res.statusCode).toBe(500);
    expect(prismaMock.processedStripeEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('returns 200 on a NON-CRITICAL event failure (no retry storm)', async () => {
    // Force a failure path by making the post-success update throw, then
    // observe that the catch arm runs and the response is 200 because the
    // event type is non-critical.
    stripeMock.webhooks.constructEvent.mockReturnValue(makeEvent('charge.dispute.created'));
    prismaMock.processedStripeEvent.update
      .mockRejectedValueOnce(new Error('first upsert fails'))
      .mockResolvedValueOnce({});

    const req = mockReq({ 'stripe-signature': 'ok' });
    const res = mockRes();
    await handlePlatformWebhook(req, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.processedStripeEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('returns 409 without dispatching when the same event is already processing', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(makeEvent('invoice.paid'));
    prismaMock.processedStripeEvent.findUnique.mockResolvedValue({ status: 'processing' });
    prismaMock.processedStripeEvent.updateMany.mockResolvedValue({ count: 0 });
    const req = mockReq({ 'stripe-signature': 'ok' });
    const res = mockRes();

    await handlePlatformWebhook(req, res as unknown as Response);

    expect(res.statusCode).toBe(409);
    expect(prismaMock.tenant.update).not.toHaveBeenCalled();
  });

  it('retrieves fresh subscription state from Stripe and uses it to update the DB', async () => {
    // 1. Stripe sends a webhook with potentially stale event payload
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: 'evt_test_race',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_x',
          status: 'past_due' // stale payload
        }
      }
    });
    
    // 2. Mock retrieve to return the fresh state
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_123',
      customer: 'cus_x',
      status: 'active', // fresh state
      items: { data: [{ price: { id: 'price_premium' } }] }
    });
    
    prismaMock.tenant.findFirst.mockResolvedValue({ id: 't1', subscriptionTier: 'premium' });
    
    const req = mockReq({ 'stripe-signature': 'ok' });
    const res = mockRes();
    await handlePlatformWebhook(req, res as unknown as Response);
    
    // 3. Ensure retrieve was called with the correct sub id
    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith('sub_123', {
      expand: ['latest_invoice']
    });
    
    // 4. Ensure DB update used the FRESH status ('active') and not the STALE ('past_due')
    expect(prismaMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: expect.objectContaining({
          subscriptionStatus: 'active'
        })
      })
    );
  });

  it('wipes stored social-account credentials when a subscription is deleted', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(makeEvent('customer.subscription.deleted'));
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: 't1',
      subscriptionTier: 'premium',
      pendingTier: null,
      onboardingCompleted: true,
    });

    const req = mockReq({ 'stripe-signature': 'ok' });
    const res = mockRes();
    await handlePlatformWebhook(req, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.socialAccount.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1' },
        data: expect.objectContaining({ secretCiphertext: null }),
      }),
    );
  });

  it('completes onboarding when Stripe confirms the initial subscription', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(makeEvent('customer.subscription.created'));
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: 't1',
      subscriptionTier: 'premium',
      pendingTier: null,
      onboardingCompleted: false,
    });
    const req = mockReq({ 'stripe-signature': 'ok' });
    const res = mockRes();

    await handlePlatformWebhook(req, res as unknown as Response);

    expect(prismaMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboardingCompleted: true,
          subscriptionStatus: 'active',
        }),
      }),
    );
  });
});
