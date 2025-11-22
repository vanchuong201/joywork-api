import { z } from 'zod';

const metricSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Metric label is required'),
  value: z.string().min(1, 'Metric value is required'),
  description: z.string().max(200, 'Metric description must be less than 200 characters').optional(),
  icon: z.string().max(100, 'Icon identifier must be less than 100 characters').optional(),
});

const storyStatSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Statistic label is required'),
  value: z.string().min(1, 'Statistic value is required'),
  description: z.string().max(200, 'Statistic description must be less than 200 characters').optional(),
});

const storyMediaSchema = z.object({
  id: z.string().optional(),
  url: z.string().url('Invalid media URL'),
  caption: z.string().max(200, 'Media caption must be less than 200 characters').optional(),
});

const storyBlockSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['text', 'list', 'quote', 'stats', 'media']).default('text'),
  title: z.string().max(120, 'Section title must be less than 120 characters').optional(),
  subtitle: z.string().max(200, 'Section subtitle must be less than 200 characters').optional(),
  body: z.string().max(5000, 'Section content must be less than 5000 characters').optional(),
  items: z.array(z.string().max(500, 'List item must be less than 500 characters')).optional(),
  stats: z.array(storyStatSchema).optional(),
  quote: z
    .object({
      text: z.string().min(1, 'Quote text is required'),
      author: z.string().max(120, 'Author name must be less than 120 characters').optional(),
      role: z.string().max(120, 'Author role must be less than 120 characters').optional(),
    })
    .optional(),
  media: z.array(storyMediaSchema).optional(),
});

const highlightsSchema = z.array(
  z.object({
    id: z.string().optional(),
    label: z.string().min(1, 'Highlight label is required'),
    description: z.string().max(200, 'Highlight description must be less than 200 characters').optional(),
  }),
);

const baseCompanySchema = {
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  tagline: z.string().max(150, 'Tagline must be less than 150 characters').optional(),
  description: z.string().max(10000, 'Description must be less than 10000 characters').optional(),
  logoUrl: z.string().url('Invalid logo URL').optional(),
  coverUrl: z.string().url('Invalid cover URL').optional(),
  website: z.string().url('Invalid website URL').optional(),
  location: z.string().max(120, 'Location must be less than 120 characters').optional(),
  industry: z.string().max(80, 'Industry must be less than 80 characters').optional(),
  size: z.enum(['STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional(),
  foundedYear: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  headcount: z.number().int().min(1, 'Headcount must be a positive number').max(200000, 'Headcount is unrealistically high').optional(),
  headcountNote: z.string().max(200, 'Headcount note must be less than 200 characters').optional(),
  metrics: z.array(metricSchema).optional(),
  profileStory: z.array(storyBlockSchema).optional(),
  highlights: highlightsSchema.optional(),
};

// Create company schema
export const createCompanySchema = z.object(baseCompanySchema);

// Update company schema
export const updateCompanySchema = z.object({
  ...Object.entries(baseCompanySchema).reduce<Record<string, z.ZodTypeAny>>((acc, [key, schema]) => {
    acc[key] = (schema as z.ZodTypeAny).optional();
    return acc;
  }, {}),
});

// Get company schema
export const getCompanySchema = z.object({
  slug: z.string().min(1, 'Company slug is required'),
});

export const getCompanySummarySchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
});

// Search companies schema
export const searchCompaniesSchema = z.object({
  q: z.preprocess((val) => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed === '' ? undefined : trimmed;
    }
    return val;
  }, z.string().min(1, 'Search query is required').optional()),
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
export type GetCompanySummaryInput = z.infer<typeof getCompanySummarySchema>;
export type SearchCompaniesInput = z.infer<typeof searchCompaniesSchema>;
export type AddCompanyMemberInput = z.infer<typeof addCompanyMemberSchema>;
export type UpdateCompanyMemberInput = z.infer<typeof updateCompanyMemberSchema>;
