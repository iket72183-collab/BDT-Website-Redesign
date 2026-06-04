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

import { rotateRefreshToken, revokeAllForUser, revokeRefreshToken } from '../tokenService.js';

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

  it('revokes the whole family when the presented jti is unknown', async () => {
    // A valid-signature token whose row is gone means either a forged token
    // (leaked secret) or a wiped row — fail closed AND nuke every session.
    prismaMock.refreshToken.findUnique.mockResolvedValue(null);
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 4 });

    await expect(rotateRefreshToken(refreshJwt())).rejects.toMatchObject({
      code: 'token_reuse_detected',
    });
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user_1', revokedAt: null }) }),
    );
  });

  it('rejects an access token presented as a refresh token (no DB lookup)', async () => {
    const accessJwt = jwt.sign(
      { sub: 'user_1', tenantId: 'tenant_1', role: 'client', jti: 'jti_1', tokenType: 'access' },
      SECRET,
      { issuer: 'bdt-connect-api', audience: 'bdt-connect-client', expiresIn: '15m' },
    );

    await expect(rotateRefreshToken(accessJwt)).rejects.toMatchObject({ code: 'invalid_token_type' });
    expect(prismaMock.refreshToken.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an expired refresh-token row', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      jti: 'jti_1',
      userId: 'user_1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(rotateRefreshToken(refreshJwt())).rejects.toMatchObject({ code: 'token_expired' });
  });

  it('rejects rotation when the user is no longer active', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user_1',
      role: 'client',
      tenantId: 'tenant_1',
      isActive: false,
    });

    await expect(rotateRefreshToken(refreshJwt())).rejects.toMatchObject({ code: 'invalid_refresh' });
  });

  it('rejects a refresh token with a tampered signature', async () => {
    await expect(rotateRefreshToken(`${refreshJwt()}tamper`)).rejects.toMatchObject({
      code: 'invalid_refresh',
    });
  });
});

describe('revokeAllForUser', () => {
  it('revokes every still-active refresh token for the user', async () => {
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 3 });

    await revokeAllForUser('user_1');

    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe('revokeRefreshToken', () => {
  it('is a best-effort no-op for an unparseable token', async () => {
    await expect(revokeRefreshToken('not-a-jwt')).resolves.toBeUndefined();
    expect(prismaMock.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
