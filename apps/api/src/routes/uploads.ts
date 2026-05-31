import { Router, type Request, type RequestHandler } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { created, ok } from '../lib/response.js';
import { HttpError } from '../middleware/error.js';
import { getTenantId } from '../lib/tenantContext.js';
import * as uploadService from '../services/uploadService.js';
import { ALLOWED_MIME, MAX_FILE_SIZE } from '../services/uploadService.js';

/**
 * Client request-attachment uploads. Mounted under /api/uploads behind
 * verifyToken + tenantScope + requireSubscription. Files are parsed into memory
 * by multer (capped + MIME-filtered) and handed to uploadService → Supabase.
 */

/** multer fileFilter — accept allowed MIME types, reject the rest with 415. */
export const fileFilter: NonNullable<multer.Options['fileFilter']> = (_req, file, cb) => {
  if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
  else cb(new HttpError(415, 'Unsupported file type.', 'UNSUPPORTED_MEDIA_TYPE'));
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter,
});

/**
 * Normalize multer's own errors into our HttpError envelope. The size-limit
 * breach (LIMIT_FILE_SIZE) becomes 413; other multer errors → 400; non-multer
 * errors (e.g. the 415 thrown by fileFilter) pass through untouched.
 */
export function mapUploadError(err: unknown): unknown {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new HttpError(413, 'File too large (max 10MB).', 'FILE_TOO_LARGE');
    }
    return new HttpError(400, err.message, 'UPLOAD_ERROR');
  }
  return err;
}

/** Run multer for the single `file` field, mapping its errors. */
const acceptFile: RequestHandler = (req, res, next) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) next(mapUploadError(err));
    else next();
  });
};

/** Core handler — multer has parsed the file onto req.file by now. */
export async function handleRequestAttachment(req: Request): Promise<uploadService.UploadResult> {
  if (!req.file) throw new HttpError(400, 'No file provided.', 'NO_FILE');
  const tenantId = getTenantId();
  return uploadService.uploadFile(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype,
    tenantId,
  );
}

/**
 * Resolve a stored object `path` to a short-lived signed URL.
 *
 * The bucket is private, so reads can't hit a public URL — the client sends the
 * stored path and we sign it server-side with the service-role key. We first
 * confirm the path lives under the caller's own tenant folder
 * (`requests/{tenantId}/`) so one client can't fetch another tenant's files; a
 * `..` segment is rejected outright to defeat path-traversal past that prefix.
 */
export async function handleSignedUrl(req: Request): Promise<{ signedUrl: string }> {
  const path = typeof req.query.path === 'string' ? req.query.path : '';
  if (!path) throw new HttpError(400, 'A file path is required.', 'MISSING_PATH');

  const tenantId = getTenantId();
  const prefix = `requests/${tenantId}/`;
  if (!path.startsWith(prefix) || path.includes('..')) {
    throw new HttpError(403, 'You do not have access to this file.', 'FORBIDDEN_PATH');
  }

  const signedUrl = await uploadService.createSignedUrl(path);
  return { signedUrl };
}

export const uploadsRouter = Router();
uploadsRouter.use(requireRole('client'));

uploadsRouter.post(
  '/request-attachment',
  acceptFile,
  asyncHandler(async (req, res) => {
    created(res, await handleRequestAttachment(req));
  }),
);

uploadsRouter.get(
  '/signed-url',
  asyncHandler(async (req, res) => {
    ok(res, await handleSignedUrl(req));
  }),
);
