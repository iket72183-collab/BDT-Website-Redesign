import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { HttpError } from '../middleware/error.js';

/**
 * Request-attachment uploads → Supabase Storage (via its REST API, no SDK).
 *
 * Storage is gated on config.storage.enabled (SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY): when unset the endpoint returns 503
 * `storage_unavailable` and the rest of the API runs fine.
 *
 * MIME + size are validated here as well as at the multer layer (defense in
 * depth + makes the rules unit-testable without an HTTP request).
 */

export const ALLOWED_MIME = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Strip special characters from a filename, preserving a clean extension.
 * `My Résumé (final)!.PDF` → `My-Resume-final.pdf`
 */
export function sanitizeFilename(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext =
    dot > 0
      ? '.' +
        name
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      : '';
  const base =
    (dot > 0 ? name.slice(0, dot) : name)
      .normalize('NFKD')
      .replace(/[^\u0020-\u007E]/g, '') // drop non-ASCII/control chars
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'file';
  return `${base}${ext}`;
}

export interface UploadResult {
  name: string;
  size: number;
  /** Storage object path within the (private) bucket. The bucket has no public
   *  read access, so callers open the file via a server-signed URL — see
   *  `createSignedUrl` / `GET /api/uploads/signed-url`. */
  path: string;
}

/** Lifetime of a generated signed URL, in seconds (1 hour). */
export const SIGNED_URL_TTL = 3600;

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  tenantId: string,
): Promise<UploadResult> {
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new HttpError(415, 'Unsupported file type.', 'UNSUPPORTED_MEDIA_TYPE');
  }
  if (buffer.length > MAX_FILE_SIZE) {
    throw new HttpError(413, 'File too large (max 10MB).', 'FILE_TOO_LARGE');
  }
  if (!config.storage.enabled || !config.storage.url || !config.storage.serviceKey) {
    throw new HttpError(503, 'File uploads are currently unavailable.', 'storage_unavailable');
  }

  const sanitized = sanitizeFilename(originalName);
  // requests/{tenantId}/{timestamp}-{sanitized} — tenant-scoped path.
  const objectPath = `requests/${tenantId}/${Date.now()}-${sanitized}`;
  const base = config.storage.url.replace(/\/$/, '');
  const endpoint = `${base}/storage/v1/object/${config.storage.bucket}/${objectPath}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.storage.serviceKey}`,
      'content-type': mimeType,
      'cache-control': 'max-age=3600',
      'x-upsert': 'false',
    },
    body: buffer,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.error({ status: res.status, detail, objectPath }, 'upload.storage_failed');
    throw new HttpError(502, 'Upload failed. Please try again.', 'UPLOAD_FAILED');
  }

  // The bucket is PRIVATE (no public read, no RLS), so we don't hand back a
  // public URL — we store the object path and resolve it to a short-lived
  // signed URL on read (see createSignedUrl).
  return { name: originalName, size: buffer.length, path: objectPath };
}

/**
 * Mint a short-lived signed URL for a stored object, server-side, using the
 * service-role key. The bucket is private with zero RLS policies, so the anon
 * key cannot do this — only the service role can. Mirrors `uploadFile`: raw
 * Supabase Storage REST, no SDK.
 *
 * The caller is responsible for authorizing `path` (e.g. confirming it lives
 * under the requesting tenant's folder) BEFORE calling this — signing is
 * unconditional here.
 *
 * @param path  object path within the bucket, e.g. `requests/{tenantId}/...`
 * @returns an absolute, openable URL valid for `SIGNED_URL_TTL` seconds.
 */
export async function createSignedUrl(path: string): Promise<string> {
  if (!config.storage.enabled || !config.storage.url || !config.storage.serviceKey) {
    throw new HttpError(503, 'File access is currently unavailable.', 'storage_unavailable');
  }

  const base = config.storage.url.replace(/\/$/, '');
  const endpoint = `${base}/storage/v1/object/sign/${config.storage.bucket}/${path}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.storage.serviceKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.error({ status: res.status, detail, path }, 'upload.sign_failed');
    throw new HttpError(502, 'Could not open file. Please try again.', 'STORAGE_ERROR');
  }

  const body = (await res.json().catch(() => null)) as { signedURL?: string } | null;
  if (!body?.signedURL) {
    logger.error({ path }, 'upload.sign_missing_url');
    throw new HttpError(502, 'Could not open file. Please try again.', 'STORAGE_ERROR');
  }

  // Supabase returns a storage-relative path (`/object/sign/...`); make it
  // absolute so the client can open it directly.
  return body.signedURL.startsWith('http') ? body.signedURL : `${base}/storage/v1${body.signedURL}`;
}
