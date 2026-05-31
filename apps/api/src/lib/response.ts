import type { Response } from 'express';

/**
 * Canonical API response envelope. Every route in `src/routes/*` returns
 * via `ok()` / `created()` / `paginated()` so clients can rely on a single
 * shape: { success, data?, error?, meta? }.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Pagination;
}
export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export function ok<T>(res: Response, data: T, meta?: Pagination): Response {
  const body: ApiSuccess<T> = meta ? { success: true, data, meta } : { success: true, data };
  return res.status(200).json(body);
}

export function created<T>(res: Response, data: T): Response {
  return res.status(201).json({ success: true, data } satisfies ApiSuccess<T>);
}

export function noContent(res: Response): Response {
  return res.status(204).end();
}

export function paginated<T>(res: Response, data: T[], meta: Pagination): Response {
  return ok(res, data, meta);
}
