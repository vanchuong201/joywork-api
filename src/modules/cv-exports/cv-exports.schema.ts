import { z } from 'zod';

export const exportCandidatePdfParamsSchema = z.object({
  slug: z.string().trim().min(1),
});

export const exportCandidatePdfQuerySchema = z.object({
  companyId: z.string().trim().min(1),
});

export type ExportCandidatePdfParams = z.infer<
  typeof exportCandidatePdfParamsSchema
>;
export type ExportCandidatePdfQuery = z.infer<
  typeof exportCandidatePdfQuerySchema
>;

export const exportOwnPdfQuerySchema = z.object({
  cvId: z.string().trim().min(1).optional(),
});

export type ExportOwnPdfQuery = z.infer<typeof exportOwnPdfQuerySchema>;

export const exportApplicationPdfParamsSchema = z.object({
  applicationId: z.string().trim().min(1).max(64),
});
