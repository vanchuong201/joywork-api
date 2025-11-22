import { z } from 'zod';

export const createTicketSchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
  title: z.string().min(10).max(120),
  content: z.string().min(20).max(4000),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const listTicketsSchema = z.object({
  companyId: z.string().min(1).optional(),
  status: z.enum(['OPEN', 'RESPONDED', 'CLOSED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ListTicketsInput = z.infer<typeof listTicketsSchema>;

export const getTicketMessagesSchema = z.object({
  ticketId: z.string().min(1, 'ticketId is required'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GetTicketMessagesInput = z.infer<typeof getTicketMessagesSchema>;

export const sendTicketMessageSchema = z.object({
  ticketId: z.string().min(1),
  content: z.string().min(1).max(4000),
});

export type SendTicketMessageInput = z.infer<typeof sendTicketMessageSchema>;

export const updateTicketStatusSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(['OPEN', 'RESPONDED', 'CLOSED']),
});

export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;

