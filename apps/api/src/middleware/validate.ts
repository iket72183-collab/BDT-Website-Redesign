import type { Request, RequestHandler } from 'express';
import type { ZodSchema, ZodTypeAny } from 'zod';

interface Shape {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Zod request validator. Parses the chosen request pieces and replaces
 * `req.body` / `req.query` / `req.params` with the parsed (and coerced)
 * values so handlers get type-safe inputs.
 *
 * Usage:
 *   router.post('/', validate({ body: createBookingSchema }), handler);
 */
export const validate =
  (shape: Shape): RequestHandler =>
  (req, _res, next) => {
    if (shape.body)   req.body   = parse(shape.body, req.body);
    if (shape.query)  req.query  = parse(shape.query, req.query) as Request['query'];
    if (shape.params) req.params = parse(shape.params, req.params) as Request['params'];
    next();
  };

function parse<T extends ZodTypeAny>(schema: T, data: unknown): unknown {
  return schema.parse(data);
}
