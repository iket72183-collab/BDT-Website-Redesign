import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Admin BFF Route Handler tests (P3).
 *
 * These Route Handlers exist so the browser never holds the access token:
 * every admin mutation goes through Next.js server-side, which reads the
 * httpOnly `bdt_admin_token` cookie and forwards it as a Bearer header to the
 * main API. We assert:
 *   - the cookie is forwarded as `Authorization: Bearer <token>`
 *   - a missing cookie short-circuits to 401 without calling the API
 *   - the upstream status + body are passed back through
 *   - logout clears the local cookies (and best-effort revokes server-side)
 *
 * Strategy: mock `next/headers` cookies() + global fetch; import the handlers
 * directly. No Next server, no network.
 */

const { cookieStore } = vi.hoisted(() => ({
  cookieStore: new Map<string, string>(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name) } : undefined,
  }),
}));

import type { NextResponse } from 'next/server';
import { PATCH as patchClient } from '../clients/[id]/route';
import { PATCH as patchMessage } from '../messages/[id]/route';
import { POST as logout } from '../auth/logout/route';

const fetchMock = vi.fn();

beforeEach(() => {
  cookieStore.clear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ success: true, data: { id: 'c1' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PATCH /api/clients/[id] (BFF)', () => {
  it('forwards the httpOnly cookie as a Bearer token to the main API', async () => {
    cookieStore.set('bdt_admin_token', 'tok_admin_123');
    const req = new Request('http://localhost/api/clients/c1', {
      method: 'PATCH',
      body: JSON.stringify({ subscriptionStatus: 'trialing' }),
    });

    const res = await patchClient(req, { params: Promise.resolve({ id: 'c1' }) });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/api/admin/clients/c1');
    expect((init as RequestInit).method).toBe('PATCH');
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer tok_admin_123');
    // The client-supplied body is passed straight through to the API.
    expect((init as RequestInit).body).toBe(JSON.stringify({ subscriptionStatus: 'trialing' }));
  });

  it('returns 401 without calling the API when no cookie is present', async () => {
    const req = new Request('http://localhost/api/clients/c1', {
      method: 'PATCH',
      body: '{}',
    });

    const res = await patchClient(req, { params: Promise.resolve({ id: 'c1' }) });

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes the upstream status through to the caller', async () => {
    cookieStore.set('bdt_admin_token', 'tok_admin_123');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'not_found' }), { status: 404 }),
    );
    const req = new Request('http://localhost/api/clients/missing', {
      method: 'PATCH',
      body: '{}',
    });

    const res = await patchClient(req, { params: Promise.resolve({ id: 'missing' }) });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/messages/[id] (BFF)', () => {
  it('forwards the Bearer token to the API mark-read endpoint', async () => {
    cookieStore.set('bdt_admin_token', 'tok_admin_456');
    const req = new Request('http://localhost/api/messages/m1', { method: 'PATCH' });

    const res = await patchMessage(req, { params: Promise.resolve({ id: 'm1' }) });

    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/api/admin/messages/m1/read');
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer tok_admin_456');
  });

  it('returns 401 without a cookie and never calls the API', async () => {
    const req = new Request('http://localhost/api/messages/m1', { method: 'PATCH' });

    const res = await patchMessage(req, { params: Promise.resolve({ id: 'm1' }) });

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/logout (BFF)', () => {
  it('clears the local admin cookies and best-effort revokes server-side', async () => {
    cookieStore.set('bdt_admin_token', 'tok_admin_789');
    cookieStore.set('bdt_refresh', 'refresh_abc');

    const res = (await logout()) as NextResponse;

    expect(res.status).toBe(200);
    // Local auth cookie is expired (maxAge 0).
    const cleared = res.cookies.get('bdt_admin_token');
    expect(cleared?.value).toBe('');
    // Backend revoke was attempted with both the bearer and the refresh cookie.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/api/auth/logout');
    const headers = init!.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer tok_admin_789');
    expect(headers.cookie).toBe('bdt_refresh=refresh_abc');
  });

  it('still clears cookies even when the backend revoke throws', async () => {
    cookieStore.set('bdt_admin_token', 'tok_admin_789');
    fetchMock.mockRejectedValue(new Error('API down'));

    const res = (await logout()) as NextResponse;

    expect(res.status).toBe(200);
    expect(res.cookies.get('bdt_admin_token')?.value).toBe('');
  });
});
