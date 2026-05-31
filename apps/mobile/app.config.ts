import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Dynamic Expo config. Replaces the static `extra` block in app.json with
 * values read from `process.env` at build time so the API URL and Stripe
 * key can vary per environment (development / preview / production EAS
 * profiles).
 *
 * `ConfigContext.config` is the result of parsing app.json — we spread it
 * and override the pieces that need to be dynamic, so the static iOS /
 * Android / plugins blocks in app.json continue to apply.
 *
 * To set the env at build time, use EAS Build's `env` block (see eas.json)
 * or pass via shell: `EXPO_PUBLIC_API_URL=https://… eas build …`.
 */
const PLACEHOLDER_EAS_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

export default ({ config }: ConfigContext): ExpoConfig => {
  const easProjectId = (config.extra?.eas as { projectId?: string } | undefined)?.projectId;
  const appEnv = process.env.APP_ENV ?? 'development';
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    (config.extra?.apiUrl as string | undefined) ??
    'http://localhost:4000';
  const stripeKey =
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    (config.extra?.stripePublishableKey as string | undefined) ??
    '';
  const sentryDsn =
    process.env.EXPO_PUBLIC_SENTRY_DSN ??
    (config.extra?.sentryDsn as string | undefined) ??
    '';

  // Production builds with the placeholder project id always end up signed to
  // some other org's EAS slot. Fail loudly here so a misconfigured `eas build
  // --profile production` aborts before anything ships.
  if (appEnv === 'production' && easProjectId === PLACEHOLDER_EAS_PROJECT_ID) {
    throw new Error(
      'eas.projectId is the placeholder. Run `eas init` in apps/mobile/ and ' +
        'commit the updated app.json before running a production build.',
    );
  }
  if (appEnv === 'production' && (!apiUrl.startsWith('https://') || apiUrl.includes('localhost'))) {
    throw new Error(
      'EXPO_PUBLIC_API_URL must be set to a production HTTPS URL for production builds.',
    );
  }
  if (appEnv === 'production' && !stripeKey) {
    // Soft-launch path: builds without a Stripe key still ship. The
    // PaymentSetupScreen uses the no-card trial flow and the API auto-falls
    // back to a DB-only trial when its own billing config is missing. Warn
    // loudly so a misconfigured build doesn't ship silently for the *real*
    // launch.
    console.warn(
      'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set — production build will ' +
        'use the no-card trial path. Add the key before launching billing.',
    );
  }

  // iOS push delivery hinges on the APNs `aps-environment` entitlement, which
  // the expo-notifications plugin writes from its `mode` prop (default
  // 'development'). A production / TestFlight / internal-distribution build is
  // signed with a distribution profile and MUST carry 'production' — otherwise
  // the device registers against sandbox APNs and Expo push silently never
  // lands once the app is off a dev machine. Only the dev-client profile wants
  // the sandbox value. We inject it here so it tracks APP_ENV per build profile
  // rather than being hardcoded in app.json.
  const apsMode = appEnv === 'development' ? 'development' : 'production';
  const plugins = (config.plugins ?? []).map((plugin) =>
    Array.isArray(plugin) && plugin[0] === 'expo-notifications'
      ? ['expo-notifications', { ...(plugin[1] as object), mode: apsMode }]
      : plugin,
  ) as ExpoConfig['plugins'];

  return {
    ...config,
    name: config.name ?? 'BDT Connect',
    slug: config.slug ?? 'bdt-connect',
    android: {
      ...config.android,
      // Local builds fall back to the (gitignored) committed file; EAS cloud
      // builds read it from the GOOGLE_SERVICES_JSON file env var so the secret
      // stays out of git. Spread config.android first to keep package /
      // versionCode / adaptiveIcon / permissions from app.json.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
    plugins,
    extra: {
      ...config.extra,
      apiUrl,
      stripePublishableKey: stripeKey,
      sentryDsn,
      appEnv,
      // Preserve the EAS project id that was already in app.json so EAS Build
      // can identify the project. Run `eas init` once and commit the result.
      eas: config.extra?.eas,
    },
  };
};
