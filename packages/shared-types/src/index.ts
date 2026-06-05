// Types shared between the API and the mobile app. Keep this package
// dependency-free so it can be consumed by both Node and React Native.

export type UserRole = 'platform_admin' | 'client';

// --- Subscription plan ------------------------------------------------------
// Single-plan model: one "Premium" plan at $100/mo. (Was Basic/Premium tiers.)

export type PlanId = 'premium';

// --- Client service requests (submitted to the BDT agency) -----------------

export type RequestType =
  | 'website_update'
  | 'social_media'
  | 'general'
  | 'file_upload'
  | 'ai_creative'
  | 'report_request';

export type RequestStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

// --- Per-type monthly limits (single Premium plan) -------------------------
// Each "limited" request type has a monthly cap. Requests beyond the cap are
// available as a flat $25 add-on (billed separately by BDT). `general` and
// `file_upload` are uncapped, so they're absent from PLAN_LIMITS.
//
// NOTE: the API ships compiled JS and cannot import this source package at
// runtime, so apps/api/src/lib/plans.ts mirrors these values — keep them in
// sync if either side changes.

export type LimitedRequestType =
  | 'ai_creative'
  | 'social_media'
  | 'website_update'
  | 'report_request';

export const LIMITED_REQUEST_TYPES: readonly LimitedRequestType[] = [
  'ai_creative',
  'social_media',
  'website_update',
  'report_request',
];

export const PLAN_LIMITS = {
  premium: {
    ai_creative: 4,
    social_media: 12,
    website_update: 4,
    report_request: 1,
    addon_price_cents: 2500,
  },
} as const;

/** Dollar price of one over-limit add-on request (derived from cents). */
export const ADDON_PRICE_USD = PLAN_LIMITS.premium.addon_price_cents / 100;

export interface RequestAttachment {
  name: string;
  size: number;
  /** Storage object path (e.g. `requests/{tenantId}/...`). The bucket is
   *  private — resolve to a short-lived signed URL via
   *  `GET /api/uploads/signed-url?path=...` to open the file. */
  path: string;
}

export interface ClientRequest {
  id: string;
  tenantId: string;
  type: RequestType;
  title: string;
  description: string;
  status: RequestStatus;
  attachments: RequestAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface RequestTypeUsage {
  used: number;
  limit: number;
}

/** Current calendar-month usage vs. limit for each limited request type —
 *  the shape returned by `GET /api/requests/usage`. */
export type RequestUsage = Record<LimitedRequestType, RequestTypeUsage>;

// --- Social accounts (BDT-managed social media) ----------------------------

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'google_business'
  | 'x_twitter'
  | 'youtube'
  | 'linkedin'
  | 'other';

export type SocialAccessMethod = 'delegated' | 'credentials' | 'create_for_me';

export type SocialAccountStatus =
  | 'pending'
  | 'access_granted'
  | 'active'
  | 'revoked'
  | 'needs_attention';

export interface SocialAccount {
  id: string;
  tenantId: string;
  platform: SocialPlatform;
  handle: string | null;
  accessMethod: SocialAccessMethod;
  status: SocialAccountStatus;
  /** Derived: a credential has been set (secretUpdatedAt !== null). The
   *  ciphertext itself is never exposed to clients. */
  hasCredentials: boolean;
  secretUpdatedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantBranding {
  primaryColor?: string;
  logoUrl?: string;
  tagline?: string;
}

export interface Tenant {
  id: string;
  slug: string;
  businessName: string;
  category: string | null;
  branding: TenantBranding;
  status: 'active' | 'suspended' | 'cancelled';
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  emailVerifiedAt: string | null;
  role: UserRole;
}

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  active: boolean;
}

export interface StaffMember {
  user: User;
  services: string[]; // service ids the staff member can perform
}

export interface StaffSchedule {
  staffUserId: string;
  weekStart: string; // ISO date
  shifts: { dayOfWeek: number; startTime: string; endTime: string }[];
}

export type AppointmentStatus = 'booked' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: string;
  tenantId: string;
  staffUserId: string;
  clientUserId: string;
  serviceId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  notes: string | null;
}

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
}

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  tenantId: string;
  appointmentId: string | null;
  userId: string | null;
  amountCents: number;
  currency: string;
  platformFeeCents: number;
  status: PaymentStatus;
  createdAt: string;
}
