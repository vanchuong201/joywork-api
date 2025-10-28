import { z } from 'zod';

// Create company schema
export const createCompanySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  tagline: z.string().max(100, 'Tagline must be less than 100 characters').optional(),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  logoUrl: z.string().url('Invalid logo URL').optional(),
  coverUrl: z.string().url('Invalid cover URL').optional(),
  website: z.string().url('Invalid website URL').optional(),
  location: z.string().max(100, 'Location must be less than 100 characters').optional(),
  industry: z.string().max(50, 'Industry must be less than 50 characters').optional(),
  size: z.enum(['STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional(),
  foundedYear: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
});

// Update company schema
export const updateCompanySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters').optional(),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
  tagline: z.string().max(100, 'Tagline must be less than 100 characters').optional(),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  logoUrl: z.string().url('Invalid logo URL').optional(),
  coverUrl: z.string().url('Invalid cover URL').optional(),
  website: z.string().url('Invalid website URL').optional(),
  location: z.string().max(100, 'Location must be less than 100 characters').optional(),
  industry: z.string().max(50, 'Industry must be less than 50 characters').optional(),
  size: z.enum(['STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional(),
  foundedYear: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
});

// Get company schema
export const getCompanySchema = z.object({
  slug: z.string().min(1, 'Company slug is required'),
});

// Search companies schema
export const searchCompaniesSchema = z.object({
  q: z.string().min(1, 'Search query is required').optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  size: z.enum(['STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// Add company member schema
export const addCompanyMemberSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']).default('MEMBER'),
});

// Update company member schema
export const updateCompanyMemberSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
});

// Types
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type GetCompanyInput = z.infer<typeof getCompanySchema>;
export type SearchCompaniesInput = z.infer<typeof searchCompaniesSchema>;
export type AddCompanyMemberInput = z.infer<typeof addCompanyMemberSchema>;
export type UpdateCompanyMemberInput = z.infer<typeof updateCompanyMemberSchema>;
