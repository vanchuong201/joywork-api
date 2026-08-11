import { z } from 'zod';

export const HOMEPAGE_HERO_SLOT = 'homepage-hero';

export const bannerSlotSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slot phải là kebab-case');

export const publicBannersQuerySchema = z.object({
  slot: bannerSlotSchema.default(HOMEPAGE_HERO_SLOT),
});

export const adminBannersQuerySchema = z.object({
  slot: bannerSlotSchema.optional(),
});

export const bannerIdParamSchema = z.object({
  id: z.string().cuid(),
});

const optionalDateTime = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ngày giờ không hợp lệ' });
      return z.NEVER;
    }
    return date;
  });

export const createBannerSchema = z.object({
  slot: bannerSlotSchema.default(HOMEPAGE_HERO_SLOT),
  imageUrl: z.string().url().max(2048),
  href: z.string().url().max(2048),
  alt: z.string().trim().min(1).max(300),
  isActive: z.boolean().optional().default(true),
  openInNewTab: z.boolean().optional().default(true),
  startsAt: optionalDateTime,
  endsAt: optionalDateTime,
  sortOrder: z.number().int().min(0).optional(),
});

export const updateBannerSchema = z
  .object({
    slot: bannerSlotSchema.optional(),
    imageUrl: z.string().url().max(2048).optional(),
    href: z.string().url().max(2048).optional(),
    alt: z.string().trim().min(1).max(300).optional(),
    isActive: z.boolean().optional(),
    openInNewTab: z.boolean().optional(),
    startsAt: optionalDateTime,
    endsAt: optionalDateTime,
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Cần ít nhất một trường để cập nhật',
  });

export const reorderBannersSchema = z.object({
  slot: bannerSlotSchema,
  ids: z.array(z.string().cuid()).min(1),
});

export const bannerUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  fileData: z.string().min(1),
});
