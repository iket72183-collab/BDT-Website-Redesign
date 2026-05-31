import { z } from 'zod';
import { SubscriptionTier } from '@prisma/client';
import { hexColorSchema } from './shared.js';

const webUrlSchema = z.string().url().refine((url) => {
  const protocol = new URL(url).protocol;
  return protocol === 'https:' || protocol === 'http:';
}, 'URL must use http or https protocol');

export const updateTenantSchema = z.object({
  businessName: z.string().min(2).max(120).optional(),
  logoUrl: webUrlSchema.optional().nullable(),
  brandColor: hexColorSchema.optional().nullable(),
});

/** Client-editable profile fields (their online presence). BDT updates these
 *  via the admin surface; the client can also tweak them. */
export const updateTenantProfileSchema = z.object({
  websiteUrl: webUrlSchema.nullable().optional(),
  instagramUrl: webUrlSchema.nullable().optional(),
  facebookUrl: webUrlSchema.nullable().optional(),
  tiktokUrl: webUrlSchema.nullable().optional(),
  googleBusinessUrl: webUrlSchema.nullable().optional(),
});

export const upgradeSubscriptionSchema = z.object({
  tier: z.nativeEnum(SubscriptionTier),
  /** Where Stripe should send the user back after the portal session. */
  returnUrl: webUrlSchema,
});
