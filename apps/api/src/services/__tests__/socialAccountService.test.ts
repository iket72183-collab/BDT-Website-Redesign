import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

/**
 * Social-account service tests (client + admin).
 *
 * Client:
 *   - list returns accounts and NEVER selects/returns the ciphertext
 *   - create enforces unique-per-platform (P2002 → 409 ACCOUNT_EXISTS)
 *   - set-credentials encrypts, stamps secretUpdatedAt + active, returns no ciphertext
 *   - set-credentials on a non-credentials account → 400 WRONG_ACCESS_METHOD
 *   - set-credentials with the vault disabled → 503 vault_unavailable
 *   - delete wipes the secret, then removes the row
 *   - switching accessMethod away from credentials clears the secret
 *
 * Admin:
 *   - list returns rows + total, no ciphertext in the projection
 *   - reveal decrypts, writes a credentials_revealed audit event, returns login
 *   - reveal with no stored secret → 404 NO_CREDENTIALS
 *   - status update persists
 *
 * The vault crypto itself is covered by lib/__tests__/crypto.test.ts; here it's
 * mocked so we test the service logic + the never-leak-the-ciphertext contract.
 */

const { dbMock, rawPrismaMock, cryptoMock, eventMock } = vi.hoisted(() => ({
  dbMock: {
    socialAccount: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
  rawPrismaMock: {
    socialAccount: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) =>
      Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : (ops as unknown),
    ),
  },
  cryptoMock: {
    encryptSecret: vi.fn(),
    decryptSecret: vi.fn(),
    isVaultEnabled: vi.fn(),
    VaultDisabledError: class extends Error {},
  },
  eventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/db.js', () => ({ db: dbMock, rawPrisma: rawPrismaMock }));
vi.mock('../../lib/crypto.js', () => cryptoMock);
vi.mock('../platformEventService.js', () => ({ logEvent: eventMock }));

import {
  listSocialAccounts,
  createSocialAccount,
  updateSocialAccount,
  setSocialAccountCredentials,
  removeSocialAccount,
} from '../socialAccountService.js';
import {
  adminListSocialAccounts,
  revealCredentials,
  adminUpdateSocialAccountStatus,
} from '../adminSocialAccountService.js';

const NOW = new Date('2026-05-29T12:00:00Z');

/** A PUBLIC_SELECT-shaped row (no secretCiphertext field at all). */
function publicRow(over: Record<string, unknown> = {}) {
  return {
    id: 'acct_1',
    tenantId: 'tenant_test_id',
    platform: 'instagram',
    handle: '@acme',
    accessMethod: 'delegated',
    status: 'pending',
    secretUpdatedAt: null as Date | null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

beforeEach(() => {
  Object.values(dbMock.socialAccount).forEach((fn) => fn.mockReset());
  rawPrismaMock.socialAccount.findMany.mockReset();
  rawPrismaMock.socialAccount.findUnique.mockReset();
  rawPrismaMock.socialAccount.update.mockReset();
  rawPrismaMock.socialAccount.count.mockReset();
  cryptoMock.encryptSecret.mockReset().mockReturnValue('v1:gcm:fake-ciphertext');
  cryptoMock.decryptSecret.mockReset().mockReturnValue('social_user:social_pass');
  cryptoMock.isVaultEnabled.mockReset().mockReturnValue(true);
  eventMock.mockReset().mockResolvedValue(undefined);
});

describe('listSocialAccounts', () => {
  it('returns the client view with hasCredentials, never selecting the ciphertext', async () => {
    dbMock.socialAccount.findMany.mockResolvedValue([
      publicRow({ secretUpdatedAt: NOW, accessMethod: 'credentials', status: 'active' }),
    ]);
    const result = await listSocialAccounts();

    // The select projection must not request secretCiphertext.
    const callArg = dbMock.socialAccount.findMany.mock.calls[0]![0];
    expect(callArg.select.secretCiphertext).toBeUndefined();

    expect(result[0]).not.toHaveProperty('secretCiphertext');
    expect(result[0]!.hasCredentials).toBe(true);
    expect(result[0]!.secretUpdatedAt).toBe(NOW.toISOString());
  });

  it('derives hasCredentials = false when no secret is set', async () => {
    dbMock.socialAccount.findMany.mockResolvedValue([publicRow()]);
    const result = await listSocialAccounts();
    expect(result[0]!.hasCredentials).toBe(false);
  });
});

describe('createSocialAccount', () => {
  it('creates an account (no ciphertext in the response)', async () => {
    dbMock.socialAccount.create.mockResolvedValue(publicRow({ accessMethod: 'credentials' }));
    const result = await createSocialAccount({
      tenantId: 'tenant_test_id',
      platform: 'instagram',
      handle: '@acme',
      accessMethod: 'credentials',
    });
    expect(result).not.toHaveProperty('secretCiphertext');
    expect(dbMock.socialAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant_test_id', platform: 'instagram' }),
      }),
    );
  });

  it('maps a unique-constraint violation to 409 ACCOUNT_EXISTS', async () => {
    dbMock.socialAccount.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dupe', { code: 'P2002', clientVersion: '5' }),
    );
    await expect(
      createSocialAccount({ tenantId: 'tenant_test_id', platform: 'instagram', accessMethod: 'delegated' }),
    ).rejects.toMatchObject({ status: 409, code: 'ACCOUNT_EXISTS' });
  });
});

describe('setSocialAccountCredentials', () => {
  it('encrypts username:password, stamps active + secretUpdatedAt, returns no ciphertext', async () => {
    dbMock.socialAccount.findFirst.mockResolvedValue({ id: 'acct_1', accessMethod: 'credentials' });
    dbMock.socialAccount.update.mockResolvedValue({});

    const result = await setSocialAccountCredentials('acct_1', 'user@x.com', 'p@ss:word');

    expect(cryptoMock.encryptSecret).toHaveBeenCalledWith('user@x.com:p@ss:word', 'acct_1');
    const updateArg = dbMock.socialAccount.update.mock.calls[0]![0];
    expect(updateArg.data.secretCiphertext).toBe('v1:gcm:fake-ciphertext');
    expect(updateArg.data.status).toBe('active');
    expect(updateArg.data.secretUpdatedAt).toBeInstanceOf(Date);
    expect(result).toEqual({ success: true, secretUpdatedAt: expect.any(String) });
    expect(result).not.toHaveProperty('secretCiphertext');
  });

  it('rejects when the account is not in credentials mode → 400 WRONG_ACCESS_METHOD', async () => {
    dbMock.socialAccount.findFirst.mockResolvedValue({ id: 'acct_1', accessMethod: 'delegated' });
    await expect(setSocialAccountCredentials('acct_1', 'u', 'p')).rejects.toMatchObject({
      status: 400,
      code: 'WRONG_ACCESS_METHOD',
    });
    expect(cryptoMock.encryptSecret).not.toHaveBeenCalled();
  });

  it('returns 503 vault_unavailable when the vault is disabled', async () => {
    cryptoMock.isVaultEnabled.mockReturnValue(false);
    await expect(setSocialAccountCredentials('acct_1', 'u', 'p')).rejects.toMatchObject({
      status: 503,
      code: 'vault_unavailable',
    });
    expect(dbMock.socialAccount.findFirst).not.toHaveBeenCalled();
  });

  it('404s when the account is not the caller\'s', async () => {
    dbMock.socialAccount.findFirst.mockResolvedValue(null);
    await expect(setSocialAccountCredentials('acct_x', 'u', 'p')).rejects.toMatchObject({ status: 404 });
  });
});

describe('updateSocialAccount', () => {
  it('clears the stored secret when accessMethod moves away from credentials', async () => {
    dbMock.socialAccount.findFirst.mockResolvedValue({ id: 'acct_1' });
    dbMock.socialAccount.update.mockResolvedValue(publicRow({ accessMethod: 'delegated' }));

    await updateSocialAccount('acct_1', { accessMethod: 'delegated' });

    const updateArg = dbMock.socialAccount.update.mock.calls[0]![0];
    expect(updateArg.data.accessMethod).toBe('delegated');
    expect(updateArg.data.secretCiphertext).toBeNull();
    expect(updateArg.data.secretUpdatedAt).toBeNull();
  });

  it('does not touch the secret when accessMethod stays credentials', async () => {
    dbMock.socialAccount.findFirst.mockResolvedValue({ id: 'acct_1' });
    dbMock.socialAccount.update.mockResolvedValue(publicRow({ accessMethod: 'credentials' }));
    await updateSocialAccount('acct_1', { accessMethod: 'credentials', notes: 'hi' });
    const updateArg = dbMock.socialAccount.update.mock.calls[0]![0];
    expect(updateArg.data).not.toHaveProperty('secretCiphertext');
  });
});

describe('removeSocialAccount', () => {
  it('wipes the secret before deleting the row', async () => {
    dbMock.socialAccount.findFirst.mockResolvedValue({ id: 'acct_1' });
    dbMock.socialAccount.update.mockResolvedValue({});
    dbMock.socialAccount.delete.mockResolvedValue({});

    await removeSocialAccount('acct_1');

    expect(dbMock.socialAccount.update).toHaveBeenCalledWith({
      where: { id: 'acct_1' },
      data: { secretCiphertext: null, secretUpdatedAt: null },
    });
    expect(dbMock.socialAccount.delete).toHaveBeenCalledWith({ where: { id: 'acct_1' } });
    // Order: wipe (update) before delete.
    const updateOrder = dbMock.socialAccount.update.mock.invocationCallOrder[0]!;
    const deleteOrder = dbMock.socialAccount.delete.mock.invocationCallOrder[0]!;
    expect(updateOrder).toBeLessThan(deleteOrder);
  });
});

describe('adminListSocialAccounts', () => {
  it('returns rows + total with a ciphertext-free projection and tenant join', async () => {
    rawPrismaMock.socialAccount.findMany.mockResolvedValue([publicRow()]);
    rawPrismaMock.socialAccount.count.mockResolvedValue(1);

    const result = await adminListSocialAccounts({ page: 1, limit: 20, status: 'pending' });

    expect(result.total).toBe(1);
    const callArg = rawPrismaMock.socialAccount.findMany.mock.calls[0]![0];
    expect(callArg.select.secretCiphertext).toBeUndefined();
    expect(callArg.select.tenant).toBeDefined();
    expect(callArg.where).toEqual({ status: 'pending' });
  });
});

describe('revealCredentials', () => {
  it('decrypts, writes an audit event, and returns the login', async () => {
    rawPrismaMock.socialAccount.findUnique.mockResolvedValue({
      id: 'acct_1',
      tenantId: 'tenant_test_id',
      platform: 'instagram',
      handle: '@acme',
      secretCiphertext: 'v1:gcm:fake-ciphertext',
    });

    const result = await revealCredentials('acct_1', 'admin_user_1');

    expect(cryptoMock.decryptSecret).toHaveBeenCalledWith('v1:gcm:fake-ciphertext', 'acct_1');
    expect(result).toEqual({
      username: 'social_user',
      password: 'social_pass',
      platform: 'instagram',
      handle: '@acme',
    });
    expect(eventMock).toHaveBeenCalledWith(
      'credentials_revealed',
      expect.objectContaining({
        adminUserId: 'admin_user_1',
        socialAccountId: 'acct_1',
        tenantId: 'tenant_test_id',
        platform: 'instagram',
      }),
    );
  });

  it('splits only on the first colon (password may contain colons)', async () => {
    cryptoMock.decryptSecret.mockReturnValue('user@x.com:p@ss:w:rd');
    rawPrismaMock.socialAccount.findUnique.mockResolvedValue({
      id: 'acct_1',
      tenantId: 't',
      platform: 'facebook',
      handle: null,
      secretCiphertext: 'ct',
    });
    const result = await revealCredentials('acct_1', 'admin_1');
    expect(result.username).toBe('user@x.com');
    expect(result.password).toBe('p@ss:w:rd');
  });

  it('404s NO_CREDENTIALS when nothing is stored', async () => {
    rawPrismaMock.socialAccount.findUnique.mockResolvedValue({
      id: 'acct_1',
      tenantId: 't',
      platform: 'instagram',
      handle: '@a',
      secretCiphertext: null,
    });
    await expect(revealCredentials('acct_1', 'admin_1')).rejects.toMatchObject({
      status: 404,
      code: 'NO_CREDENTIALS',
    });
    expect(eventMock).not.toHaveBeenCalled();
  });

  it('404s when the account does not exist', async () => {
    rawPrismaMock.socialAccount.findUnique.mockResolvedValue(null);
    await expect(revealCredentials('missing', 'admin_1')).rejects.toMatchObject({ status: 404 });
  });
});

describe('adminUpdateSocialAccountStatus', () => {
  it('updates the status', async () => {
    rawPrismaMock.socialAccount.update.mockResolvedValue(publicRow({ status: 'active' }));
    await adminUpdateSocialAccountStatus('acct_1', 'active');
    expect(rawPrismaMock.socialAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'acct_1' }, data: { status: 'active' } }),
    );
  });
});
