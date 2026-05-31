import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE, USER_COOKIE } from '@/lib/auth';

/**
 * BFF logout endpoint. Clears the local admin cookies and best-effort calls
 * the backend POST /api/auth/logout so the refresh-token row is revoked.
 *
 * Never fails — even if the backend is unreachable we still clear the local
 * cookies so the user is locally signed out.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4000';

export async function POST(): Promise<Response> {
  const jar = cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  const refreshToken = jar.get('bdt_refresh')?.value;

  // Best-effort revoke. If the backend is down or returns 4xx we still
  // wipe the local cookie; nothing useful comes from blocking the user.
  if (token) {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        ...(refreshToken ? { cookie: `bdt_refresh=${refreshToken}` } : {}),
      },
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(USER_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set('bdt_refresh', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/api/auth',
  });
  return response;
}
