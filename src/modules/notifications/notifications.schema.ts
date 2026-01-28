import { z } from 'zod';

export const getNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
    unreadOnly: z.coerce.boolean().default(false).optional(),
  }),
});

export const markAsReadSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const deleteNotificationSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});
