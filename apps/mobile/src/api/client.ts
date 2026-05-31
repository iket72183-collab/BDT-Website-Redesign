import Constants from 'expo-constants';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';

const baseUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

interface ApiInit extends Omit<RequestInit, 'body'> {
  /** JSON-serializable body. Pre-stringified strings are passed through unchanged. */
  body?: unknown;
  /** Set false to skip the Authorization header — used by login / register. */
  auth?: boolean;
}

// =============================================================================
// Single-flight refresh-and-retry
//
// When an access token expires the API returns 401 { code: 'TOKEN_EXPIRED' }.
// Instead of bouncing the user to the login screen we silently:
//
//   1. Mark the first failing request as "refresh in flight"
//   2. Hit POST /api/auth/refresh — refresh cookie is httpOnly so the OS
//      ships it automatically, no client-side state needed
//   3. Replay the original request with the new access token
//   4. Any other request that 401s while step 2 is in flight gets queued
//      and replayed once we have the new token (so we never hammer
//      /refresh with 5 parallel calls during a screen mount)
//
// On refresh failure (refresh token revoked / expired / reuse-detected) we
// log the user out and surface the original 401. Anything other than
// `TOKEN_EXPIRED` is treated as a real auth failure and reported up
// unmodified — don't retry "wrong password" loops.
// =============================================================================

let isRefreshing = false;
type RefreshSubscriber = (token: string | null) => void;
let refreshQueue: RefreshSubscriber[] = [];

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // The refresh cookie is httpOnly + sameSite=lax + scoped to /api/auth
    // on the API side. `credentials: 'include'` makes fetch send it.
    credentials: 'include',
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as
    | { data?: { accessToken?: string } }
    | null;
  return body?.data?.accessToken ?? null;
}

async function executeRequest(
  path: string,
  init: ApiInit,
  token: string | null,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');

  const tenantSlug = useTenantStore.getState().slug;
  if (tenantSlug) headers.set('x-tenant-slug', tenantSlug);

  if ((init.auth ?? true) && token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  const body =
    init.body === undefined || typeof init.body === 'string'
      ? (init.body as string | undefined)
      : JSON.stringify(init.body);

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    body,
    // Same reason as in refreshAccessToken — keep the refresh cookie flowing.
    credentials: 'include',
  });
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const initialToken = useAuthStore.getState().accessToken;
  let res = await executeRequest(path, init, initialToken);

  if (res.status === 401 && (init.auth ?? true)) {
    const body = (await res.clone().json().catch(() => null)) as { code?: string } | null;
    const code = body?.code;

    // Only retry on explicit token expiry. Other 401s (invalid_credentials,
    // missing_token, invalid_token_type) are real auth failures — let them
    // surface so the caller can decide what to do (e.g. show "wrong password"
    // on the login screen instead of silently bouncing to refresh).
    if (code === 'TOKEN_EXPIRED' || code === 'token_expired') {
      const newToken = await runRefresh();
      if (newToken) {
        res = await executeRequest(path, init, newToken);
      } else {
        // Refresh failed for real (revoked, reuse detected). Burn the local
        // session — middleware on the next request will redirect to login.
        await useAuthStore.getState().clear();
      }
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      details?: unknown;
    };
    throw new ApiError(res.status, body.error ?? res.statusText, body.code, body.details);
  }
  // 204 No Content (e.g. DELETE) has an empty body — don't try to parse it.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Single-flight wrapper around `refreshAccessToken`. Concurrent expirations
 * (typical when a screen mounts and fires several queries at once) all wait
 * on the same in-flight refresh and replay against the same fresh token.
 */
async function runRefresh(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise<string | null>((resolve) => {
      refreshQueue.push(resolve);
    });
  }

  isRefreshing = true;
  let newToken: string | null = null;
  try {
    newToken = await refreshAccessToken();
    if (newToken) {
      await useAuthStore.getState().setAccessToken(newToken);
    }
  } catch {
    newToken = null;
  } finally {
    const drain = refreshQueue;
    refreshQueue = [];
    isRefreshing = false;
    drain.forEach((cb) => cb(newToken));
  }
  return newToken;
}

// =============================================================================
// Multipart upload (request attachments)
//
// FormData uploads can't go through `api()` (which JSON-stringifies + sets a
// JSON content-type). This mirrors the same auth/tenant headers but lets fetch
// set the multipart boundary itself. React Native's FormData takes a
// `{ uri, name, type }` object for files — NOT a Blob.
// =============================================================================

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

export async function uploadRequestAttachment(
  file: PickedFile,
): Promise<{ name: string; size: number; path: string }> {
  const token = useAuthStore.getState().accessToken;
  const tenantSlug = useTenantStore.getState().slug;

  const form = new FormData();
  // RN file shape — do NOT use new Blob(); the cast is required by RN's types.
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);

  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (tenantSlug) headers['x-tenant-slug'] = tenantSlug;

  const res = await fetch(`${baseUrl}/api/uploads/request-attachment`, {
    method: 'POST',
    headers, // intentionally no content-type — fetch adds the multipart boundary
    body: form,
    credentials: 'include',
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(res.status, body.error ?? res.statusText, body.code);
  }
  const json = (await res.json()) as { data: { name: string; size: number; path: string } };
  return json.data;
}
