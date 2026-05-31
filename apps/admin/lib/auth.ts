/**
 * Admin auth helpers. The admin app reuses the existing API auth surface,
 * but the access token is **never** exposed to client-side JavaScript:
 *
 *   - The login Route Handler at /api/auth/login calls the backend
 *     POST /api/auth/login on behalf of the browser and stores the
 *     resulting access token in an `httpOnly` cookie. XSS can no longer
 *     read it (and so can no longer escalate to platform_admin).
 *
 *   - The Edge middleware reads the same cookie server-side. Same name,
 *     same value path — just no `document.cookie` access from anywhere.
 *
 *   - Every server-side fetch to the backend reads the cookie via
 *     `next/headers` and sets `Authorization: Bearer …`. Client
 *     components never need the token directly — every backend call
 *     either goes through a Route Handler or a Server Component.
 *
 * Refresh-token rotation lives on the API side (httpOnly cookie scoped to
 * /api/auth). When the access cookie expires, the user re-logs in.
 */

export const AUTH_COOKIE = 'bdt_admin_token';
export const USER_COOKIE = 'bdt_admin_user';

/** 15 minutes — matches the API's access-token TTL. */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 15;
/** Longer-lived non-sensitive user blob for the sidebar header. */
export const USER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'platform_admin' | 'client';
}

interface JwtPayload {
  sub: string;
  role: string;
  exp: number;
  /** tenantId; null for platform admins. */
  tenantId: string | null;
}

/**
 * Decode a JWT payload without verifying the signature. Safe to use for UI
 * decisions only — the API always re-verifies on every request. Runs in
 * the Edge runtime so we can't import a Node Buffer.
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1]!;
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function isAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const payload = decodeJwt(token);
  if (!payload) return false;
  if (payload.exp * 1000 < Date.now()) return false;
  return payload.role === 'platform_admin';
}
