import { Prisma } from '@prisma/client';

const NON_EMPTY_NULLABLE_TEXT: Prisma.StringNullableFilter = {
  not: null,
  notIn: [''],
};

const NON_EMPTY_TEXT: Prisma.StringFilter = {
  not: '',
};

const CV_READY_BASIC_INFO_LABEL = 'Thông tin cơ bản';
const CV_READY_KSA_LABEL = 'Năng lực (KSA)';
const CV_READY_EXPERIENCE_LABEL = 'Kinh nghiệm làm việc';

export const CV_READY_SECTION_LABELS = {
  basicInfo: CV_READY_BASIC_INFO_LABEL,
  ksa: CV_READY_KSA_LABEL,
  experiences: CV_READY_EXPERIENCE_LABEL,
} as const;

export type CandidateCvReadinessInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  profile?: {
    avatar?: string | null;
    fullName?: string | null;
    title?: string | null;
    bio?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    locations?: string[] | null;
    knowledge?: string[] | null;
    skills?: string[] | null;
    attitude?: string[] | null;
  } | null;
  experiencesCount: number;
};

export type CandidateCvReadinessResult = {
  hasBasicInfo: boolean;
  hasKsa: boolean;
  hasExperiences: boolean;
  isReady: boolean;
  missingSections: string[];
};

const hasFilledText = (value?: string | null): boolean => Boolean(value?.trim());

const hasNonEmptyTextItem = (items?: string[] | null): boolean =>
  (items ?? []).some((item) => item.trim().length > 0);

export const evaluateCandidateCvReadiness = (
  candidate: CandidateCvReadinessInput
): CandidateCvReadinessResult => {
  const profile = candidate.profile;
  // Avatar không bắt buộc — DN vẫn tìm thấy hồ sơ import/generate khi đủ thông tin còn lại.
  const hasBasicInfo =
    hasFilledText(profile?.fullName || candidate.name) &&
    hasFilledText(profile?.title) &&
    hasFilledText(profile?.bio) &&
    hasFilledText(profile?.contactEmail || candidate.email) &&
    hasFilledText(profile?.contactPhone || candidate.phone) &&
    hasNonEmptyTextItem(profile?.locations);

  const hasKsa =
    hasNonEmptyTextItem(profile?.knowledge) ||
    hasNonEmptyTextItem(profile?.skills) ||
    hasNonEmptyTextItem(profile?.attitude);

  const hasExperiences = candidate.experiencesCount > 0;
  const isReady = hasBasicInfo && hasKsa && hasExperiences;

  const missingSections: string[] = [];
  if (!hasBasicInfo) missingSections.push(CV_READY_BASIC_INFO_LABEL);
  if (!hasKsa) missingSections.push(CV_READY_KSA_LABEL);
  if (!hasExperiences) missingSections.push(CV_READY_EXPERIENCE_LABEL);

  return {
    hasBasicInfo,
    hasKsa,
    hasExperiences,
    isReady,
    missingSections,
  };
};

/** Điều kiện trên CV mặc định của user. */
export const defaultCvIs = (where: Prisma.CandidateCvWhereInput): Prisma.UserWhereInput => ({
  profile: { is: { defaultCv: { is: where } } },
});

/** CV mặc định của user đủ điều kiện (bản Prisma where của `evaluateCandidateCvReadiness`). */
export const buildCvReadyUserWhere = (): Prisma.UserWhereInput => ({
  AND: [
    {
      OR: [{ name: NON_EMPTY_NULLABLE_TEXT }, defaultCvIs({ fullName: NON_EMPTY_NULLABLE_TEXT })],
    },
    defaultCvIs({ title: NON_EMPTY_NULLABLE_TEXT }),
    defaultCvIs({ bio: NON_EMPTY_NULLABLE_TEXT }),
    {
      OR: [{ email: NON_EMPTY_TEXT }, defaultCvIs({ contactEmail: NON_EMPTY_NULLABLE_TEXT })],
    },
    {
      OR: [{ phone: NON_EMPTY_NULLABLE_TEXT }, defaultCvIs({ contactPhone: NON_EMPTY_NULLABLE_TEXT })],
    },
    defaultCvIs({ locations: { isEmpty: false } }),
    {
      OR: [
        defaultCvIs({ knowledge: { isEmpty: false } }),
        defaultCvIs({ skills: { isEmpty: false } }),
        defaultCvIs({ attitude: { isEmpty: false } }),
      ],
    },
    defaultCvIs({ experiences: { some: {} } }),
  ],
});

/**
 * Bản raw SQL của readiness. Yêu cầu alias: `u` = users, `c` = candidate_cvs (CV mặc định).
 */
export const cvReadyRawSqlCondition = Prisma.sql`
  (
    (
      NULLIF(BTRIM(COALESCE(c."fullName", u.name)), '') IS NOT NULL
      AND NULLIF(BTRIM(c.title), '') IS NOT NULL
      AND NULLIF(BTRIM(c.bio), '') IS NOT NULL
      AND NULLIF(BTRIM(COALESCE(c."contactEmail", u.email)), '') IS NOT NULL
      AND NULLIF(BTRIM(COALESCE(c."contactPhone", u.phone)), '') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(c.locations, ARRAY[]::text[])) AS location_item
        WHERE NULLIF(BTRIM(location_item), '') IS NOT NULL
      )
    )
    AND (
      EXISTS (
        SELECT 1
        FROM unnest(COALESCE(c.knowledge, ARRAY[]::text[])) AS knowledge_item
        WHERE NULLIF(BTRIM(knowledge_item), '') IS NOT NULL
      )
      OR EXISTS (
        SELECT 1
        FROM unnest(COALESCE(c.skills, ARRAY[]::text[])) AS skill_item
        WHERE NULLIF(BTRIM(skill_item), '') IS NOT NULL
      )
      OR EXISTS (
        SELECT 1
        FROM unnest(COALESCE(c.attitude, ARRAY[]::text[])) AS attitude_item
        WHERE NULLIF(BTRIM(attitude_item), '') IS NOT NULL
      )
    )
    AND EXISTS (
      SELECT 1
      FROM candidate_cv_experiences ce
      WHERE ce."cvId" = c.id
    )
  )
`;
