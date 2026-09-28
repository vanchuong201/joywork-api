import type { CandidateCv, CandidateCvEducation, CandidateCvExperience, Prisma } from '@prisma/client';

export const CV_SNAPSHOT_VERSION = 1;

export type CvSnapshotSource = 'apply' | 'backfill';

export type CvSnapshotExperience = {
  id: string;
  role: string;
  company: string;
  startDate: string | null;
  endDate: string | null;
  period: string | null;
  desc: string | null;
  achievements: string[];
  order: number;
};

export type CvSnapshotEducation = {
  id: string;
  school: string;
  degree: string;
  startDate: string | null;
  endDate: string | null;
  period: string | null;
  gpa: string | null;
  honors: string | null;
  order: number;
};

export type CvSnapshotContent = {
  avatar: string | null;
  fullName: string | null;
  title: string | null;
  headline: string | null;
  bio: string | null;
  skills: string[];
  knowledge: string[];
  attitude: string[];
  cvUrl: string | null;
  locations: string[];
  wardCodes: string[];
  specificAddress: string | null;
  website: string | null;
  linkedin: string | null;
  github: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  visibility: Record<string, boolean> | null;
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  salaryCurrency: string | null;
  workMode: string | null;
  expectedCulture: string | null;
  careerGoals: string[];
  gender: string | null;
  dayOfBirth: number | null;
  monthOfBirth: number | null;
  yearOfBirth: number | null;
  educationLevel: string | null;
};

export type CvSnapshotV1 = {
  version: 1;
  source: CvSnapshotSource;
  capturedAt: string;
  cvId: string;
  cvName: string;
  account: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    slug: string | null;
  };
  content: CvSnapshotContent;
  experiences: CvSnapshotExperience[];
  educations: CvSnapshotEducation[];
};

export type CvWithSections = CandidateCv & {
  experiences: CandidateCvExperience[];
  educations: CandidateCvEducation[];
};

export type SnapshotAccount = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  slug: string | null;
};

const toIso = (value: Date | null): string | null => (value ? value.toISOString() : null);

const toSafeNumber = (value: bigint | null): number | null => (value == null ? null : Number(value));

const bySectionOrder = <T extends { order: number; startDate: Date | null }>(a: T, b: T): number => {
  if (a.order !== b.order) return a.order - b.order;
  return (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0);
};

export function buildCvSnapshot(params: {
  cv: CvWithSections;
  account: SnapshotAccount;
  source: CvSnapshotSource;
  capturedAt?: Date;
}): CvSnapshotV1 {
  const { cv, account, source } = params;
  const capturedAt = params.capturedAt ?? new Date();

  return {
    version: CV_SNAPSHOT_VERSION,
    source,
    capturedAt: capturedAt.toISOString(),
    cvId: cv.id,
    cvName: cv.name,
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      phone: account.phone,
      slug: account.slug,
    },
    content: {
      avatar: cv.avatar,
      fullName: cv.fullName,
      title: cv.title,
      headline: cv.headline,
      bio: cv.bio,
      skills: [...cv.skills],
      knowledge: [...cv.knowledge],
      attitude: [...cv.attitude],
      cvUrl: cv.cvUrl,
      locations: [...cv.locations],
      wardCodes: [...cv.wardCodes],
      specificAddress: cv.specificAddress,
      website: cv.website,
      linkedin: cv.linkedin,
      github: cv.github,
      contactEmail: cv.contactEmail,
      contactPhone: cv.contactPhone,
      visibility: (cv.visibility as Record<string, boolean> | null) ?? null,
      expectedSalaryMin: toSafeNumber(cv.expectedSalaryMin),
      expectedSalaryMax: toSafeNumber(cv.expectedSalaryMax),
      salaryCurrency: cv.salaryCurrency,
      workMode: cv.workMode,
      expectedCulture: cv.expectedCulture,
      careerGoals: [...cv.careerGoals],
      gender: cv.gender,
      dayOfBirth: cv.dayOfBirth,
      monthOfBirth: cv.monthOfBirth,
      yearOfBirth: cv.yearOfBirth,
      educationLevel: cv.educationLevel,
    },
    experiences: [...cv.experiences].sort(bySectionOrder).map((exp) => ({
      id: exp.id,
      role: exp.role,
      company: exp.company,
      startDate: toIso(exp.startDate),
      endDate: toIso(exp.endDate),
      period: exp.period,
      desc: exp.desc,
      achievements: [...exp.achievements],
      order: exp.order,
    })),
    educations: [...cv.educations].sort(bySectionOrder).map((edu) => ({
      id: edu.id,
      school: edu.school,
      degree: edu.degree,
      startDate: toIso(edu.startDate),
      endDate: toIso(edu.endDate),
      period: edu.period,
      gpa: edu.gpa,
      honors: edu.honors,
      order: edu.order,
    })),
  };
}

export function parseCvSnapshot(value: Prisma.JsonValue | null | undefined): CvSnapshotV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const snapshot = value as Record<string, unknown>;
  if (snapshot['version'] !== CV_SNAPSHOT_VERSION) return null;
  return snapshot as unknown as CvSnapshotV1;
}
