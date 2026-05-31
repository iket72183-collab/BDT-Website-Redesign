import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, isAdminToken } from './lib/auth';

/**
 * Auth gate for every protected route.
 *
 * The middleware only checks token presence + role decoding. The API
 * enforces the actual permission on each request — middleware is a UX
 * convenience (don't render shells the user can't use), not a security
 * boundary.
 *
 * If the token is missing / expired / not platform_admin, we redirect to
 * /login and preserve the original path as `?next=` so the login form can
 * bounce the user back after success.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/login') || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (isAdminToken(token)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  if (pathname !== '/') url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Match everything except Next.js internals + static assets. We do the
  // login-page bypass inside the function above so the matcher stays simple.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
