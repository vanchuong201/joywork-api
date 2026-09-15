import { CompanyBadgeType, UserAccountStatus } from '@prisma/client';
import { z } from 'zod';
import {
  ADMIN_DATE_PRESETS,
  ADMIN_DATE_RANGE_MAX_DAYS,
  daysBetweenInclusive,
} from '@/modules/system/admin-date-range';

const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

export const adminUsersQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: z.string().trim().max(200).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  accountStatus: z.nativeEnum(UserAccountStatus).optional(),
});

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export const adminCompaniesQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: z.string().trim().max(200).optional(),
  verificationStatus: z.enum(['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED']).optional(),
  premiumStatus: z.enum(['premium', 'free']).optional(),
  cvFlipStatus: z.enum(['enabled', 'disabled']).optional(),
});

export type AdminCompaniesQuery = z.infer<typeof adminCompaniesQuerySchema>;

export const adminCompanyParamSchema = z.object({
  companyId: z.string().cuid(),
});

export type AdminCompanyParam = z.infer<typeof adminCompanyParamSchema>;

const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải dạng YYYY-MM-DD');

const adminDateRangeBaseSchema = z.object({
  preset: z.enum(ADMIN_DATE_PRESETS).default('last30d'),
  from: ymdSchema.optional(),
  to: ymdSchema.optional(),
});

function refineCustomRange(
  value: {
    preset: string;
    from?: string | undefined;
    to?: string | undefined;
  },
  ctx: z.RefinementCtx
) {
  if (value.preset !== 'custom') {
    return;
  }
  if (!value.from) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'from bắt buộc khi preset=custom',
      path: ['from'],
    });
  }
  if (!value.to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'to bắt buộc khi preset=custom',
      path: ['to'],
    });
  }
  if (value.from && value.to) {
    if (value.from > value.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'from phải nhỏ hơn hoặc bằng to',
        path: ['from'],
      });
    } else if (daysBetweenInclusive(value.from, value.to) > ADMIN_DATE_RANGE_MAX_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Khoảng thời gian tối đa ${ADMIN_DATE_RANGE_MAX_DAYS} ngày`,
        path: ['to'],
      });
    }
  }
}

/** Overview: period filter hoặc lifetime=true (external API). */
export const adminOverviewQuerySchema = adminDateRangeBaseSchema
  .extend({
    lifetime: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .optional()
      .transform((v) => v === true || v === 'true' || v === '1')
      .default(false),
  })
  .superRefine((value, ctx) => {
    if (value.lifetime) {
      return;
    }
    refineCustomRange(value, ctx);
  });

export type AdminOverviewQuery = z.infer<typeof adminOverviewQuerySchema>;

export const adminDateRangeQuerySchema = adminDateRangeBaseSchema.superRefine(refineCustomRange);

export type AdminDateRangeQuery = z.infer<typeof adminDateRangeQuerySchema>;

/** Timeseries dùng cùng contract preset/from/to. */
export const adminReportTimeseriesQuerySchema = adminDateRangeQuerySchema;

export type AdminReportTimeseriesQuery = AdminDateRangeQuery;

export const adminUserAccountPatchSchema = z.object({
  accountStatus: z.nativeEnum(UserAccountStatus),
});

export type AdminUserAccountPatch = z.infer<typeof adminUserAccountPatchSchema>;

export const adminCompanyPremiumPatchSchema = z.object({
  isPremium: z.boolean(),
});

export type AdminCompanyPremiumPatch = z.infer<typeof adminCompanyPremiumPatchSchema>;

export const adminCompanyCvFlipPatchSchema = z.object({
  enabled: z.boolean(),
  monthlyTotalLimit: z.coerce.number().int().min(1).max(100000).optional(),
  monthlyRequestLimit: z.coerce.number().int().min(1).max(100000).optional(),
  cycleStartDay: z.coerce.number().int().min(1).max(31).optional(),
  cycleCount: z.coerce.number().int().min(1).max(120).optional(),
});

export type AdminCompanyCvFlipPatch = z.infer<typeof adminCompanyCvFlipPatchSchema>;

export const adminCompanyBadgePatchSchema = z.object({
  type: z.nativeEnum(CompanyBadgeType),
  granted: z.boolean(),
});

export type AdminCompanyBadgePatch = z.infer<typeof adminCompanyBadgePatchSchema>;

export const adminJobsQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: z.string().trim().max(200).optional(),
  filter: z.enum(['expiring_soon', 'expired', 'all']).default('all'),
});

export type AdminJobsQuery = z.infer<typeof adminJobsQuerySchema>;

export const adminPostsQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: z.string().trim().max(200).optional(),
  companyId: z.string().cuid().optional(),
});

export type AdminPostsQuery = z.infer<typeof adminPostsQuerySchema>;

export const adminPostFeedVisibilityPatchSchema = z.object({
  hiddenFromFeed: z.boolean(),
});

export type AdminPostFeedVisibilityPatch = z.infer<typeof adminPostFeedVisibilityPatchSchema>;

export const adminPostDeleteSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

export type AdminPostDeleteInput = z.infer<typeof adminPostDeleteSchema>;

export const adminCompanyShowcaseTypeSchema = z.enum(['FEATURED', 'TOP']);

export type AdminCompanyShowcaseType = z.infer<typeof adminCompanyShowcaseTypeSchema>;

export const adminCompanyShowcaseAddSchema = z.object({
  companyId: z.string().cuid(),
  coverUrl: z.string().url().optional(),
});

export type AdminCompanyShowcaseAddInput = z.infer<typeof adminCompanyShowcaseAddSchema>;

export const adminCompanyShowcaseReorderSchema = z.object({
  companyIds: z.array(z.string().cuid()).min(1),
});

export type AdminCompanyShowcaseReorderInput = z.infer<typeof adminCompanyShowcaseReorderSchema>;

export const adminCompanyShowcaseCoverUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  fileData: z
    .string()
    .min(1)
    .refine((value) => {
      try {
        return Buffer.from(value, 'base64').length > 0;
      } catch {
        return false;
      }
    }, 'Invalid base64 data'),
});

export type AdminCompanyShowcaseCoverUploadInput = z.infer<typeof adminCompanyShowcaseCoverUploadSchema>;
