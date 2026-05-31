import { beforeEach, describe, expect, it, vi } from 'vitest';

const { stripeMock, prismaMock, eventMock } = vi.hoisted(() => ({
  stripeMock: {
    setupIntents: { retrieve: vi.fn() },
    customers: { create: vi.fn(), update: vi.fn() },
    subscriptions: { create: vi.fn(), retrieve: vi.fn(), update: vi.fn(), cancel: vi.fn() },
    subscriptionSchedules: { create: vi.fn(), retrieve: vi.fn(), update: vi.fn(), release: vi.fn() },
    billingPortal: { sessions: { create: vi.fn() } },
  },
  prismaMock: {
    tenant: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
  eventMock: vi.fn(),
}));

vi.mock('../../lib/stripe.js', () => ({ stripe: stripeMock }));
vi.mock('../../lib/db.js', () => ({ rawPrisma: prismaMock, db: prismaMock }));
vi.mock('../../lib/tenantContext.js', () => ({
  getTenantId: () => 'tenant_1',
  runAsTenant: (_ctx: unknown, fn: () => unknown) => fn(),
}));
vi.mock('../../config/env.js', () => ({
  config: {
    nodeEnv: 'test',
    logLevel: 'silent',
    stripe: { priceIds: { basic: 'price_basic', premium: 'price_premium' } },
    publicUrl: 'https://app.example.test',
    publicAppUrl: 'https://app.example.test',
  },
}));
vi.mock('../platformEventService.js', () => ({ logEvent: eventMock }));

import { createSubscription, updateSubscription } from '../stripeService.js';

const TENANT = {
  id: 'tenant_1',
  slug: 'acme',
  businessName: 'Acme',
  stripeCustomerId: 'cus_1',
  stripeSubscriptionId: null,
  owner: { email: 'owner@acme.test' },
};

const SETUP_INTENT = {
  id: 'seti_valid',
  status: 'succeeded',
  customer: 'cus_1',
  payment_method: 'pm_1',
  metadata: { tenantId: 'tenant_1' },
};

const SUBSCRIPTION = {
  id: 'sub_1',
  status: 'trialing',
  trial_end: 1_800_000_000,
  metadata: { tenantId: 'tenant_1', tier: 'premium' },
  customer: 'cus_1',
  schedule: null,
  current_period_start: 1_800_000_000,
  current_period_end: 1_802_592_000,
  items: { data: [{ id: 'si_1', price: { id: 'price_premium' }, quantity: 1 }] },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.tenant.findUnique.mockResolvedValue(TENANT);
  stripeMock.setupIntents.retrieve.mockResolvedValue(SETUP_INTENT);
  stripeMock.customers.update.mockResolvedValue({});
  stripeMock.subscriptions.create.mockResolvedValue(SUBSCRIPTION);
  stripeMock.subscriptions.cancel.mockResolvedValue({});
  prismaMock.tenant.updateMany
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValueOnce({ count: 1 });
  prismaMock.tenant.update.mockResolvedValue({});
  eventMock.mockResolvedValue(undefined);
});

describe('createSubscription', () => {
  it('rejects a SetupIntent that has not succeeded before creating a subscription', async () => {
    stripeMock.setupIntents.retrieve.mockResolvedValueOnce({
      ...SETUP_INTENT,
      status: 'requires_payment_method',
    });

    await expect(
      createSubscription({ tenantId: 'tenant_1', tier: 'basic', setupIntentId: 'seti_bad' }),
    ).rejects.toMatchObject({ status: 400, code: 'SETUP_INTENT_INCOMPLETE' });
    expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
  });

  it('rejects a SetupIntent created for another tenant', async () => {
    stripeMock.setupIntents.retrieve.mockResolvedValueOnce({
      ...SETUP_INTENT,
      metadata: { tenantId: 'tenant_other' },
    });

    await expect(
      createSubscription({ tenantId: 'tenant_1', tier: 'basic', setupIntentId: 'seti_other' }),
    ).rejects.toMatchObject({ status: 403, code: 'SETUP_INTENT_MISMATCH' });
    expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
  });

  it('creates a trial only with the verified payment method and tenant idempotency key', async () => {
    const result = await createSubscription({
      tenantId: 'tenant_1',
      tier: 'premium',
      setupIntentId: 'seti_valid',
    });

    expect(stripeMock.customers.update).toHaveBeenCalledWith('cus_1', {
      invoice_settings: { default_payment_method: 'pm_1' },
    });
    expect(stripeMock.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ default_payment_method: 'pm_1', trial_period_days: 14 }),
      { idempotencyKey: 'sub:create:tenant_1' },
    );
    expect(result.subscriptionId).toBe('sub_1');
  });

  it('refuses a competing subscription provisioning request before calling Stripe', async () => {
    prismaMock.tenant.updateMany.mockReset().mockResolvedValueOnce({ count: 0 });

    await expect(
      createSubscription({ tenantId: 'tenant_1', tier: 'basic', setupIntentId: 'seti_valid' }),
    ).rejects.toMatchObject({ status: 409, code: 'SUBSCRIPTION_PROVISIONING' });
    expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
  });
});

describe('updateSubscription', () => {
  it('schedules downgrades at period end and stores the pending tier', async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValueOnce(SUBSCRIPTION);
    stripeMock.subscriptionSchedules.create.mockResolvedValueOnce({ id: 'sub_sched_1' });
    stripeMock.subscriptionSchedules.update.mockResolvedValueOnce({});

    const result = await updateSubscription('tenant_1', 'sub_1', 'basic');

    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
    expect(stripeMock.subscriptionSchedules.create).toHaveBeenCalledWith({
      from_subscription: 'sub_1',
    });
    expect(prismaMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pendingTier: 'basic' }) }),
    );
    expect(result.pendingTier).toBe('basic');
  });

  it('releases a pending downgrade when the client keeps the current tier', async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValueOnce({
      ...SUBSCRIPTION,
      schedule: 'sub_sched_1',
    });
    stripeMock.subscriptionSchedules.release.mockResolvedValueOnce({});

    const result = await updateSubscription('tenant_1', 'sub_1', 'premium');

    expect(stripeMock.subscriptionSchedules.release).toHaveBeenCalledWith('sub_sched_1');
    expect(prismaMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pendingTier: null, pendingTierEffectiveAt: null } }),
    );
    expect(result.pendingTier).toBeNull();
  });
});
