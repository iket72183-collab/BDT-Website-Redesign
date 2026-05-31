import { z } from 'zod';

/** POST /api/push/register — body. */
export const registerTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
  deviceName: z.string().optional(),
});

/** DELETE /api/push/deregister — body. */
export const deregisterTokenSchema = z.object({
  token: z.string().min(1),
});
