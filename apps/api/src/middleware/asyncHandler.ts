import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wrap an async route handler so a rejected promise reaches the Express
 * error middleware instead of becoming an unhandled rejection (the request
 * would hang, eventually time out, and never invoke the error handler).
 *
 * Express 5 catches async rejections natively, but we're on Express 4 — until
 * we upgrade, every async route handler must go through this wrapper.
 *
 *   router.get('/path', asyncHandler(async (req, res) => { … }));
 *
 * Synchronous throws are also forwarded — Express 4 catches those itself,
 * but routing them through `next` keeps the error-handler entry point
 * uniform.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
  };
