import { describe, expect, it } from 'vitest';
import {
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../auth.validators.js';

/**
 * Auth validator tests — input hardening on the registration + credential
 * surface (P0). The strong-password rule and slug constraint are the first
 * line of defence before authService ever runs, so they get explicit coverage.
 */

const STRONG_PASSWORD = 'Sup3rSecretPass';

const VALID_REGISTER = {
  email: 'Owner@Acme.TEST',
  password: STRONG_PASSWORD,
  firstName: 'Jane',
  lastName: 'Doe',
  tenant: { slug: 'acme-co', businessName: 'Acme Co' },
};

describe('registerSchema', () => {
  it('accepts a well-formed registration and lowercases the email', () => {
    const parsed = registerSchema.parse(VALID_REGISTER);
    expect(parsed.email).toBe('owner@acme.test');
    expect(parsed.tenant.slug).toBe('acme-co');
  });

  it('rejects an invalid email', () => {
    expect(registerSchema.safeParse({ ...VALID_REGISTER, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects weak passwords (too short / missing class)', () => {
    const weak = [
      'short1A',          // < 12 chars
      'alllowercase1',    // no uppercase
      'ALLUPPERCASE1',    // no lowercase
      'NoDigitsHereAtAll', // no digit
    ];
    for (const password of weak) {
      const result = registerSchema.safeParse({ ...VALID_REGISTER, password });
      expect(result.success, `expected ${JSON.stringify(password)} to be rejected`).toBe(false);
    }
  });

  it('rejects an invalid tenant slug', () => {
    for (const slug of ['ab', 'Has Spaces', 'UPPER', 'bad_underscore', 'no']) {
      const result = registerSchema.safeParse({
        ...VALID_REGISTER,
        tenant: { ...VALID_REGISTER.tenant, slug },
      });
      expect(result.success, `expected slug ${JSON.stringify(slug)} to be rejected`).toBe(false);
    }
  });

  it('requires a business name of at least 2 characters', () => {
    const result = registerSchema.safeParse({
      ...VALID_REGISTER,
      tenant: { ...VALID_REGISTER.tenant, businessName: 'A' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown business type', () => {
    const result = registerSchema.safeParse({
      ...VALID_REGISTER,
      tenant: { ...VALID_REGISTER.tenant, businessType: 'not_a_real_type' },
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('lowercases the email and allows an omitted tenantSlug (platform admin)', () => {
    const parsed = loginSchema.parse({ email: 'Admin@BDT.test', password: 'x' });
    expect(parsed.email).toBe('admin@bdt.test');
    expect(parsed.tenantSlug).toBeUndefined();
  });

  it('requires a non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.test', password: '' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('requires a sufficiently long token and a strong password', () => {
    expect(
      resetPasswordSchema.safeParse({ token: 'a'.repeat(32), password: STRONG_PASSWORD }).success,
    ).toBe(true);
    expect(resetPasswordSchema.safeParse({ token: 'short', password: STRONG_PASSWORD }).success).toBe(
      false,
    );
    expect(
      resetPasswordSchema.safeParse({ token: 'a'.repeat(32), password: 'weak' }).success,
    ).toBe(false);
  });
});

describe('verifyEmailSchema', () => {
  it('requires a sufficiently long token', () => {
    expect(verifyEmailSchema.safeParse({ token: 'a'.repeat(32) }).success).toBe(true);
    expect(verifyEmailSchema.safeParse({ token: 'nope' }).success).toBe(false);
  });
});
