import { CvFlipRequestStatus } from '@prisma/client';
import { z } from 'zod';

const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(50).default(20);

const csvToArray = (value: unknown): string[] | undefined => {
  if (typeof value !== 'string') return undefined;
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : undefined;
};

export const candidatesQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  keyword: z.string().trim().max(200).optional(),
  skills: z.preprocess(csvToArray, z.array(z.string().trim().min(1)).max(20).optional()),
  locations: z.preprocess(csvToArray, z.array(z.string().trim().min(1)).max(20).optional()),
  ward: z.string().trim().max(200).optional(),
  education: z.string().trim().max(200).optional(),
  salaryMin: z.coerce.number().int().min(0).optional(),
  salaryMax: z.coerce.number().int().min(0).optional(),
  salaryCurrency: z.enum(['VND', 'USD']).optional().default('VND'),
  workMode: z.string().trim().max(100).optional(),
});

export type CandidatesQuery = z.infer<typeof candidatesQuerySchema>;

export const candidateDetailQuerySchema = z.object({
  companyId: z.string().cuid().optional(),
});

export type CandidateDetailQuery = z.infer<typeof candidateDetailQuerySchema>;

export const flipBodySchema = z.object({
  companyId: z.string().cuid(),
  candidateUserId: z.string().cuid(),
});

export type FlipBody = z.infer<typeof flipBodySchema>;

export const usageQuerySchema = z.object({
  companyId: z.string().cuid(),
});

export type UsageQuery = z.infer<typeof usageQuerySchema>;

export const requestsQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  status: z.nativeEnum(CvFlipRequestStatus).optional(),
});

export type RequestsQuery = z.infer<typeof requestsQuerySchema>;

export const respondRequestBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
});

export type RespondRequestBody = z.infer<typeof respondRequestBodySchema>;
