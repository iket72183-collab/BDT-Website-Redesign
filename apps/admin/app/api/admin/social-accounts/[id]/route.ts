import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4000';

/**
 * Proxy for the admin status update. Mirrors app/api/admin/requests/[id];
 * forwards to the backend `PATCH /api/admin/social-accounts/:id/status`.
 */
export async function PATCH(
  request: Request,
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

  const body = await request.text();
  const upstream = await fetch(
    `${API_URL}/api/admin/social-accounts/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body,
      cache: 'no-store',
    },
  );

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': 'application/json' },
  });
}
