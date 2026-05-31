import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, loggerMock } = vi.hoisted(() => ({
  prismaMock: {
    refreshToken: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  loggerMock: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const SECRET = 'token-tests-secret-which-is-long-enough-for-use';
vi.mock('../../lib/db.js', () => ({ rawPrisma: prismaMock }));
vi.mock('../../lib/logger.js', () => ({ logger: loggerMock }));
vi.mock('../../config/env.js', () => ({
  config: {
    jwt: {
      accessSecret: 'token-tests-secret-which-is-long-enough-for-use',
      refreshSecret: 'token-tests-secret-which-is-long-enough-for-use',
      accessTtl: '15m',
      refreshTtl: '30d',
      issuer: 'bdt-connect-api',
      audience: 'bdt-connect-client',
    },
  },
}));

import { rotateRefreshToken } from '../tokenService.js';

function refreshJwt(): string {
  return jwt.sign(
    { sub: 'user_1', tenantId: 'tenant_1', role: 'client', jti: 'jti_1', tokenType: 'refresh' },
    SECRET,
    { issuer: 'bdt-connect-api', audience: 'bdt-connect-client', expiresIn: '30d' },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.refreshToken.findUnique.mockResolvedValue({
    jti: 'jti_1',
    userId: 'user_1',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  });
  prismaMock.user.findUnique.mockResolvedValue({
    id: 'user_1',
    role: 'client',
    tenantId: 'tenant_1',
    isActive: true,
  });
  prismaMock.refreshToken.create.mockResolvedValue({});
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
});

describe('rotateRefreshToken', () => {
  it('mints a replacement only after atomically claiming the old token', async () => {
    prismaMock.refreshToken.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await rotateRefreshToken(refreshJwt());

    expect(result.claims.sub).toBe('user_1');
    expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ revokedAt: null }) }),
    );
  });

  it('allows only one of two simultaneous rotations and revokes sessions for the loser', async () => {
    let claimNumber = 0;
    prismaMock.refreshToken.updateMany.mockImplementation(async (args: { where: { jti?: string } }) => {
      if (args.where.jti) {
        claimNumber += 1;
        return { count: claimNumber === 1 ? 1 : 0 };
      }
      return { count: 1 };
    });

    const results = await Promise.allSettled([
      rotateRefreshToken(refreshJwt()),
      rotateRefreshToken(refreshJwt()),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({ code: 'token_reuse_detected' }),
    });
  });
});
