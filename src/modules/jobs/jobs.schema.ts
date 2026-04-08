import { z } from 'zod';
import { PROVINCE_BY_CODE } from '@/shared/provinces';
import { WARD_BY_CODE, WARD_CODE_PATTERN } from '@/shared/wards';

const locationCodeSchema = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'Invalid location code format')
  .refine((code) => PROVINCE_BY_CODE.has(code), 'Unknown location code');

const wardCodeSchema = z
  .string()
  .regex(WARD_CODE_PATTERN, 'Invalid ward code format')
  .refine((code) => WARD_BY_CODE.has(code), 'Unknown ward code');

// Create job schema - Standard JD format
export const createJobSchema = z.object({
  // Basic info
  title: z.string().min(1, 'Job title is required').max(200, 'Job title must be less than 200 characters'),
  location: locationCodeSchema.optional(),
  locations: z.array(locationCodeSchema).max(20, 'Maximum 20 locations allowed').optional(),
  wardCodes: z.array(wardCodeSchema).max(30, 'Maximum 30 wards allowed').optional(),
  remote: z.boolean().default(false),
  salaryMin: z.number().int().min(0).optional(),
  salaryMax: z.number().int().min(0).optional(),
  currency: z.string().length(3).default('VND'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE']).default('FULL_TIME'),
  experienceLevel: z.enum(['NO_EXPERIENCE', 'LT_1_YEAR', 'Y1_2', 'Y2_3', 'Y3_5', 'Y5_10', 'GT_10']).default('NO_EXPERIENCE'),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed').optional(),
  applicationDeadline: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  // Header fields
  department: z.string().max(100, 'Department must be less than 100 characters').optional(),
  jobLevel: z.enum(['INTERN_STUDENT', 'FRESH_GRAD', 'EMPLOYEE', 'SPECIALIST_TEAM_LEAD', 'MANAGER_HEAD', 'DIRECTOR', 'EXECUTIVE']).optional(),
  educationLevel: z.enum(['NONE', 'HIGH_SCHOOL', 'COLLEGE', 'BACHELOR', 'MASTER', 'PHD']).optional(),
  
  // Required JD fields (rich text/markdown)
  generalInfo: z.string().max(5000, 'Thông tin bổ sung must be less than 5000 characters').optional(),
  mission: z.string().min(1, 'Sứ mệnh/Vai trò is required').max(5000, 'Sứ mệnh/Vai trò must be less than 5000 characters'),
  tasks: z.string().min(1, 'Nhiệm vụ chuyên môn is required').max(10000, 'Nhiệm vụ chuyên môn must be less than 10000 characters'),
  knowledge: z.string().min(1, 'Kiến thức chuyên môn is required').max(5000, 'Kiến thức chuyên môn must be less than 5000 characters'),
  skills: z.string().min(1, 'Kỹ năng cần thiết is required').max(5000, 'Kỹ năng cần thiết must be less than 5000 characters'),
  attitude: z.string().min(1, 'Thái độ và phẩm chất is required').max(5000, 'Thái độ và phẩm chất must be less than 5000 characters'),
  
  // Optional JD fields
  kpis: z.string().max(5000, 'Kết quả chuyên môn must be less than 5000 characters').optional(),
  authority: z.string().max(5000, 'Quyền hạn must be less than 5000 characters').optional(),
  relationships: z.string().max(5000, 'Quan hệ công việc must be less than 5000 characters').optional(),
  careerPath: z.string().max(5000, 'Lộ trình phát triển must be less than 5000 characters').optional(),
  benefitsIncome: z.string().max(200, 'Thu nhập must be less than 200 characters').optional(),
  benefitsPerks: z.string().max(2000, 'Phúc lợi must be less than 2000 characters').optional(),
  contact: z.string().max(500, 'Thông tin liên hệ must be less than 500 characters').optional(),
});

// Update job schema - Standard JD format
export const updateJobSchema = z.object({
  // Basic info
  title: z.string().min(1, 'Job title is required').max(200, 'Job title must be less than 200 characters').optional(),
  location: locationCodeSchema.optional().nullable(),
  locations: z.array(locationCodeSchema).max(20, 'Maximum 20 locations allowed').optional(),
  wardCodes: z.array(wardCodeSchema).max(30, 'Maximum 30 wards allowed').optional(),
  remote: z.boolean().optional(),
  salaryMin: z.number().int().min(0).optional().nullable(),
  salaryMax: z.number().int().min(0).optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE']).optional(),
  experienceLevel: z.enum(['NO_EXPERIENCE', 'LT_1_YEAR', 'Y1_2', 'Y2_3', 'Y3_5', 'Y5_10', 'GT_10']).optional(),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed').optional(),
  applicationDeadline: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  // Header fields
  department: z.string().max(100, 'Department must be less than 100 characters').optional().nullable(),
  jobLevel: z.enum(['INTERN_STUDENT', 'FRESH_GRAD', 'EMPLOYEE', 'SPECIALIST_TEAM_LEAD', 'MANAGER_HEAD', 'DIRECTOR', 'EXECUTIVE']).optional().nullable(),
  educationLevel: z.enum(['NONE', 'HIGH_SCHOOL', 'COLLEGE', 'BACHELOR', 'MASTER', 'PHD']).optional().nullable(),
  
  // Required JD fields (rich text/markdown)
  generalInfo: z.string().max(5000, 'Thông tin bổ sung must be less than 5000 characters').optional(),
  mission: z.string().min(1, 'Sứ mệnh/Vai trò is required').max(5000, 'Sứ mệnh/Vai trò must be less than 5000 characters').optional(),
  tasks: z.string().min(1, 'Nhiệm vụ chuyên môn is required').max(10000, 'Nhiệm vụ chuyên môn must be less than 10000 characters').optional(),
  knowledge: z.string().min(1, 'Kiến thức chuyên môn is required').max(5000, 'Kiến thức chuyên môn must be less than 5000 characters').optional(),
  skills: z.string().min(1, 'Kỹ năng cần thiết is required').max(5000, 'Kỹ năng cần thiết must be less than 5000 characters').optional(),
  attitude: z.string().min(1, 'Thái độ và phẩm chất is required').max(5000, 'Thái độ và phẩm chất must be less than 5000 characters').optional(),
  
  // Optional JD fields
  kpis: z.string().max(5000, 'Kết quả chuyên môn must be less than 5000 characters').optional().nullable(),
  authority: z.string().max(5000, 'Quyền hạn must be less than 5000 characters').optional().nullable(),
  relationships: z.string().max(5000, 'Quan hệ công việc must be less than 5000 characters').optional().nullable(),
  careerPath: z.string().max(5000, 'Lộ trình phát triển must be less than 5000 characters').optional().nullable(),
  benefitsIncome: z.string().max(200, 'Thu nhập must be less than 200 characters').optional().nullable(),
  benefitsPerks: z.string().max(2000, 'Phúc lợi must be less than 2000 characters').optional().nullable(),
  contact: z.string().max(500, 'Thông tin liên hệ must be less than 500 characters').optional().nullable(),
});

// Get job schema
export const getJobSchema = z.object({
  jobId: z.string().cuid('Invalid job ID'),
});

export const getRelatedJobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(10),
});

// Search jobs schema
export const searchJobsSchema = z.object({
  q: z.string().min(1, 'Search query is required').optional(),
  location: locationCodeSchema.optional(),
  ward: wardCodeSchema.optional(),
  remote: z.coerce.boolean().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE']).optional(),
  experienceLevel: z.enum(['NO_EXPERIENCE', 'LT_1_YEAR', 'Y1_2', 'Y2_3', 'Y3_5', 'Y5_10', 'GT_10']).optional(),
  salaryMin: z.coerce.number().int().min(0).optional(),
  salaryMax: z.coerce.number().int().min(0).optional(),
  skills: z.string().optional(), // Comma-separated skills
  companyId: z.string().cuid('Invalid company ID').optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// Apply job schema
export const applyJobSchema = z.object({
  jobId: z.string().cuid('Invalid job ID'),
  coverLetter: z.string().max(2000, 'Cover letter must be less than 2000 characters').optional(),
  resumeUrl: z.string().url('Invalid resume URL').optional(),
});

// Get applications schema
export const getApplicationsSchema = z.object({
  jobId: z.string().cuid('Invalid job ID').optional(),
  companyId: z.string().cuid('Invalid company ID').optional(),
  status: z.enum(['PENDING', 'REVIEWING', 'SHORTLISTED', 'REJECTED', 'HIRED']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// Update application status schema
export const updateApplicationStatusSchema = z.object({
  applicationId: z.string().cuid('Invalid application ID'),
  status: z.enum(['PENDING', 'REVIEWING', 'SHORTLISTED', 'REJECTED', 'HIRED']),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
});

// Get my applications schema
export const getMyApplicationsSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWING', 'SHORTLISTED', 'REJECTED', 'HIRED']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// Get my saved jobs schema
export const getMyFavoritesSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(20),
});

export const jobIdParamsSchema = z.object({
  jobId: z.string().cuid('Invalid job ID'),
});

// Types
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type GetJobInput = z.infer<typeof getJobSchema>;
export type GetRelatedJobsQueryInput = z.infer<typeof getRelatedJobsQuerySchema>;
export type SearchJobsInput = z.infer<typeof searchJobsSchema>;
export type ApplyJobInput = z.infer<typeof applyJobSchema>;
export type GetApplicationsInput = z.infer<typeof getApplicationsSchema>;
export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;
export type GetMyApplicationsInput = z.infer<typeof getMyApplicationsSchema>;
export type GetMyFavoritesInput = z.infer<typeof getMyFavoritesSchema>;
export type JobIdParams = z.infer<typeof jobIdParamsSchema>;
