# BDT Connect

Agency client portal for **BDT Talent Group**. The agency's clients
(business owners) install the BDT Connect mobile app, sign up, pick a
Basic ($100/mo) or Premium ($175/mo) subscription with a 14-day free
trial, then use the app to track BDT's work for them and message the
team. A separate admin web app gives Isaac (BDT) a view across every
client, every subscription, and every inbound message.

See [PIVOT.md](PIVOT.md) for the full story of why the product looks the
way it does — it started life as a multi-tenant booking SaaS and was
deliberately reshaped around two things: **subscriptions** and
**messaging**.

```
bdt-connect/
├── apps/
│   ├── api/        Node 20 + Express + Postgres (TypeScript)
│   ├── admin/      Next.js 14 — BDT-internal admin dashboard
│   ├── mobile/     Expo Router — the client app (iOS + Android)
│   └── web/        Next.js — marketing site + design system
├── packages/
│   └── shared-types/   TS types shared between api & mobile
├── PIVOT.md        Product context: what changed and why
├── DEPLOYMENT.md   Production deploy runbook
├── ADMIN_SETUP.md  How to run + bootstrap the admin app
├── turbo.json
├── pnpm-workspace.yaml
├── .env.example
└── README.md       (this file)
```

Reference docs to read before working in each area:

- Web/marketing design system → [apps/web/DESIGN_SYSTEM.md](apps/web/DESIGN_SYSTEM.md)
- Database schema + multi-tenancy → [apps/api/DATABASE_SCHEMA.md](apps/api/DATABASE_SCHEMA.md)
- API surface + envelope conventions → [apps/api/API_REFERENCE.md](apps/api/API_REFERENCE.md)
- Auth (access + refresh tokens, reset/verify) → [apps/api/AUTH_FLOW.md](apps/api/AUTH_FLOW.md)
- Background jobs (BullMQ + Redis) → [apps/api/WORKER_SETUP.md](apps/api/WORKER_SETUP.md)
- Push notifications → [apps/api/PUSH_SETUP.md](apps/api/PUSH_SETUP.md)

## Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **API:** Node 20, Express 4, TypeScript, **Prisma** + Postgres 15+,
  zod, pino. Multi-tenancy enforced via a Prisma client extension that
  auto-injects `WHERE tenantId = ?` from AsyncLocalStorage.
- **Workers:** BullMQ + Redis (Upstash in production). One queue today —
  `platform-events` for async audit writes + delayed Expo push receipts.
- **Admin:** Next.js 14 App Router, Tailwind, Recharts. JWT auth lives
  in an **httpOnly cookie** set by a BFF Route Handler — the access
  token is never exposed to client-side JS.
- **Mobile:** Expo SDK 51, Expo Router, React Query, Zustand,
  `@stripe/stripe-react-native` (PaymentSheet on top of SetupIntent —
  card is captured up front, charged on day 15 when the 14-day trial
  ends).
- **Billing:** Stripe subscriptions only. No Stripe Connect — BDT is
  not a marketplace. Two products: Basic + Premium.
- **Email:** Resend. `BDTTalentGroup@yahoo.com` receives every inbound
  client message with `Reply-To: clientEmail` so the team can reply
  directly without copy/pasting addresses.

## Setup

```bash
# 1. Install (Node 20+, pnpm 9+ required)
corepack enable
pnpm install

# 2. Configure
cp .env.example .env
# edit DATABASE_URL, JWT_SECRET, STRIPE_*, RESEND_*

# 3. Database (uses Prisma — no manual psql role setup needed)
pnpm --filter @bdt/api db:migrate:dev
pnpm --filter @bdt/api db:seed   # DEV ONLY — refuses to run in production

# 4. Run
pnpm --filter @bdt/api dev       # API     → :4000
pnpm --filter @bdt/api worker    # workers → no public port
pnpm --filter @bdt/admin dev     # Admin   → :3100
pnpm --filter @bdt/mobile dev    # Expo dev server

# 5. Stripe webhooks (separate terminal)
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

Seed credentials (dev only — won't run with `NODE_ENV=production`):

- Platform admin: `ops@bdttalent.com` / `platform-admin-dev`
- Demo Basic client: `marcus@vale-strength.com` / `demo-password`
- Demo Premium client: `priya@cardamomspa.com` / `demo-password`

For production admin bootstrap, use the safe one-time script:

```bash
pnpm --filter @bdt/api tsx scripts/createAdmin.ts you@bdttalent.com '<password>'
```

Refuses to run if any platform admin already exists.

## Multi-tenancy

Each tenant-scoped table carries `tenantId` (uuid). The Prisma extension
in [apps/api/src/lib/db.ts](apps/api/src/lib/db.ts) auto-injects
`WHERE tenantId = ?` on every query against scoped models, reading the
active tenant from AsyncLocalStorage (`runAsTenant` /
`runAsPlatform`). Platform admins (`runAsPlatform`) skip scoping
entirely.

Why not Postgres RLS: Prisma's connection pooling + `set_config` is
awkward to thread through every query. The app-layer extension catches
cross-tenant leaks just as effectively and is far easier to audit.

## Auth at a glance

| Token | Storage | TTL | Discriminator |
|---|---|---|---|
| Access JWT | mobile: SecureStore. admin: **httpOnly cookie**. | 15 min | `tokenType: 'access'` |
| Refresh JWT | httpOnly cookie scoped to `/api/auth` | 30 days | `tokenType: 'refresh'` |
| Reset / verify | URL param + sha256 in DB | 1h / 24h | n/a |

- Access and refresh use separate `ACCESS_TOKEN_SECRET` /
  `REFRESH_TOKEN_SECRET` (fall back to `JWT_SECRET` during transition).
- `verifyToken` rejects any token whose body has the wrong `tokenType`
  — a refresh-token leak can't be replayed as an access token.
- Mobile transparently refreshes on 401 + `TOKEN_EXPIRED` via a
  single-flight queue in [apps/mobile/src/api/client.ts](apps/mobile/src/api/client.ts).
  No more "session ended after 15 minutes" bug.
- All client routes go through `requireSubscription` middleware:
  past_due / cancelled / suspended / unverified-email accounts get
  402/403 with a specific code so the mobile UI can route them to the
  billing portal.

## API conventions

- Every async route handler is wrapped in `asyncHandler` (see
  [apps/api/src/middleware/asyncHandler.ts](apps/api/src/middleware/asyncHandler.ts))
  so rejected promises reach the error pipeline instead of hanging the
  request. Express 4 doesn't auto-catch.
- Webhook idempotency is two-phase: SELECT the
  `processed_stripe_events` row first; only mark `status='succeeded'`
  after the handler runs cleanly. Handler failure on a critical event
  returns 500 so Stripe retries.
- Response envelope: `{ success, data?, error?, code?, meta? }` via
  `ok` / `created` / `noContent` / `paginated` in `lib/response.ts`.
- Stripe webhook is mounted **before** `express.json` —
  signature verification needs the raw body.
- CORS in production: set `ALLOWED_ORIGINS` to the admin domain (and
  any operator tools). Dev leaves it blank → permissive.

## Common commands

```bash
pnpm dev               # turbo: run dev across all apps
pnpm build             # turbo build
pnpm typecheck         # turbo typecheck
pnpm test              # turbo test — API has 79 vitest cases
pnpm db:migrate        # apply pending Prisma migrations
pnpm db:seed           # seed demo data (dev only)
```

## Deployment

The full runbook lives in [DEPLOYMENT.md](DEPLOYMENT.md). High-level:

- **API + worker** → Railway (two services, one repo, shared build)
- **Postgres** → Railway managed
- **Redis** → Upstash (TLS auto-detected from `rediss://` URLs)
- **Admin dashboard** → Vercel (auto-deploy on `main`)
- **Mobile** → EAS Build + manual submit to App Store / Play Store
- **Email** → Resend (verified sending domain)

CI is in `.github/workflows/`. Backend tests must stay green for the
Railway deploy job to fire.

## Repo layout (selected)

```
apps/api/src/
  config/env.ts              zod-validated env + production fail-fast
  middleware/
    asyncHandler.ts          wrap async handlers; Promise.catch → next(err)
    verifyToken.ts           JWT verify + tokenType discriminator
    requireSubscription.ts   gate clients by subscription status
    tenantScope.ts           AsyncLocalStorage tenant scope
  lib/
    db.ts                    Prisma + tenant-scoped extension
    userSelect.ts            USER_PUBLIC / TENANT_PUBLIC select shapes
    plans.ts                 PLANS source of truth (Basic / Premium)
  routes/
    auth.ts messages.ts tenant.ts stripe.ts admin.ts webhooks.ts
  services/
    authService.ts tokenService.ts stripeService.ts messageService.ts
    adminService.ts notificationService.ts pushService.ts
  scripts/createAdmin.ts     one-time bootstrap for the first admin

apps/admin/
  app/
    login/page.tsx                  client form → POSTs to BFF
    api/auth/login/route.ts         BFF: sets httpOnly cookie
    api/auth/logout/route.ts        BFF: clears cookie + revokes refresh
    (protected)/...                 dashboard, clients, messages, revenue
  middleware.ts                     Edge auth gate (reads httpOnly cookie)
  lib/api.ts                        server-side fetch wrapper

apps/mobile/
  app/                       Expo Router
    (auth)/                  tenant-select, login, signup, verify, reset
    (onboarding)/            plan-selection, payment-setup
    (client)/                home, messages, plan, settings (4 tabs)
  src/
    api/client.ts            fetch + single-flight refresh-and-retry
    screens/...              dashboard, messaging, onboarding, settings
    stores/{auth,tenant,stripe}.ts
```
