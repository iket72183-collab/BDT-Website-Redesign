# BDT Connect — Pivot to Agency Client Portal

**Date:** 2026-05-23
**Status:** Backend + mobile both pivoted (P0–P7). Backend tests green
(`pnpm --filter @bdt/api test` — 41/41). Mobile typecheck not verifiable
in this sandbox (no `node_modules` for the mobile workspace); will need
`pnpm install` + `pnpm --filter @bdt/mobile typecheck` for confirmation.

---

## What changed and why

BDT Connect started life as a multi-tenant SaaS for service businesses
(gyms, salons, trainers) with booking, calendar, staff scheduling, and a
Stripe Connect marketplace. The product pivoted: it is now an **agency
client portal** for **BDT Talent Group**'s clients. Business owners install
the Expo app, sign up, pick a subscription, and use the app to track what
the agency is doing for them and to message the team.

Everything booking/calendar/staff/marketplace-shaped is dead code under the
new product. This pivot rips it out and reshapes the surface around two
things only: **subscriptions** and **messaging**.

---

## New app purpose

A client downloads BDT Connect, registers their business, picks **Basic**
or **Premium**, and starts a **14-day free trial**. After that they:

- See what BDT is delivering (website, social presence) on a dashboard
- Message the agency at any time (the message routes to
  `BDTTalentGroup@yahoo.com` via Resend)
- Upgrade / downgrade / cancel their plan from the Stripe billing portal

---

## Plans — single source of truth

Defined in [apps/api/src/lib/plans.ts](apps/api/src/lib/plans.ts).

| | **Basic** | **Premium** |
|---|---|---|
| Price | **$100/mo** | **$175/mo** |
| Trial | 14 days | 14 days |
| Website redesign | ✓ | ✓ |
| Website maintenance | ✓ | ✓ |
| Direct messaging | ✓ | ✓ |
| Social media management | — | ✓ |
| Monthly performance report | — | ✓ |
| Priority message response | — | ✓ |

The mobile app should consume PLANS rather than hardcoding feature lists.

---

## Stripe setup for the new products

The pivot only changes the Stripe **price IDs** and adds a 14-day trial; the
rest of the subscription plumbing (customer creation, billing portal,
webhook idempotency) is unchanged.

### One-time setup

1. **Dashboard → Products → New product** for each of:
   - **BDT Connect Basic** — recurring `$100.00/month`
   - **BDT Connect Premium** — recurring `$175.00/month`
2. Copy each product's **default price ID** (`price_…`) into the env:
   ```
   STRIPE_BASIC_PRICE_ID=price_...
   STRIPE_PREMIUM_PRICE_ID=price_...
   ```
3. **Dashboard → Webhooks → Add endpoint** for
   `https://YOUR_API/api/webhooks/stripe`. Subscribe to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end`
   - `invoice.paid`
   - `invoice.payment_failed`

   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

### Trial behavior

`stripe.subscriptions.create` is called with `trial_period_days: 14`. The
client can start the trial **with or without a card**:

- A card is required up front. Stripe stores the PM and bills it on day 15
  (the day after the 14-day trial ends).
- Without a card — Stripe marks the sub `incomplete` when the trial ends
  and the client gets a `customer.subscription.trial_will_end` event 3
  days before, surfacing a "trial ending soon" push.

Cancellation is always at period end. We do not expose immediate cancel.

### What was removed

- `STRIPE_SOLO_PRICE_ID`, `STRIPE_GROWTH_PRICE_ID`, `STRIPE_STUDIO_PRICE_ID`
- `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_PLATFORM_FEE_*`,
  `STRIPE_CONNECT_CLIENT_ID`
- The entire `/api/webhooks/stripe-connect` endpoint
- The entire `/api/stripe/connect/*` route family
- `stripe_connect_accounts` and `platform_fees` tables

BDT is not a marketplace. Subscription billing flows directly into the BDT
platform Stripe account.

---

## How messaging works end-to-end

1. Client composes in the app → `POST /api/messages { subject?, body }`
2. `messageService.sendMessage`:
   - Validates body length (1–2000 chars)
   - Inserts a `messages` row scoped to the tenant
   - Emails `BDTTalentGroup@yahoo.com` via Resend with:
     - Subject: `New message from {businessName} — {subject ?? 'No subject'}`
     - Body: business name, plan, sender name + email, message body,
       footer instructing the agency to reply to the email to respond.
   - Pushes a notification to all platform admins (so a signed-in BDT team
     member sees it on their phone)
   - Writes a `platform_events` row (`message.sent`)
3. The agency responds out-of-band by replying to the email. There is no
   admin-side inbound message UI in this version — replies happen on the
   email side, intentionally.

Listing endpoints:
- `GET /api/messages` — the client's own history
- `PATCH /api/messages/:id/read` — mark a message read (used by the BDT
  admin surface once that exists)

---

## Database changes (migration `20260523120000_pivot_to_agency_portal`)

**Dropped tables:**
`bookings`, `booking_status_history`, `availability_templates`,
`availability_overrides`, `services`, `service_staff`, `staff_profiles`,
`packages`, `stripe_connect_accounts`, `platform_fees`, `client_profiles`,
`invoices`, `invoice_line_items`, `payments`, `refunds`.

**Dropped enums:**
`BookingStatus`, `BookedBy`, `InvoiceStatus`, `PaymentMethod`,
`PaymentStatus`, `RefundStatus`.

**Reshaped enums:**
- `SubscriptionTier`: `solo|growth|studio` → `basic|premium`
  (solo → basic, growth|studio → premium)
- `UserRole`: `owner|staff|client|platform_admin` →
  `client|platform_admin` (owner|staff → client)
- `NotificationType`: kept `payment_received`, replaced rest with
  `message_reply` + `account_update`
- `SubscriptionEventType`: added `trial_started`, `trial_ending`

**Reshaped tenants:**
Dropped `timezone`, `slot_interval_minutes`, `auto_invoice`,
`booking_lead_time_hours`, `booking_window_days`,
`cancellation_policy_hours`. `business_type` became optional.

Added `website_url`, `instagram_url`, `facebook_url`, `tiktok_url`,
`google_business_url`, `onboarding_completed`, `onboarding_completed_at`,
`notes` (internal-only).

**New table:** `messages` (`id`, `tenant_id`, `user_id`, `subject?`, `body`,
`status` enum unread|read|archived, `sent_at`, `created_at`).

**Reshaped notification_preferences:** dropped `booking_reminders`,
`reminder_hours_before`.

---

## Mobile pivot (landed)

The mobile app was restructured to match. What changed:

**Removed:**
- `app/(owner)/` and `app/(staff)/` route groups (entire trees).
- All booking-shaped screens: `BookingCalendarScreen`, `CalendarScreen`,
  `ClientsListScreen`, `HomeDashboardScreen`, `PaymentsScreen`,
  `PayoutsScreen`, `StaffScheduleScreen`, `StripeConnectScreen`,
  `ClientHomeScreen`, `ClientProfileScreen`, `_fixtures.ts`.
- `src/components/bookings/` (whole folder), `src/components/stripe/`
  (whole folder), `src/hooks/useDashboardStats`, `useAvailability`,
  `useBookingList`, `useBooking`, `src/navigation/AppNavigator.tsx`.

**Added:**
- `src/screens/dashboard/ClientDashboardScreen.tsx`
- `src/screens/messaging/MessageScreen.tsx`
- `src/screens/messaging/MessageHistoryScreen.tsx`
- `src/screens/onboarding/PlanSelectionScreen.tsx`
- `src/screens/onboarding/PaymentSetupScreen.tsx`

**Reshaped:**
- `app/(client)/_layout.tsx` — 4-tab bar (Home / Messages / Plan /
  Settings), plus an `onboardingCompleted` gate that redirects unfinished
  signups into `(onboarding)`.
- `app/(client)/messages/` + `app/(client)/settings/` — stacks with
  `index` + nested screens (history, notifications).
- `app/(onboarding)/` — Stack with `plan-selection` then `payment-setup`.
- `app/_layout.tsx` — drops the `(owner)`/`(staff)` stack screens; deep
  links now route by `type=message_reply | account_update | payment_received`.
- `app/(auth)/login.tsx`, `verify-email.tsx` — route by `role==='client'`
  → `/(client)/home` (which itself decides if onboarding is needed).
- `src/screens/SubscriptionScreen.tsx` — rewritten around Basic/Premium
  with trial banner; no Connect section.
- `src/screens/SettingsScreen.tsx` — slimmer; sign-out, notifications,
  message history.
- `src/screens/settings/NotificationsScreen.tsx` — dropped the booking
  toggle rows; the only knobs left are master push, email, marketing.
- `src/stores/stripe.ts` — rewritten to expose `fetchSubscription`,
  `upgradeTo`, `cancelSubscription`, `openBillingPortal`,
  `createSubscription`, `createSetupIntent`. No Connect / payouts.
- `src/stores/auth.ts` — `RegisterInput.tenant.businessType` is optional.

**Caveat:** I could not run `pnpm --filter @bdt/mobile typecheck` in this
sandbox (no `node_modules` for the mobile workspace). The code is written
against the same types the backend exposes; run typecheck after a fresh
`pnpm install` to catch anything I missed.

---

## Test status

`apps/api`: 41 / 41 tests passing as of this commit
(`pnpm --filter @bdt/api test`).

Removed tests: `availabilityService`, `bookingService`, the old
Connect-heavy `stripeService` test, the old `webhooks` route test, the
`bookingReminders` + `paymentCleanup` queue/worker tests.

Added tests: `messageService.test.ts` (11 cases — persistence, email
dispatch to `BDTTalentGroup@yahoo.com`, plan inclusion in email body,
push to platform admins, validation, fail-soft on email, list + markRead).

---

## Resume notes for next session

1. **Run `pnpm install` at the workspace root** if you're picking this up
   on a fresh machine — the mobile workspace was missing `node_modules`
   in the sandbox where this was written, so I couldn't run mobile
   typecheck or `expo start`. Backend `node_modules` was present and
   tsc/vitest are both green.
2. **Run the migration** (`pnpm --filter @bdt/api db:migrate:dev`) to
   apply `20260523120000_pivot_to_agency_portal`. The migration is
   destructive — drops booking-shaped tables. Take a snapshot first if
   you have prod data you care about (you shouldn't — the agency-portal
   product has no users yet).
3. **Re-seed** (`pnpm --filter @bdt/api db:seed`) to get two demo
   tenants: `marcus@vale-strength.com` (Basic) and
   `priya@cardamomspa.com` (Premium), password `demo-password`.
4. **Set the two new Stripe price IDs** in your env: `STRIPE_BASIC_PRICE_ID`
   and `STRIPE_PREMIUM_PRICE_ID`. See the "Stripe setup" section above.
5. **Then `pnpm --filter @bdt/mobile dev`** to bring up the Expo dev
   client and walk the signup → plan selection → payment setup →
   dashboard → message flow.
6. **Brand stays the same** — `apps/mobile/src/styles/appTokens.ts` is
   the RN token source; new screens use the same Playfair Display
   headlines, warm white text, rose-gold metallic accents.

If something on the mobile side doesn't compile after `pnpm install`,
the most likely places to check are:
- `app/(auth)/signup.tsx` — businessType chip selector defaults to
  `'studio'`; safe but you may want to drop it now that the field is
  decorative.
- `src/components/AppHeader.tsx` — still expects optional `brand`/`title`
  props; the new screens don't pass it (they render their own headers).
  Leave AppHeader where it is — it's not currently rendered.
