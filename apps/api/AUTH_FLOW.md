# BDT Connect — Auth Flow

> End-to-end walkthrough of authentication: access + refresh tokens, password
> reset, email verification, and the Resend email transport that delivers the
> reset / verify links.

Companion docs: [API_REFERENCE.md](API_REFERENCE.md) for endpoint details,
[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) §11 for the auth tables.

---

## 1. Token model

| Token | Lifetime | Storage | Purpose |
|---|---|---|---|
| Access | 15 min | `Authorization: Bearer …` header | Authenticates every API call |
| Refresh | 30 days | `bdt_refresh` httpOnly cookie + `refresh_tokens` table | Mints fresh access tokens; rotated on every use |
| Password reset | 1 hour | URL param + sha256 in `auth_tokens` | One-time-use reset link |
| Email verify | 24 hours | URL param + sha256 in `auth_tokens` | One-time-use verify link |

All four are JWTs except the action tokens (which are 32 random bytes,
base64url-encoded — the raw value goes in the email link, only the sha256
hash lives in the DB).

Access tokens are stateless: just verify the JWT signature. Refresh tokens
are stateful (server-side allowlist by `jti`) so logout / password reset /
suspicious activity can actually invalidate live sessions.

### Refresh-token rotation

Every `POST /api/auth/refresh` does this dance in one transaction:

```
incoming JWT → verify signature → look up jti in refresh_tokens
                                       │
                                       ├─ not found OR already revoked
                                       │   → REUSE DETECTED
                                       │   → revoke ALL refresh tokens for the user
                                       │   → return 401 token_reuse_detected
                                       │
                                       └─ valid + active
                                           → mark old row revoked + link via replaced_by_jti
                                           → mint new jti + new JWT
                                           → return new access + refresh
```

Why rotate: an attacker who steals a refresh cookie can use it exactly once
before the legitimate user's next refresh invalidates it (or vice versa —
whichever attempt loses the race triggers the reuse-detection path and
revokes everything).

---

## 2. Action tokens (reset + verify)

Both flows use the same primitive (`tokenService.issueActionToken` /
`consumeActionToken`) with different TTLs and purposes.

- **Issuing** a token for a `(userId, purpose)` pair marks all prior
  unconsumed tokens with the same purpose `consumed`. Only the most recent
  link works — clicking "Forgot password" three times leaves only the
  latest email valid.
- **Consuming** a token validates: purpose match, not consumed, not expired.
  On success it marks `consumed_at` so the link can't be replayed.
- Only the sha256 of the raw token is stored. A database leak doesn't
  expose live reset links.

URL contract emailed to the user:

```
${PUBLIC_APP_URL}/reset-password?token=<raw>&tenant=<slug>
${PUBLIC_APP_URL}/verify-email?token=<raw>&tenant=<slug>
```

`PUBLIC_APP_URL` is your web/mobile deep-link domain. Falls back to
`API_PUBLIC_URL` if unset (fine in dev; explicit in prod).

---

## 3. End-to-end flows

### 3a. Register a new business

```
client → POST /api/auth/register
         { email, password, firstName, lastName, tenant: { slug, businessName, businessType } }
       ←   201 { user, accessToken } + Set-Cookie: bdt_refresh

server side, inside one $transaction:
   - tenants INSERT (owner_id null)
   - users INSERT (role=owner)
   - tenants UPDATE owner_id = user.id
   - notification_preferences INSERT (defaults)

then (fire-and-forget):
   - issue email_verify token
   - email it via notificationService.sendEmailVerificationEmail
   - log tenant.created + user.registered events
```

If the email transport fails, signup still succeeds — verification can be
retried via `POST /api/auth/verify-email/resend`.

### 3b. Log in

```
client → POST /api/auth/login { email, password, tenantSlug? }
       ←   200 { user, accessToken } + Set-Cookie: bdt_refresh
```

bcrypt-compared, audit-logged, refresh row inserted with UA + IP for
session forensics.

### 3c. Refresh

```
client → POST /api/auth/refresh   (cookie auto-sent by browser)
       ←   200 { user, accessToken } + new Set-Cookie: bdt_refresh
```

If rotation fails (reuse, expired, unknown jti), the route clears the
cookie so the bad value can't be replayed.

### 3d. Logout

```
client → POST /api/auth/logout (bearer + cookie)
       ←   204, Set-Cookie: bdt_refresh=; expires=…
       server: revokes the cookie's refresh row (just this session)
```

### 3e. Password reset

```
1. client → POST /api/auth/forgot-password { email, tenantSlug? }
          ←   200 { sent: true }                  (always — anti-enumeration)
   server: if user exists → issue password_reset token, send email

2. user clicks link in email
   → frontend renders /reset-password page with `?token=…` in URL
   → user enters new password

3. client → POST /api/auth/reset-password { token, password }
          ←   204
   server: consume token → bcrypt new password →
           revokeAllForUser(userId) so every device must log in again
```

### 3f. Email verification

```
1. (automatic on register) email_verify token issued + emailed
2. user clicks link → frontend extracts token, prompts user to log in if needed
3. client → PATCH /api/auth/verify-email { token }   (bearer required)
          ←   204
   server: consume token; assert token.userId === bearer.sub
           (prevents using someone else's leaked link); set emailVerifiedAt
```

Lost / expired link? `POST /api/auth/verify-email/resend` (bearer) reissues
and invalidates any prior unconsumed verify token.

---

## 4. Email transport — Resend

[Resend](https://resend.com) is the production email provider. Free tier
covers ~3k emails/month, ~100/day — plenty for early stage.

### Dev vs prod behavior

`notificationService.sendEmail()` has two paths, gated by `NODE_ENV`:

- **Dev / test:** logs to pino (`email.devsend`) and returns. No API key
  needed. Copy reset / verify URLs straight from the console.
- **Production:** dispatches via `resend.emails.send(...)`. Throws
  `HttpError(502, email_send_failed)` on Resend errors,
  `HttpError(500, email_provider_unconfigured)` if `RESEND_API_KEY` or
  `RESEND_FROM` is missing.

Callers like `authService.forgotPassword` invoke email helpers
fire-and-forget — they log the underlying error but don't fail the
parent request (otherwise password reset would break in a transient
provider outage).

### Setup checklist

**1. Create a Resend account.** https://resend.com/signup

**2. Verify your sending domain.** Resend → Domains → Add Domain. You'll
get a set of DNS records (SPF, DKIM, DMARC) to add to your domain
registrar. Verification usually completes in minutes. Until your domain
is verified, you can send from `onboarding@resend.dev` for testing.

**3. Generate an API key.** Resend → API Keys → Create. Scope: full access
is fine for one-app accounts; consider a per-environment "Sending access
only" key if you split staging / production.

**4. Set environment variables** (in `.env` for local prod runs, in your
hosting platform's secret store for actual production):

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM=BDT Connect <noreply@bdtconnect.com>
PUBLIC_APP_URL=https://app.bdtconnect.com   # where reset/verify links go
```

The `RESEND_FROM` value must use an address on your verified domain.
The `Name <address>` format works in all major email clients.

**5. Confirm in production.** Trigger one of:

```bash
curl -X POST https://your-api/api/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@yourdomain.com","tenantSlug":"vale-strength"}'
```

Check the Resend dashboard's "Emails" tab — you should see the
delivery within ~2 seconds.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `email_provider_unconfigured` 500 | `RESEND_API_KEY` or `RESEND_FROM` not set in prod | Add both to your platform's env |
| `email_send_failed` 502, log shows `validation_error: from` | `RESEND_FROM` uses an unverified domain | Verify the domain in Resend → Domains |
| `email_send_failed` 502, log shows `restricted` | Resend account is in test mode | Verify domain + add billing |
| Email "delivered" in Resend but never arrives | Likely spam-filtered | Add DMARC alignment; warm up the domain |
| Dev console shows `email.devsend` but link looks wrong | `PUBLIC_APP_URL` falls back to `API_PUBLIC_URL` | Set `PUBLIC_APP_URL` explicitly |

### Cost / volume signals to watch

- Resend's free tier resets monthly. The pricing page shows current limits.
- We send roughly one email per: signup, password reset request, lost
  verify-link resend. Booking reminders / receipts are TODO and will
  significantly bump volume — switch to a paid tier before enabling them.
- Stripe webhook payment-receipt emails are sent by Stripe, not by us.

---

## 5. Code map

| Concern | File |
|---|---|
| Token issuance / rotation / revocation | [src/services/tokenService.ts](src/services/tokenService.ts) |
| Auth orchestration (register / login / reset / verify) | [src/services/authService.ts](src/services/authService.ts) |
| Email transport + helpers | [src/services/notificationService.ts](src/services/notificationService.ts) |
| Route + cookie handling | [src/routes/auth.ts](src/routes/auth.ts) |
| Access-token verification middleware | [src/middleware/verifyToken.ts](src/middleware/verifyToken.ts) |
| Env validation | [src/config/env.ts](src/config/env.ts) |
| Email-transport tests | [src/services/\_\_tests\_\_/notificationService.test.ts](src/services/__tests__/notificationService.test.ts) |

---

## 6. Testing

```bash
pnpm --filter @bdt/api test                   # runs vitest once
pnpm --filter @bdt/api test -- --watch        # watch mode
```

The notificationService tests mock `resend`, `@/lib/db`, the logger, and
the config module — so they don't touch the database, the network, or
real env vars. They verify:

- Dev path always logs + never calls Resend (even with API key unset)
- Prod path calls `resend.emails.send` with the right shape
- Typed Resend errors → `email_send_failed (502)`
- Missing API key / from → `email_provider_unconfigured (500)`
- Both helpers (`sendPasswordResetEmail`, `sendEmailVerificationEmail`)
  build the right URL and call sendEmail

A future end-to-end test (skipped for now) would:

1. Start the API against a real test DB
2. POST /api/auth/register
3. Read the dev-log line for `email.devsend` to extract the verify token
4. PATCH /api/auth/verify-email with that token
5. Assert `users.emailVerifiedAt` is now set

That requires a test DB + Prisma seed reset between runs — defer until
the test suite warrants the harness.
