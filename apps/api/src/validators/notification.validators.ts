import { z } from 'zod';
import { paginationSchema } from './shared.js';

export const listNotificationsQuerySchema = paginationSchema.extend({
  unreadOnly: z.coerce.boolean().default(false),
});

export const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  marketing: z.boolean().optional(),
});
