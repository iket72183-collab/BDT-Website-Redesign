import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { TenantContextError } from '../lib/tenantContext.js';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Global error handler. Every error path lands here and turns into the
 * canonical `{ success: false, error, code?, details? }` envelope so clients
 * have one shape to handle. Unknown errors are logged with the request id
 * and returned as a generic 500.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;

  if (err instanceof HttpError) {
    res.status(err.status).json({
      success: false,
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'validation_failed',
      code: 'validation_failed',
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof TenantContextError) {
    res.status(403).json({
      success: false,
      error: err.message,
      code: 'tenant_context_error',
    });
    return;
  }

  // Prisma's known error codes — map a few common ones to nicer statuses.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: 'duplicate',
        code: 'unique_constraint',
        details: { target: err.meta?.target },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, error: 'not_found', code: 'not_found' });
      return;
    }
  }

  logger.error({ err, path: req.path, method: req.method }, 'unhandled_error');
  res.status(500).json({ success: false, error: 'internal_error', code: 'internal_error' });
};
