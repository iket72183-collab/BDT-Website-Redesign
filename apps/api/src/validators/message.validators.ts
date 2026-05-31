import { z } from 'zod';
import { MessageStatus } from '@prisma/client';
import { paginationSchema } from './shared.js';

export const messageSchema = z.object({
  subject: z.string().trim().max(200).optional(),
  body: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message cannot exceed 2000 characters'),
});

export const listMessagesQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(MessageStatus).optional(),
});

export type MessageInput = z.infer<typeof messageSchema>;
