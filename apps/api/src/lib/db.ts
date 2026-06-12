import { PrismaClient, Prisma } from '@prisma/client';
import { getContext } from './tenantContext.js';

// =============================================================================
// Singleton (safe across hot-reload in dev + module reuse in serverless)
// =============================================================================

declare global {
  var __bdtPrisma: PrismaClient | undefined;
}

const basePrisma =
  globalThis.__bdtPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__bdtPrisma = basePrisma;
}

// =============================================================================
// Tenant-scoping client extension
//
// Models in TENANT_SCOPED auto-receive `tenantId` filters on reads and
// `tenantId` on writes. The active tenantId is pulled from AsyncLocalStorage
// (see tenantContext.ts). When isPlatform() is true (platform admins) the
// extension is a no-op — those callers are trusted to query across tenants.
//
// This is the *primary* multi-tenancy guard. Optional Postgres RLS can be
// layered as defense-in-depth (see DATABASE_SCHEMA.md §Defense in depth).
// =============================================================================

const TENANT_SCOPED = new Set<Prisma.ModelName>([
  'Message',
  'Notification',
  'NotificationPreference',
  'ServiceRequest',
  'SocialAccount',
  // User is intentionally NOT here — handled separately because tenantId is
  // nullable for platform admins.
]);
// NOTE: the scoping extension injects tenantId into where/data but does NOT do
// column-level exclusion — it cannot strip `secretCiphertext` from results. The
// service layer is responsible for never selecting that column on client-facing
// reads (see socialAccountService PUBLIC_SELECT); only the admin reveal path,
// running unscoped via rawPrisma, selects it.

/** Operations that read rows — extension injects `where.tenantId`. */
const READ_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

/** Operations that mutate rows — extension scopes `where` and stamps `data`. */
const WRITE_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany', 'upsert']);

/** Create-style operations — extension stamps `data.tenantId`. */
const CREATE_OPS = new Set(['create', 'createMany']);

export const db = basePrisma.$extends({
  name: 'tenant-scope',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANT_SCOPED.has(model as Prisma.ModelName)) return query(args);

        const ctx = getContext();
        // No context = scripts, migrations, seed. Skip — those are trusted.
        if (!ctx) return query(args);
        // Platform admins bypass scoping.
        if (ctx.tenantId == null) return query(args);

        const tenantId = ctx.tenantId;

        if (READ_OPS.has(operation)) {
          // Merge tenantId into the where clause (with safe defaults).
          const where = (args as { where?: Record<string, unknown> }).where ?? {};
          args = {
            ...args,
            where: operation.startsWith('findUnique')
              ? { ...where, tenantId }
              : { AND: [{ tenantId }, where] },
          };
        } else if (WRITE_OPS.has(operation)) {
          const where = (args as { where?: Record<string, unknown> }).where ?? {};
          if (operation === 'upsert') {
            const upsertArgs = args as Prisma.Args<unknown, 'upsert'>;
            args = {
              ...upsertArgs,
              where: { ...upsertArgs.where, tenantId } as never,
              create: { ...upsertArgs.create, tenantId },
              update: upsertArgs.update,
            } as typeof args;
          } else {
            args = {
              ...args,
              where:
                operation === 'update' || operation === 'delete'
                  ? { ...where, tenantId }
                  : { AND: [{ tenantId }, where] },
            };
          }
        } else if (CREATE_OPS.has(operation)) {
          if (operation === 'create') {
            args = { ...args, data: { ...(args as { data?: object }).data, tenantId } };
          } else {
            // createMany — data can be an array or single object.
            type Row = Record<string, unknown>;
            const data = (args as { data?: Row | Row[] }).data;
            args = {
              ...args,
              data: Array.isArray(data)
                ? data.map((row) => ({ ...row, tenantId }))
                : { ...data, tenantId },
            };
          }
        }

        return query(args);
      },
    },
  },
});

export type DbClient = typeof db;

/**
 * Escape hatch: returns the raw unscoped client. Use ONLY for:
 *   - Migrations / seed scripts
 *   - Authentication (looking up a user by email before we know the tenant)
 *   - Platform-admin endpoints
 *   - Cross-tenant analytics
 * Every other call site should use `db`.
 */
export const rawPrisma = basePrisma;
