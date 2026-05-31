import { beforeEach, describe, expect, it, vi } from 'vitest';
import multer from 'multer';

/**
 * uploads route. No supertest in this repo (route tests call the unit under
 * test directly), so we exercise the extracted pieces: the multer fileFilter
 * (415), the multer error mapper (413), the upload handler (201 / 400 NO_FILE),
 * the signed-url handler (200 / 403 cross-tenant / 400 missing path), and the
 * auth gate (401).
 */

vi.mock('../../config/env.js', () => ({
  config: { storage: { enabled: true, url: 'https://x.supabase.co', serviceKey: 'k', bucket: 'b' } },
}));
vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../lib/tenantContext.js', () => ({ getTenantId: () => 'tenant_test_id' }));
// requireSubscription pulls in the Prisma client at import; stub it (the 401
// path throws before any query runs).
vi.mock('../../lib/db.js', () => ({
  rawPrisma: { tenant: { findUnique: vi.fn() }, user: { findUnique: vi.fn() } },
  db: {},
}));
// Keep the real ALLOWED_MIME / MAX_FILE_SIZE (used by the route at load) but
// stub the network-touching uploadFile / createSignedUrl.
vi.mock('../../services/uploadService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/uploadService.js')>();
  return { ...actual, uploadFile: vi.fn(), createSignedUrl: vi.fn() };
});

import * as uploadService from '../../services/uploadService.js';
import { fileFilter, mapUploadError, handleRequestAttachment, handleSignedUrl } from '../uploads.js';
import { requireRole } from '../../middleware/requireRole.js';
import { requireSubscription } from '../../middleware/requireSubscription.js';
import { HttpError } from '../../middleware/error.js';

beforeEach(() => {
  vi.mocked(uploadService.uploadFile).mockReset();
  vi.mocked(uploadService.createSignedUrl).mockReset();
});

describe('fileFilter', () => {
  it('accepts an allowed MIME type', () => {
    const cb = vi.fn();
    fileFilter({} as never, { mimetype: 'image/png' } as never, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('rejects a disallowed MIME type with 415', () => {
    const cb = vi.fn();
    fileFilter({} as never, { mimetype: 'text/plain' } as never, cb);
    expect(cb.mock.calls[0]![0]).toMatchObject({ status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
  });
});

describe('mapUploadError', () => {
  it('maps multer LIMIT_FILE_SIZE to 413', () => {
    expect(mapUploadError(new multer.MulterError('LIMIT_FILE_SIZE'))).toMatchObject({
      status: 413,
      code: 'FILE_TOO_LARGE',
    });
  });

  it('maps other multer errors to 400', () => {
    expect(mapUploadError(new multer.MulterError('LIMIT_UNEXPECTED_FILE'))).toMatchObject({
      status: 400,
      code: 'UPLOAD_ERROR',
    });
  });

  it('passes non-multer errors through unchanged', () => {
    const e = new HttpError(415, 'x', 'UNSUPPORTED_MEDIA_TYPE');
    expect(mapUploadError(e)).toBe(e);
  });
});

describe('handleRequestAttachment', () => {
  it('uploads the file and returns the result (the 201 path)', async () => {
    vi.mocked(uploadService.uploadFile).mockResolvedValue({
      name: 'y.png',
      size: 10,
      path: 'requests/tenant_test_id/123-y.png',
    });
    const req = {
      file: { buffer: Buffer.from('x'), originalname: 'y.png', mimetype: 'image/png' },
    } as never;

    const result = await handleRequestAttachment(req);

    expect(result).toEqual({ name: 'y.png', size: 10, path: 'requests/tenant_test_id/123-y.png' });
    expect(uploadService.uploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'y.png',
      'image/png',
      'tenant_test_id',
    );
  });

  it('400s NO_FILE when no file is attached', async () => {
    await expect(handleRequestAttachment({} as never)).rejects.toMatchObject({
      status: 400,
      code: 'NO_FILE',
    });
  });
});

describe('handleSignedUrl', () => {
  it('signs a path inside the caller’s tenant and returns { signedUrl } (the 200 path)', async () => {
    vi.mocked(uploadService.createSignedUrl).mockResolvedValue('https://signed.example/f?token=abc');
    const req = { query: { path: 'requests/tenant_test_id/123-y.png' } } as never;

    const result = await handleSignedUrl(req);

    expect(result).toEqual({ signedUrl: 'https://signed.example/f?token=abc' });
    expect(uploadService.createSignedUrl).toHaveBeenCalledWith('requests/tenant_test_id/123-y.png');
  });

  it('403s a path that belongs to a different tenant (never signs)', async () => {
    const req = { query: { path: 'requests/other_tenant/secret.pdf' } } as never;
    await expect(handleSignedUrl(req)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_PATH' });
    expect(uploadService.createSignedUrl).not.toHaveBeenCalled();
  });

  it('403s a traversal attempt that escapes the tenant folder', async () => {
    const req = { query: { path: 'requests/tenant_test_id/../other_tenant/secret.pdf' } } as never;
    await expect(handleSignedUrl(req)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_PATH' });
    expect(uploadService.createSignedUrl).not.toHaveBeenCalled();
  });

  it('400s MISSING_PATH when no path query is provided', async () => {
    await expect(handleSignedUrl({ query: {} } as never)).rejects.toMatchObject({
      status: 400,
      code: 'MISSING_PATH',
    });
  });
});

describe('auth gate', () => {
  it('401s an unauthenticated request (requireRole client)', () => {
    const handler = requireRole('client');
    let caught: unknown;
    try {
      handler({} as never, {} as never, vi.fn());
    } catch (e) {
      caught = e;
    }
    expect(caught).toMatchObject({ status: 401 });
  });

  it('401s an unauthenticated signed-url request (requireSubscription)', async () => {
    // The endpoint is mounted behind requireSubscription; with no req.auth it
    // rejects before any tenant/billing lookup.
    const thrown = await new Promise<unknown>((resolve) => {
      requireSubscription({} as never, {} as never, ((err: unknown) => resolve(err)) as never);
    });
    expect(thrown).toMatchObject({ status: 401, code: 'missing_token' });
  });
});
