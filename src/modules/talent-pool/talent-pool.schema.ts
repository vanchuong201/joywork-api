import { TalentPoolRequestStatus, TalentPoolMemberStatus } from '@prisma/client';
import { z } from 'zod';

const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

// ── Candidate ──

export const createRequestBodySchema = z.object({
  message: z.string().trim().max(2000).optional(),
});

export type CreateRequestBody = z.infer<typeof createRequestBodySchema>;

// ── Admin: requests ──

export const adminRequestsQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  status: z.nativeEnum(TalentPoolRequestStatus).optional(),
  q: z.string().trim().max(200).optional(),
});

export type AdminRequestsQuery = z.infer<typeof adminRequestsQuerySchema>;

export const adminRejectBodySchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export type AdminRejectBody = z.infer<typeof adminRejectBodySchema>;

// ── Admin: members ──

export const adminMembersQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: z.string().trim().max(200).optional(),
  status: z.nativeEnum(TalentPoolMemberStatus).optional(),
});

export type AdminMembersQuery = z.infer<typeof adminMembersQuerySchema>;

export const adminAddMemberBodySchema = z.object({
  email: z.string().trim().email(),
  reason: z.string().trim().min(1).max(2000),
});

export type AdminAddMemberBody = z.infer<typeof adminAddMemberBodySchema>;

export const adminRemoveMemberBodySchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export type AdminRemoveMemberBody = z.infer<typeof adminRemoveMemberBodySchema>;

export const adminLookupQuerySchema = z.object({
  email: z.string().trim().email(),
});

export type AdminLookupQuery = z.infer<typeof adminLookupQuerySchema>;

// ── Admin: entitlements ──

export const adminEntitlementsQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: z.string().trim().max(200).optional(),
  enabled: z.coerce.boolean().optional(),
});

export type AdminEntitlementsQuery = z.infer<typeof adminEntitlementsQuerySchema>;

export const adminToggleEntitlementBodySchema = z.object({
  enabled: z.boolean(),
});

export type AdminToggleEntitlementBody = z.infer<typeof adminToggleEntitlementBodySchema>;

// ── Company: candidates list ──

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
  q: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  ward: z.string().trim().max(200).optional(),
  // Updated filters
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  yearOfBirthMin: z.coerce.number().int().min(1900).max(2100).optional(),
  yearOfBirthMax: z.coerce.number().int().min(1900).max(2100).optional(),
  educationLevels: z.preprocess(csvToArray, z.array(z.enum(['TRAINING_CENTER', 'INTERMEDIATE', 'COLLEGE', 'BACHELOR', 'MASTER', 'PHD'])).max(6).optional()),
});

export type CandidatesQuery = z.infer<typeof candidatesQuerySchema>;
