import { z } from 'zod';
import { PROVINCE_BY_CODE } from '@/shared/provinces';

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

const trainingProgramSchema = z.object({
  title: z.string().max(120, 'Program title must be less than 120 characters').optional(),
  desc: z.string().max(500, 'Program description must be less than 500 characters').optional(),
});

const trainingSectionSchema = z.object({
  description: z.string().max(5000, 'Training/introduction description must be less than 5000 characters').optional(),
  image: z.string().url('Invalid training/introduction image URL').optional(),
  workforceSize: z.string().max(120, 'Workforce size must be less than 120 characters').optional(),
  // Keep for backward compatibility with old payloads
  budget: z.string().max(120, 'Training budget must be less than 120 characters').optional(),
  programs: z.array(trainingProgramSchema).optional(),
});

// Helper để chấp nhận empty string hoặc null cho các trường optional
// Nếu là empty string hoặc null thì không validate format, nếu có giá trị thì validate
const optionalString = (maxLength?: number) => 
  z.preprocess(
    (val) => val === "" ? null : val,
    z.string().max(maxLength || 10000, `Must be less than ${maxLength || 10000} characters`).nullable().optional()
  );

const optionalUrl = () => 
  z.preprocess(
    (val) => val === "" ? null : val,
    z.union([
      z.string().url('Invalid URL'),
      z.null(),
    ]).optional()
  );

const optionalEmail = () => 
  z.preprocess(
    (val) => val === "" ? null : val,
    z.union([
      z.string().email('Invalid email address').max(200, 'Email must be less than 200 characters'),
      z.null(),
    ]).optional()
  );

const optionalLocationCode = () =>
  z.preprocess(
    (val) => (val === '' ? null : val),
    z
      .string()
      .regex(/^[a-z0-9-]+$/, 'Invalid location code format')
      .refine((code) => PROVINCE_BY_CODE.has(code), 'Unknown location code')
      .nullable()
      .optional(),
  );

const baseCompanySchema = {
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  legalName: optionalString(200),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  tagline: optionalString(150),
  description: optionalString(10000),
  logoUrl: optionalUrl(),
  coverUrl: optionalUrl(),
  website: optionalUrl(),
  location: optionalLocationCode(),
  email: optionalEmail(),
  phone: optionalString(50),
  industry: optionalString(200),
  size: z.string().max(20, 'Size must be less than 20 characters').optional(),
  foundedYear: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  headcount: z.number().int().min(1, 'Headcount must be a positive number').max(200000, 'Headcount is unrealistically high').optional(),
  headcountNote: z.string().max(200, 'Headcount note must be less than 200 characters').optional(),
  metrics: z.array(metricSchema).optional(),
  profileStory: z.array(storyBlockSchema).optional(),
  highlights: highlightsSchema.optional(),
};

// Create company schema
export const createCompanySchema = z.object({
  ...baseCompanySchema,
  legalName: z.string().min(2, 'Legal name must be at least 2 characters').max(200, 'Legal name must be less than 200 characters'),
});

// Update company schema
export const updateCompanySchema = z.object({
  ...Object.entries(baseCompanySchema).reduce<Record<string, z.ZodTypeAny>>((acc, [key, schema]) => {
    acc[key] = (schema as z.ZodTypeAny).optional();
    return acc;
  }, {}),
  // Flag to request re-verification when legal name changes on a verified company
  requestReVerification: z.boolean().optional(),
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
  location: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Invalid location code format')
    .refine((code) => PROVINCE_BY_CODE.has(code), 'Unknown location code')
    .optional(),
  size: z.string().max(20).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// Add company member schema
export const addCompanyMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']).default('MEMBER'),
});

// Update company member schema
export const updateCompanyMemberSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
});

// Update Company Profile Schema (JSON fields are loose for flexibility, but could be tighter)
export const updateCompanyProfileSchema = z.object({
  stats: z.array(z.any()).optional(),
  vision: z.string().optional(),
  mission: z.string().optional(),
  coreValues: z.string().optional(),
  leadershipPhilosophy: z.any().optional(),
  products: z.any().optional(),
  recruitmentPrinciples: z.any().optional(),
  benefits: z.any().optional(),
  hrJourney: z.any().optional(),
  careerPath: z.any().optional(),
  salaryAndBonus: z.any().optional(),
  training: trainingSectionSchema.optional(),
  gallery: z.array(z.object({
    url: z.string(),
    type: z.enum(['image', 'video']),
    caption: z.string().max(200).optional(),
  })).optional(),
  leaders: z.any().optional(),
  story: z.any().optional(),
  culture: z.any().optional(),
  awards: z.any().optional(),
  sectionVisibility: z.record(z.string(), z.boolean()).optional(), // Map section keys to visibility boolean (Zod v4 syntax)
});

// Upload verification contacts CSV
export const uploadVerificationContactsCsvSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileType: z.string().min(1, 'File type is required'),
  fileData: z.string().min(1, 'File data (base64) is required'),
  listName: z.string().max(200).optional(),
});

// Send company statements for verification
export const sendCompanyStatementsSchema = z.object({
  listId: z.string().min(1, 'Verification list ID is required').optional(),
  statements: z
    .array(
      z.object({
        title: z.string().min(3, 'Tiêu đề tuyên bố phải có ít nhất 3 ký tự'),
        description: z.string().max(2000).optional(),
        isPublic: z.boolean().optional().default(true),
      }),
    )
    .min(1, 'Cần ít nhất 1 tuyên bố'),
});

// Reorder company statements
export const reorderCompanyStatementsSchema = z.object({
  orders: z.array(
    z.object({
      id: z.string().min(1, 'Statement ID is required'),
      order: z.number().int().min(0, 'Order must be non-negative'),
    }),
  ),
});

// Create post from statement
export const createPostFromStatementSchema = z.object({
  statementId: z.string().min(1, 'Statement ID is required'),
  content: z.string().max(10000, 'Content must be less than 10000 characters').optional(),
  type: z.enum(['STORY', 'ANNOUNCEMENT', 'EVENT', 'STATEMENT']).default('STATEMENT').optional(),
});

// Types
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type GetCompanyInput = z.infer<typeof getCompanySchema>;
export type GetCompanySummaryInput = z.infer<typeof getCompanySummarySchema>;
export type SearchCompaniesInput = z.infer<typeof searchCompaniesSchema>;
export type AddCompanyMemberInput = z.infer<typeof addCompanyMemberSchema>;
export type UpdateCompanyMemberInput = z.infer<typeof updateCompanyMemberSchema>;
export type UpdateCompanyProfileInput = z.infer<typeof updateCompanyProfileSchema>;
export type UploadVerificationContactsCsvInput = z.infer<typeof uploadVerificationContactsCsvSchema>;
export type SendCompanyStatementsInput = z.infer<typeof sendCompanyStatementsSchema>;
export type ReorderCompanyStatementsInput = z.infer<typeof reorderCompanyStatementsSchema>;
export type CreatePostFromStatementInput = z.infer<typeof createPostFromStatementSchema>;

// List followers of a company
export const listCompanyFollowersSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
});
export type ListCompanyFollowersInput = z.infer<typeof listCompanyFollowersSchema>;
