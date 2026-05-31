import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, txMock, hashMock } = vi.hoisted(() => ({
  prismaMock: {
    tenant: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  txMock: {
    tenant: { create: vi.fn(), update: vi.fn() },
    user: { create: vi.fn() },
  },
  hashMock: vi.fn(),
}));

vi.mock('bcrypt', () => ({ default: { hash: hashMock, compare: vi.fn() } }));
vi.mock('../../lib/db.js', () => ({ rawPrisma: prismaMock }));
vi.mock('../../lib/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../platformEventService.js', () => ({ logEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../notificationService.js', () => ({
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../tokenService.js', () => ({
  issueAccessToken: vi.fn().mockReturnValue('access'),
  issueRefreshToken: vi.fn().mockResolvedValue('refresh'),
  issueActionToken: vi.fn().mockResolvedValue('verify'),
  consumeActionToken: vi.fn(),
  revokeAllForUser: vi.fn(),
  revokeRefreshToken: vi.fn(),
  rotateRefreshToken: vi.fn(),
}));

import { register } from '../authService.js';

describe('register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tenant.findUnique.mockResolvedValue(null);
    hashMock.mockResolvedValue('hashed');
    txMock.tenant.create.mockResolvedValue({ id: 'tenant_1', slug: 'acme' });
    txMock.user.create.mockResolvedValue({
      id: 'user_1',
      tenantId: 'tenant_1',
      email: 'owner@acme.test',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'client',
      emailVerifiedAt: null,
    });
    txMock.tenant.update.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock));
  });

  it('creates a new tenant as incomplete until payment onboarding succeeds', async () => {
    await register({
      email: 'owner@acme.test',
      password: 'strong-password',
      firstName: 'Jane',
      lastName: 'Doe',
      tenant: { slug: 'acme', businessName: 'Acme' },
    });

    expect(txMock.tenant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subscriptionStatus: 'incomplete',
        onboardingCompleted: false,
      }),
    });
  });
});
