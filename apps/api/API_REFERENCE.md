# BDT Connect — API Reference

> Express + TypeScript. All endpoints under `/api/*`. JSON in / JSON out.
> Auth: JWT access token in `Authorization: Bearer …`; refresh token in
> `bdt_refresh` httpOnly cookie. Tenant resolved via `X-Tenant-Slug` header
> (mobile) or subdomain (web). Every protected route runs through
> `verifyToken → tenantScope` so writes are tenant-scoped at the data layer.

Reference these alongside: [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md), [DESIGN_SYSTEM.md](../web/DESIGN_SYSTEM.md).

---

## Conventions

### Response envelope

Every endpoint returns one shape:

```json
// success
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 47 } }
// error
{ "success": false, "error": "validation_failed", "code": "validation_failed", "details": { /* zod fieldErrors */ } }
```

`meta` is present only on paginated lists. `code` is a stable machine-readable string clients can switch on. `details` is type-specific extra context.

### HTTP statuses

| Status | When |
|---|---|
| 200 | Read / update success |
| 201 | Resource created |
| 204 | Delete / no-content success |
| 400 | Validation failed, missing tenant, missing signature |
| 401 | Missing or invalid token, invalid credentials |
| 403 | Role not permitted, cross-tenant access denied |
| 404 | Resource not found |
| 409 | Duplicate, illegal state transition (e.g. illegal booking status change) |
| 429 | Rate limited |
| 500 | Unhandled error (logged with request context) |
| 501 | Not yet implemented (clearly-flagged scaffold stub) |

### Error codes you'll see often

- `unauthorized`, `token_expired`, `invalid_token`, `invalid_credentials`, `invalid_refresh`
- `forbidden`, `role_not_permitted`, `tenant_mismatch`, `tenant_required`, `tenant_not_found`
- `validation_failed` (Zod) — `details` has per-field errors
- `unique_constraint` (Prisma P2002) — `details.target` lists colliding columns
- `not_found` (Prisma P2025)
- `illegal_transition` — booking status moves outside the allowed set
- `slug_taken`, `service_has_future_bookings`, `payment_not_refundable`, `connect_not_ready`
- `rate_limited`, `too_many_attempts`
- `missing_signature`, `invalid_signature` — Stripe webhook signature failure

### Rate limits

| Bucket | Limit | Keyed by | Applies to |
|---|---|---|---|
| `publicLimiter` | 100 / min | IP | unauth routes (register, login, public booking) |
| `authedLimiter` | 500 / min | user id (sub) | every protected `/api/*` route |
| `authAttemptsLimiter` | 10 / 15 min | IP | login / register / forgot-password / reset-password |
| `webhookLimiter` | 2000 / min | IP | Stripe webhook only |

### Auth + tenant flow

```
verifyToken → req.auth = { sub, role, tenantId }
            ↓
tenantScope → either runAsPlatform()   (platform_admin)
            ↓ or
              runAsTenant({ tenantId, userId, role })
            ↓
            → req.tenant = { id, slug }
            → Prisma extension auto-injects tenantId on every query
            ↓
requireRole(…) → role guard
            ↓
            handler
```

### Money

All money is integer cents. Field names end in `Cents`. Never floats. Currency stored as 3-letter lowercase code (`usd` default).

### Times

All timestamps stored UTC. Accept ISO-8601 with offset (`2026-03-15T14:30:00-05:00`); store and return UTC. The client converts at the boundary.

### `// REALTIME-CANDIDATE` markers

These flag routes that would benefit from a WebSocket / SSE push when implemented: live calendar updates, booking-status changes, new-booking notifications. Not built now — search `apps/api/src/services` and `apps/api/src/routes` for `REALTIME-CANDIDATE` to find them.

---

## 1. Auth `/api/auth`

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/register` | none | `RegisterInput` | 201 `{ user, accessToken }` + sets `bdt_refresh` cookie; dispatches verify-email |
| POST | `/login` | none | `LoginInput` | 200 `{ user, accessToken }` + cookie |
| POST | `/refresh` | cookie | — | 200 `{ user, accessToken }` + **rotated** cookie. Reuse of an old jti revokes every session. |
| POST | `/logout` | bearer | — | 204; revokes this session's refresh token + clears cookie |
| POST | `/forgot-password` | none | `{ email, tenantSlug? }` | 200 `{ sent: true }` (always — no enumeration); emails a reset link |
| POST | `/reset-password` | none | `{ token, password }` | 204; consumes the token, rotates the password, **revokes every refresh token** for the user |
| PATCH | `/verify-email` | bearer | `{ token }` | 204; bearer's `sub` must match the token's user (`token_user_mismatch` otherwise) |
| POST | `/verify-email/resend` | bearer | — | 204; reissues the verify-email token + invalidates prior unconsumed ones |
| GET | `/me` | bearer | — | 200 `{ user, tenant, staffProfile?, clientProfile? }` |

`RegisterInput`:
```json
{
  "email": "marcus@vale-strength.com",
  "password": "ThisIsLongEnough1",
  "firstName": "Marcus",
  "lastName": "Vale",
  "tenant": { "slug": "vale-strength", "businessName": "Vale Strength Studio", "businessType": "studio" }
}
```

### Token model

- **Access token** — stateless JWT, 15-min expiry, sent as `Authorization: Bearer …`.
- **Refresh token** — JWT carrying a `jti`, 30-day expiry, in the httpOnly `bdt_refresh` cookie. Server keeps an allowlist row (`refresh_tokens` table) keyed by `jti`. Every `POST /refresh` rotates: the old row is revoked + linked to the new `jti` via `replaced_by_jti`, a fresh JWT is minted. If a presented `jti` is unknown OR already revoked, that's treated as theft → **all** of the user's refresh tokens are revoked (forces fresh login everywhere).
- **One-time action tokens** — for password reset (1 h TTL) and email verify (24 h TTL). Stored as sha256 in `auth_tokens`; the raw value goes in the link we email. Reissuing a token for the same `(userId, purpose)` consumes any prior unused ones — only the latest emailed link is valid.

### Email dispatch

`notificationService.sendEmail()` logs to pino in development (look for `email.devsend`) so you can copy the reset / verify URL straight from the console. In production the function throws `email_provider_unconfigured` until you wire a real provider (Postmark / SendGrid / SES). `register` and `forgotPassword` invoke the helpers fire-and-forget — transport failures are logged but never block the response.

### Reset-password URL contract

Email links are constructed as `${PUBLIC_APP_URL}/reset-password?token=<raw>&tenant=<slug>` (verify-email: `/verify-email?token=…`). The frontend extracts `token` from the URL and POSTs `{ token, password }` to `/api/auth/reset-password`. Set `PUBLIC_APP_URL` env var (falls back to `API_PUBLIC_URL`).

---

## 2. Tenant `/api/tenant` (owner only)

| Method | Path | Returns |
|---|---|---|
| GET | `/` | current tenant row |
| PATCH | `/` | update `{ businessName?, logoUrl?, brandColor? }` |
| GET | `/stats` | `{ bookingsToday, revenueTodayCents, newClientsLast7d, staffOnShift }` |
| GET | `/subscription` | `{ subscriptionTier, subscriptionStatus, stripeCustomerId, stripeSubscriptionId }` |
| POST | `/subscription/upgrade` | `{ tier, returnUrl }` → 200 `{ url }` (Stripe billing portal) |

---

## 3. Users `/api/users` (owner; staff = read self only)

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| GET | `/` | `?page=1&limit=20&search=&role=&isActive=` | paginated |
| GET | `/:id` | — | staff allowed only for own id |
| PATCH | `/:id` | `{ firstName?, lastName?, phone?, avatarUrl?, isActive? }` | owner only |
| DELETE | `/:id` | — | soft delete (`isActive = false`) |
| POST | `/:id/reset-password` | `{ password }` | owner-initiated for staff |

---

## 4. Staff `/api/staff` (owner = write; staff = read + edit own profile)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/` | — | list all staff |
| POST | `/` | `InviteStaffInput` | returns `{ user, profile, provisionalPassword }` — relay PW out-of-band |
| GET | `/:id` | — | staff profile + services + templates |
| PATCH | `/:id` | `{ title?, bio?, colorHex?, isAcceptingBookings? }` | staff can PATCH own only |
| DELETE | `/:id` | — | sets `isAcceptingBookings = false`; TODO: future-booking warning |
| GET | `/:id/availability` | — | `{ template[], overrides[] }` |
| PATCH | `/:id/availability` | `{ shifts: [{ dayOfWeek, startTime, endTime }] }` | full-replacement |
| POST | `/:id/availability/override` | `{ date, isAvailable, startTime?, endTime?, reason? }` | upsert on `(staff, date)` |
| GET | `/:id/bookings` | `?from=&to=&status=` | staff calendar |
| GET | `/:id/services` | — | services this staff performs |
| PATCH | `/:id/services` | `{ serviceIds, priceOverridesCents? }` | full-replacement |

---

## 5. Clients `/api/clients` (owner + staff)

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| GET | `/` | `?page=&limit=&search=` | searchable by name/email |
| POST | `/` | `CreateClientInput` | also creates `clientProfile` + `notificationPreference` |
| GET | `/:id` | — | full client + profile (incl. internal notes) |
| PATCH | `/:id` | `UpdateClientInput` | updates `User` + `ClientProfile` in one tx |
| DELETE | `/:id` | — | soft delete |
| GET | `/:id/bookings` | — | booking history |
| GET | `/:id/invoices` | — | invoice history |
| GET | `/:id/stats` | — | `{ totalVisits, lifetimeValueCents, lastVisitAt }` |

**Note** `User.clientProfile.notes` is staff-only — never echo back from a client-facing route. The client-side `/auth/me` does NOT include `clientProfile` for this reason; if you ever do, project to a `ClientPublicProfile` first.

---

## 6. Services `/api/services` (owner = write; staff = read)

| Method | Path | Notes |
|---|---|---|
| GET | `/` | `?page=&limit=&isActive=&category=` |
| POST | `/` | full Service body — `priceCents` is integer cents |
| GET | `/:id` | service + assigned staff |
| PATCH | `/:id` | partial update |
| DELETE | `/:id` | soft delete; **rejects** with 409 if future non-cancelled bookings exist |
| GET (PUBLIC) | `/public/:tenantSlug` | client-facing bookable services list |

---

## 7. Bookings `/api/bookings`

Clients see/edit only their own bookings (enforced in handler).

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| GET | `/` | `?from=&to=&status=&staffId=&clientId=&page=&limit=` | **REALTIME-CANDIDATE** |
| POST | `/` | `{ clientId, staffId, serviceId, startsAt, notes?, internalNotes? }` | server computes `endsAt` from service duration |
| GET | `/:id` | — | includes `client`, `staff`, `service`, full `statusHistory` |
| PATCH | `/:id` | `{ startsAt?, staffId?, serviceId?, notes?, internalNotes? }` | reschedule + notes |
| PATCH | `/:id/status` | `{ status, reason? }` | **REALTIME-CANDIDATE** — enforces allowed transitions; throws `illegal_transition` |
| DELETE | `/:id` | `{ reason? }` | shortcut for status → cancelled |
| GET | `/:id/history` | — | full status-change audit |
| POST (PUBLIC) | `/check-availability` | `{ tenantSlug, serviceId, staffId?, from, to, granularityMinutes? }` | open-slot calc |
| POST (PUBLIC) | `/public/book` | `{ tenantSlug, serviceId, staffId, startsAt, client: { … }, notes? }` | self-serve booking — find-or-create client |

### Status transitions

```
pending     → confirmed | cancelled
confirmed   → in_progress | cancelled | no_show
in_progress → completed | cancelled
completed   → (terminal)
cancelled   → (terminal)
no_show     → (terminal)
```

Anything outside this graph returns 409 `illegal_transition` with `details.allowed`.

### Availability algorithm

Implemented in [`services/availabilityService.ts`](src/services/availabilityService.ts). Per requested staff (or all eligible staff for the service):

1. Pull `availabilityTemplates` for the day-of-week
2. Apply `availabilityOverrides` (full-day off OR adjusted hours)
3. Subtract existing `bookings` in `pending|confirmed|in_progress` status, **expanded by `service.bufferTimeMinutes` on both sides**
4. Walk the remaining windows in `granularityMinutes` (default 15) increments; each slot must fit `service.durationMinutes + bufferMinutes` before the window ends
5. Return `[{ startsAt (ISO UTC), endsAt, staffId }]` sorted chronologically

All times stored + computed in UTC. Server expects + returns ISO-8601 with timezone offset; client converts at the boundary.

---

## 8. Invoices `/api/invoices`

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/` | `?status=&clientId=&from=&to=&page=&limit=` | clients see their own only |
| POST | `/` | `CreateInvoiceInput` | server computes totals from line items — never trust client totals |
| GET | `/:id` | — | full invoice + line items + payments |
| PATCH | `/:id` | `UpdateInvoiceInput` | TODO (501) — only drafts editable, recompute totals |
| POST | `/:id/send` | — | status → `sent`; TODO: email |
| POST | `/:id/void` | — | owner only |
| POST | `/:id/pay` | `{ amountCents? }` | creates Stripe PaymentIntent → returns `{ clientSecret }` |

`CreateInvoiceInput`:
```json
{
  "clientId": "<uuid>",
  "bookingId": "<uuid>",
  "dueDate": "2026-04-01",
  "lineItems": [
    { "description": "Personal Training", "quantity": 1, "unitPriceCents": 9500, "serviceId": "<uuid>" }
  ],
  "discountAmountCents": 0,
  "taxAmountCents": 0,
  "currency": "usd"
}
```

---

## 9. Payments `/api/payments`

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| GET | `/` | `?status=&clientId=&from=&to=` | clients see their own |
| GET | `/payouts` | — | proxies Stripe `payouts.list` for the tenant's Connect account |
| GET | `/:id` | — | payment + refunds + invoice |
| POST | `/:id/refund` | `{ amountCents?, reason? }` | calls Stripe; reconciled via webhook |
| POST (PUBLIC) | `/webhook/stripe` | RAW BODY | see §11 |

---

## 10. Stripe Connect `/api/stripe` (owner only)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/connect/onboard` | `{ refreshUrl, returnUrl }` | `{ url }` — onboarding link |
| GET | `/connect/status` | — | `{ connected, onboardingComplete, payoutsEnabled, chargesEnabled }` |
| POST | `/connect/dashboard` | `{ returnUrl }` | `{ url }` — Stripe Express dashboard |
| DELETE | `/connect` | — | unlinks (does NOT delete the Stripe account) |

---

## 11. Stripe webhook `/api/payments/webhook/stripe`

- **MUST receive raw body.** Mounted before `express.json()` in `server.ts`.
- Signature verified via `stripe.webhooks.constructEvent(body, signature, secret)`. Failed verification returns 400 `invalid_signature` and is **not** processed.
- Events handled:

| Event | Action |
|---|---|
| `payment_intent.succeeded` | mark invoice `paid` + create `Payment` row (in tenant scope derived from `metadata.tenantId`) |
| `payment_intent.payment_failed` | log `platform_events: payment.failed` |
| `invoice.paid` | platform-subscription paid — set tenant.subscriptionStatus = `active` |
| `customer.subscription.updated` / `deleted` | sync `tenant.subscriptionStatus` |
| `account.updated` | sync `StripeConnectAccount` flags |
| `payout.paid` | log only — owner reads payouts via dashboard |
| `charge.refunded` | mark Payment `refunded` |

All other event types are logged at `debug` and skipped.

---

## 12. Notifications `/api/notifications`

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| GET | `/` | `?unreadOnly=&page=&limit=` | **REALTIME-CANDIDATE** |
| PATCH | `/:id/read` | — | mark single notification read |
| PATCH | `/read-all` | — | mark all unread → read for current user |
| GET | `/preferences` | — | per-user notification prefs |
| PATCH | `/preferences` | `{ emailEnabled?, smsEnabled?, pushEnabled?, bookingReminders?, marketing?, reminderHoursBefore? }` | partial |

---

## 13. Platform admin `/api/admin` (platform_admin only)

These routes bypass tenant scoping — superadmin sees across all tenants. Every write logs to `platform_events` with `userId = admin sub` and a tenantId payload.

| Method | Path | Notes |
|---|---|---|
| GET | `/tenants` | `?page=&limit=&search=&status=` |
| GET | `/tenants/:id` | tenant + owner + connect status + counts |
| PATCH | `/tenants/:id` | `{ isActive?, subscriptionTier?, subscriptionStatus? }` |
| GET | `/users` | paginated, includes tenant ref |
| GET | `/stats` | `{ totalTenants, activeTenants, activeBookingsToday, activeSubscriptions, totalTransactionsThisMonthCents }` |
| GET | `/events` | `?eventType=&tenantId=&from=&to=` — platform audit log |

---

## File map

| Concern | Path |
|---|---|
| Express composition | `src/server.ts` |
| Entry point | `src/index.ts` |
| Middleware | `src/middleware/{verifyToken,requireRole,tenantScope,rateLimiter,validate,requestLogger,error}.ts` |
| Validators | `src/validators/*.validators.ts` + `shared.ts` |
| Services (business logic) | `src/services/*.ts` |
| Routes (thin handlers) | `src/routes/*.ts` |
| Response helpers | `src/lib/response.ts` |
| Tenant context | `src/lib/tenantContext.ts` |
| Scoped Prisma client | `src/lib/db.ts` |

---

## Architecture rules (enforced)

1. **Route handlers are thin.** Validate → call service → return. No business logic in `routes/*`.
2. **DB access via Prisma only.** Raw SQL is allowed only for complex reporting; document with a `// RAW-SQL:` comment when used.
3. **All money in cents (Int).** Field names end in `Cents`.
4. **All times stored UTC.** Convert at the API boundary.
5. **Soft delete only** for user-facing entities. Hard deletes are blocked by FK `Restrict` on financial rows.
6. **Every write emits a `platform_events` row** via `logEvent(...)`. Searchable audit log.
7. **Stripe webhook verifies signature first.** No exceptions.
8. **No raw `prisma` client in routes.** Use `db` (scoped) or, with explicit comment, `rawPrisma` for webhooks/migrations/admin.

---

## What's stubbed (returns 501 `not_implemented`)

These have validators + routes wired so clients can integrate, but the service body is a TODO:

- `PATCH /api/invoices/:id` — partial update + recompute totals (only edit while draft)

Search `apps/api/src` for `not_implemented` to find them all.

## Production wiring TODOs

Not stubs, but production-time tasks the scaffold flags inline:

- **Email provider** — `notificationService.sendEmail()` throws in production until you plug in Postmark/SendGrid/SES. Dev branch logs to pino.
- **Refresh-token cleanup job** — `refresh_tokens` and `auth_tokens` both have `expires_at` indexes; add a nightly cron to `DELETE WHERE expires_at < now() - interval '7 days'`.
- **Booking double-booking lock** — see DATABASE_SCHEMA.md §5.7 (add `EXCLUDE USING gist` constraint before public online booking ships).
