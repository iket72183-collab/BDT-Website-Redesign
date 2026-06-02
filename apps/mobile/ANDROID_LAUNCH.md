# BDT Connect — Android Launch Checklist

Working list to get the Android app onto Google Play. Companion to
[../../DEPLOYMENT.md](../../DEPLOYMENT.md) §4 (which is platform-agnostic);
this doc is Android-specific and explicit about what's blocking,
what's coded, and what needs you.

**Status snapshot (2026-05-27):**

| Item | State |
|---|---|
| Mobile typecheck | ✅ clean |
| API tests | ✅ 95/95 passing |
| App config (`com.bdt.connect`, versionCode 1, scheme `bdtconnect`) | ✅ set |
| Notification accent color | ✅ `#C9A882` |
| Android permissions | ✅ explicit allowlist in app.json: INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, VIBRATE, WAKE_LOCK |
| Dead pre-pivot deps | ✅ removed expo-calendar, react-native-calendars (former would have added calendar permissions) |
| Stripe build gate | ✅ relaxed — production build succeeds without Stripe (warns instead) |
| Onboarding without Stripe | ✅ "Start trial without card" path lands users on home; DB-only trialing state |
| Backend billing gate | ✅ `config.billingEnabled` derived from STRIPE_* env; Stripe-only routes return 503 when unset |
| EAS project id | ❌ placeholder `00000000-…` — `eas init` not run |
| App icon / adaptive icon / splash / notification icon | ✅ generated from SVG sources in `assets/sources/`, wired in `app.json`. Run `node tools/generate-android-assets.mjs` to regenerate |
| Crash reporting (Sentry) | ✅ `@sentry/react-native` wired with no-op-when-DSN-missing; sourcemap config plugin in `app.json` |
| FCM (`google-services.json` **+ FCM V1 service-account key**) | ❌ not configured — push won't deliver on Android. Both pieces required, see §1 |
| Play Console developer account | ❌ not created ($25 one-time) |
| Privacy policy + terms URLs | ✅ live at `/privacy` and `/terms` (when web ships) |

---

## 1. Accounts you need

Before launch you'll need to create / have ready:

- [ ] **Google Play Console** — https://play.google.com/console — one-time $25 USD.
      Use a personal or business Google account. Verify identity (Google sends a card via mail in some regions; can take 1–2 weeks).
- [ ] **Firebase project** for FCM push — https://console.firebase.google.com
      Create a project, add an Android app with package name `com.bdt.connect`,
      download the `google-services.json` (wire it into `app.json` →
      `android.googleServicesFile`). **Two pieces are needed, not one:**
      1. `google-services.json` — registers the device with FCM so it can get a token.
      2. **FCM V1 service-account key (JSON)** — Firebase Console → Project
         settings → Service accounts → *Generate new private key*. Upload via
         `eas credentials` (Android → FCM V1). Since Google retired the legacy
         FCM API, the Expo Push service **cannot deliver to Android without
         this key** even when `google-services.json` is present. Both files must
         belong to the same Firebase project / sender ID.
- [ ] **Expo / EAS account** — https://expo.dev — free tier OK for first build.
      Install CLI: `npm i -g eas-cli` then `eas login`.
- [ ] **Bank account + Stripe** — separate launch track. Once ready, follow
      [../../DEPLOYMENT.md §3c](../../DEPLOYMENT.md) and set the env vars below.

---

## 2. Credentials & env vars

EAS-managed (`apps/mobile/`):

```bash
eas env:create EXPO_PUBLIC_API_URL                --value "https://api.bdttalentgroup.com"
eas env:create EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value "pk_live_..."   # when Stripe ready
```

The `EXPO_PUBLIC_API_URL` value must be your real Railway-deployed API URL, not a localhost.

Set EAS submit credentials in [eas.json](eas.json) once you have them:

```json
"android": {
  "serviceAccountKeyPath": "./google-service-account.json",
  "track": "production"
}
```

The service-account JSON comes from Google Play Console → Setup → API Access → Service accounts. It needs the **Release Manager** role on your Play app.

---

## 3. Code changes still needed before launch

These are blockers from a fresh-clone perspective, in priority order:

### 3a. Stripe-optional build + onboarding — DONE ✅

Shipped 2026-05-27. Both halves landed:

- Build gate in [app.config.ts:44](app.config.ts:44) is now a warn, not a throw. `eas build --profile production` succeeds without a Stripe publishable key.
- [PaymentSetupScreen.tsx](src/screens/onboarding/PaymentSetupScreen.tsx) auto-detects a missing publishable key and uses the no-card trial path. Even when the key IS present, a secondary "Skip — add card later" CTA is offered.
- Backend route `POST /api/stripe/subscription/start-trial { tier }` ([apps/api/src/routes/stripe.ts](../api/src/routes/stripe.ts)) calls [`startTrialWithoutCard`](../api/src/services/stripeService.ts). Service branches on `config.billingEnabled`:
  - Billing enabled → real Stripe subscription with `trial_period_days`, no `default_payment_method`. Stripe fires `trial_will_end` 3 days early.
  - Billing disabled → DB-only `trialing` state, `onboardingCompleted=true`. When billing is wired later, the tenant's first card-capture call promotes the trial into a real subscription.
- Backend `config.billingEnabled` is derived from `STRIPE_SECRET_KEY + STRIPE_BASIC_PRICE_ID + STRIPE_PREMIUM_PRICE_ID`. Stripe-only routes (setup-intent, subscription/create, upgrade, delete, billing-portal) return **503 `billing_unavailable`** when the flag is false. The Stripe webhook returns 503 too.
- Production startup no longer requires Stripe env vars. It does still require all-or-nothing (partial Stripe config in prod is a startup fail-fast).

### 3b. Android assets — DONE ✅

Shipped 2026-05-27. Four PNGs live in `apps/mobile/assets/`, all generated from brand-consistent SVG sources in `apps/mobile/assets/sources/`:

| File | Size | Purpose |
|---|---|---|
| `icon.png` | 1024×1024 | Expo app icon (iOS + Android base) |
| `adaptive-icon.png` | 1024×1024 transparent | Android adaptive-icon foreground; composited over `#0A0A0A` background |
| `splash.png` | 1242×2436 | Splash screen, scaled by Expo per device |
| `notification-icon.png` | 96×96 mono white | Android notification tray; tinted by Android with `#C9A882` |

Wired into [app.json](app.json) at `expo.icon`, `expo.splash.image`, `expo.android.adaptiveIcon.foregroundImage`, and `expo.plugins.expo-notifications.icon`.

Edit SVGs in `assets/sources/` then regenerate with:

```bash
cd apps/mobile && node tools/generate-android-assets.mjs
```

The generator uses `@resvg/resvg-js` (devDep). Outputs are committed alongside sources so CI / EAS builds don't need to run the script.

**You'll still want** to swap these for designer-produced PNGs before launch. The current set is brand-consistent (rose-gold serif "B" on dark) and won't embarrass you, but a real designer's hand will give you more refinement.

`googleServicesFile` is *not* yet wired — that comes in § 1 (you create the Firebase project) and adds one more line to `app.json` once you have the file.

### 3c. Android permissions audit — DONE ✅

Audited 2026-05-27. Two pre-pivot deps were dead weight that would have widened the permission footprint:

- `expo-calendar` — removed. Would have added `READ_CALENDAR` + `WRITE_CALENDAR` (sensitive PII permissions that draw Play Store + data-safety scrutiny).
- `react-native-calendars` — removed. UI-only, no permissions but unused.

Locked down [app.json](app.json) → `expo.android.permissions` to an explicit allowlist. Expo prebuild strips anything outside this set:

| Permission | Why we need it |
|---|---|
| `INTERNET` | API calls (always required) |
| `ACCESS_NETWORK_STATE` | React Native connectivity checks |
| `POST_NOTIFICATIONS` | Android 13+ runtime notification permission (expo-notifications) |
| `RECEIVE_BOOT_COMPLETED` | Re-register scheduled notifications after device reboot |
| `VIBRATE` | Haptic feedback in buttons + notification vibration |
| `WAKE_LOCK` | FCM background message processing |

No camera, no location, no contacts, no microphone, no storage, no calendar. Play Store data-safety form should match what's in [/privacy](../web/app/privacy/page.tsx).

Stripe React Native's AndroidManifest declares no permissions — it inherits from the host. Card capture works via the PaymentSheet web component; no native camera/NFC scan path is used.

**Verify after first EAS build:** the AndroidManifest.xml that EAS generates (visible in build logs) should list only the 6 permissions above. If anything extra appears, a transitive dep added it — investigate before submitting.

### 3d. Crash reporting — DONE ✅

Shipped 2026-05-27. `@sentry/react-native@~5.24.0` installed and wired:

- Init runs at module load in [app/_layout.tsx](app/_layout.tsx) — before any React tree renders, so init-time errors are captured.
- Root component wrapped with `Sentry.wrap()` for render-tree error boundary + touch tracking.
- DSN read from `Constants.expoConfig.extra.sentryDsn`, populated from `EXPO_PUBLIC_SENTRY_DSN` in [app.config.ts](app.config.ts).
- `enabled: Boolean(sentryDsn)` — dev builds without a DSN no-op cleanly; no events leak to a wrong project.
- `sendDefaultPii: false` — Sentry inputs don't widen what /privacy says we collect.
- `tracesSampleRate: 0.1` in production, `1.0` in dev/preview.
- Config plugin `@sentry/react-native/expo` added to [app.json](app.json) plugins array — handles sourcemap upload at EAS build time.

**Env you'll set in EAS before production builds:**

```bash
# Bundled into the app — safe to expose (Sentry DSNs are write-only)
eas env:create EXPO_PUBLIC_SENTRY_DSN --value "https://...ingest.sentry.io/..."

# Build-time only — NOT prefixed EXPO_PUBLIC_, never shipped to clients
eas env:create SENTRY_AUTH_TOKEN --value "sntrys_..."  # from Sentry → Settings → Auth Tokens
eas env:create SENTRY_ORG        --value "your-org-slug"
eas env:create SENTRY_PROJECT    --value "bdt-connect-mobile"
```

Without the auth token / org / project, the app still reports crashes — you just won't get symbolicated stack traces. With them, sourcemaps upload automatically on every EAS build.

**Privacy policy follow-up:** Sentry is now a data processor for the mobile app. The privacy policy at [/privacy](../web/app/privacy/page.tsx) lists Stripe / Resend / Apple Push / FCM / hosting providers but not Sentry. Add Sentry to the "Who we share it with" list before launch — left for the Codex/web pass per task split.

---

## 4. EAS setup walkthrough

```bash
cd apps/mobile
eas login
eas init                           # writes real projectId into app.json — commit it
eas credentials                    # set up Android keystore (let EAS generate one)
```

When prompted about the keystore: **let EAS generate and store it.** Don't try to manage keystores manually — losing it means you can never update your app on Play Store again. EAS keeps a backup tied to your Expo account.

If you want a local backup (recommended): after `eas credentials`, run `eas credentials --platform android` and select "Download credentials" → save the `keystore.jks` somewhere safe.

---

## 5. First production build

Sequence, assuming 3a and 3b are done:

```bash
# from apps/mobile/
eas build --platform android --profile production
```

Build takes ~15-25 min on EAS's queue. You get a downloadable `.aab` file at the end.

Smoke test BEFORE submitting:

1. Download the `.aab` from the EAS build page.
2. Or build a `preview` APK first (`eas build --platform android --profile preview`) — installs directly on a real Android phone for testing.
3. Walk the flow: install → sign up → plan select → onboarding → home → message → settings.
4. Confirm push notifications work (send a test from the admin → device receives it). Won't work without `google-services.json` configured.

---

## 6. Play Store listing requirements

Before you can submit to production track, the Play Console needs:

**Store listing**
- [ ] App name: `BDT Connect`
- [ ] Short description (80 chars): TBD — suggest *"Your business's online presence, professionally delivered by BDT Talent Group."*
- [ ] Full description (4000 chars): TBD — see App Store copy section in DEPLOYMENT.md once written
- [ ] App icon: 512×512 PNG (separate from in-app icon)
- [ ] Feature graphic: 1024×500 PNG, used at the top of the listing
- [ ] Phone screenshots: 2 minimum, 8 maximum. 1080×1920 (portrait) or 1080×1080 (square). Capture from a real device after the assets are in.
- [ ] Tablet screenshots: optional but recommended if supporting tablets

**Required URLs**
- [ ] Privacy policy: `https://bdttalentgroup.com/connect/privacy` (live on web)
- [ ] Website: `https://bdttalentgroup.com/connect/`
- [ ] Contact email: `BDTTalentGroup@yahoo.com`

**Content rating questionnaire** → answer truthfully; this app rates **Everyone**.

**Data safety form** — mirror what's in `/privacy`:
- Collects: name, email, business info, message content, payment info (Stripe collects), device push token, IP, user agent
- Shared with: Stripe, Resend, Firebase, hosting providers
- Encrypted in transit: yes
- Data deletion: in-app + email request

**Target audience** → 18 and over.

**App content category** → Business.

---

## 7. Submission

```bash
# from apps/mobile/
eas submit --platform android --profile production --latest
```

This pushes the latest production build to the Play Console using the service-account credentials in [eas.json](eas.json).

First submission: Google does a manual review (1–7 days). Future updates auto-publish within hours once the policy compliance review is clear.

Internal testing track recommendation: do the first submission to **internal testing** (instant, no review), test on a couple real devices, then promote to production.

---

## 8. Post-launch verification

After the app is live in production:

- [ ] Install from Play Store on a real Android phone.
- [ ] Complete signup with a throwaway email.
- [ ] Without Stripe set up: confirm the "Start trial without card" path lets the user reach the home screen.
- [ ] Send a message to BDT → confirm email arrives at `BDTTalentGroup@yahoo.com`.
- [ ] Trigger a push (from admin or by replying to the message) → confirm it lands on the device.
- [ ] Verify deep-link routing: tap the notification → app opens to messages.
- [ ] Visit Play Console → check the install count, crash-free rate after 24 hours.

---

## 9. What's NOT covered here

- **iOS launch** — see [../../DEPLOYMENT.md §4](../../DEPLOYMENT.md). iOS adds App Store Connect, Apple Developer membership ($99/yr), Apple Push setup (separate from FCM), and a manual App Review with demo credentials.
- **Backend deploy** — see [../../DEPLOYMENT.md §3](../../DEPLOYMENT.md). The Android app talks to the Railway-deployed API; that needs to be live before the app is useful.
- **Stripe setup** — see [../../DEPLOYMENT.md §3c](../../DEPLOYMENT.md). Until bank account is open, follow 3a above to ship a Stripe-optional build.

---

## 10. Order of operations (recommended)

Reading order for executing this checklist:

1. Section 3 (code changes) — until 3a lands, nothing else matters
2. Section 1 (accounts) — start the Play Console account today; identity verification can take days
3. Section 4 (EAS setup) — `eas init` and `eas credentials`
4. Section 3b (assets) — final blocker for store screenshots
5. Section 5 (first build) → 6 (listing) → 7 (submit) → 8 (verify)

Items 1 and 4 are independent of 3 and can be done in parallel while 3 lands.

---

## §8 — Firebase Setup

- **Firebase project:** `bdt-connect` ✅
- **Android:** `google-services.json` placed at `apps/mobile/google-services.json` and
  referenced in `app.json` → `android.googleServicesFile` ✅
- **SHA fingerprints** (EAS upload keystore) captured to `.firebase-sha-fingerprints.txt`
  (SHA-1 `27:A3:…:E2:61`, SHA-256 `AD:49:…:7D:00`). Not required for FCM, kept for reference.
- **FCM V1 service account key:** ✅ already uploaded to **EAS** as a service credential
  (`firebase-adminsdk-fbsvc@bdt-connect.iam.gserviceaccount.com`). This is the functional
  location Expo's push service reads from — no separate `FCM_SERVICE_ACCOUNT_KEY` EAS *secret*
  was created (it would be redundant + require generating a duplicate private key).
- **Sensitive files** (`*.p8`, `.fcm-service-account.json`, fingerprint/metadata `.txt`) covered by `.gitignore` ✅.
- **Date:** 2026-06-01
