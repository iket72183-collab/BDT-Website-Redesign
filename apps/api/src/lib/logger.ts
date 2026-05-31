import pino from 'pino';
import { createRequire } from 'node:module';
import { config } from '../config/env.js';

/**
 * In development we pretty-print via the `pino-pretty` transport — but only
 * when it's actually installed. It's an optional dev-only dependency, so a
 * missing module must degrade to plain JSON logging rather than crash the API
 * at boot (pino throws synchronously if a transport target can't be resolved).
 */
function devTransport(): { target: string; options: { colorize: boolean } } | undefined {
  if (config.nodeEnv !== 'development') return undefined;
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return { target: 'pino-pretty', options: { colorize: true } };
  } catch {
    return undefined;
  }
}

const transport = devTransport();
export const logger = pino({
  level: config.logLevel,
  ...(transport ? { transport } : {}),
});
