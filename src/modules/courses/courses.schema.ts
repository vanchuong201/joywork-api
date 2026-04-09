import { z } from 'zod';

export const coursesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  q: z.string().trim().max(200).optional(),
});

export type CoursesListQuery = z.infer<typeof coursesListQuerySchema>;

export const courseSlugParamsSchema = z.object({
  slug: z.string().min(1).max(200),
});
