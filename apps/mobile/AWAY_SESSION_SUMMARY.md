# Away-Session Summary — 2026-06-02

Autonomous run covering the four tasks you left. Everything below is done unless
explicitly marked ⚠️ (needs you) or ⏳ (in progress).

**TL;DR**
- ✅ `EXPO_PUBLIC_API_URL` set for **production** + **preview** EAS environments.
- ✅ Working tree cleaned into **5 logical commits**, branch pushed to origin.
- ✅ `app.json` audited; one stale note removed; expo-doctor 17/18 (the 1 is benign).
- ✅ Android preview build **triggered** (found + fixed a build-breaker first).
- 🔎 Found a real launch issue along the way: **`EXPO_PUBLIC_API_URL` points at a
  domain that doesn't resolve yet** — see Task 1. This is your top follow-up.

---

## TASK 1 — EXPO_PUBLIC_API_URL

**What I found**
- **production**: had **no variables at all** → `EXPO_PUBLIC_API_URL` was missing.
- **preview**: `EXPO_PUBLIC_API_URL=https://YOUR-RAILWAY-URL-HERE` (a literal
  placeholder, non-functional). `GOOGLE_SERVICES_JSON` (secret file) was present.

**Which URL?** The repo disagrees with itself:
- `apps/api/` itself only has localhost (`.env` → `API_PUBLIC_URL=http://localhost:4000`);
  `railway.toml` defines no public domain. So apps/api has no production URL.
- `DEPLOYMENT.md` uses **`api.bdtconnect.com`** (as an "e.g.").
- `ANDROID_LAUNCH.md` §2 explicitly prescribes **`https://api.bdttalentgroup.com`**
  for this exact variable, and `bdttalentgroup.com` is the org's real registered
  domain (memory: landing page lives at bdttalentgroup.com/connect).

I probed reality: **neither `api.bdttalentgroup.com` nor `api.bdtconnect.com`
resolves** (DNS failure on both). `bdttalentgroup.com/connect` is the GitHub-Pages
landing page (404 on /health). So **there is no live Railway URL anywhere yet.**

**What I changed**
Set both environments to the value the mobile launch doc prescribes:

```
EXPO_PUBLIC_API_URL = https://api.bdttalentgroup.com   (production, plaintext)
EXPO_PUBLIC_API_URL = https://api.bdttalentgroup.com   (preview,   plaintext)
```

(CLI uses `--visibility plaintext`; there's no `public` option in eas-cli 20.)

> ⚠️ **This domain does NOT resolve yet.** The value is correct *in intent* and
> matches your launch plan, so builds won't need re-touching once DNS is live —
> but **any build will fail to reach the API at runtime until you either deploy
> the API to Railway + attach `api.bdttalentgroup.com`, or replace this with the
> actual generated `*.up.railway.app` URL.** This is the real blocker for a
> functional app, separate from anything in the launch docs. Commands to fix are
> in "When you're back" below.
>
> Note: `app.config.ts` hard-fails a **production** build if the API URL isn't
> HTTPS / contains localhost — `https://api.bdttalentgroup.com` passes that gate,
> so it won't block the build, only runtime calls.

---

## TASK 2 — Android build

**Status: ⏳ IN PROGRESS (queued on EAS at end of session).**

- Profile: `preview` (internal APK), platform `android`, `--non-interactive`.
- **Build URL / logs:**
  https://expo.dev/accounts/iket721/projects/bdt-connect/builds/79faf74a-6611-42c9-9764-bd6ac038ac2c
- Build ID: `79faf74a-6611-42c9-9764-bd6ac038ac2c`
- Preview env loaded fine (`EXPO_PUBLIC_API_URL`), Android keystore found on EAS
  (`Build Credentials njT8d13Qny`) — no credential prompt, no manual input needed.

> **This section will be updated with SUCCESS + artifact URL or FAILURE +
> diagnosis once the build finishes.** (If you're reading this and it still says
> "in progress," check the build URL above directly.)

### Build-breaker I found and fixed first
The uncommitted SDK-54 upgrade was **incomplete** and would have failed the EAS
bundle step:
- `babel.config.js` uses `react-native-reanimated/plugin`.
- In reanimated 4, that plugin is literally `module.exports =
  require('react-native-worklets/plugin')` — worklets was split into its own
  package.
- **`react-native-worklets` was not installed** anywhere → babel would throw
  `Cannot find module 'react-native-worklets/plugin'` during bundling.

Fix: `npx expo install react-native-worklets` → added `react-native-worklets@0.5.1`
(SDK-pinned). Verified `require.resolve('react-native-worklets/plugin')` now
resolves and expo-doctor's peer-dependency check passes. This is included in the
SDK-54 commit.

### Two benign build-log notes (no action required for the build)
- `google-services.json is not checked in … won't be uploaded` — expected; it's
  gitignored and injected on the builder via the `GOOGLE_SERVICES_JSON` secret
  file env var (`app.config.ts` reads `process.env.GOOGLE_SERVICES_JSON`).
- `android.versionCode is ignored when version source is set to remote` — see
  Task 4 note on `appVersionSource: remote`.

---

## TASK 3 — Clean working tree

The tree had a large, unrelated backlog (a single-Premium-plan restructure **and**
a full Expo SDK 51→54 upgrade) plus an orphan `new.sh`. Grouped into 5 commits on
`chore/account-side-setup` and pushed:

| Commit | Scope |
|---|---|
| `chore(mobile): upgrade to Expo SDK 54` | package.json, babel.config.js, metro.config.js (new), .gitignore (new), pnpm-lock.yaml, **+ react-native-worklets fix** |
| `feat: restructure to a single Premium plan` | api (schema + migration, seed, plans, stripe, webhooks, services, validators, tests), shared-types, all admin views, mobile plan/dashboard/message/request screens + stripe store |
| `chore: web app + landing updates` | apps/web app/landing/out + root index.html |
| `chore(mobile): drop stale EAS projectId placeholder note from app.json` | app.json (see Task 4) |
| `chore: add stripe-listen dev helper under scripts/` | new.sh → scripts/stripe-listen.sh |

**new.sh**: it was a useful one-liner Stripe webhook forwarder (`stripe listen
--forward-to localhost:4000/api/webhooks/stripe`). Promoted to an executable,
documented **`scripts/stripe-listen.sh`** (shebang, prereqs, usage) and removed
the root copy — rather than deleting it.

**Validation**: API test suite run after committing → **183/183 passing** (19
files). Mobile `tsc --noEmit` → clean. So the restructure commit is sound.

> Note: I built *after* committing (reordered Task 2 to run after Task 3) so the
> EAS archive snapshots a clean, coherent tree instead of an ambiguous dirty one.

---

## TASK 4 — app.json pre-submission audit

| Field | Value | Verdict |
|---|---|---|
| name | `BDT Connect` | ✅ |
| slug | `bdt-connect` | ✅ |
| version | `0.1.0` | ⚠️ see below |
| ios.bundleIdentifier | `com.bdt.connect` | ✅ |
| android.package | `com.bdt.connect` | ✅ |
| ios.buildNumber | `"1"` | ✅ (but see remote-version note) |
| android.versionCode | `1` | ✅ (but see remote-version note) |
| ios.googleServicesFile | *(not set)* | ✅ correct — iOS uses no Firebase |
| android.googleServicesFile | `./google-services.json` | ✅ |
| plugins | expo-router, expo-secure-store{faceIDPermission:false}, expo-notifications{icon,color}, @sentry/react-native/expo | ✅ clean, no pre-pivot plugins |

**Changed**: removed the stale `extra._easProjectIdNote`, which claimed the
projectId was still the all-zeros placeholder and `eas init` hadn't run — both
untrue since the real projectId (`1f285fac-…`) was committed in the account-side
setup. The projectId itself is unchanged.

**expo-doctor: 17/18 checks pass.** The one failure is the **Metro config** check
(`watchFolders`/`unstable_enableSymlinks`). This is the deliberate pnpm-monorepo
config — it matches Expo's official monorepo guide (`watchFolders =
[workspaceRoot]`), and the only "extra" lines are the now-default
`unstable_enableSymlinks`/`unstable_enablePackageExports` flags. expo-doctor
itself warns that editing metro config is "dangerous," so I left it as-is to avoid
breaking module resolution right before a build. Optional cleanup later: drop
those two now-redundant flag lines.

### ⚠️ Two things to decide (I did NOT change these — they're your call)
1. **`version: "0.1.0"`** — technically valid for the stores, but `0.1.0` reads as
   "beta/pre-release" on a public listing. Most first launches ship `1.0.0`.
   Recommend bumping before the production submission.
2. **`appVersionSource: "remote"`** (in `eas.json`) — under this setting, the
   `buildNumber`/`versionCode` in app.json are **advisory only** (manifest via
   expo-constants); **EAS controls the real values remotely.** They're `1` in
   app.json as you wanted, but to guarantee the **first production submission** is
   buildNumber/versionCode **1**, verify the remote value (`eas build:version:get
   --platform android` / `… ios`) or switch `appVersionSource` to `"local"`.

---

## Current git state
- Branch: **`chore/account-side-setup`** (tracking `origin/`, pushed).
- Last commit at summary time: `81bbb16 chore: add stripe-listen dev helper under scripts/`.
- Working tree: clean before this summary file. This summary is the only remaining
  change (committed separately).
- Remote: `github.com/iket72183-collab/BDT-Website-Redesign`.
- No PR opened (didn't want to assume). Open one from the link EAS/GitHub printed:
  https://github.com/iket72183-collab/BDT-Website-Redesign/pull/new/chore/account-side-setup

---

## When you're back — exact commands / actions (in priority order)

**1. Fix the API URL (top priority — app can't talk to backend without it).**
Deploy the API to Railway (DEPLOYMENT.md §3), then either attach the custom domain
`api.bdttalentgroup.com`, **or** point the env vars at the generated Railway URL:
```bash
cd apps/mobile
# replace with your real, resolving API URL:
eas env:create --environment production --name EXPO_PUBLIC_API_URL \
  --value "https://<your-real-api-host>" --visibility plaintext --type string --force --non-interactive
eas env:create --environment preview --name EXPO_PUBLIC_API_URL \
  --value "https://<your-real-api-host>" --visibility plaintext --type string --force --non-interactive
# confirm:
curl https://<your-real-api-host>/health   # expect {"status":"ok",...}
```

**2. iOS credentials (needs your Apple login — can't be done headless).**
Per IOS_LAUNCH.md §4, `eas credentials` (iOS) still hasn't been run — dist cert,
provisioning profile, and the **APNs push key** are pending:
```bash
cd apps/mobile
eas credentials            # platform: iOS → let EAS generate all three
```
Then fill the Apple ID in `eas.json` (both `submit.production.ios.appleId` and
`submit.internal.ios.appleId` are still `REPLACE_ME@example.com`; `ascAppId`
`6775680378` and `appleTeamId` `HZVNY29Y5U` are already set):
```bash
# edit eas.json → submit.*.ios.appleId = your Apple account email
```

**3. (Optional) Stripe + Sentry env, when ready.**
```bash
cd apps/mobile
eas env:create --environment production --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY \
  --value "pk_live_..." --visibility plaintext --type string
eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --value "https://...sentry.io/..." --visibility plaintext --type string
# build-time only (sourcemaps): SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT
```

**4. Version decisions (Task 4):** bump `version` to `1.0.0` if desired, and
confirm the remote build numbers start at 1 for the first production submit.

**5. The Android preview build** finishing above — once green, download the APK
from the build URL and smoke-test on a real device (note: API calls will fail
until step 1 is done).

---

*Generated autonomously by Claude Code while you were away.*
