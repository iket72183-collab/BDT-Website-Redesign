import { z } from 'zod';
import { BusinessType } from '@prisma/client';
import { passwordSchema, phoneSchema } from './shared.js';

export const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: passwordSchema,
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: phoneSchema.optional(),

  // New-client signup: business owner registers themselves alongside a tenant
  // record we use to organize their agency engagement.
  tenant: z.object({
    slug: z.string().regex(/^[a-z0-9-]{3,40}$/, 'lowercase letters/digits/hyphens, 3-40 chars'),
    businessName: z.string().min(2).max(120),
    /** Optional — context only, not enforced on routing. */
    businessType: z.nativeEnum(BusinessType).optional(),
  }),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
  tenantSlug: z.string().optional(), // omit for platform admin
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
  tenantSlug: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
