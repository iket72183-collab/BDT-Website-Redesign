import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

/**
 * verifyToken middleware tests. Focus on the token-type discriminator
 * (P1 from the code-review fixes) and the basic envelope behavior:
 *
 *   - Missing Authorization → 401 missing_token
 *   - Bad signature → 401 invalid_token
 *   - Expired access token → 401 TOKEN_EXPIRED (specific code so the mobile
 *     client can distinguish from generic auth failure and refresh)
 *   - Valid access token → next() called, req.auth populated
 *   - Refresh token presented as access → 401 invalid_token_type (the bug
 *     this whole fix is about)
 */

// vi.mock factories run before module-top-level constants are initialized, so
// we hoist the SECRET into the same scope as the mock factory.
const { SECRET, COMMON } = vi.hoisted(() => {
  const SECRET = 'a'.repeat(48);
  return {
    SECRET,
    COMMON: { issuer: 'bdt-connect-api', audience: 'bdt-connect-client' },
  };
});

vi.mock('../../config/env.js', () => ({
  config: {
    nodeEnv: 'test',
    logLevel: 'silent',
    jwt: {
      secret: SECRET,
      accessSecret: SECRET,
      refreshSecret: SECRET,
      accessTtl: '15m',
      refreshTtl: '30d',
      issuer: 'bdt-connect-api',
      audience: 'bdt-connect-client',
    },
  },
}));

import { verifyToken } from '../verifyToken.js';
import { HttpError } from '../error.js';

function mockReq(headers: Record<string, string> = {}) {
  return {
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  } as never;
}

function call(token?: string) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const next = vi.fn();
  const req = mockReq(headers) as { auth?: unknown };
  let thrown: unknown = null;
  try {
    verifyToken(req as never, {} as never, next);
  } catch (err) {
    thrown = err;
  }
  return { next, req, thrown };
}

describe('verifyToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests with no Authorization header', () => {
    const { thrown } = call();
    expect(thrown).toBeInstanceOf(HttpError);
    expect((thrown as HttpError).status).toBe(401);
    expect((thrown as HttpError).code).toBe('missing_token');
  });

  it('rejects malformed Bearer header', () => {
    const { thrown } = call();
    expect(thrown).toBeInstanceOf(HttpError);
  });

  it('rejects tokens with bad signature', () => {
    const bad = jwt.sign({ sub: 'u1', role: 'client', tenantId: 't1', tokenType: 'access' }, 'wrong-secret', { ...COMMON });
    const { thrown } = call(bad);
    expect((thrown as HttpError).status).toBe(401);
    expect((thrown as HttpError).code).toBe('invalid_token');
  });

  it('surfaces token expiry with the TOKEN_EXPIRED code', () => {
    const expired = jwt.sign(
      { sub: 'u1', role: 'client', tenantId: 't1', tokenType: 'access' },
      SECRET,
      { ...COMMON, expiresIn: '-1m' },
    );
    const { thrown } = call(expired);
    expect((thrown as HttpError).status).toBe(401);
    expect((thrown as HttpError).code).toBe('TOKEN_EXPIRED');
  });

  it('accepts a valid access token and populates req.auth', () => {
    const token = jwt.sign(
      { sub: 'u1', role: 'client', tenantId: 't1', tokenType: 'access' },
      SECRET,
      { ...COMMON, expiresIn: '15m' },
    );
    const { next, req, thrown } = call(token);
    expect(thrown).toBeNull();
    expect(next).toHaveBeenCalled();
    expect(req.auth).toEqual({ sub: 'u1', role: 'client', tenantId: 't1' });
  });

  it('REJECTS a refresh token presented as an access token (P1 fix)', () => {
    const refresh = jwt.sign(
      { sub: 'u1', role: 'client', tenantId: 't1', tokenType: 'refresh', jti: 'jti-1' },
      SECRET,
      { ...COMMON, expiresIn: '30d' },
    );
    const { thrown } = call(refresh);
    expect((thrown as HttpError).status).toBe(401);
    expect((thrown as HttpError).code).toBe('invalid_token_type');
  });

  it('rejects tokens issued for a different audience', () => {
    const token = jwt.sign(
      { sub: 'u1', role: 'client', tenantId: 't1', tokenType: 'access' },
      SECRET,
      { issuer: 'bdt-connect-api', audience: 'someone-else', expiresIn: '15m' },
    );
    const { thrown } = call(token);
    expect((thrown as HttpError).status).toBe(401);
  });
});
