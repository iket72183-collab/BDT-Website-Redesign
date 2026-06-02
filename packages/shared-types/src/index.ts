// Types shared between the API and the mobile app. Keep this package
// dependency-free so it can be consumed by both Node and React Native.

export type UserRole = 'platform_admin' | 'client';

// --- Subscription plan ------------------------------------------------------
// Single-plan model: one "Premium" plan at $150/mo. (Was Basic/Premium tiers.)

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

export interface RequestUsage {
  used: number;
  limit: number;
  resetsAt: string;
}

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
