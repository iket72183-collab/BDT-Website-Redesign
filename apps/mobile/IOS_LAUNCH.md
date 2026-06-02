# BDT Connect — iOS Launch Checklist

Working list to get the iOS app onto the App Store. Companion to
[ANDROID_LAUNCH.md](ANDROID_LAUNCH.md) and to
[../../DEPLOYMENT.md](../../DEPLOYMENT.md) §4 (platform-agnostic build/submit).
This doc is iOS-specific and explicit about what's blocking, what's coded,
and what needs you.

**The only launch blocker is Stripe.** Everything in this doc is meant to be
finished and verified *before* the Stripe account is approved, so that the
moment `pk_live_…` exists, you can build → submit the same day.

**Status snapshot (2026-05-28):**

| Item | State |
|---|---|
| Mobile typecheck | ✅ clean |
| App config (`com.bdt.connect`, buildNumber 1, scheme `bdtconnect`) | ✅ set |
| iOS permission-string audit (`NS*UsageDescription`) | ✅ clean — only auto-injected string was FaceID; now stripped (see §3a) |
| Export-compliance pre-answer (`ITSAppUsesNonExemptEncryption`) | ✅ `usesNonExemptEncryption: false` in [app.json](app.json) — skips the per-submission encryption prompt (see §3b) |
| APNs entitlement (`aps-environment`) | ✅ now `production` for production/preview builds, `development` for dev-client, wired in [app.config.ts](app.config.ts) (see §3c) |
| Stripe build gate | ✅ relaxed — production build succeeds without Stripe (shared with Android) |
| Onboarding without Stripe (no-card trial) | ✅ — also unblocks App Review demo account (see §6) |
| Crash reporting (Sentry) | ✅ wired, no-op when DSN missing (shared with Android) |
| App icon / splash | ✅ generated, wired in [app.json](app.json) (shared with Android) |
| Apple Developer Program | ✅ active ($99/yr) — same account as Catholic Daily Scripture |
| App Store Connect app record | ❌ not created (see §5) |
| EAS iOS credentials (dist cert + provisioning + APNs key) | ❌ not run — `eas credentials` (see §4) |
| EAS project id | ❌ placeholder `00000000-…` — `eas init` not run (shared blocker w/ Android) |
| `eas.json` submit creds (`appleId` / `ascAppId` / `appleTeamId`) | ❌ placeholders — fill after §5 |
| Data privacy "nutrition label" | ❌ not filled — answers mapped in §5c |
| **IAP-vs-Stripe review risk** | ⚠️ **validate before submit** — see §6b |

---

## 1. What's different about iOS vs. Android (read first)

Three things that trip people up, all already handled or documented here:

1. **Push does NOT use Firebase on iOS.** This app sends push via the **Expo
   Push service** (`expo-server-sdk` on the API, `getExpoPushTokenAsync` on the
   client — see [pushService.ts](../api/src/services/pushService.ts), which fans
   one token format out to APNs + FCM). For iOS that means Expo talks to APNs
   using an **APNs key (.p8)** stored in your EAS credentials. **You do not need
   a `GoogleService-Info.plist`** — that file is only for apps that integrate
   Firebase SDKs directly, which this app does not. The Android side needs
   `google-services.json` + an FCM V1 service-account key; iOS needs neither.
   See §7.
2. **Credentials are EAS-managed.** Distribution certificate, provisioning
   profile, and APNs key are all generated and stored by EAS during
   `eas credentials`. Don't hand-manage them in the Apple portal.
3. **App Review is a human gate.** Unlike Play's mostly-automated review, Apple
   has a person open the build, so you need a working **demo account** and clean
   answers to the IAP question (§6).

---

## 2. Accounts you need

- [x] **Apple Developer Program** — active, $99/yr, shared with Catholic Daily
      Scripture. Note your **Team ID** (10-char, Apple Developer → Membership)
      for `eas.json`.
- [ ] **App Store Connect app record** — created in §5. Free, but must be
      created before the first `eas submit`.
- [x] **Expo / EAS account** — same as Android. `npm i -g eas-cli && eas login`.
- [ ] **Bank account + Stripe** — separate launch track; the only true blocker.

---

## 3. Code/config changes — DONE ✅ (2026-05-28)

### 3a. iOS permission-string audit + FaceID removal — DONE ✅

iOS rejects/blocks nothing for *missing* `NS*UsageDescription` keys — the
problem is the reverse: declaring a permission you don't use invites reviewer
questions and a wider privacy label. Audit result: **the app touches no camera,
location, contacts, mic, photos, calendar, or tracking** — so it needs **zero**
usage-description strings.

The one string that *was* being auto-injected: **`NSFaceIDUsageDescription`**.
The `expo-secure-store` config plugin sets it unconditionally — its
`applyPermissions` helper writes the default string unless you pass
`faceIDPermission: false`
([proof in node_modules](node_modules/.pnpm/@expo+config-plugins@8.0.11/node_modules/@expo/config-plugins/build/ios/Permissions.js)).
This app uses SecureStore only as a plain JWT token store
([storage.ts](src/lib/storage.ts) — no `requireAuthentication`, no biometric
prompt), so the FaceID string was dead weight.

Fixed in [app.json](app.json): the plugin is now
`["expo-secure-store", { "faceIDPermission": false }]`, which routes through the
`delete infoPlist["NSFaceIDUsageDescription"]` branch. Net iOS permission
strings after prebuild: **none.**

> No other dependency injects iOS usage strings. `@stripe/stripe-react-native`
> is a plain dependency (not in the `plugins` array), so it adds no
> camera/contacts keys — and no card-scan path is used. `expo-notifications`
> only sets the `aps-environment` entitlement and notification assets, not a
> usage string.

### 3b. Export-compliance pre-answer — DONE ✅

Every iOS upload otherwise stops to ask the **export-compliance / encryption**
question, and TestFlight won't distribute the build until it's answered. The app
uses only standard, exempt encryption (HTTPS, the OS Keychain via SecureStore,
Stripe's SDK) — no proprietary crypto. Set in [app.json](app.json):

```json
"ios": { "config": { "usesNonExemptEncryption": false } }
```

This writes `ITSAppUsesNonExemptEncryption=false` into Info.plist at prebuild,
so every build is auto-cleared for export compliance — no manual prompt, no
TestFlight hold.

### 3c. APNs environment (`aps-environment`) — DONE ✅

The `expo-notifications` plugin defaults the `aps-environment` entitlement to
`development` (sandbox APNs). A build signed with a **distribution** profile
(TestFlight / App Store / internal) must carry `production` or the device
registers against sandbox APNs and **Expo push silently never arrives** off a
dev machine — a classic "push works in dev, dead in TestFlight" bug.

Fixed in [app.config.ts](app.config.ts): the plugin's `mode` is injected per
build profile from `APP_ENV` — `development` for the dev-client profile,
`production` for `preview` and `production`. EAS syncs the capability to the
Apple Developer console at build time. Verified via `expo config --type public`
that the resolved `expo-notifications` plugin carries `"mode": "production"`
under the preview/production profiles.

> These three changes are additive config only; mobile `tsc --noEmit` stays
> clean.

---

## 4. EAS iOS credentials setup

```bash
cd apps/mobile
eas login
eas init                 # writes the real projectId into app.json — commit it (shared w/ Android)
eas credentials          # platform: iOS
```

In `eas credentials` → iOS, let EAS **generate and manage** all three:

- **Distribution Certificate** — EAS creates + stores it.
- **Provisioning Profile** — EAS creates it against bundle id `com.bdt.connect`.
- **Push Key (APNs .p8)** — EAS creates one Apple Push key and reuses it. **This
  is what makes iOS push work** through the Expo Push service. Without it, Expo
  has no way to reach APNs and every iOS push returns an `InvalidCredentials`
  receipt (which [pushService.ts](../api/src/services/pushService.ts) already
  logs explicitly).

You'll be prompted to log into Apple; EAS handles the portal work. The Apple
**Team ID** surfaced here goes into `eas.json` (§5b).

> First time on this Apple account: EAS will register the bundle id
> `com.bdt.connect` as a new App ID and enable the Push Notifications capability
> automatically.

---

## 5. App Store Connect setup

### 5a. New app record

App Store Connect → **My Apps → + → New App**:

- **Platform:** iOS
- **Name:** `BDT Connect` (must be globally unique on the App Store)
- **Primary language:** English (U.S.)
- **Bundle ID:** `com.bdt.connect` — select the App ID EAS registered in §4. If
  it's not in the dropdown yet, run an `eas build` first (or register it in
  Certificates, IDs & Profiles).
- **SKU:** any internal string, e.g. `bdt-connect-ios`
- **User access:** Full Access

The numeric **Apple ID** that App Store Connect assigns this record is your
`ascAppId` for `eas.json`.

### 5b. Fill `eas.json` submit credentials

Once the record exists ([eas.json](eas.json) `submit.production.ios` +
`submit.internal.ios`):

```json
"ios": {
  "appleId": "your-apple-account@email.com",   // the Apple ID you log in with
  "ascAppId": "1234567890",                      // numeric App Store Connect app id (§5a)
  "appleTeamId": "ABCDE12345"                    // 10-char Team ID (Membership page / §4)
}
```

> An `internal` submit profile was added alongside `production` so the first
> upload can go to a path that doesn't need a finished public listing — see §8.

### 5c. App Privacy "nutrition label"

App Store Connect → your app → **App Privacy**. Answer to match
[/privacy](../web/app/privacy/page.tsx) and the Android Data-Safety form so the
two stores tell the same story. Mapping for this app:

| Data type | Collected? | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Name | Yes | Yes | No | App Functionality |
| Email address | Yes | Yes | No | App Functionality |
| Other user content (message text) | Yes | Yes | No | App Functionality |
| Payment info | Yes (via **Stripe**, not stored by us) | Yes | No | App Functionality |
| Device ID / push token | Yes | Yes | No | App Functionality (push) |
| Coarse/precise location | **No** | — | — | — |
| Contacts | **No** | — | — | — |
| Crash data + performance (Sentry) | Yes | No | No | App Functionality / Analytics |

- **Tracking (ATT):** **No** — the app does not track users across other
  companies' apps/sites, so **no `NSUserTrackingUsageDescription` / ATT prompt**
  is needed. Keep it that way unless an ad SDK is ever added.
- **Third parties to disclose as processors:** Stripe (payments), Resend
  (transactional email), Expo/Apple APNs (push), Sentry (crash). *Note: the
  web `/privacy` page still needs Sentry added to its processor list — flagged
  in [ANDROID_LAUNCH.md](ANDROID_LAUNCH.md) §3d; do it before submit so all
  three surfaces match.*

### 5d. Store listing (can be drafted pre-Stripe)

- [ ] Subtitle (30 chars)
- [ ] Promotional text + description (reuse Play full description)
- [ ] Keywords (100 chars)
- [ ] Support URL: `https://bdttalentgroup.com/connect/`
- [ ] Marketing URL (optional)
- [ ] Privacy Policy URL: `https://bdttalentgroup.com/connect/privacy`
- [ ] Screenshots: **6.7"** (iPhone 15 Pro Max, 1290×2796) and **6.1"** (iPhone
      15) required; **iPad 12.9"** (2048×2732) required because
      `supportsTablet: true`. Capture from a preview build once the API is live.
- [ ] Age rating questionnaire → **4+**
- [ ] Category: **Business**

---

## 6. App Review readiness

### 6a. Demo account — no Stripe needed ✅

App Review needs working credentials in the review notes. Because the no-card
trial path shipped (see [ANDROID_LAUNCH.md](ANDROID_LAUNCH.md) §3a), you can
hand Apple a demo account **without Stripe being live**:

1. Sign up a throwaway tenant in the production app.
2. Take the **"Start trial without card"** path → lands on the dashboard in a
   DB-only `trialing` state.
3. Put that email + password in **App Review Information → Notes**, plus a line:
   *"Subscriptions are billed externally for agency services rendered offline;
   the in-app trial requires no payment to demonstrate full functionality."*

This removes Stripe from the iOS critical path for review.

### 6b. ⚠️ IAP-vs-Stripe — validate this before you submit

This is the one iOS-specific risk that could force real rework, so resolve it
deliberately rather than discovering it at rejection. Apple **Guideline 3.1.1**
requires **In-App Purchase** for "digital content or services consumed within
the app" — and IAP takes Apple's commission and forbids linking to external
payment.

BDT Connect's read on this: the subscription pays **BDT Talent Group for
real-world agency services** (web presence, marketing deliverables produced by
people, tracked on the dashboard and coordinated over messaging). Services
delivered in the real world fall under **3.1.3 / 3.1.5**, which *permit*
non-IAP payment (the same basis Uber, Airbnb, and class-booking apps use). If
that's accurate, Stripe is allowed.

**Action before submit:**
- Make the review notes state plainly that the fee is for **services performed
  outside the app by the agency**, not for unlocking in-app digital content.
- Ensure no screen frames the purchase as "unlock features/content."
- If review pushes back, the fallback is StoreKit IAP for the subscription —
  a meaningfully larger change, which is exactly why it's worth de-risking now.
- If you want certainty, this is a good question to put to Apple via a
  pre-submission **App Review** contact or the Resolution Center.

### 6c. Encryption / export compliance ✅

Handled in §3b — `usesNonExemptEncryption: false` auto-answers it.

---

## 7. Push credentials (shared model, iOS specifics)

Push runs through the **Expo Push service**, so credentials split by platform:

| Platform | What Expo needs | Where it lives | Required? |
|---|---|---|---|
| **iOS** | APNs key (.p8) | EAS credentials (`eas credentials` → iOS → Push Key) | ✅ for iOS push |
| **iOS** | `GoogleService-Info.plist` | — | ❌ **not used** (no direct Firebase) |
| **Android** | `google-services.json` | `app.json` → `android.googleServicesFile` | ✅ for Android push |
| **Android** | **FCM V1 service-account key (JSON)** | Uploaded to EAS credentials (Android → FCM V1) | ✅ for Android push delivery |

The Android FCM V1 service-account key is the piece most teams miss: since
Google retired the legacy FCM API, the Expo Push service can't deliver to
Android without it even when `google-services.json` is present. Generate it in
Firebase Console → Project settings → Service accounts → *Generate new private
key*, then `eas credentials` (Android) detects and uploads it. (Cross-reference:
[ANDROID_LAUNCH.md](ANDROID_LAUNCH.md) §1.) The `google-services.json` and the
service-account key must belong to the **same Firebase project / sender ID.**

iOS needs none of the Firebase setup — just the APNs key from §4.

---

## 8. First build → TestFlight → submit

```bash
# from apps/mobile/ — assumes eas init + eas credentials done, projectId committed
eas build --platform ios --profile production
```

~10–25 min on EAS's queue → an `.ipa`.

Then push the first build to **TestFlight / internal** to exercise the pipeline
before the public listing is finished:

```bash
eas submit --platform ios --profile internal --latest
```

(`submit.internal.ios` mirrors production creds — see §5b.) Internal TestFlight
testers (your own Apple ID + up to 100 internal users) get the build with **no
Beta App Review wait**, so you can smoke-test on a real device immediately.

Smoke test before the public submit:

1. Install via TestFlight on a real iPhone.
2. Walk: install → sign up → plan select → **"Start trial without card"** →
   home → message → settings.
3. Confirm a message to BDT arrives at `BDTTalentGroup@yahoo.com`.
4. Confirm push: trigger a notification → it lands (requires §4 APNs key).
5. Tap the notification → app deep-links to messages.

When the listing (§5d) + privacy label (§5c) are complete and Stripe is live:

```bash
eas submit --platform ios --profile production --latest
```

…then submit for review in App Store Connect with the demo account (§6a) and
the services-not-digital-content note (§6b).

---

## 9. Order of operations

Independent of the Stripe track, do these now so submission is same-day once
`pk_live_…` exists:

1. `eas init` (shared blocker) → commit the real projectId.
2. `eas credentials` (iOS) — dist cert, provisioning, **APNs key**.
3. Create the App Store Connect record (§5a) → fill `eas.json` (§5b).
4. Fill the privacy label (§5c) + draft the listing (§5d).
5. Decide the IAP-vs-Stripe framing + review notes (§6b).
6. `eas build` (iOS) → `eas submit --profile internal` → TestFlight smoke test
   (§8).
7. Hold the public `eas submit --profile production` + "Submit for Review" until
   Stripe is live (or submit with the no-card trial if launching billing later).

Everything above except step 7's public submit can be finished before Stripe is
approved.

---

## 10. What's NOT covered here

- **Android launch** — [ANDROID_LAUNCH.md](ANDROID_LAUNCH.md).
- **Backend deploy** — [../../DEPLOYMENT.md](../../DEPLOYMENT.md) §3. The iOS app
  talks to the Railway-deployed API; that must be live for the app to function
  and for screenshots.
- **Stripe setup** — [../../DEPLOYMENT.md](../../DEPLOYMENT.md) §3c. Until the
  bank account is open, ship the Stripe-optional build (the no-card trial).

---

## §7 — App Store Connect Record

- **Status:** Created ✅
- **Bundle ID:** `com.bdt.connect` (App ID registered at developer.apple.com with Push Notifications capability)
- **SKU:** `com-bdt-connect`
- **ascAppId (numeric App Store Connect id):** `6775680378` → set in `eas.json` (`submit.*.ios.ascAppId`)
- **Apple Team ID:** `HZVNY29Y5U` → set in `eas.json` (`submit.*.ios.appleTeamId`)
- ⚠️ `eas.json` `submit.*.ios.appleId` still needs your Apple ID login email.
- **Privacy questionnaire:** Complete + **Published** ✅ — declared (all "App Functionality",
  linked to identity, **not** used for tracking, **not** sold): Name, Email Address,
  Phone Number, Payment Info (via Stripe), Product Interaction (usage).
- **Date:** 2026-06-01

> Note: Apple's own definition would let Stripe-handled Payment Info that the
> developer never accesses go undeclared; we declared it anyway, consistent with §5c.

## §8 — Firebase Setup

Per §1/§7, **iOS does not use Firebase** — so the iOS-Firebase steps from the
account-setup task were intentionally skipped:

- **Firebase project:** `bdt-connect` (exists)
- **iOS:** ❌ **no `GoogleService-Info.plist`, no `ios.googleServicesFile`** — correct;
  iOS push runs through the Expo Push service via the **EAS-managed APNs key** (see §4/§7).
- **APNs Auth Key:** EAS-managed (`eas credentials` → iOS → Push Key), **not** hand-created
  and uploaded to Firebase. ⏳ pending `eas credentials` (see EAS_CREDENTIALS_SUMMARY.md).
- **Android side (FYI):** `google-services.json` placed + referenced in `app.json`;
  FCM V1 service-account key already uploaded to EAS — see [ANDROID_LAUNCH.md](ANDROID_LAUNCH.md) §8.
- **Sensitive files** (`*.p8`, `.fcm-service-account.json`, fingerprint/metadata `.txt`) covered by `.gitignore` ✅.
- **Date:** 2026-06-01
