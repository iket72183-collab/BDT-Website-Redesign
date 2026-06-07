import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { config } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error.js';
import { requestLogger } from './middleware/requestLogger.js';
import { verifyToken } from './middleware/verifyToken.js';
import { tenantScope } from './middleware/tenantScope.js';
import { requireSubscription } from './middleware/requireSubscription.js';
import { authedLimiter } from './middleware/rateLimiter.js';

import { authRouter }          from './routes/auth.js';
import { tenantRouter }        from './routes/tenant.js';
import { usersRouter }         from './routes/users.js';
import { stripeRouter }        from './routes/stripe.js';
import { webhooksRouter }      from './routes/webhooks.js';
import { notificationsRouter } from './routes/notifications.js';
import { pushRouter }          from './routes/push.js';
import { adminRouter }         from './routes/admin.js';
import { adminRequestsRouter } from './routes/admin/requests.js';
import { adminSocialAccountsRouter } from './routes/admin/socialAccounts.js';
import { messagesRouter }      from './routes/messages.js';
import { requestsRouter }      from './routes/requests.js';
import { socialAccountsRouter } from './routes/socialAccounts.js';
import { uploadsRouter }       from './routes/uploads.js';

/**
 * Express app composition. Middleware order is load-bearing — read top to bottom:
 *
 *   1. Security headers + CORS + cookie parsing
 *   2. Request logger
 *   3. Stripe webhook FIRST (needs raw body, must precede express.json)
 *   4. JSON body parser
 *   5. Public, no-auth routes (auth, /health)
 *   6. Authed-but-no-tenant: `/api/admin` (platform admins)
 *   7. Authed + tenant-scoped: everything else
 *   8. Global error handler
 */
export function createServer(): Express {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(buildCorsOptions()));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: false }));
  app.use(requestLogger);

  // 3. STRIPE WEBHOOKS — raw body, no auth, no JSON parsing.
  app.use('/api/webhooks', webhooksRouter);

  // 4. JSON body parser for everything else.
  app.use(express.json({ limit: '1mb' }));

  // 5. PUBLIC routes (no auth required).
  //    Health check is what Railway hits to confirm a deployment is live; the
  //    payload includes a version so we can tell which build is serving. It's
  //    lightweight (no DB/Redis calls) so it returns 200 the moment the
  //    process is up. Exposed at both /health and /api/health — the latter is
  //    Railway's configured healthcheckPath. Both MUST be registered before
  //    the `/api` auth middleware below or they'd 401.
  const health = (_req: express.Request, res: express.Response): void => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: config.appVersion,
    });
  };
  app.get('/health', health);
  app.get('/api/health', health);
  app.use('/api/auth', authRouter);

  // 6. PLATFORM ADMIN — auth required but NO tenant scope (cross-tenant).
  //    Mount the specific /requests sub-surface before the catch-all admin
  //    router so its routes win.
  app.use('/api/admin/requests', verifyToken, authedLimiter, tenantScope, adminRequestsRouter);
  app.use('/api/admin/social-accounts', verifyToken, authedLimiter, tenantScope, adminSocialAccountsRouter);
  app.use('/api/admin', verifyToken, authedLimiter, tenantScope, adminRouter);

  // 7. TENANT-SCOPED routes.
  app.use('/api', verifyToken, authedLimiter, tenantScope);

  // 7a. Stripe routes — must work even when the subscription is past_due
  //     (so the client can update their card). No requireSubscription gate.
  app.use('/api/stripe', stripeRouter);
  // Push registration must also work during onboarding so the same signed-in
  // user starts receiving updates once their subscription is confirmed.
  app.use('/api/push', pushRouter);

  // 7b. Everything else for authed clients goes behind requireSubscription:
  //     blocks past_due / cancelled / suspended / unverified-email accounts
  //     from poking at the app surface while still letting them fix billing.
  // Reading the tenant is needed to resume unfinished onboarding. Mutations
  // and subscription data remain gated until card setup is complete.
  app.use('/api/tenant',        (req, res, next) => {
    if (req.method === 'GET' && req.path === '/') return next();
    return requireSubscription(req, res, next);
  }, tenantRouter);
  app.use('/api/users',         requireSubscription, usersRouter);
  app.use('/api/messages',      requireSubscription, messagesRouter);
  app.use('/api/notifications', requireSubscription, notificationsRouter);
  app.use('/api/requests',      requireSubscription, requestsRouter);
  app.use('/api/social-accounts', requireSubscription, socialAccountsRouter);
  app.use('/api/uploads',         requireSubscription, uploadsRouter);

  // 8. Global error handler.
  app.use(errorHandler);

  return app;
}

/**
 * Build a CORS options object. Two modes:
 *
 *   - **Allowlist** (production): `ALLOWED_ORIGINS` env is set. Only those
 *     exact origins can call us with credentials. Cross-origin requests from
 *     anywhere else get blocked at the browser. Server-to-server callers
 *     (Stripe webhooks, mobile app, monitoring) have no `Origin` header at
 *     all, so they pass through untouched.
 *
 *   - **Permissive** (dev): no allowlist configured. We reflect whatever
 *     origin sent the request — keeps `localhost:3000` ↔ `localhost:4000`
 *     working without a config dance. Never ship to prod without setting
 *     ALLOWED_ORIGINS.
 */
function buildCorsOptions(): CorsOptions {
  const allowed = config.cors.allowedOrigins;
  if (allowed.length === 0) {
    return { origin: true, credentials: true };
  }
  return {
    credentials: true,
    origin(origin, callback) {
      // No origin → server-to-server / mobile native / curl. Always allow.
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      logger.warn({ origin }, 'cors.origin_rejected');
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
  };
}
