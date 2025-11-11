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

export type CreatePresignInput = z.infer<typeof createPresignSchema>;
export type DeleteObjectInput = z.infer<typeof deleteObjectSchema>;

