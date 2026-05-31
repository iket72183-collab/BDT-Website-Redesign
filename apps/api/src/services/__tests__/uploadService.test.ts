import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * uploadService — Supabase Storage upload via REST (fetch is stubbed; no
 * network). Covers: valid image + PDF round-trips, MIME rejection (415), size
 * rejection (413), disabled storage (503), storage error (502), tenant-scoped
 * + sanitized path, and filename sanitization.
 */

const { configMock, loggerMock, fetchMock } = vi.hoisted(() => ({
  configMock: {
    storage: {
      enabled: true,
      url: 'https://proj.supabase.co',
      serviceKey: 'svc_key_123',
      bucket: 'request-attachments',
    },
  },
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  fetchMock: vi.fn(),
}));

vi.mock('../../config/env.js', () => ({ config: configMock }));
vi.mock('../../lib/logger.js', () => ({ logger: loggerMock }));

import {
  uploadFile,
  createSignedUrl,
  sanitizeFilename,
  MAX_FILE_SIZE,
  SIGNED_URL_TTL,
} from '../uploadService.js';

beforeEach(() => {
  configMock.storage.enabled = true;
  configMock.storage.url = 'https://proj.supabase.co';
  configMock.storage.serviceKey = 'svc_key_123';
  configMock.storage.bucket = 'request-attachments';
  fetchMock.mockReset().mockResolvedValue({ ok: true, text: async () => '' });
  vi.stubGlobal('fetch', fetchMock);
  loggerMock.error.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe('uploadFile', () => {
  it('uploads a valid image and returns { name, size, path }', async () => {
    const buf = Buffer.from('image-bytes');
    const result = await uploadFile(buf, 'photo.png', 'image/png', 'tenant_1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(endpoint).toContain('/storage/v1/object/request-attachments/requests/tenant_1/');
    expect(endpoint).toContain('-photo.png');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer svc_key_123');
    expect(init.headers['content-type']).toBe('image/png');

    expect(result.name).toBe('photo.png');
    expect(result.size).toBe(buf.length);
    // Private bucket: we store the object PATH, never a public URL.
    expect(result.path).toMatch(/^requests\/tenant_1\/\d+-photo\.png$/);
    expect(result.path).not.toContain('http');
    expect(result.path).not.toContain('/object/public/');
  });

  it('uploads a valid PDF', async () => {
    const result = await uploadFile(Buffer.from('%PDF-'), 'doc.pdf', 'application/pdf', 'tenant_1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.path).toContain('.pdf');
  });

  it('rejects an unsupported MIME type (415) and never touches storage', async () => {
    await expect(
      uploadFile(Buffer.from('x'), 'note.txt', 'text/plain', 'tenant_1'),
    ).rejects.toMatchObject({ status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an oversize file (413)', async () => {
    const big = Buffer.alloc(MAX_FILE_SIZE + 1);
    await expect(
      uploadFile(big, 'big.png', 'image/png', 'tenant_1'),
    ).rejects.toMatchObject({ status: 413, code: 'FILE_TOO_LARGE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('503s when storage is not configured', async () => {
    configMock.storage.enabled = false;
    await expect(
      uploadFile(Buffer.from('x'), 'a.png', 'image/png', 'tenant_1'),
    ).rejects.toMatchObject({ status: 503, code: 'storage_unavailable' });
  });

  it('502s when the storage API returns a non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    await expect(
      uploadFile(Buffer.from('x'), 'a.png', 'image/png', 'tenant_1'),
    ).rejects.toMatchObject({ status: 502, code: 'UPLOAD_FAILED' });
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('builds a tenant-scoped path with a sanitized filename', async () => {
    await uploadFile(Buffer.from('x'), 'My Résumé (final)!.PDF', 'application/pdf', 'tenant_42');
    const endpoint = fetchMock.mock.calls[0]![0] as string;
    expect(endpoint).toContain('/requests/tenant_42/');
    expect(endpoint).toContain('-My-Resume-final.pdf');
  });
});

describe('createSignedUrl', () => {
  const PATH = 'requests/tenant_1/123-photo.png';

  it('signs server-side with the service-role key and returns an absolute URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ signedURL: `/object/sign/request-attachments/${PATH}?token=jwt` }),
    });

    const url = await createSignedUrl(PATH);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(endpoint).toBe(`https://proj.supabase.co/storage/v1/object/sign/request-attachments/${PATH}`);
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer svc_key_123');
    expect(JSON.parse(init.body as string)).toEqual({ expiresIn: SIGNED_URL_TTL });
    expect(SIGNED_URL_TTL).toBe(3600);

    // Supabase returns a storage-relative path; we make it openable.
    expect(url).toBe(
      `https://proj.supabase.co/storage/v1/object/sign/request-attachments/${PATH}?token=jwt`,
    );
  });

  it('502s STORAGE_ERROR when Supabase returns a non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'no rls policy' });
    await expect(createSignedUrl(PATH)).rejects.toMatchObject({
      status: 502,
      code: 'STORAGE_ERROR',
    });
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('502s STORAGE_ERROR when the response is missing signedURL', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(createSignedUrl(PATH)).rejects.toMatchObject({
      status: 502,
      code: 'STORAGE_ERROR',
    });
  });

  it('503s when storage is not configured', async () => {
    configMock.storage.enabled = false;
    await expect(createSignedUrl(PATH)).rejects.toMatchObject({
      status: 503,
      code: 'storage_unavailable',
    });
  });
});

describe('sanitizeFilename', () => {
  it('strips special chars and keeps the extension', () => {
    expect(sanitizeFilename('My Résumé (final)!.PDF')).toBe('My-Resume-final.pdf');
  });
  it('handles names with no extension', () => {
    expect(sanitizeFilename('weird @name')).toBe('weird-name');
  });
  it('falls back to "file" when nothing usable remains', () => {
    expect(sanitizeFilename('***.png')).toBe('file.png');
  });
});
