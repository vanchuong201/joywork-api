import { z } from 'zod';

// Create job schema
export const createJobSchema = z.object({
  title: z.string().min(1, 'Job title is required').max(200, 'Job title must be less than 200 characters'),
  description: z.string().min(1, 'Job description is required').max(10000, 'Job description must be less than 10000 characters'),
  requirements: z.string().max(5000, 'Requirements must be less than 5000 characters').optional(),
  responsibilities: z.string().max(5000, 'Responsibilities must be less than 5000 characters').optional(),
  benefits: z.string().max(2000, 'Benefits must be less than 2000 characters').optional(),
  location: z.string().max(100, 'Location must be less than 100 characters').optional(),
  remote: z.boolean().default(false),
  salaryMin: z.number().int().min(0).optional(),
  salaryMax: z.number().int().min(0).optional(),
  currency: z.string().length(3).default('VND'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE']).default('FULL_TIME'),
  experienceLevel: z.enum(['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']).default('MID'),
  skills: z.array(z.string()).max(20, 'Maximum 20 skills allowed').optional(),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed').optional(),
  applicationDeadline: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
});

// Update job schema
export const updateJobSchema = z.object({
  title: z.string().min(1, 'Job title is required').max(200, 'Job title must be less than 200 characters').optional(),
  description: z.string().min(1, 'Job description is required').max(10000, 'Job description must be less than 10000 characters').optional(),
  requirements: z.string().max(5000, 'Requirements must be less than 5000 characters').optional(),
  responsibilities: z.string().max(5000, 'Responsibilities must be less than 5000 characters').optional(),
  benefits: z.string().max(2000, 'Benefits must be less than 2000 characters').optional(),
  location: z.string().max(100, 'Location must be less than 100 characters').optional(),
  remote: z.boolean().optional(),
  salaryMin: z.number().int().min(0).optional(),
  salaryMax: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE']).optional(),
  experienceLevel: z.enum(['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']).optional(),
  skills: z.array(z.string()).max(20, 'Maximum 20 skills allowed').optional(),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed').optional(),
  applicationDeadline: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

// Get job schema
export const getJobSchema = z.object({
  jobId: z.string().cuid('Invalid job ID'),
});

// Search jobs schema
export const searchJobsSchema = z.object({
  q: z.string().min(1, 'Search query is required').optional(),
  location: z.string().optional(),
  remote: z.coerce.boolean().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE']).optional(),
  experienceLevel: z.enum(['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']).optional(),
  salaryMin: z.coerce.number().int().min(0).optional(),
  salaryMax: z.coerce.number().int().min(0).optional(),
  skills: z.string().optional(), // Comma-separated skills
  companyId: z.string().cuid('Invalid company ID').optional(),
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
export type SearchJobsInput = z.infer<typeof searchJobsSchema>;
export type ApplyJobInput = z.infer<typeof applyJobSchema>;
export type GetApplicationsInput = z.infer<typeof getApplicationsSchema>;
export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;
export type GetMyApplicationsInput = z.infer<typeof getMyApplicationsSchema>;
export type GetMyFavoritesInput = z.infer<typeof getMyFavoritesSchema>;
export type JobIdParams = z.infer<typeof jobIdParamsSchema>;
