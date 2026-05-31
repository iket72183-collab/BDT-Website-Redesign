# BDT Connect — Database Schema

> Postgres 15+ via Prisma 5. Multi-tenant SaaS, row-level isolation enforced
> at the **application layer** via a Prisma client extension + AsyncLocalStorage.
> Optional Postgres RLS available as defense-in-depth.

Source files:

- Schema: [`prisma/schema.prisma`](prisma/schema.prisma)
- Initial migration: [`prisma/migrations/20260516000000_init/migration.sql`](prisma/migrations/20260516000000_init/migration.sql)
- Tenant context: [`src/lib/tenantContext.ts`](src/lib/tenantContext.ts)
- Scoped client: [`src/lib/db.ts`](src/lib/db.ts)
- Seed: [`prisma/seed.ts`](prisma/seed.ts)

---

## 1. Entity overview (ASCII ERD)

```
                          ┌─────────────┐
                          │  Tenant     │  (platform-level)
                          │  ─────────  │
                          │  slug, type │
                          │  Stripe…    │
                          └──────┬──────┘
                                 │ 1:N (tenantId on every row below)
                                 │
       ┌─────────────────────────┼───────────────────────────────┐
       │                         │                               │
┌──────▼──────┐          ┌───────▼────────┐             ┌────────▼─────────┐
│   User      │          │   Service      │             │   Booking        │
│  role, email│          │   price, dur.  │             │   starts_at,     │
│  tenantId?  │          │   bufferTime   │             │   status,        │
└──┬─────┬────┘          └────┬───────────┘             │   notes (public  │
   │     │                    │                          │   + internal)    │
   │     │                    │ N:M via                  └──┬──┬────────────┘
   │     │                    │ ServiceStaff                │  │
   │     │                    │                              │  │
   │     │                ┌───▼────────┐                     │  │
   │     │                │ServiceStaff│                     │  │
   │     └─role=staff────►│ price_over │                     │  │
   │                      └────────────┘                     │  │
   │                                                          │  │
   │  role=staff   ┌────────────────────────┐                │  │
   ├─────────────► │  StaffProfile          │ ◄──────────────┘  │
   │               │  title, color, hours   │   staffId         │
   │               │  AvailTemplate (M)     │                   │
   │               │  AvailOverride (M)     │                   │
   │               └────────────────────────┘                   │
   │                                                            │
   │  role=client  ┌────────────────────────┐                  │
   └─────────────► │  ClientProfile         │ ◄────────────────┘
                   │  notes (private),      │   clientId
                   │  preferredStaff,       │
                   │  totalVisits cache     │
                   └────────────────────────┘

                        ┌──────────────┐  ┌──────────────┐
   Booking 1───N───────►│   Invoice    │──┤ LineItem (N) │
                        │ status, totals├──┴──────────────┘
                        └──────┬───────┘
                               │ 1:N
                        ┌──────▼───────┐  ┌──────────────┐
                        │   Payment    │──┤   Refund (N) │
                        │ Stripe ids   │  └──────────────┘
                        └──────────────┘

   (Cross-cutting)  Notification, NotificationPreference, StripeConnectAccount,
                    PlatformEvent (cross-tenant), PlatformAdmin (no tenant),
                    RefreshToken + AuthToken (auth state, see §11).
```

A normal-form sketch — Prisma's `prisma format` will render a much richer ERD if you want it visualized.

---

## 2. Multi-tenancy: how the guard works

Every domain table carries `tenantId UUID NOT NULL` and is indexed on it. App enforcement:

1. **Request enters API.** `requireAuth` validates the JWT (`{ sub, role, tenantId }`).
2. **`resolveTenant` middleware** loads the tenant by slug/header.
3. **`openTenantScope` middleware** (`src/middleware/tenantContext.ts`) opens an `AsyncLocalStorage` scope with `{ tenantId, userId, role }`. Platform admins get `runAsPlatform(...)` instead.
4. **Every Prisma call** routes through `db` (the extended client in `src/lib/db.ts`). The extension:
   - reads the current context,
   - for tenant-scoped models: injects `where: { AND: [{ tenantId }, ...prev] }` on reads, scopes `where` on updates/deletes, and stamps `data.tenantId` on creates.
   - Platform admins bypass (no scoping).

Net effect: a handler that writes `db.booking.findMany({ where: { staffId } })` cannot leak across tenants — the extension silently appends the tenant filter. The same handler called under `runAsPlatform()` sees everything.

### What is NOT auto-scoped

- `Tenant`, `PlatformAdmin`, `PlatformEvent` — by design (platform-level).
- `User` — explicitly excluded because `tenantId` is **nullable** (platform admins). Tenant-scoped user queries must include `tenantId` manually or go through a helper like `findTenantUser(...)`.
- `rawPrisma` (escape hatch in `db.ts`) — bypasses the extension entirely. Use only for auth, migrations, seeds, platform-admin endpoints.

### Defense in depth: optional Postgres RLS

The application-layer guard is the **primary** boundary. For extra safety in production you can also enable Postgres RLS:

```sql
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bookings
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

To make this work with Prisma you'd wrap each request in `$transaction` and `SET LOCAL app.tenant_id = $1` at the top. This is awkward (Prisma doesn't have first-class GUC support) so I'd only enable RLS once the app stabilizes — and treat the extension as the load-bearing guard. The legacy raw-SQL scaffold at `src/db/migrations/0001_init.sql` shows a working RLS setup if you want to port it.

---

## 3. Key design decisions

### 3.1 Application-layer scoping over Postgres RLS

**Decision:** Prisma extension + AsyncLocalStorage, not RLS.

**Why:** Prisma uses a connection pool and runs each query as an implicit transaction. `SET app.tenant_id` doesn't persist across queries, so you'd need to wrap every operation in an explicit `$transaction` to set the GUC reliably. That's painful and easy to forget. Application enforcement via the extension is type-safe and visible in code.

**Tradeoff:** A direct SQL connection (script, admin tool, ORM bypass) won't be scoped. Pair with RLS for true defense-in-depth before going to production with sensitive data (PHI, regulated industries).

### 3.2 UUIDs everywhere, never auto-increment

`gen_random_uuid()` from pgcrypto, applied at the DB. No enumerable IDs, safe to expose in URLs.

### 3.3 Money is `Int` cents, never `Decimal` or floats

Prisma `Int` is 32-bit signed (max ~$21M per row), plenty for line items. If you ever stamp invoice _totals_ above $21M, swap to `BigInt`. Never `Float` / `Decimal` for money: rounding errors compound.

### 3.4 Two private-note fields

- `Booking.notes` — visible to the client.
- `Booking.internalNotes` — staff-only.
- `ClientProfile.notes` — staff-only.

Routes serving client requests MUST omit `internalNotes` / `ClientProfile.notes`. Worth a Zod `pick()` schema per route — easy to forget.

### 3.5 Booking status with full audit history

`booking_status_history` records every state change with `previousStatus`, `newStatus`, `changedById`, `note`. Driven by application code (no DB trigger — keeps the audit visible in the same TS code that mutates state).

### 3.6 Denormalized counters on `ClientProfile`

`totalVisits` and `lifetimeValueCents` are caches updated by application code on booking-completed / payment-succeeded events. NOT authoritative — recompute on demand if precision matters.

### 3.7 Cancel/refund chain uses `onDelete: Restrict`

`bookings.client_id`, `payments.client_id`, `invoices.client_id` all `ON DELETE RESTRICT`. You cannot delete a user with financial history — must anonymize instead. Add a `User.anonymizedAt` flag and a privacy job when you implement GDPR/CCPA delete.

### 3.8 Tenant `ownerId` is nullable

Avoids a chicken-and-egg on tenant creation. App rule: when creating a tenant, create the owner user in the same `$transaction` and patch `ownerId` immediately. Null `ownerId` outside that window is an integrity warning to investigate.

### 3.9 Email uniqueness is `(tenantId, email)`, not global

Lets a single human have client accounts at multiple BDT Connect businesses. See §5 tradeoff.

---

## 4. Indexes — what they're for

| Table | Index | Why |
|---|---|---|
| `tenants` | `subscription_status`, `is_active` | Superadmin churn / health dashboards |
| `users` | `tenant_id`, `role`, `email` | Auth lookup; per-role roster pages |
| `bookings` | `(tenant_id, starts_at)` | Calendar day/week views (hottest read path) |
| `bookings` | `(tenant_id, staff_id, starts_at)` | Per-staff calendar |
| `bookings` | `(tenant_id, client_id)` | Client profile → history |
| `bookings` | `(tenant_id, status)` | Pending / upcoming / cancelled filters |
| `invoices` | `(tenant_id, status)`, `stripe_payment_intent_id` | Unpaid filters; webhook lookups |
| `payments` | `stripe_payment_intent_id`, `stripe_charge_id` | Webhook lookups |
| `notifications` | `(user_id, is_read, created_at DESC)` | Inbox list ordered by recency |
| `availability_overrides` | `unique(staff_id, date)` | Prevent duplicate overrides for same day |
| `service_staff` | `unique(service_id, staff_id)` | A staff can perform a service at most once |
| `platform_events` | `(event_type, created_at DESC)` | Cross-tenant analytics |

---

## 5. Known tradeoffs

### 5.1 Per-tenant user identity (no global "person")

A user "Amelia Chen" who's a client at Vale Strength **and** Cardamom Spa has two rows in `users` — one per tenant. Pros: simplest tenant isolation, no global PII surface, clean GDPR delete. Cons: no built-in "BDT account, see all my bookings everywhere" view; the same person on two tenants gets two profiles, two notification preferences, etc. **Revisit when** clients ask for a unified mobile-app experience across multiple tenants.

### 5.2 Denormalized counters drift

`ClientProfile.totalVisits` / `lifetimeValueCents` updated by app code. Background job or DB trigger needed to reconcile periodically. Use raw SQL: `UPDATE client_profiles SET total_visits = (SELECT count(*) FROM bookings WHERE …)` on a nightly cron.

### 5.3 No DB-level cross-table constraints for cross-tenant correctness

The schema does NOT enforce "Booking.client.tenantId == Booking.tenantId" at the DB level. The extension makes accidental cross-tenant writes impossible from app code, but a manual SQL operator could violate the invariant. Add a `check` trigger if it ever happens in practice.

### 5.4 No soft-delete

Hard deletes only. If you need soft-delete (audit, undo) add `deletedAt timestamptz` to relevant models and update the extension to inject `deletedAt: null` on reads. Cheaper to add now than later.

### 5.5 `User.email` not globally unique

Cannot do "did you mean…?" suggestions across tenants without ranking by global email. Acceptable for now.

### 5.6 Working hours stored twice

`StaffProfile.workingHours` (JSON snapshot for fast read) + `AvailabilityTemplate` (queryable rows). App must keep both in sync — risky. Eventually drop the JSON and derive on read.

### 5.7 No locking for double-booking

`Booking` has no exclusion constraint. Two concurrent requests to book the same slot for the same staff can both succeed. Add a Postgres `EXCLUDE USING gist` constraint with `tstzrange` when you implement online booking. Tracked: TODO in service code.

---

## 6. Multi-location — what changes

When one owner runs multiple locations under one tenant, **most domain tables need a `locationId` too**. Suggested approach when we get there:

1. Add `model Location { id, tenantId, name, address, … }`.
2. Add `locationId UUID NOT NULL` to:
   - `Service` (price & availability often differ by location)
   - `StaffProfile` (a staff member works at specific locations)
   - `AvailabilityTemplate` + `AvailabilityOverride`
   - `Booking` (must know where to show up)
   - `Invoice` (accounting wants per-location P&L)
   - `Package` (sometimes location-bound, sometimes not — make optional)
3. **Stays tenant-only**: `User`, `ClientProfile`, `NotificationPreference`, `StripeConnectAccount`, `subscription*`.
4. The Prisma extension grows a parallel "location scope" — if a request specifies a `locationId`, scope to it; otherwise tenant-scoped queries return data from all locations.
5. `ClientProfile` may want a `homeLocationId` (preferred location), but is otherwise tenant-wide.
6. Migration: backfill `locationId` to a default-created Location per tenant.

Files that will need touch-ups when adding multi-location:

- `prisma/schema.prisma` — new model + locationId fields + indexes
- `src/lib/db.ts` — add LOCATION_SCOPED set + locationId injection
- `src/lib/tenantContext.ts` — add `locationId?` to context
- Most service modules (`appointments`, `staff`, `payments`)

---

## 7. Top 10 query patterns

All examples use the scoped `db` client — `tenantId` is auto-injected.

### 1. Owner dashboard — today's appointments + counts

```ts
const start = startOfToday();
const end = endOfToday();
const [bookings, counts] = await Promise.all([
  db.booking.findMany({
    where: { startsAt: { gte: start, lt: end } },
    orderBy: { startsAt: 'asc' },
    include: { client: true, staff: true, service: true },
  }),
  db.booking.groupBy({
    by: ['status'],
    where: { startsAt: { gte: start, lt: end } },
    _count: true,
  }),
]);
```

### 2. Calendar week view for a single staff member

```ts
const bookings = await db.booking.findMany({
  where: {
    staffId,
    startsAt: { gte: weekStart, lt: weekEnd },
    status: { notIn: ['cancelled', 'no_show'] },
  },
  orderBy: { startsAt: 'asc' },
  include: { client: { select: { firstName: true, lastName: true } }, service: true },
});
```

### 3. Availability for a staff on a date (raw — combine template + overrides)

```ts
const [template, override, existing] = await Promise.all([
  db.availabilityTemplate.findMany({ where: { staffId, dayOfWeek: getDay(date) } }),
  db.availabilityOverride.findUnique({ where: { staffId_date: { staffId, date } } }),
  db.booking.findMany({
    where: { staffId, startsAt: { gte: startOfDay(date), lt: endOfDay(date) }, status: { notIn: ['cancelled', 'no_show'] } },
  }),
]);
// derive open slots in app code
```

### 4. Create a booking + initial status history (transactional)

```ts
const booking = await db.$transaction(async (tx) => {
  const b = await tx.booking.create({
    data: { clientId, staffId, serviceId, startsAt, endsAt, status: 'pending', bookedBy: 'client' },
  });
  await tx.bookingStatusHistory.create({
    data: { bookingId: b.id, previousStatus: null, newStatus: 'pending', changedById: clientId },
  });
  return b;
});
```

### 5. Cancel a booking with full audit

```ts
await db.$transaction([
  db.booking.update({
    where: { id: bookingId },
    data: { status: 'cancelled', cancelledAt: new Date(), cancelledById: userId, cancellationReason: reason },
  }),
  db.bookingStatusHistory.create({
    data: { bookingId, previousStatus: prev, newStatus: 'cancelled', changedById: userId, note: reason },
  }),
]);
```

### 6. Client profile — visits + lifetime + upcoming

```ts
const [profile, upcoming, history] = await Promise.all([
  db.clientProfile.findUnique({ where: { userId: clientId } }),
  db.booking.findMany({
    where: { clientId, startsAt: { gte: new Date() }, status: { in: ['confirmed', 'pending'] } },
    orderBy: { startsAt: 'asc' },
    include: { service: true, staff: true },
  }),
  db.booking.findMany({
    where: { clientId, status: 'completed' },
    orderBy: { startsAt: 'desc' },
    take: 20,
    include: { service: true },
  }),
]);
```

### 7. Unpaid invoices

```ts
const unpaid = await db.invoice.findMany({
  where: { status: { in: ['draft', 'sent'] } },
  orderBy: { dueDate: 'asc' },
  include: { client: true, lineItems: true },
});
```

### 8. Payments dashboard — week-over-week revenue

```ts
const [thisWeek, lastWeek] = await Promise.all([
  db.payment.aggregate({
    where: { status: 'succeeded', processedAt: { gte: thisWeekStart, lt: thisWeekEnd } },
    _sum: { amountCents: true },
  }),
  db.payment.aggregate({
    where: { status: 'succeeded', processedAt: { gte: lastWeekStart, lt: lastWeekEnd } },
    _sum: { amountCents: true },
  }),
]);
```

### 9. Stripe webhook — find payment by intent ID

Note: webhooks fire OUTSIDE a request context. Use `rawPrisma` (or wrap in `runAsPlatform`) and then derive `tenantId` from the payment row to scope the rest.

```ts
import { rawPrisma } from '@/lib/db';
const payment = await rawPrisma.payment.findFirst({
  where: { stripePaymentIntentId: event.data.object.id },
});
if (!payment) throw new Error('payment_not_found');
await runAsTenant({ tenantId: payment.tenantId, userId: SYSTEM_USER_ID, role: 'owner' }, async () => {
  await db.payment.update({ where: { id: payment.id }, data: { status: 'succeeded' } });
});
```

### 10. Notifications inbox

```ts
const inbox = await db.notification.findMany({
  where: { userId, isRead: false },
  orderBy: { createdAt: 'desc' },
  take: 50,
});
```

---

## 8. Running it

```bash
# install
pnpm install

# generate Prisma client (also runs as part of `pnpm build`)
pnpm --filter @bdt/api db:generate

# create / apply migrations
pnpm --filter @bdt/api db:migrate:dev      # development — creates new migrations
pnpm --filter @bdt/api db:migrate          # production — applies committed ones

# seed
pnpm --filter @bdt/api db:seed

# UI
pnpm --filter @bdt/api db:studio
```

The legacy raw-SQL schema at `src/db/migrations/0001_init.sql` is **superseded** by the Prisma migration. Keep it around for the RLS reference until production-grade defense-in-depth is wired, then delete.

---

## 11. Auth state tables (`refresh_tokens`, `auth_tokens`)

Added in migration `20260517000000_auth_tokens`. Not tenant-scoped (auth is a user-level concern), so they're NOT in `TENANT_SCOPED` in `src/lib/db.ts` — call sites use `rawPrisma` (only `tokenService.ts` should).

### `refresh_tokens`

Server-side allowlist for refresh JWTs. Every issue writes a row keyed by `jti`; every `POST /api/auth/refresh` looks it up, rotates (revokes old + writes new + links via `replaced_by_jti`), and re-mints both tokens.

| Column | Why |
|---|---|
| `jti` (unique) | Matches the `jti` claim in the refresh JWT |
| `expires_at` | TTL; cleanup job deletes rows past this |
| `revoked_at` | Set on rotation, logout, password reset, reuse detection |
| `replaced_by_jti` | Audit trail — proves the rotation chain |
| `user_agent`, `ip` | Captured at issue for session forensics + suspicious-login detection |

**Reuse detection:** if a presented `jti` is found AND `revoked_at IS NOT NULL`, that's an old cookie being replayed. `tokenService.rotateRefreshToken` revokes every active token for the user, forcing fresh login on all devices. Logged as `refresh.replay_detected` in pino.

### `auth_tokens`

One-time action tokens. The raw token (32 random bytes, base64url) is what we email; only its sha256 is stored. `consumed_at` makes redemption idempotent and gives us "you already used this link" UX.

Issuing a new token for the same `(user_id, purpose)` marks every prior unconsumed row consumed first — so a user who clicks "Forgot password" three times has only the most recent link active.

| Purpose | TTL | Triggered by | Consumed by |
|---|---|---|---|
| `password_reset` | 1 hour | `POST /api/auth/forgot-password` | `POST /api/auth/reset-password` (revokes all refresh tokens) |
| `email_verify` | 24 hours | `register`, `POST /api/auth/verify-email/resend` | `PATCH /api/auth/verify-email` (bearer's `sub` must match) |

### Cleanup

Both tables have `expires_at` indexes. Add a nightly cron once in production:

```sql
DELETE FROM refresh_tokens WHERE expires_at < now() - interval '7 days';
DELETE FROM auth_tokens    WHERE expires_at < now() - interval '7 days';
```

Don't drop immediately on expiry — keep a small grace window so revoked-token forensics still has data to investigate.
