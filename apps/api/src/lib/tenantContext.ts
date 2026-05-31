import { AsyncLocalStorage } from 'node:async_hooks';
import type { UserRole } from '@prisma/client';

/**
 * Per-request tenant context propagated via Node's AsyncLocalStorage.
 *
 * Set this at the top of every request handler that operates inside a
 * tenant. The Prisma client extension in `db.ts` reads from here on every
 * query and auto-injects `tenantId` filters so handlers cannot accidentally
 * leak across tenants.
 *
 * Platform admins use `runAsPlatform()` to bypass scoping — they're trusted
 * to operate cross-tenant.
 */
export interface TenantContext {
  tenantId: string;
  userId: string;
  role: UserRole;
}

export interface PlatformContext {
  /** Sentinel — the extension treats this as "skip tenant scoping". */
  tenantId: null;
  userId: string;
  role: 'platform_admin';
}

type Ctx = TenantContext | PlatformContext;

const storage = new AsyncLocalStorage<Ctx>();

/**
 * Run `fn` inside a tenant scope. Every Prisma query that happens during
 * the callback (including async work) will be auto-filtered by tenantId.
 */
export function runAsTenant<T>(ctx: TenantContext, fn: () => T | Promise<T>): T | Promise<T> {
  return storage.run(ctx, fn);
}

/** Run `fn` as a platform admin — Prisma extension skips tenant scoping. */
export function runAsPlatform<T>(
  ctx: Omit<PlatformContext, 'tenantId' | 'role'>,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return storage.run({ ...ctx, tenantId: null, role: 'platform_admin' }, fn);
}

/** Read the current context. Returns null if called outside a scope. */
export function getContext(): Ctx | null {
  return storage.getStore() ?? null;
}

/** Read the active tenantId or throw — use when a tenant is required. */
export function getTenantId(): string {
  const ctx = storage.getStore();
  if (!ctx || ctx.tenantId == null) {
    throw new TenantContextError(
      'No tenant context. Wrap the handler in runAsTenant(...).',
    );
  }
  return ctx.tenantId;
}

/** True when running under runAsPlatform(). */
export function isPlatform(): boolean {
  return storage.getStore()?.tenantId == null;
}

/**
 * Assert the active user belongs to `tenantId`. Throws if not. Use as a
 * defensive check at the start of routes that take a tenantId from the URL
 * or body — protects against a valid JWT being replayed against a different
 * tenant's data.
 */
export function assertTenantAccess(tenantId: string): void {
  const ctx = storage.getStore();
  if (!ctx) throw new TenantContextError('No request context.');
  if (ctx.tenantId == null) return; // platform admins pass
  if (ctx.tenantId !== tenantId) {
    throw new TenantContextError(
      `Cross-tenant access denied: user belongs to ${ctx.tenantId}, requested ${tenantId}.`,
    );
  }
}

export class TenantContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantContextError';
  }
}
