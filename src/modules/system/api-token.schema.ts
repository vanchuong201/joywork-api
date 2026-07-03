import { z } from 'zod';

const VALID_SCOPES = ['read:overview', 'read:users', 'read:companies', 'read:jobs'] as const;

export const createApiTokenSchema = z.object({
  name: z.string().min(2).max(100),
  scopes: z.array(z.enum(VALID_SCOPES)).min(1, 'At least one scope required'),
  expiresAt: z.string().datetime().optional(),
});

export const updateApiTokenSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  scopes: z.array(z.enum(VALID_SCOPES)).min(1).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  enabled: z.boolean().optional(),
});

export const apiTokenParamSchema = z.object({
  id: z.string().cuid(),
});

export const validateApiTokenBodySchema = z.object({
  token: z.string().startsWith('jw_'),
});

export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>;
export type UpdateApiTokenInput = z.infer<typeof updateApiTokenSchema>;
export type ValidateApiTokenBody = z.infer<typeof validateApiTokenBodySchema>;
