import { z } from 'zod';

// UserStatus enum
export const userStatusEnum = z.enum(['OPEN_TO_WORK', 'NOT_AVAILABLE', 'LOOKING']);

// Helper for optional URL fields - accepts empty string and converts to null
const optionalUrl = z
  .string()
  .transform((val) => (val === '' ? null : val))
  .refine((val) => val === null || z.string().url().safeParse(val).success, {
    message: 'Invalid URL',
  })
  .nullable()
  .optional();

// Update profile schema
export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
  avatar: optionalUrl,
  headline: z.string().max(100, 'Headline must be less than 100 characters').optional().nullable().transform((val) => val === '' ? null : val),
  bio: z.string().max(2000, 'Bio must be less than 2000 characters').optional().nullable().transform((val) => val === '' ? null : val),
  skills: z.array(z.string()).max(20, 'Maximum 20 skills allowed').optional(),
  cvUrl: optionalUrl,
  location: z.string().max(100, 'Location must be less than 100 characters').optional().nullable().transform((val) => val === '' ? null : val),
  website: optionalUrl,
  linkedin: optionalUrl,
  github: optionalUrl,
  // New profile fields
  fullName: z.string().max(200, 'Full name must be less than 200 characters').optional().nullable().transform((val) => val === '' ? null : val),
  title: z.string().max(150, 'Title must be less than 150 characters').optional().nullable().transform((val) => val === '' ? null : val),
  status: userStatusEnum.optional().nullable(),
  isPublic: z.boolean().optional(),
  visibility: z.object({
    bio: z.boolean().optional(),
    experience: z.boolean().optional(),
    education: z.boolean().optional(),
    ksa: z.boolean().optional(),
    expectations: z.boolean().optional(),
  }).optional().nullable(),
  knowledge: z.array(z.string()).max(20, 'Maximum 20 knowledge items allowed').optional(),
  attitude: z.array(z.string()).max(20, 'Maximum 20 attitude items allowed').optional(),
  expectedSalary: z.string().max(100, 'Expected salary must be less than 100 characters').optional().nullable().transform((val) => val === '' ? null : val),
  workMode: z.string().max(100, 'Work mode must be less than 100 characters').optional().nullable().transform((val) => val === '' ? null : val),
  expectedCulture: z.string().max(500, 'Expected culture must be less than 500 characters').optional().nullable().transform((val) => val === '' ? null : val),
  careerGoals: z.array(z.string()).max(10, 'Maximum 10 career goals allowed').optional(),
});

// Experience schema
export const experienceSchema = z.object({
  role: z.string().min(1, 'Role is required').max(200, 'Role must be less than 200 characters'),
  company: z.string().min(1, 'Company is required').max(200, 'Company must be less than 200 characters'),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  period: z.string().max(100, 'Period must be less than 100 characters').optional().nullable(),
  desc: z.string().max(2000, 'Description must be less than 2000 characters').optional().nullable(),
  achievements: z.array(z.string()).max(20, 'Maximum 20 achievements allowed').optional(),
  order: z.number().int().min(0).default(0),
});

// Education schema
export const educationSchema = z.object({
  school: z.string().min(1, 'School is required').max(200, 'School must be less than 200 characters'),
  degree: z.string().min(1, 'Degree is required').max(200, 'Degree must be less than 200 characters'),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  period: z.string().max(100, 'Period must be less than 100 characters').optional().nullable(),
  gpa: z.string().max(50, 'GPA must be less than 50 characters').optional().nullable(),
  honors: z.string().max(200, 'Honors must be less than 200 characters').optional().nullable(),
  order: z.number().int().min(0).default(0),
});

// Get user profile schema
export const getUserProfileSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
});

// Get user profile by slug schema
export const getUserProfileBySlugSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
});

// Search users schema
export const searchUsersSchema = z.object({
  q: z.string().min(1, 'Search query is required').optional(),
  skills: z.string().optional(),
  location: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// Types
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type GetUserProfileInput = z.infer<typeof getUserProfileSchema>;
export type GetUserProfileBySlugInput = z.infer<typeof getUserProfileBySlugSchema>;
export type SearchUsersInput = z.infer<typeof searchUsersSchema>;
export type ExperienceInput = z.infer<typeof experienceSchema>;
export type EducationInput = z.infer<typeof educationSchema>;
