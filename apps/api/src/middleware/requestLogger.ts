import type { RequestHandler } from 'express';
import { logger } from '../lib/logger.js';

/**
 * Lightweight per-request log line — method, path, status, duration, plus
 * tenant + user id when the auth chain has already populated them. Pino is
 * doing the heavy lifting via `pino-http` in server.ts; this exists for the
 * structured per-request summary at request *end* with full context.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.info(
      {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(1)),
        tenantId: req.tenant?.id ?? null,
        userId: req.auth?.sub ?? null,
        ip: req.ip,
      },
      'req',
    );
  });
  next();
};
