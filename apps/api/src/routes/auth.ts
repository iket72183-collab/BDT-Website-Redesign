import type { Request } from 'express';
import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { authAttemptsLimiter, publicLimiter } from '../middleware/rateLimiter.js';
import * as authService from '../services/authService.js';
import { created, noContent, ok } from '../lib/response.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/auth.validators.js';

export const authRouter = Router();

const REFRESH_COOKIE = 'bdt_refresh';
const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
  // 30 days; mirrors JWT_REFRESH_TTL. Re-derive if you make refresh TTL dynamic.
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

/** Pull UA + IP for the refresh_tokens audit row. */
function refreshMeta(req: Request) {
  return {
    userAgent: req.header('user-agent') ?? undefined,
    ip: req.ip ?? undefined,
  };
}

authRouter.post(
  '/register',
  publicLimiter,
  authAttemptsLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body, refreshMeta(req));
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOpts);
    created(res, { user: result.user, accessToken: result.accessToken });
  }),
);

authRouter.post(
  '/login',
  publicLimiter,
  authAttemptsLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body, refreshMeta(req));
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOpts);
    ok(res, { user: result.user, accessToken: result.accessToken });
  }),
);

authRouter.post(
  '/refresh',
  publicLimiter,
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) {
      res.status(401).json({ success: false, error: 'no_refresh_cookie', code: 'no_refresh_cookie' });
      return;
    }
    try {
      const result = await authService.refresh(token, refreshMeta(req));
      res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOpts);
      ok(res, { user: result.user, accessToken: result.accessToken });
    } catch (err) {
      // Reuse / unknown jti → clear the cookie so the bad value isn't replayed.
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      throw err;
    }
  }),
);

authRouter.post(
  '/logout',
  verifyToken,
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await authService.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    noContent(res);
  }),
);

authRouter.post(
  '/forgot-password',
  publicLimiter,
  authAttemptsLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(async (req, res) => {
    await authService.forgotPassword(req.body.email, req.body.tenantSlug);
    // Always 200, never leak whether the email exists.
    ok(res, { sent: true });
  }),
);

authRouter.post(
  '/reset-password',
  publicLimiter,
  authAttemptsLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body.token, req.body.password);
    noContent(res);
  }),
);

authRouter.patch(
  '/verify-email',
  verifyToken,
  validate({ body: verifyEmailSchema }),
  asyncHandler(async (req, res) => {
    await authService.verifyEmail(req.body.token, req.auth!.sub);
    noContent(res);
  }),
);

// Resend verification email — handy when the original link expires or the
// user lost it. Idempotent (issuing a new token invalidates the prior one).
authRouter.post(
  '/verify-email/resend',
  verifyToken,
  asyncHandler(async (req, res) => {
    await authService.resendEmailVerification(req.auth!.sub);
    noContent(res);
  }),
);

authRouter.get(
  '/me',
  verifyToken,
  asyncHandler(async (req, res) => {
    const user = await authService.me(req.auth!.sub);
    ok(res, user);
  }),
);
