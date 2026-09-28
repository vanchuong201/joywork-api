import { z } from 'zod';
import { educationSchema, experienceSchema, updateProfileSchema } from '@/modules/users/users.schema';

export const CV_LIMIT = 5;
export const CV_NAME_MAX_LENGTH = 60;
export const DEFAULT_CV_NAME = 'CV của tôi';

export function normalizeCvName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

const cvNameSchema = z
  .string()
  .transform((val) => val.normalize('NFC').trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(1, 'Tên CV không được để trống')
      .max(CV_NAME_MAX_LENGTH, `Tên CV tối đa ${CV_NAME_MAX_LENGTH} ký tự`)
  );

/** Field nội dung CV (không gồm settings tìm việc và thông tin tài khoản). */
export const cvContentSchema = updateProfileSchema.omit({
  name: true,
  slug: true,
  status: true,
  isPublic: true,
  isSearchingJob: true,
  allowCvFlip: true,
});

export const cvIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const cvItemParamsSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
});

export const createCvSchema = z.object({
  name: cvNameSchema,
});

export const updateCvSchema = cvContentSchema.extend({
  name: cvNameSchema.optional(),
});

export const duplicateCvSchema = z
  .object({
    name: cvNameSchema.optional(),
  })
  .default({});

export const cvExperienceSchema = experienceSchema;
export const cvEducationSchema = educationSchema;
export const cvExperiencePatchSchema = experienceSchema.partial();
export const cvEducationPatchSchema = educationSchema.partial();

export type CvContentInput = z.infer<typeof cvContentSchema>;
export type CreateCvInput = z.infer<typeof createCvSchema>;
export type UpdateCvInput = z.infer<typeof updateCvSchema>;
export type DuplicateCvInput = z.infer<typeof duplicateCvSchema>;
export type CvExperienceInput = z.infer<typeof cvExperienceSchema>;
export type CvEducationInput = z.infer<typeof cvEducationSchema>;
export type CvExperiencePatch = z.infer<typeof cvExperiencePatchSchema>;
export type CvEducationPatch = z.infer<typeof cvEducationPatchSchema>;
