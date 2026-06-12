import { cookies } from 'next/headers';
import { AUTH_COOKIE } from './auth';

/**
 * Thin typed wrapper around `fetch` for talking to the BDT Connect API.
 *
 *   - In Server Components / Route Handlers we read the httpOnly access-token
 *     cookie via `next/headers` and forward it as a Bearer token.
 *   - Client Components must NOT call this directly with the bearer flow —
 *     the access token is httpOnly and not readable from JS. Use a Server
 *     Action or a Route Handler instead.
 *
 * The `token` override is still here for the one place that doesn't have a
 * stored token yet (login itself, which now lives in the /api/auth/login
 * Route Handler).
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Common envelope: `{ success, data, error?, code?, meta? }`. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
  code?: string;
  meta?: { page: number; limit: number; total: number };
}

interface FetchOpts extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Override the token lookup. Pass `null` to send no Authorization header. */
  token?: string | null;
}

async function readServerToken(): Promise<string | null> {
  try {
    return (await cookies()).get(AUTH_COOKIE)?.value ?? null;
  } catch {
    // `cookies()` throws if called outside a request scope (e.g. during a
    // build-time static analysis pass). Fall through — the caller gets an
    // unauthenticated request which the API will reject with 401.
    return null;
  }
}

export async function api<T>(path: string, opts: FetchOpts = {}): Promise<ApiEnvelope<T>> {
  const { body, token, headers, ...rest } = opts;

  // Token resolution:
  //   - explicit `token` (including null) wins
  //   - server context → read the httpOnly admin cookie
  //   - client context → null (the token isn't JS-readable; client-side
  //     mutations should go through a Route Handler instead)
  const t =
    token !== undefined
        ? token
        : typeof window === 'undefined'
        ? await readServerToken()
        : null;

  const h = new Headers(headers);
  h.set('content-type', 'application/json');
  if (t) h.set('authorization', `Bearer ${t}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const text = await res.text();
  const json = text ? (JSON.parse(text) as ApiEnvelope<T>) : ({} as ApiEnvelope<T>);

  if (!res.ok || json.success === false) {
    throw new ApiError(res.status, json.error ?? res.statusText, json.code);
  }
  return json;
}
