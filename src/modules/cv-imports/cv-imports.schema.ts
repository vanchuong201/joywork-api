import { z } from 'zod';

/** Các section ứng viên có thể chọn áp dụng khi confirm import CV. */
export const CV_IMPORT_SECTIONS = [
  'basicInfo',
  'contact',
  'skills',
  'knowledge',
  'attitude',
  'careerGoals',
  'expectations',
  'experiences',
  'educations',
] as const;

export type CvImportSection = (typeof CV_IMPORT_SECTIONS)[number];

const trimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable();

const optionalString = (max: number) => trimmedString(max).optional().nullable();

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .url()
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const optionalEmail = z
  .string()
  .trim()
  .max(255)
  .email()
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

/**
 * Định dạng dữ liệu đã được AI parse từ CV.
 *
 * Tất cả các trường đều `optional` hoặc `nullable` để model có thể bỏ qua khi không chắc.
 * Dùng `.catch(...)` ở các trường array/object con để model trả output sai schema vẫn không
 * phá toàn bộ pipeline.
 */
export const parsedExperienceSchema = z
  .object({
    role: trimmedString(200),
    company: trimmedString(200),
    startDate: optionalString(20),
    endDate: optionalString(20),
    period: optionalString(60),
    desc: optionalString(2000),
    achievements: z.array(z.string().trim().min(1).max(500)).max(20).optional().default([]),
  })
  .partial()
  .transform((value) => ({
    role: value.role ?? null,
    company: value.company ?? null,
    startDate: value.startDate ?? null,
    endDate: value.endDate ?? null,
    period: value.period ?? null,
    desc: value.desc ?? null,
    achievements: value.achievements ?? [],
  }));

export const parsedEducationSchema = z
  .object({
    school: trimmedString(200),
    degree: trimmedString(200),
    startDate: optionalString(20),
    endDate: optionalString(20),
    period: optionalString(60),
    gpa: optionalString(40),
    honors: optionalString(200),
  })
  .partial()
  .transform((value) => ({
    school: value.school ?? null,
    degree: value.degree ?? null,
    startDate: value.startDate ?? null,
    endDate: value.endDate ?? null,
    period: value.period ?? null,
    gpa: value.gpa ?? null,
    honors: value.honors ?? null,
  }));

export const parsedBasicInfoSchema = z
  .object({
    fullName: optionalString(200),
    title: optionalString(150),
    headline: optionalString(150),
    bio: optionalString(2000),
    gender: z
      .enum(['MALE', 'FEMALE', 'OTHER'])
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    yearOfBirth: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear())
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  })
  .partial();

export const parsedContactSchema = z
  .object({
    contactEmail: optionalEmail,
    contactPhone: optionalString(50),
    website: optionalUrl,
    linkedin: optionalUrl,
    github: optionalUrl,
  })
  .partial();

export const parsedExpectationsSchema = z
  .object({
    expectedSalaryMin: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    expectedSalaryMax: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    salaryCurrency: z
      .enum(['VND', 'USD'])
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    workMode: optionalString(50),
  })
  .partial();

export const parsedCvSchema = z.object({
  basicInfo: parsedBasicInfoSchema.optional().default({}),
  contact: parsedContactSchema.optional().default({}),
  skills: z.array(z.string().trim().min(1).max(80)).max(40).optional().default([]),
  knowledge: z.array(z.string().trim().min(1).max(200)).max(40).optional().default([]),
  attitude: z.array(z.string().trim().min(1).max(200)).max(40).optional().default([]),
  careerGoals: z.array(z.string().trim().min(1).max(500)).max(20).optional().default([]),
  expectations: parsedExpectationsSchema.optional().default({}),
  experiences: z.array(parsedExperienceSchema).max(30).optional().default([]),
  educations: z.array(parsedEducationSchema).max(20).optional().default([]),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20).optional().default([]),
  confidence: z.number().min(0).max(1).optional().nullable(),
});

export type ParsedCv = z.infer<typeof parsedCvSchema>;

export const createCvImportSchema = z
  .object({
    sourceKey: z.string().trim().min(1).max(500).optional(),
    cvUrl: z.string().trim().url().max(1000).optional(),
  })
  .refine((value) => Boolean(value.sourceKey || value.cvUrl), {
    message: 'Vui lòng cung cấp cvUrl hoặc sourceKey',
    path: ['sourceKey'],
  });

export type CreateCvImportInput = z.infer<typeof createCvImportSchema>;

export const applyCvImportSchema = z.object({
  mode: z.enum(['fill_missing', 'overwrite']),
  sections: z.array(z.enum(CV_IMPORT_SECTIONS)).min(1, 'Chọn ít nhất một mục để áp dụng'),
});

export type ApplyCvImportInput = z.infer<typeof applyCvImportSchema>;
