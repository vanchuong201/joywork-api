import { z } from 'zod';

export const createPresignSchema = z.object({
  companyId: z.string().cuid('Invalid company ID'),
  fileName: z.string().min(1, 'File name is required').max(255, 'File name is too long'),
  fileType: z.string().min(1, 'File type is required'),
  fileSize: z.number().int().min(1, 'File size must be positive'),
});

export const deleteObjectSchema = z.object({
  key: z.string().min(1, 'Object key is required'),
});

export const createProfileAvatarPresignSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255, 'File name is too long'),
  fileType: z.string().min(1, 'File type is required'),
  fileSize: z.number().int().min(1, 'File size must be positive'),
});

export const uploadProfileAvatarSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, 'File name is required')
    .max(255, 'File name is too long'),
  fileType: z.string().min(1, 'File type is required'),
  fileData: z
    .string()
    .min(1, 'File data is required')
    .refine((value) => {
      try {
        return Buffer.from(value, 'base64').length > 0;
      } catch {
        return false;
      }
    }, 'Invalid base64 data'),
  previousKey: z.string().optional(),
});

export type CreatePresignInput = z.infer<typeof createPresignSchema>;
export type DeleteObjectInput = z.infer<typeof deleteObjectSchema>;
export type CreateProfileAvatarPresignInput = z.infer<typeof createProfileAvatarPresignSchema>;
export type UploadProfileAvatarInput = z.infer<typeof uploadProfileAvatarSchema>;

