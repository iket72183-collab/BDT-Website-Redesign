import type { Prisma, UserRole } from '@prisma/client';
import { rawPrisma } from '../lib/db.js';
import { USER_PUBLIC } from '../lib/userSelect.js';
import { getTenantId } from '../lib/tenantContext.js';
import { HttpError } from '../middleware/error.js';
import { logEvent } from './platformEventService.js';

/**
 * Note: User is NOT auto-scoped by the Prisma extension (tenantId can be null
 * for platform admins). All queries here add `tenantId` explicitly.
 */

function requireTenantId(tenantId: string | undefined): string {
  if (!tenantId) {
    throw new Error(
      'tenantId is required for User queries. ' +
      'The User model is not auto-scoped by the ' +
      'Prisma extension — always scope manually.'
    );
  }
  return tenantId;
}

interface ListInput {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

export async function listUsers(input: ListInput) {
  const tenantId = requireTenantId(getTenantId());
  const where: Prisma.UserWhereInput = {
    tenantId,
    ...(input.role ? { role: input.role } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.search
      ? {
          OR: [
            { firstName: { contains: input.search, mode: 'insensitive' } },
            { lastName:  { contains: input.search, mode: 'insensitive' } },
            { email:     { contains: input.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await rawPrisma.$transaction([
    rawPrisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      select: USER_PUBLIC,
    }),
    rawPrisma.user.count({ where }),
  ]);
  return { rows, total };
}

export async function getUser(id: string) {
  const tenantId = requireTenantId(getTenantId());
  const u = await rawPrisma.user.findFirst({ where: { id, tenantId }, select: USER_PUBLIC });
  if (!u) throw new HttpError(404, 'not_found', 'not_found');
  return u;
}

export async function updateUser(id: string, data: Prisma.UserUpdateInput) {
  const tenantId = requireTenantId(getTenantId());
  const existing = await rawPrisma.user.findFirst({ where: { id, tenantId } });
  if (!existing) throw new HttpError(404, 'not_found', 'not_found');
  const u = await rawPrisma.user.update({ where: { id }, data, select: USER_PUBLIC });
  await logEvent('user.updated', { userId: id });
  return u;
}

/** Soft delete = isActive false. Hard delete is forbidden — financial FKs use Restrict. */
export async function softDeleteUser(id: string) {
  return updateUser(id, { isActive: false });
}


