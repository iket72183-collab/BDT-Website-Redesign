import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request } from 'express';

/**
 * Per-IP limit for unauthenticated routes (login, register, public booking
 * lookup, Stripe webhook bypass not — webhooks use the relaxed limiter).
 */
export const publicLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'rate_limited' },
});

/**
 * Per-user limit for authenticated routes — keyed by the JWT `sub` claim so
 * a single user can't fan out across IPs. Falls back to IP if unauth.
 */
export const authedLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.auth?.sub ?? req.ip ?? 'anonymous',
  message: { success: false, error: 'rate_limited' },
});

/** Keep a single authenticated client from flooding the agency inbox. */
export const messageLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.auth?.sub ?? req.ip ?? 'anonymous',
  message: {
    success: false,
    error: 'Too many messages. Please wait before sending another.',
    code: 'message_rate_limited',
  },
});

/**
 * Tight limit for password-reset + login attempts to slow credential stuffing.
 * Apply per-route ON TOP OF `publicLimiter`.
 */
export const authAttemptsLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000 * 15,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'too_many_attempts' },
});

/** Webhooks: high ceiling, Stripe is the only legit caller. */
export const webhookLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 2000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
