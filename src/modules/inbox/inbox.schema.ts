import { z } from 'zod';

// Send message schema
export const sendMessageSchema = z.object({
  applicationId: z.string().cuid('Invalid application ID'),
  content: z.string().min(1, 'Message content is required').max(2000, 'Message content must be less than 2000 characters'),
  messageType: z.enum(['TEXT', 'FILE', 'IMAGE']).default('TEXT'),
  fileUrl: z.string().url('Invalid file URL').optional(),
});

// Get messages schema
export const getMessagesSchema = z.object({
  applicationId: z.string().cuid('Invalid application ID'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// Get conversations schema
export const getConversationsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// Mark message as read schema
export const markMessageReadSchema = z.object({
  messageId: z.string().cuid('Invalid message ID'),
});

// Mark conversation as read schema
export const markConversationReadSchema = z.object({
  applicationId: z.string().cuid('Invalid application ID'),
});

// Get unread count schema
export const getUnreadCountSchema = z.object({
  applicationId: z.string().cuid('Invalid application ID').optional(),
});

// Types
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetMessagesInput = z.infer<typeof getMessagesSchema>;
export type GetConversationsInput = z.infer<typeof getConversationsSchema>;
export type MarkMessageReadInput = z.infer<typeof markMessageReadSchema>;
export type MarkConversationReadInput = z.infer<typeof markConversationReadSchema>;
export type GetUnreadCountInput = z.infer<typeof getUnreadCountSchema>;
