import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4000';

/**
 * SENSITIVE proxy — reveals a client's stored social login. Forwards to the
 * backend `GET /api/admin/social-accounts/:id/credentials`, which decrypts and
 * writes a `credentials_revealed` audit event. The admin's access token (httpOnly
 * cookie) is attached server-side; the browser never sees it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'unauthorized', code: 'missing_token' },
      { status: 401 },
    );
  }

  const upstream = await fetch(
    `${API_URL}/api/admin/social-accounts/${encodeURIComponent(id)}/credentials`,
    {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': 'application/json' },
  });
}
