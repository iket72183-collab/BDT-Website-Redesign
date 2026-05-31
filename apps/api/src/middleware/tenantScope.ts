import type { RequestHandler } from 'express';
import { rawPrisma } from '../lib/db.js';
import { runAsPlatform, runAsTenant } from '../lib/tenantContext.js';
import { HttpError } from './error.js';
import { asyncHandler } from './asyncHandler.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: { id: string; slug: string };
    }
  }
}

/**
 * Composite tenant-scope middleware. Runs AFTER `verifyToken`:
 *
 *   1. Platform admins → `runAsPlatform(...)`. The Prisma extension treats
 *      these as unscoped — they're trusted to query across tenants.
 *   2. Tenant users → resolve the tenant from `X-Tenant-Slug` header (mobile)
 *      or `Host` subdomain (web), validate it matches `req.auth.tenantId`,
 *      then open an `AsyncLocalStorage` scope so every Prisma call in the
 *      handler is auto-filtered by tenantId.
 *
 * Net effect: every protected route is guaranteed to either be platform-wide
 * or strictly tenant-scoped at the data layer — no leakage from a forgotten
 * `where tenantId` clause.
 */
export const tenantScope: RequestHandler = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'unauthorized', 'missing_token');

  // Platform admins skip tenant resolution entirely.
  if (auth.role === 'platform_admin') {
    runAsPlatform({ userId: auth.sub }, () => next());
    return;
  }

  // Resolve tenant from the slug header (mobile) or subdomain (future web).
  const slug = req.header('x-tenant-slug') ?? subdomainFromHost(req.header('host'));
  if (!slug && !auth.tenantId) {
    throw new HttpError(400, 'tenant_required', 'tenant_required');
  }

  let tenant: { id: string; slug: string } | null = null;
  if (slug) {
    tenant = await rawPrisma.tenant.findFirst({
      where: { slug, isActive: true },
      select: { id: true, slug: true },
    });
    if (!tenant) throw new HttpError(404, 'tenant_not_found', 'tenant_not_found');
  } else if (auth.tenantId) {
    tenant = await rawPrisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { id: true, slug: true },
    });
    if (!tenant) throw new HttpError(404, 'tenant_not_found', 'tenant_not_found');
  }

  // Defense in depth: reject if the resolved tenant disagrees with the JWT.
  if (tenant && auth.tenantId && tenant.id !== auth.tenantId) {
    throw new HttpError(403, 'tenant_mismatch', 'tenant_mismatch');
  }

  req.tenant = tenant!;
  runAsTenant(
    { tenantId: tenant!.id, userId: auth.sub, role: auth.role },
    () => next(),
  );
});

function subdomainFromHost(host: string | undefined): string | null {
  if (!host) return null;
  const [hostname] = host.split(':');
  const parts = hostname?.split('.') ?? [];
  if (parts.length < 3) return null;
  return parts[0] ?? null;
}

/**
 * Assert the resolved tenant matches a tenantId from the request (URL param
 * or body field). Use as a defensive second layer on routes that take the
 * tenantId from user input rather than from the JWT.
 */
export function assertTenantAccess(req: Express.Request, tenantId: string): void {
  if (!req.tenant) throw new HttpError(400, 'tenant_required');
  if (req.tenant.id !== tenantId) {
    throw new HttpError(403, 'tenant_mismatch', 'tenant_mismatch');
  }
}
