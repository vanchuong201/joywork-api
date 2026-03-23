import { UserAccountStatus } from '@prisma/client';
import { z } from 'zod';

const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

export const adminUsersQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: z.string().trim().max(200).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  accountStatus: z.nativeEnum(UserAccountStatus).optional(),
});

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export const adminCompaniesQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: z.string().trim().max(200).optional(),
  verificationStatus: z.enum(['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED']).optional(),
});

export type AdminCompaniesQuery = z.infer<typeof adminCompaniesQuerySchema>;

export const adminReportTimeseriesQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
});

export type AdminReportTimeseriesQuery = z.infer<typeof adminReportTimeseriesQuerySchema>;

export const adminUserAccountPatchSchema = z.object({
  accountStatus: z.nativeEnum(UserAccountStatus),
});

export type AdminUserAccountPatch = z.infer<typeof adminUserAccountPatchSchema>;
