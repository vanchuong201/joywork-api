import { z } from 'zod';

export const SEO_TITLE_MAX = 200;
export const SEO_DESCRIPTION_MAX = 500;
export const SEO_HEADING_MAX = 200;

/** Ngưỡng khuyến nghị SEO — vượt thì cảnh báo, không chặn lưu. */
export const SEO_TITLE_RECOMMENDED_MAX = 65;
export const SEO_DESCRIPTION_RECOMMENDED_MAX = 165;

export const SEO_IMPORT_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
] as const;

const seoPathField = z.string().min(1, 'SEO URL là bắt buộc').max(300, 'SEO URL quá dài');
const originalPathField = z.string().min(1, 'URL gốc là bắt buộc').max(2000, 'URL gốc quá dài');
const titleField = z
  .string()
  .min(1, 'Title là bắt buộc')
  .max(SEO_TITLE_MAX, `Title tối đa ${SEO_TITLE_MAX} ký tự`);
const descriptionField = z
  .string()
  .min(1, 'Description là bắt buộc')
  .max(SEO_DESCRIPTION_MAX, `Description tối đa ${SEO_DESCRIPTION_MAX} ký tự`);
const headingField = z.string().max(SEO_HEADING_MAX, `H1 tối đa ${SEO_HEADING_MAX} ký tự`);

export const createSeoUrlSchema = z.object({
  seoPath: seoPathField,
  originalPath: originalPathField,
  title: titleField,
  description: descriptionField,
  heading: headingField.optional(),
});

export const updateSeoUrlSchema = z
  .object({
    seoPath: seoPathField.optional(),
    originalPath: originalPathField.optional(),
    title: titleField.optional(),
    description: descriptionField.optional(),
    heading: headingField.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Không có thay đổi nào');

export const adminListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const publicListQuerySchema = z.object({
  includeEmpty: z.coerce.boolean().default(false),
});

export const resolveQuerySchema = z.object({
  path: z.string().min(1, 'Thiếu tham số path').max(300),
});

export const idParamSchema = z.object({
  id: z.string().cuid('ID không hợp lệ'),
});

export const bulkIdsSchema = z.object({
  ids: z.array(z.string().cuid('ID không hợp lệ')).min(1, 'Chọn ít nhất một mục').max(200),
});

export const previewSchema = z.object({
  seoPath: seoPathField.optional(),
  originalPath: originalPathField,
  title: titleField.optional(),
  /** Bỏ mapping đang sửa ra khỏi phần đối chiếu trùng SEO URL và cùng bộ lọc. */
  excludeId: z.string().cuid('ID không hợp lệ').optional(),
});

export type CreateSeoUrlInput = z.infer<typeof createSeoUrlSchema>;
export type UpdateSeoUrlInput = z.infer<typeof updateSeoUrlSchema>;
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
export type PreviewInput = z.infer<typeof previewSchema>;
