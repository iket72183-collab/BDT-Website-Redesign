import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4000';

/**
 * Proxy for the admin status update. The client table can't read the httpOnly
 * access-token cookie, so it PATCHes here and we forward to the backend with a
 * Bearer token. Mirrors app/api/clients/[id]/route.ts; the backend endpoint is
 * `PATCH /api/admin/requests/:id/status`.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const token = cookies().get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'unauthorized', code: 'missing_token' },
      { status: 401 },
    );
  }

  const body = await request.text();
  const upstream = await fetch(
    `${API_URL}/api/admin/requests/${encodeURIComponent(params.id)}/status`,
    {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body,
      cache: 'no-store',
    },
  );

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': 'application/json' },
  });
}
