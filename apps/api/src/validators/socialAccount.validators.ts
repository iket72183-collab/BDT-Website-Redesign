import { z } from 'zod';
import { SocialPlatform, SocialAccessMethod, SocialAccountStatus } from '@prisma/client';
import { paginationSchema } from './shared.js';

export const createSocialAccountSchema = z.object({
  platform: z.nativeEnum(SocialPlatform),
  handle: z.string().trim().max(120).optional(),
  accessMethod: z.nativeEnum(SocialAccessMethod),
  notes: z.string().trim().max(1000).optional(),
});

export const updateSocialAccountSchema = z.object({
  handle: z.string().trim().max(120).optional(),
  status: z.nativeEnum(SocialAccountStatus).optional(),
  notes: z.string().trim().max(1000).optional(),
  accessMethod: z.nativeEnum(SocialAccessMethod).optional(),
});

export const setCredentialsSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(200),
  // Not trimmed — leading/trailing whitespace can be part of a real password.
  password: z.string().min(1, 'Password is required').max(400),
});

// --- Admin-facing (platform_admin) -----------------------------------------

export const adminListSocialAccountsQuerySchema = paginationSchema.extend({
  tenantId: z.string().uuid().optional(),
  platform: z.nativeEnum(SocialPlatform).optional(),
  status: z.nativeEnum(SocialAccountStatus).optional(),
});

export const updateSocialAccountStatusSchema = z.object({
  status: z.nativeEnum(SocialAccountStatus),
});
