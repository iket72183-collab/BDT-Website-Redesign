import { beforeEach, describe, expect, it, vi } from 'vitest';

const { stripeMock, prismaMock, eventMock } = vi.hoisted(() => ({
  stripeMock: {
    setupIntents: { retrieve: vi.fn(), create: vi.fn() },
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
    stripe: { priceIds: { premium: 'price_premium' } },
    publicUrl: 'https://app.example.test',
    publicAppUrl: 'https://app.example.test',
  },
}));
vi.mock('../platformEventService.js', () => ({ logEvent: eventMock }));

import { createSubscription, createSetupIntent } from '../stripeService.js';

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
  status: 'active', // single-plan model bills immediately — no trial
  trial_end: null,
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
      createSubscription({ tenantId: 'tenant_1', tier: 'premium', setupIntentId: 'seti_bad' }),
    ).rejects.toMatchObject({ status: 400, code: 'SETUP_INTENT_INCOMPLETE' });
    expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
  });

  it('rejects a SetupIntent created for another tenant', async () => {
    stripeMock.setupIntents.retrieve.mockResolvedValueOnce({
      ...SETUP_INTENT,
      metadata: { tenantId: 'tenant_other' },
    });

    await expect(
      createSubscription({ tenantId: 'tenant_1', tier: 'premium', setupIntentId: 'seti_other' }),
    ).rejects.toMatchObject({ status: 403, code: 'SETUP_INTENT_MISMATCH' });
    expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
  });

  it('subscribes immediately (no trial) with the verified payment method and tenant idempotency key', async () => {
    const result = await createSubscription({
      tenantId: 'tenant_1',
      tier: 'premium',
      setupIntentId: 'seti_valid',
    });

    expect(stripeMock.customers.update).toHaveBeenCalledWith('cus_1', {
      invoice_settings: { default_payment_method: 'pm_1' },
    });
    expect(stripeMock.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ default_payment_method: 'pm_1' }),
      { idempotencyKey: 'sub:create:tenant_1' },
    );
    // No free trial in the single-plan model.
    const createArgs = stripeMock.subscriptions.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createArgs).not.toHaveProperty('trial_period_days');
    expect(result.subscriptionId).toBe('sub_1');
  });

  it('refuses a competing subscription provisioning request before calling Stripe', async () => {
    prismaMock.tenant.updateMany.mockReset().mockResolvedValueOnce({ count: 0 });

    await expect(
      createSubscription({ tenantId: 'tenant_1', tier: 'premium', setupIntentId: 'seti_valid' }),
    ).rejects.toMatchObject({ status: 409, code: 'SUBSCRIPTION_PROVISIONING' });
    expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
  });

  it('refuses when the tenant already has a subscription, before touching Stripe', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ ...TENANT, stripeSubscriptionId: 'sub_existing' });

    await expect(
      createSubscription({ tenantId: 'tenant_1', tier: 'premium', setupIntentId: 'seti_valid' }),
    ).rejects.toMatchObject({ status: 409, code: 'subscription_exists' });
    expect(stripeMock.setupIntents.retrieve).not.toHaveBeenCalled();
    expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
  });

  it('404s when the tenant does not exist', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null);

    await expect(
      createSubscription({ tenantId: 'ghost', tier: 'premium', setupIntentId: 'seti_valid' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
  });

  it('rejects a SetupIntent whose Stripe customer is not the tenant customer', async () => {
    stripeMock.setupIntents.retrieve.mockResolvedValueOnce({
      ...SETUP_INTENT,
      customer: 'cus_someone_else',
    });

    await expect(
      createSubscription({ tenantId: 'tenant_1', tier: 'premium', setupIntentId: 'seti_valid' }),
    ).rejects.toMatchObject({ status: 403, code: 'SETUP_INTENT_MISMATCH' });
    expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
  });

  it('rejects a SetupIntent with no attached payment method', async () => {
    stripeMock.setupIntents.retrieve.mockResolvedValueOnce({ ...SETUP_INTENT, payment_method: null });

    await expect(
      createSubscription({ tenantId: 'tenant_1', tier: 'premium', setupIntentId: 'seti_valid' }),
    ).rejects.toMatchObject({ status: 400, code: 'SETUP_INTENT_INCOMPLETE' });
    expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
  });

  it('persists the subscription and completes onboarding on success', async () => {
    await createSubscription({ tenantId: 'tenant_1', tier: 'premium', setupIntentId: 'seti_valid' });

    const storeCall = prismaMock.tenant.updateMany.mock.calls.find(
      ([args]) => (args as { data?: Record<string, unknown> }).data?.stripeSubscriptionId === 'sub_1',
    );
    expect(storeCall).toBeTruthy();
    expect((storeCall![0] as { data: Record<string, unknown> }).data).toMatchObject({
      stripeSubscriptionId: 'sub_1',
      subscriptionStatus: 'active',
      onboardingCompleted: true,
    });
  });
});

describe('createSetupIntent', () => {
  it('creates a tenant-scoped SetupIntent with a stable idempotency key', async () => {
    stripeMock.setupIntents.create.mockResolvedValue({ client_secret: 'seti_secret_123' });

    const result = await createSetupIntent('tenant_1');

    expect(result.clientSecret).toBe('seti_secret_123');
    expect(stripeMock.setupIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { tenantId: 'tenant_1' } }),
      { idempotencyKey: 'setup:tenant_1' },
    );
  });

  it('throws when Stripe returns no client_secret', async () => {
    stripeMock.setupIntents.create.mockResolvedValue({ client_secret: null });

    await expect(createSetupIntent('tenant_1')).rejects.toMatchObject({ status: 500 });
  });
});
