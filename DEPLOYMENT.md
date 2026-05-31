# BDT Connect — Deployment Runbook

The goal of this document is a single source of truth for going from `git
push` → production users on phones. Everything in here is reproducible —
copy/paste commands, no tribal knowledge.

Stack at a glance:

| Layer | Service | Notes |
|---|---|---|
| API + worker | Railway (Node + tsx) | two services, one repo |
| Database | Railway Postgres | applied via `prisma migrate deploy` in the build |
| Cache / queue | Upstash Redis | TLS, `rediss://` URLs |
| Admin dashboard | Vercel (Next.js 14) | auto-deploys from `main` |
| Mobile app | EAS Build → App Store + Play | manual builds; manual submits until OTA |
| Email | Resend | already wired in [notificationService](apps/api/src/services/notificationService.ts) |

Companion docs: [PIVOT.md](PIVOT.md), [ADMIN_SETUP.md](ADMIN_SETUP.md),
[apps/api/AUTH_FLOW.md](apps/api/AUTH_FLOW.md),
[apps/api/PUSH_SETUP.md](apps/api/PUSH_SETUP.md).

---

## 1. Prerequisites checklist

Accounts you need before doing anything:

- [ ] **Railway** — https://railway.app (API + worker + Postgres)
- [ ] **Vercel** — https://vercel.com (admin dashboard)
- [ ] **Upstash** — https://upstash.com (Redis)
- [ ] **Resend** — https://resend.com (email; domain verified)
- [ ] **Stripe** — https://dashboard.stripe.com (Basic + Premium products created)
- [ ] **Expo / EAS** — https://expo.dev (`npm i -g eas-cli`, `eas login`)
- [ ] **Apple Developer** — https://developer.apple.com ($99/yr)
- [ ] **Google Play Console** — https://play.google.com/console ($25 once)
- [ ] **GitHub** — repo lives here; CI runs from `.github/workflows/`

CLIs:

```bash
npm i -g pnpm@9 eas-cli @railway/cli vercel
```

---

## 2. Environment variables — master list

Every variable, where to get it, and which service needs it.

### API (Railway · `api` service + `worker` service — both need the full set)

| Variable | Required | Source | Notes |
|---|---|---|---|
| `NODE_ENV` | ✓ | literal `production` | enables Resend transport, prod logging |
| `DATABASE_URL` | ✓ | Railway Postgres → "Connect" tab | use the **internal** URL between Railway services |
| `DATABASE_MAX_CONNECTIONS` | ✗ | default `10` | bump if/when you scale |
| `JWT_SECRET` | ✓ | `openssl rand -base64 48` | **same value** as admin |
| `JWT_ACCESS_TTL` | ✗ | default `15m` | |
| `JWT_REFRESH_TTL` | ✗ | default `30d` | |
| `STRIPE_SECRET_KEY` | ✓ | Stripe Dashboard → API keys → Live mode | starts `sk_live_` |
| `STRIPE_PUBLISHABLE_KEY` | ✗ | same place | not used server-side but tidy to set |
| `STRIPE_WEBHOOK_SECRET` | ✓ | Stripe Dashboard → Webhooks → endpoint signing secret | starts `whsec_` |
| `STRIPE_BASIC_PRICE_ID` | ✓ | Stripe Dashboard → Products → BDT Connect Basic | `price_…` |
| `STRIPE_PREMIUM_PRICE_ID` | ✓ | Stripe Dashboard → Products → BDT Connect Premium | `price_…` |
| `RESEND_API_KEY` | ✓ | Resend Dashboard → API Keys | required in prod, `sendEmail` will throw without it |
| `RESEND_FROM` | ✓ | e.g. `BDT Connect <noreply@bdtconnect.com>` | domain must be verified in Resend |
| `PUBLIC_APP_URL` | ✓ | admin dashboard URL, e.g. `https://admin.bdtconnect.com` | used for password-reset / verify links |
| `REDIS_URL` | ✓ | Upstash → "Connect" → `rediss://…` | TLS auto-detected from the scheme |
| `WORKER_CONCURRENCY` | ✗ | default `5` | |
| `ALLOWED_ORIGINS` | ✓ in prod | comma-sep: `https://admin.bdtconnect.com,https://bdtconnect.com` | leave blank in dev; locks CORS in prod |
| `LOG_LEVEL` | ✗ | default `info` | `debug` for troubleshooting |
| `SENTRY_DSN` | ✗ | Sentry project DSN | not wired yet — placeholder |
| `APP_VERSION` | ✗ | Railway exposes `RAILWAY_GIT_COMMIT_SHA` — map it to `APP_VERSION` | shows up in `/health` |

### Admin (Vercel)

| Variable | Required | Source |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✓ | Railway API public URL, e.g. `https://api.bdtconnect.com` |

`JWT_SECRET` is **not** needed on Vercel — the admin app only decodes JWTs
for UI decisions (no signature verification); the API enforces the real
auth on every request.

### Mobile (EAS Build env or shell)

| Variable | Required | Source |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | ✓ | Railway API public URL |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✓ | Stripe → publishable key (`pk_live_`) |
| `APP_ENV` | ✗ | set per profile in [eas.json](apps/mobile/eas.json) — `development` / `preview` / `production` |

### GitHub Actions (`Settings → Secrets and variables → Actions`)

| Secret | Used by | Source |
|---|---|---|
| `RAILWAY_TOKEN` | [.github/workflows/deploy.yml](.github/workflows/deploy.yml) | Railway → Project Settings → Tokens |

Vercel auto-deploys via its native GitHub integration — no token needed.

---

## 3. First deploy — step by step

The exact order matters. Each step depends on the previous one's outputs.

### 3a. Database

1. Railway → New Project → "Provision Postgres".
2. Open the service → **Variables** → copy `DATABASE_URL`. Use the
   **internal** one (host ends in `.railway.internal`) for inter-service
   traffic later.

### 3b. Redis (Upstash)

1. Upstash Console → "Create Database" → pick a region close to your
   Railway region.
2. Copy the **`rediss://...`** URL from the "Connect" tab. (Not the
   plain `redis://` — Upstash requires TLS.)

### 3c. Stripe products

1. Dashboard → **Products** → New product → "BDT Connect Basic".
   - Recurring, $100.00/month, no free trial in Stripe itself (we add the
     14-day trial via `trial_period_days` at subscription-create time).
   - Copy the price id (`price_…`) → that's your `STRIPE_BASIC_PRICE_ID`.
2. Repeat for "BDT Connect Premium" at $175.00/month.
3. If replacing previously configured pricing:
   - Archive the prior 150 USD/month Basic and 250 USD/month Premium Stripe prices.
   - Create new $100.00/month Basic and $175.00/month Premium prices.
   - Update `STRIPE_BASIC_PRICE_ID` and `STRIPE_PREMIUM_PRICE_ID` environment variables to the new `price_...` values.
   - Existing Stripe subscriptions are not automatically repriced. Each subscriber remains on the original price until manually migrated in Stripe or they cancel and resubscribe.
4. **Webhooks** → Add endpoint → `https://YOUR_RAILWAY_DOMAIN/api/webhooks/stripe`.
   Subscribe to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end`
   - `invoice.paid`
   - `invoice.payment_failed`

   Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.

   **Note:** you'll need to know the Railway domain to register this
   webhook. It's chicken-and-egg with step 3d — provision the Railway
   service first (without webhook secret), then come back here once you
   have its URL.

### 3d. Resend (email)

1. Resend Dashboard → **Domains** → add `bdtconnect.com` (or whatever
   sending domain you own). Add the DNS records, wait for verification.
2. **API Keys** → create a new key with `emails.send` permission.
3. Copy → `RESEND_API_KEY`. Set `RESEND_FROM` to
   `BDT Connect <noreply@yourverified.domain>`.

### 3e. Railway — API service

1. Railway project → **New** → "Deploy from GitHub repo" → select this repo.
2. **Root directory:** `apps/api`. Railway will detect [railway.toml](apps/api/railway.toml)
   and use those build/start commands.
3. **Variables** — paste in everything from the API table above. For
   `DATABASE_URL` and `REDIS_URL`, use Railway's reference variables (e.g.
   `${{Postgres.DATABASE_URL}}`) so they auto-update if you ever rotate.
4. **Networking** → Generate domain. Copy that URL — you'll need it for
   the Stripe webhook (step 3c) and for the admin / mobile env values.
5. Deploy. Watch the logs. The build runs Prisma migrate, generate, and
   tsc; the start command is `pnpm --filter @bdt/api start`.
6. Once `/health` returns `{ "status": "ok", ... }`, continue.

### 3f. Railway — worker service

1. Same project → **New** → "Empty service" → connect the same GitHub repo.
2. **Settings**:
   - Root directory: `apps/api`
   - Start command: `pnpm --filter @bdt/api worker`
   - No public networking; no health check.
3. **Variables**: same set as the API service. Use Railway's "Sync from"
   feature or paste again.
4. Deploy. Logs should show `Worker started: platform-events`.

### 3g. Bootstrap the first platform admin

`pnpm db:seed` **refuses to run with `NODE_ENV=production`** — its first
step is to wipe existing data, which would be catastrophic on a real
database. Use the dedicated bootstrap script instead:

```bash
# Railway → API service → "Run command":
pnpm --filter @bdt/api tsx scripts/createAdmin.ts you@bdttalent.com 'a-long-password'
```

The script:

- Hashes the password with bcrypt rounds 12 (same as production register).
- Creates the user + `platform_admin` row + marks email verified.
- **Refuses to run if any platform admin already exists** — by then you
  should be promoting new admins via the admin UI or direct DB row.

After it runs, sign in at `https://admin.bdtconnect.com/login`. Change
the password immediately via the forgot-password flow if you want a new
one; the initial value never touches anything other than your shell
history.

### 3h. Vercel — admin

1. Vercel → **Add New Project** → import this GitHub repo.
2. **Framework Preset**: Next.js (auto).
3. **Root Directory**: `apps/admin`.
4. **Build Command** / **Output Directory**: leave defaults — Vercel will
   read [apps/admin/vercel.json](apps/admin/vercel.json).
5. **Environment Variables**:
   - `NEXT_PUBLIC_API_URL` = your Railway API URL.
6. Deploy. Confirm `/login` renders.

### 3i. Wire CORS

Now that you know all the production domains, set `ALLOWED_ORIGINS` on
both Railway services to the comma-separated list:

```
ALLOWED_ORIGINS=https://admin.bdtconnect.com,https://bdtconnect.com
```

Trigger a redeploy on the API service for the change to take effect.

### 3j. Verify

- `curl https://YOUR_API_URL/health` → `{"status":"ok",...}`
- Sign in to the admin at `https://admin…/login` with the bootstrap admin.
- From admin: dashboard renders, no console errors, sidebar badges work.
- Stripe Dashboard → Webhooks → your endpoint → "Send test event" →
  pick `customer.subscription.created`. Confirm 200 in the delivery log.

---

## 4. Mobile build + submit

### 4a. One-time EAS setup

```bash
cd apps/mobile
eas login                                  # browser auth
eas init                                   # writes EAS projectId into app.json
                                            # → commit that change
eas credentials                            # set up iOS provisioning + Android keystore
```

Set the EAS-managed env vars for the **production** profile:

```bash
eas env:create EXPO_PUBLIC_API_URL                --value "https://api.bdtconnect.com"
eas env:create EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value "pk_live_..."
```

These are referenced in [app.config.ts](apps/mobile/app.config.ts) via
`process.env` and inlined into the bundle at build time.

### 4b. Build

```bash
# from apps/mobile/
eas build --platform ios     --profile production
eas build --platform android --profile production
```

Each takes 10–25 minutes on EAS's build queue. Output: `.ipa` and `.aab`
artifacts you can submit directly.

### 4c. Submit

```bash
eas submit --platform ios     --profile production --latest
eas submit --platform android --profile production --latest
```

(Fill in `appleId` / `ascAppId` / `appleTeamId` /
`serviceAccountKeyPath` in [eas.json](apps/mobile/eas.json) first.)

### 4d. Store-listing requirements

**App Store**
- [ ] App Privacy Policy URL
- [ ] App Support URL
- [ ] Screenshots: 6.7" (iPhone 15 Pro Max), 6.1" (iPhone 15), iPad 12.9"
- [ ] Age rating questionnaire → 4+
- [ ] **Demo account** — App Review needs working credentials. Create a
      throwaway tenant in production (sign up via the app, complete the
      14-day trial via Stripe test mode in your sandbox, then promote that
      tenant to "active" via the admin "Suspend → Reactivate" toggle), and
      provide the email + password in the review notes.

**Google Play**
- [ ] Privacy Policy URL
- [ ] Screenshots (phone + tablet if you support tablets)
- [ ] Feature graphic 1024×500
- [ ] Content rating questionnaire → "Everyone"

---

## 5. Post-launch checklist

Walk through these the moment the first build is live.

- [ ] Stripe webhook endpoint registered against the **live** Railway URL
- [ ] Resend domain verified (green checkmark in Resend dashboard)
- [ ] Bootstrap admin user created via `scripts/createAdmin.ts` (NOT
      `db:seed` — refuses to run in production anyway)
- [ ] **`eas init` run in `apps/mobile/`** and the updated `app.json`
      committed — the placeholder `00000000-…` projectId will fail
      production builds (the dynamic config in `app.config.ts` rejects it)
- [ ] Sign up a new tenant from the iOS or Android build (full flow:
      register → plan selection → payment setup with a real card →
      land on dashboard)
- [ ] Send a message from that tenant → confirm the email arrives at
      `BDTTalentGroup@yahoo.com`
- [ ] Stripe test (use a `pm_card_visa_chargeDeclined` token) → confirm
      `past_due` status surfaces in the admin
- [ ] iOS + Android push: send a message from a second tenant while
      logged in as platform admin on each device → push arrives
- [ ] Admin dashboard MRR matches `SUM(active+trialing tenants × plan price)`
      from `psql` (sanity check on the live data)

---

## 6. Ongoing operations

### Logs

- **API + worker**: Railway → service → "Logs" tab. `pino`-formatted JSON
  with `level`, `msg`, request id, status, latency.
- **Admin**: Vercel → project → "Logs" → choose function or runtime logs.
- **Mobile**: `expo-router` errors land in the user's device console; for
  prod crashes wire Sentry (placeholder env var already set up).

### Migrations

When the schema changes:

```bash
# locally — write the migration
cd apps/api
pnpm db:migrate:dev --name describe_the_change

# commit the new file in prisma/migrations/<timestamp>_<name>/
git add prisma/migrations
git commit -m "feat(db): describe the change"
git push
```

The Railway API build runs `pnpm --filter @bdt/api db:migrate`
(`prisma migrate deploy`) before tsc, so the schema is updated **before**
either service restarts. If the migration fails the deploy aborts and the
old build keeps serving.

### Queue health

Admin → Settings → "Queue health" panel pulls from
`GET /api/admin/queue-health`. `reachable: false` means the worker can't
talk to Redis — most likely cause is wrong `REDIS_URL` (missing the
`rediss://` scheme) or an Upstash IP allowlist.

### Mobile updates

- **JS-only changes** (UI tweaks, copy edits, new screens that don't
  require new native modules) → `eas update --branch production`. Lands
  on every installed device within minutes.
- **Native changes** (new permission, new plugin, new Expo SDK version)
  → full `eas build` + `eas submit` cycle.

### Rotating a secret

1. Update the value in the source (Stripe, Resend, etc.).
2. Update the env var in Railway / Vercel / EAS.
3. Trigger a redeploy.
4. For `JWT_SECRET` specifically: rotating it invalidates every existing
   refresh + access token. Every user has to log back in.

### Rolling back

Railway → service → **Deployments** → click any previous deploy →
"Redeploy". Same for Vercel. For DB migrations, rollback is **not** a
button — write a forward-fix migration. The data model is small enough
that backup + restore is realistic for catastrophic cases (Railway has
nightly Postgres snapshots).

---

## 7. CI pipeline

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every push +
PR to `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @bdt/api db:generate` (Prisma client must exist before tsc)
3. `pnpm --filter @bdt/api typecheck` + `test` + `build`
4. `pnpm --filter @bdt/admin typecheck` + `next build`
5. `pnpm --filter @bdt/mobile typecheck`

Backend tests (55/55) run with dummy `DATABASE_URL` / `JWT_SECRET` /
`STRIPE_*` — the suite mocks Prisma + Stripe so no real services are
needed.

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) waits for CI
to pass on `main`, then invokes the Railway CLI to redeploy `api` +
`worker`. Vercel listens to GitHub on its own and redeploys the admin app
automatically — no token needed in GitHub.

---

## 8. Known limitations / future hardening

- **No Sentry yet.** `SENTRY_DSN` is plumbed but no SDK is wired. Add
  `@sentry/node` to the API and `@sentry/nextjs` to the admin when the
  user count justifies it.
- **No rate limiting on `/health`.** Don't expose it to the open internet
  without a quota — it hits the DB on every call indirectly via the env
  load. (Currently it's near-free; mention in case it grows.)
- **CSP** on the admin app isn't set yet — only the basic three headers
  in [vercel.json](apps/admin/vercel.json). Tighten when you connect
  third-party scripts.
- **No log aggregation.** Railway's per-service log viewer is sufficient
  for one-operator use but searching across services is painful. Wire
  Logtail or Better Stack later if it bites.
- **Backup verification** — Railway snapshots are automatic but never
  tested. Spin up a staging Postgres from a snapshot quarterly.
