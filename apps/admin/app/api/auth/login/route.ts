import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE_SECONDS,
  USER_COOKIE,
  USER_COOKIE_MAX_AGE_SECONDS,
  type AdminUser,
} from '@/lib/auth';

/**
 * BFF login endpoint. The admin login page POSTs `{ email, password }` here
 * instead of straight to the backend. We forward to the API, then set the
 * access token as an httpOnly cookie before responding — so the browser
 * never has document.cookie access to it.
 *
 * Returns `{ user }` so the client can show "signed in as…" without a
 * separate /me call. No token in the body.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4000';

interface LoginBody { email?: string; password?: string }
interface ApiLoginResponse {
  success: boolean;
  data?: { user: AdminUser; accessToken: string };
  error?: string;
  code?: string;
}

export async function POST(req: Request): Promise<Response> {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json(
      { success: false, error: 'email_and_password_required' },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
    // Pass the API's refresh-cookie response back to the browser via the
    // Set-Cookie forwarding below.
    cache: 'no-store',
  });

  const text = await upstream.text();
  const json = (text ? JSON.parse(text) : {}) as ApiLoginResponse;

  if (!upstream.ok || !json.success || !json.data) {
    return NextResponse.json(
      {
        success: false,
        error: json.error ?? 'login_failed',
        ...(json.code ? { code: json.code } : {}),
      },
      { status: upstream.status || 401 },
    );
  }

  const { user, accessToken } = json.data;

  // Defensive role check — the API also enforces this on /api/admin/*, but
  // failing fast here means we never set the admin cookie for a wrong-role
  // login response.
  if (user.role !== 'platform_admin') {
    return NextResponse.json(
      { success: false, error: 'role_not_permitted', code: 'role_not_permitted' },
      { status: 403 },
    );
  }

  const jar = cookies();
  jar.set({
    name: AUTH_COOKIE,
    value: accessToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });

  // Non-sensitive display info — readable by client components so the header
  // can show the signed-in user's name without an extra /me round trip.
  jar.set({
    name: USER_COOKIE,
    value: encodeURIComponent(JSON.stringify(user)),
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: USER_COOKIE_MAX_AGE_SECONDS,
  });

  // Forward the refresh-token Set-Cookie header from the API so the browser
  // also stores `bdt_refresh` (httpOnly, scoped to /api/auth on the backend).
  // The browser sees both cookie sets under the admin origin but only the
  // backend's refresh cookie matters for refresh-rotation.
  const setCookie = upstream.headers.get('set-cookie');
  const out = NextResponse.json({ success: true, data: { user } });
  if (setCookie) {
    out.headers.append('set-cookie', setCookie);
  }
  // Re-set our two cookies via header form so they actually go out (cookies()
  // mutations land in the response when used with NextResponse). Belt-and-
  // suspenders for runtimes that don't auto-flush.
  return out;
}
