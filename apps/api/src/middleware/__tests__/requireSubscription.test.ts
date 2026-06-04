import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * requireSubscription middleware tests (P5).
 *
 * Covers each branch of the gate:
 *   - platform_admin → always passes
 *   - missing tenantId → 401 (auth shouldn't have let this through)
 *   - tenant missing → 403 tenant_not_found
 *   - isActive=false → 403 ACCOUNT_SUSPENDED
 *   - emailVerifiedAt null → 403 EMAIL_NOT_VERIFIED
 *   - status='past_due' → 402 SUBSCRIPTION_REQUIRED
 *   - status='cancelled' → 402 SUBSCRIPTION_REQUIRED
 *   - status='active' → passes
 *   - status='trialing' + incomplete onboarding → 403
 *   - status='trialing' + complete onboarding → passes
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tenant: { findUnique: vi.fn() },
    user:   { findUnique: vi.fn() },
  },
}));

vi.mock('../../lib/db.js', () => ({ rawPrisma: prismaMock, db: prismaMock }));
vi.mock('../../config/env.js', () => ({
  config: { nodeEnv: 'test', logLevel: 'silent' },
}));

import { requireSubscription } from '../requireSubscription.js';
import { HttpError } from '../error.js';
import type { Request, Response, NextFunction } from 'express';

function call(auth: { sub: string; role: string; tenantId: string | null } | undefined) {
  const next = vi.fn();
  const req = { auth } as unknown as Request;
  const res = {} as Response;

  return new Promise<{ next: ReturnType<typeof vi.fn>; thrown: unknown }>((resolve) => {
    requireSubscription(req, res, ((err: unknown) => {
      if (err) {
        resolve({ next, thrown: err });
      } else {
        next();
        resolve({ next, thrown: null });
      }
    }) as NextFunction);
  });
}

beforeEach(() => {
  prismaMock.tenant.findUnique.mockReset();
  prismaMock.user.findUnique.mockReset();
});

describe('requireSubscription', () => {
  it('passes for platform_admin without touching the DB', async () => {
    const { next, thrown } = await call({ sub: 'u1', role: 'platform_admin', tenantId: null });
    expect(thrown).toBeNull();
    expect(next).toHaveBeenCalled();
    expect(prismaMock.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('throws 401 when no auth is attached', async () => {
    const { thrown } = await call(undefined);
    expect((thrown as HttpError).status).toBe(401);
    expect((thrown as HttpError).code).toBe('missing_token');
  });

  it('throws 401 when a client auth has no tenantId', async () => {
    const { thrown } = await call({ sub: 'u1', role: 'client', tenantId: null });
    expect((thrown as HttpError).status).toBe(401);
    expect((thrown as HttpError).code).toBe('missing_tenant');
  });

  it('throws 403 tenant_not_found when the tenant row is missing', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null);
    const { thrown } = await call({ sub: 'u1', role: 'client', tenantId: 't1' });
    expect((thrown as HttpError).status).toBe(403);
    expect((thrown as HttpError).code).toBe('tenant_not_found');
  });

  it('throws 402 SUBSCRIPTION_REQUIRED for a freshly-registered incomplete tenant', async () => {
    // `incomplete` is the status every tenant carries straight out of
    // registration (before payment). It must never reach the app surface.
    // onboardingCompleted is forced true here to isolate the status gate.
    prismaMock.tenant.findUnique.mockResolvedValue({
      isActive: true,
      subscriptionStatus: 'incomplete',
      onboardingCompleted: true,
    });
    prismaMock.user.findUnique.mockResolvedValue({ emailVerifiedAt: new Date() });
    const { thrown } = await call({ sub: 'u1', role: 'client', tenantId: 't1' });
    expect((thrown as HttpError).status).toBe(402);
    expect((thrown as HttpError).code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('throws 403 ACCOUNT_SUSPENDED when tenant.isActive is false', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      isActive: false,
      subscriptionStatus: 'active',
      onboardingCompleted: true,
    });
    const { thrown } = await call({ sub: 'u1', role: 'client', tenantId: 't1' });
    expect((thrown as HttpError).status).toBe(403);
    expect((thrown as HttpError).code).toBe('ACCOUNT_SUSPENDED');
  });

  it('throws 403 EMAIL_NOT_VERIFIED when emailVerifiedAt is null', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      isActive: true,
      subscriptionStatus: 'active',
      onboardingCompleted: true,
    });
    prismaMock.user.findUnique.mockResolvedValue({ emailVerifiedAt: null });
    const { thrown } = await call({ sub: 'u1', role: 'client', tenantId: 't1' });
    expect((thrown as HttpError).status).toBe(403);
    expect((thrown as HttpError).code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('throws 402 SUBSCRIPTION_REQUIRED when status is past_due', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      isActive: true,
      subscriptionStatus: 'past_due',
      onboardingCompleted: true,
    });
    prismaMock.user.findUnique.mockResolvedValue({ emailVerifiedAt: new Date() });
    const { thrown } = await call({ sub: 'u1', role: 'client', tenantId: 't1' });
    expect((thrown as HttpError).status).toBe(402);
    expect((thrown as HttpError).code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('throws 402 SUBSCRIPTION_REQUIRED when status is cancelled', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      isActive: true,
      subscriptionStatus: 'cancelled',
      onboardingCompleted: true,
    });
    prismaMock.user.findUnique.mockResolvedValue({ emailVerifiedAt: new Date() });
    const { thrown } = await call({ sub: 'u1', role: 'client', tenantId: 't1' });
    expect((thrown as HttpError).status).toBe(402);
  });

  it('passes for active subscriptions', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      isActive: true,
      subscriptionStatus: 'active',
      onboardingCompleted: true,
    });
    prismaMock.user.findUnique.mockResolvedValue({ emailVerifiedAt: new Date() });
    const { next, thrown } = await call({ sub: 'u1', role: 'client', tenantId: 't1' });
    expect(thrown).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('throws 403 ONBOARDING_INCOMPLETE for trialing tenants without card setup', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      isActive: true,
      subscriptionStatus: 'trialing',
      onboardingCompleted: false,
    });
    prismaMock.user.findUnique.mockResolvedValue({ emailVerifiedAt: new Date() });
    const { thrown } = await call({ sub: 'u1', role: 'client', tenantId: 't1' });
    expect((thrown as HttpError).status).toBe(403);
    expect((thrown as HttpError).code).toBe('ONBOARDING_INCOMPLETE');
  });

  it('passes for trialing subscriptions after onboarding is complete', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      isActive: true,
      subscriptionStatus: 'trialing',
      onboardingCompleted: true,
    });
    prismaMock.user.findUnique.mockResolvedValue({ emailVerifiedAt: new Date() });
    const { next, thrown } = await call({ sub: 'u1', role: 'client', tenantId: 't1' });
    expect(thrown).toBeNull();
    expect(next).toHaveBeenCalled();
  });
});
