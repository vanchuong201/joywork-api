import { z } from 'zod';

export const adminCoursesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  q: z.string().trim().max(200).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
});

export type AdminCoursesQuery = z.infer<typeof adminCoursesQuerySchema>;

export const adminCourseCreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  shortDescription: z.string().trim().min(1).max(500),
  description: z.string().trim().max(50000).optional().nullable(),
  thumbnailUrl: z.union([z.string().url().max(2000), z.null()]).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']).default('DRAFT'),
});

export const adminCoursePatchSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  shortDescription: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(50000).optional().nullable(),
  thumbnailUrl: z.union([z.string().url().max(2000), z.null()]).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']).optional(),
});

export const adminLessonCreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  sortOrder: z.number().int().optional(),
});

export const adminLessonPatchSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  sortOrder: z.number().int().optional(),
});

export const adminLessonVideoCreateSchema = z.object({
  source: z.enum(['URL', 'S3_KEY']),
  value: z.string().trim().min(1).max(4000),
  sortOrder: z.number().int().optional(),
});

export const adminLessonVideoPatchSchema = z.object({
  source: z.enum(['URL', 'S3_KEY']).optional(),
  value: z.string().trim().min(1).max(4000).optional(),
  sortOrder: z.number().int().optional(),
});

export const adminLessonAttachmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(300),
  source: z.enum(['URL', 'S3_KEY']),
  value: z.string().trim().min(1).max(4000),
  sortOrder: z.number().int().optional(),
});

export const adminLessonAttachmentPatchSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  source: z.enum(['URL', 'S3_KEY']).optional(),
  value: z.string().trim().min(1).max(4000).optional(),
  sortOrder: z.number().int().optional(),
});

export const adminCourseEnrollmentCreateSchema = z.object({
  email: z.string().trim().email().max(320),
});

export const adminReorderLessonsSchema = z.object({
  lessonIds: z.array(z.string().min(1)).min(1).max(200),
});
