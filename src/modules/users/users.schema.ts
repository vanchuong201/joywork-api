import { z } from 'zod';

// Update profile schema
export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  headline: z.string().max(100, 'Headline must be less than 100 characters').optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  skills: z.array(z.string()).max(10, 'Maximum 10 skills allowed').optional(),
  cvUrl: z.string().url('Invalid CV URL').optional(),
  location: z.string().max(100, 'Location must be less than 100 characters').optional(),
  website: z.string().url('Invalid website URL').optional(),
  linkedin: z.string().url('Invalid LinkedIn URL').optional(),
  github: z.string().url('Invalid GitHub URL').optional(),
});

// Get user profile schema
export const getUserProfileSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
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
export type SearchUsersInput = z.infer<typeof searchUsersSchema>;
