# BDT Connect — Admin Dashboard

Internal web app for Isaac (BDT Talent Group) to manage agency clients,
read messages, and watch revenue. Lives at [apps/admin/](apps/admin/) in
the monorepo and runs separately from the mobile app and the API.

---

## Stack

- **Next.js 14** (App Router, RSC by default)
- **Tailwind CSS** (mirrors the BDT design tokens — same matte black +
  rose-gold palette as the mobile + marketing surfaces)
- **Recharts** for the MRR / growth charts
- **Same JWT auth as the API** — no separate identity system. The admin
  app reads the access token from a cookie the login page writes, and
  middleware enforces presence + `role === 'platform_admin'`.

---

## Local development

Prereqs:

- Node 20+, pnpm 9+
- Postgres reachable via `DATABASE_URL`
- The API running locally (`pnpm --filter @bdt/api dev`)

```bash
# from the repo root
pnpm install

# in one tab — the API
pnpm --filter @bdt/api dev               # → :4000

# in another tab — the admin app
pnpm --filter @bdt/admin dev             # → :3100
```

The admin runs on port `3100` so it doesn't clash with the marketing
site (`@bdt/web`, port `3000`) or the API.

### Environment variables

The admin app only needs to know where to call the API. Add a
`apps/admin/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

In production set this to the API's public URL (e.g.
`https://api.bdtconnect.com`). The variable is read on both the server
and the client; the `NEXT_PUBLIC_` prefix is required for the client
bundle.

---

## Creating the first platform admin

The seed script creates one already:

```
email:    ops@bdttalent.com
password: platform-admin-dev
```

Run:

```bash
pnpm --filter @bdt/api db:seed
```

To create another admin manually (no admin UI for this — bootstrap only),
open a `psql` or Prisma Studio session and:

```sql
-- 1. Hash a password with bcrypt (rounds 12). For ad-hoc creation in dev,
--    you can copy the existing seed user's hash and use the seed password.

-- 2. Insert the user row (tenantId NULL for platform admins).
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, email_verified_at)
VALUES (
  gen_random_uuid(),
  NULL,
  'you@bdttalent.com',
  '<bcrypt hash>',
  'Isaac',
  'Marsh',
  'platform_admin',
  NOW()
);

-- 3. Promote to superadmin.
INSERT INTO platform_admins (id, user_id, role)
VALUES (gen_random_uuid(), '<the user id from step 2>', 'superadmin');
```

Then sign in at `http://localhost:3100/login`.

---

## What's where

```
apps/admin/
  app/
    layout.tsx                ← root html shell, fonts, dark theme
    page.tsx                  ← redirects to /dashboard
    login/page.tsx            ← unauthed sign-in form
    (protected)/
      layout.tsx              ← sidebar + auth check via middleware
      dashboard/page.tsx      ← stat cards + MRR chart + recent activity
      clients/
        page.tsx              ← list + filters + CSV export
        ClientsTable.tsx      ← client component (URL-driven state)
        [id]/page.tsx         ← detail with messages + sub events
        [id]/ClientEditor.tsx ← notes / suspend / delete
      messages/
        page.tsx              ← inbox shell
        MessagesInbox.tsx     ← two-pane list + detail
      revenue/page.tsx        ← MRR breakdown + sub events table
      settings/page.tsx       ← admin profile, plans (display), queue health
  components/
    layout/                   ← Sidebar, Header, PageWrapper
    ui/                       ← StatCard, Badge, Card, EmptyState
    charts/                   ← RevenueChart, ClientGrowthChart
  lib/
    api.ts                    ← typed fetch wrapper (server + client)
    auth.ts                   ← JWT decode + cookie names
    user.ts                   ← server-side current-user from cookie
    format.ts                 ← currency / date helpers
  middleware.ts               ← auth gate (Edge runtime)
  tailwind.config.ts          ← brand color tokens
  next.config.mjs
  package.json
```

---

## Backend endpoints the admin uses

All under `/api/admin/*`, gated by `requireRole('platform_admin')` on the
API side. The admin app is just a typed UI for these.

| Method | Path                                       | Returns                             |
|--------|--------------------------------------------|-------------------------------------|
| GET    | `/api/admin/stats`                         | totals, unread count, new-this-month |
| GET    | `/api/admin/revenue`                       | current MRR, basic/premium split, 6-month MRR series, churn, conversions |
| GET    | `/api/admin/clients`                       | paginated list w/ search/plan/status/sort filters |
| GET    | `/api/admin/clients/:id`                   | full client detail incl. recent messages + sub events |
| PATCH  | `/api/admin/clients/:id`                   | update notes / isActive / tier / status |
| GET    | `/api/admin/messages`                      | cross-tenant inbox + platform unread count |
| PATCH  | `/api/admin/messages/:id/read`             | mark message as read |
| GET    | `/api/admin/subscription-events`           | recent subscription events with tenant |
| GET    | `/api/admin/events`                        | full platform-event log (audit) |
| GET    | `/api/admin/users`                         | all users (paginated) |
| GET    | `/api/admin/queue-health`                  | BullMQ queue depth |

The `/api/admin/tenants` family is kept as a thin alias to `/clients` so
any older callers still compile. New code should prefer `/clients`.

---

## Test status

After this build:

```
pnpm --filter @bdt/api test
# Test Files  5 passed (5)
#      Tests  55 passed (55)
```

14 new tests cover `adminService` end-to-end (`listClients` filter/sort
dispatch, `getClient` 404, `updateClient` audit log, `listAllMessages`
unread count, `markMessageRead`, `revenueOverview` MRR math,
`platformStats` shape). The web app itself has no tests yet — RSC pages
are largely thin wrappers over the API and aren't worth unit-testing in
isolation; smoke-test by clicking through after running locally.

---

## Deploying

The admin is a standalone Next.js app and deploys independently from the
API. Recommended setup:

1. **Build target:** `next build`, run with `next start -p 3100` (or
   serve the static + server bundle via Vercel / Render / Fly).
2. **Single env var required:** `NEXT_PUBLIC_API_URL` → the public URL
   of the API (e.g. `https://api.bdtconnect.com`).
3. **No database access.** The admin never touches Postgres directly —
   it talks to the API. Don't ship any database secrets to the admin
   environment.
4. **Restrict access.** Put the admin behind an IP allowlist or
   Cloudflare Access if possible. The login page enforces
   `role === 'platform_admin'` but the deeper you can keep the surface
   from random scanners, the better.

A subdomain like `admin.bdtconnect.com` works well. The cookie used for
auth (`bdt_admin_token`) is `path=/`, `sameSite=lax`, so a third-level
subdomain won't share the access token with the marketing site or the
API origin — that's by design.

---

## Known limitations / follow-ups

- **CSV export** is built from the current page's rows only (limit 20).
  When export-all matters, add a route that streams all rows server-side.
- **MRR trend approximation.** `mrrByMonth` counts active tenants by tier
  at month-end, modulo `cancelled` events. Doesn't fully model mid-month
  tier changes. For perfect point-in-time MRR, add a nightly snapshot
  job and persist `mrr_snapshots`.
- **No web tests.** The pages are thin RSC wrappers; if logic creeps in
  (more `ClientEditor`-style client components), add Playwright smoke
  coverage.
- **Sandbox typecheck.** This build couldn't run `pnpm --filter @bdt/admin
  typecheck` because the admin workspace's `node_modules` weren't present
  in the build environment. Run it after a fresh `pnpm install` to
  confirm no `@types/react` / Next.js drift.
