import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSubscriptionSchema, billingPortalSchema } from '../stripe.validators.js';

/**
 * Stripe validator tests.
 *
 * These guard the boundary for P2 (SetupIntent verification) and the billing
 * portal open-redirect surface:
 *   - `createSubscriptionSchema` is the first gate a forged/garbage
 *     `setupIntentId` hits. A value that isn't a Stripe SetupIntent id is
 *     rejected at the schema (400) before any Stripe call is made.
 *   - `billingPortalSchema.returnUrl` must be an approved origin or our
 *     `bdtconnect://` deep link, so a caller can't bounce the user to an
 *     attacker-controlled domain after the hosted portal.
 */

describe('createSubscriptionSchema', () => {
  it('accepts a well-formed SetupIntent id and defaults the tier to premium', () => {
    const parsed = createSubscriptionSchema.parse({ setupIntentId: 'seti_1ABCdef' });
    expect(parsed).toEqual({ setupIntentId: 'seti_1ABCdef', tier: 'premium' });
  });

  it('requires setupIntentId — an empty body is rejected', () => {
    const result = createSubscriptionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects a setupIntentId that is not a Stripe SetupIntent (fake/forged id)', () => {
    for (const fake of ['pm_123', 'sub_123', 'totally-fake', 'seti', '']) {
      const result = createSubscriptionSchema.safeParse({ setupIntentId: fake });
      expect(result.success, `expected ${JSON.stringify(fake)} to be rejected`).toBe(false);
    }
  });

  it('rejects a non-string setupIntentId', () => {
    expect(createSubscriptionSchema.safeParse({ setupIntentId: 12345 }).success).toBe(false);
    expect(createSubscriptionSchema.safeParse({ setupIntentId: null }).success).toBe(false);
  });

  it('rejects an unknown subscription tier', () => {
    const result = createSubscriptionSchema.safeParse({ setupIntentId: 'seti_ok', tier: 'basic' });
    expect(result.success).toBe(false);
  });
});

describe('billingPortalSchema', () => {
  const ORIGINAL = process.env.PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.PUBLIC_APP_URL = 'https://admin.bdtconnect.com';
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = ORIGINAL;
  });

  it('allows an omitted returnUrl', () => {
    expect(billingPortalSchema.safeParse({}).success).toBe(true);
  });

  it('allows the native deep-link scheme', () => {
    expect(
      billingPortalSchema.safeParse({ returnUrl: 'bdtconnect://settings/billing' }).success,
    ).toBe(true);
  });

  it('allows a return URL on the approved origin', () => {
    expect(
      billingPortalSchema.safeParse({ returnUrl: 'https://admin.bdtconnect.com/settings/billing' })
        .success,
    ).toBe(true);
  });

  it('rejects a return URL on an attacker-controlled origin', () => {
    expect(
      billingPortalSchema.safeParse({ returnUrl: 'https://evil.example.com/phish' }).success,
    ).toBe(false);
  });

  it('rejects a value that is not a URL', () => {
    expect(billingPortalSchema.safeParse({ returnUrl: 'not a url' }).success).toBe(false);
  });
});
