import type { Prisma } from '@prisma/client';

/**
 * The single source of truth for what a "user" looks like across every
 * route response. Import this everywhere a User row is returned instead
 * of hand-rolling a select / pick — that's how `passwordHash` accidents
 * happen.
 *
 * Rule: never add a sensitive field here. `passwordHash` is intentionally
 * absent and must stay that way. Auth tokens never leave authService.
 */
export const USER_PUBLIC = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
  role: true,
  tenantId: true,
  isActive: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type UserPublic = Prisma.UserGetPayload<{ select: typeof USER_PUBLIC }>;

/**
 * Tenant projection for any client-facing response. Internal fields like
 * `notes` (BDT staff notes about the client), `stripeCustomerId`, and
 * `ownerId` are intentionally absent. Admin routes that need those use
 * the unscoped `rawPrisma` directly.
 */
export const TENANT_PUBLIC = {
  id: true,
  slug: true,
  businessName: true,
  businessType: true,
  logoUrl: true,
  brandColor: true,
  subscriptionTier: true,
  subscriptionStatus: true,
  onboardingCompleted: true,
  onboardingCompletedAt: true,
  websiteUrl: true,
  instagramUrl: true,
  facebookUrl: true,
  tiktokUrl: true,
  googleBusinessUrl: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.TenantSelect;

export type TenantPublic = Prisma.TenantGetPayload<{ select: typeof TENANT_PUBLIC }>;
