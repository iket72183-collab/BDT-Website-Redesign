import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),

  DATABASE_URL: z.string().min(1),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().default(10),

  JWT_SECRET: z.string().min(32),
  // Optional dedicated secrets. When set, access tokens are signed with
  // ACCESS_TOKEN_SECRET and refresh tokens with REFRESH_TOKEN_SECRET. Falling
  // back to JWT_SECRET keeps existing deployments running through the
  // transition; rotate both onto distinct values when you're ready.
  ACCESS_TOKEN_SECRET: z.string().min(32).optional(),
  REFRESH_TOKEN_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  // All STRIPE_* are optional so the API can run without billing wired up
  // (soft launch with the trial-without-card path). `config.billingEnabled`
  // below is derived from these — endpoints that need Stripe check that flag
  // and return 503 instead of crashing.
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Single-plan model: only the Premium price is needed.
  STRIPE_PREMIUM_PRICE_ID: z.string().optional(),

  // Email (Resend). Optional in dev — sendEmail() falls back to logging.
  // In production, missing values cause sendEmail() to throw `email_provider_unconfigured`.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  PUBLIC_APP_URL: z.string().url().optional(),

  // --- Social-account credential vault ---
  // AES-256 master key, base64 of exactly 32 bytes (generate:
  // `openssl rand -base64 32`). Optional: when unset, the credential vault is
  // DISABLED and the API refuses to store passwords (delegated-access +
  // create-for-me flows still work). When set it must decode to 32 bytes or we
  // fail fast — a wrong-length key is a silent footgun. `config.socialVault`
  // below derives the usable key + enabled flag.
  SOCIAL_VAULT_KEY: z.string().optional(),

  // --- File storage (Supabase Storage) ---
  // Object storage for client request attachments. Optional: when unset the
  // upload endpoint returns `storage_unavailable` (503) and the rest of the API
  // runs fine. SUPABASE_SERVICE_ROLE_KEY is a server-only secret — never expose
  // it to clients. Create a Storage bucket in the Supabase dashboard and put
  // its name in SUPABASE_STORAGE_BUCKET (default `request-attachments`).
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('request-attachments'),

  LOG_LEVEL: z.string().default('info'),
  SENTRY_DSN: z.string().optional(),

  // --- CORS ---
  // Comma-separated list of origins allowed to call the API with credentials.
  // In dev we leave it blank (server falls back to permissive); in prod, list
  // every domain that should be able to talk to us — the admin dashboard URL,
  // any operator tools, etc. The mobile app is native and doesn't need CORS
  // (no browser).
  ALLOWED_ORIGINS: z.string().optional(),

  // Surfaced through /health and useful in logs for "which build is running."
  // Populated by the CI/Railway build (`RAILWAY_GIT_COMMIT_SHA`), or leave
  // unset locally — `unknown` is fine.
  APP_VERSION: z.string().optional(),

  // --- Background jobs (BullMQ + Redis) ---
  REDIS_URL: z.string().default('redis://localhost:6379'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

/**
 * Decode + validate the credential-vault master key. Returns null when unset
 * (vault disabled). A set-but-wrong-length key is fatal — better a loud crash
 * than silently encrypting client passwords with a malformed key.
 */
function loadSocialVaultKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    console.error(
      `FATAL: SOCIAL_VAULT_KEY must decode to 32 bytes for AES-256 (got ${key.length}). ` +
        'Generate one with: openssl rand -base64 32',
    );
    process.exit(1);
  }
  return key;
}
const socialVaultKey = loadSocialVaultKey(env.SOCIAL_VAULT_KEY);

// -----------------------------------------------------------------------------
// Production fail-fast: things that are optional in the zod schema (because
// dev should work zero-config) but are mandatory once we're shipping to real
// users. Listing them here keeps the schema clean while still forcing a noisy
// startup crash instead of silent "email_provider_unconfigured" 500s on day
// one of production.
//
// `pnpm --filter @bdt/api test` runs with NODE_ENV=test, so this block is
// a no-op under the test suite.
// -----------------------------------------------------------------------------

if (env.NODE_ENV === 'production') {
  const required: Array<keyof typeof env> = [
    'DATABASE_URL',
    'JWT_SECRET',
    'RESEND_API_KEY',
    'RESEND_FROM',
    'REDIS_URL',
    'ALLOWED_ORIGINS',
    'PUBLIC_APP_URL',
  ];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    console.error(
      'FATAL: production startup missing required env vars:',
      missing.join(', '),
    );
    process.exit(1);
  }
  // Stripe is optional at startup. If you set any STRIPE_* var, set them all —
  // a partial config produces confusing failures.
  const stripeKeys: Array<keyof typeof env> = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PREMIUM_PRICE_ID',
  ];
  const stripeSet = stripeKeys.filter((k) => env[k]);
  if (stripeSet.length > 0 && stripeSet.length < stripeKeys.length) {
    const missingStripe = stripeKeys.filter((k) => !env[k]);
    console.error(
      'FATAL: partial Stripe config in production — set all or none:',
      missingStripe.join(', '),
    );
    process.exit(1);
  }
}

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.API_PORT,
  publicUrl: env.API_PUBLIC_URL,
  db: {
    url: env.DATABASE_URL,
    maxConnections: env.DATABASE_MAX_CONNECTIONS,
  },
  jwt: {
    /** Legacy single-secret. Kept for backwards compatibility — new code paths
     *  prefer `accessSecret` / `refreshSecret` below. */
    secret: env.JWT_SECRET,
    accessSecret:  env.ACCESS_TOKEN_SECRET  ?? env.JWT_SECRET,
    refreshSecret: env.REFRESH_TOKEN_SECRET ?? env.JWT_SECRET,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL,
    /** Hard-coded JWT registered claims — used by both signer + verifier so
     *  a token minted for a different audience or issuer is rejected. */
    issuer:   'bdt-connect-api',
    audience: 'bdt-connect-client',
  },
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    priceIds: {
      premium: env.STRIPE_PREMIUM_PRICE_ID,
    },
  },
  /** True when all the Stripe config needed to run real billing is present.
   *  Routes that hit Stripe gate on this and return 503 when false. */
  billingEnabled: Boolean(
    env.STRIPE_SECRET_KEY &&
    env.STRIPE_PREMIUM_PRICE_ID,
  ),
  resend: {
    apiKey: env.RESEND_API_KEY,
    from: env.RESEND_FROM,
  },
  /** Social-account credential vault. `enabled` gates credential-storage
   *  endpoints (they return `vault_unavailable` when false); the delegated-
   *  access + create-for-me flows never need a key. `key` is the AES-256
   *  master key (32 bytes) or null. */
  socialVault: {
    enabled: socialVaultKey !== null,
    key: socialVaultKey,
  },
  /** Supabase Storage for request attachments. `enabled` gates the upload
   *  endpoint (503 `storage_unavailable` when false). */
  storage: {
    enabled: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
    url: env.SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: env.SUPABASE_STORAGE_BUCKET,
  },
  publicAppUrl: env.PUBLIC_APP_URL,
  logLevel: env.LOG_LEVEL,
  sentryDsn: env.SENTRY_DSN,
  redis: {
    url: env.REDIS_URL,
  },
  worker: {
    concurrency: env.WORKER_CONCURRENCY,
  },
  cors: {
    // Empty array = "no explicit allowlist". The server uses this to decide
    // whether to lock down origins or stay permissive.
    allowedOrigins: env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
  },
  appVersion: env.APP_VERSION ?? 'unknown',
} as const;
