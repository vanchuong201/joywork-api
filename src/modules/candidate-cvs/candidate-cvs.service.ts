import { Prisma } from '@prisma/client';
import type { CandidateCv, CandidateCvEducation, CandidateCvExperience } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { getProvinceNameByCode } from '@/shared/provinces';
import { resolveLocationsWithWards } from '@/shared/wards';
import { removeUndefined } from '@/shared/utils';
import {
  evaluateCandidateCvReadiness,
  type CandidateCvReadinessResult,
} from '@/shared/candidates/cv-readiness';
import { syncCandidateToEs } from '@/shared/candidates/candidate-search-sync';
import {
  CV_LIMIT,
  CV_NAME_MAX_LENGTH,
  DEFAULT_CV_NAME,
  normalizeCvName,
  type CreateCvInput,
  type CvContentInput,
  type CvEducationInput,
  type CvEducationPatch,
  type CvExperienceInput,
  type CvExperiencePatch,
  type DuplicateCvInput,
  type UpdateCvInput,
} from './candidate-cvs.schema';
import type { CvWithSections } from './cv-snapshot';

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type ReadinessAccount = { name: string | null; email: string | null; phone: string | null };

export const CV_SECTION_ORDER_BY = [{ order: 'asc' as const }, { startDate: 'desc' as const }];

export const CV_WITH_SECTIONS_INCLUDE = {
  experiences: { orderBy: CV_SECTION_ORDER_BY },
  educations: { orderBy: CV_SECTION_ORDER_BY },
} satisfies Prisma.CandidateCvInclude;

const ARRAY_CONTENT_FIELDS = new Set(['skills', 'knowledge', 'attitude', 'careerGoals']);

const SCALAR_CONTENT_FIELDS = [
  'avatar',
  'fullName',
  'title',
  'headline',
  'bio',
  'skills',
  'cvUrl',
  'website',
  'linkedin',
  'github',
  'contactEmail',
  'contactPhone',
  'visibility',
  'knowledge',
  'attitude',
  'expectedSalaryMin',
  'expectedSalaryMax',
  'salaryCurrency',
  'workMode',
  'expectedCulture',
  'careerGoals',
  'gender',
  'dayOfBirth',
  'monthOfBirth',
  'yearOfBirth',
  'educationLevel',
  'specificAddress',
] as const;

export const cvNotFound = () => new AppError('CV không tồn tại', 404, 'CV_NOT_FOUND');

export const cvLimitReached = () =>
  new AppError(`Bạn đã đạt giới hạn ${CV_LIMIT} CV`, 409, 'CV_LIMIT_REACHED');

export const cvNameDuplicate = () => new AppError('Tên CV đã tồn tại, vui lòng chọn tên khác', 409, 'CV_NAME_DUPLICATE');

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/** Khóa theo user trong transaction: chống vượt giới hạn / trùng tên khi request song song. */
export async function lockUserCvs(tx: Tx, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cv:${userId}`}))`;
}

/** Copy nội dung CV (không gồm id/userId/name/timestamps) để nhân bản. */
export function pickCvContent(cv: CandidateCv) {
  return {
    avatar: cv.avatar,
    headline: cv.headline,
    bio: cv.bio,
    skills: cv.skills,
    cvUrl: cv.cvUrl,
    locations: cv.locations,
    wardCodes: cv.wardCodes,
    specificAddress: cv.specificAddress,
    website: cv.website,
    linkedin: cv.linkedin,
    github: cv.github,
    contactEmail: cv.contactEmail,
    contactPhone: cv.contactPhone,
    fullName: cv.fullName,
    title: cv.title,
    visibility: cv.visibility ?? Prisma.JsonNull,
    knowledge: cv.knowledge,
    attitude: cv.attitude,
    expectedSalaryMin: cv.expectedSalaryMin,
    expectedSalaryMax: cv.expectedSalaryMax,
    salaryCurrency: cv.salaryCurrency,
    workMode: cv.workMode,
    expectedCulture: cv.expectedCulture,
    careerGoals: cv.careerGoals,
    gender: cv.gender,
    dayOfBirth: cv.dayOfBirth,
    monthOfBirth: cv.monthOfBirth,
    yearOfBirth: cv.yearOfBirth,
    educationLevel: cv.educationLevel,
  };
}

/** Map input nội dung (schema chung với PATCH /me/profile) sang data Prisma cho CandidateCv. */
export function buildCvContentData(
  existing: Pick<CandidateCv, 'locations' | 'wardCodes'> | null,
  input: CvContentInput
): Prisma.CandidateCvUncheckedUpdateInput {
  const data: Record<string, unknown> = {};
  for (const field of SCALAR_CONTENT_FIELDS) {
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined) continue;
    if (field === 'visibility') {
      data[field] = value ?? Prisma.JsonNull;
      continue;
    }
    data[field] = value ?? (ARRAY_CONTENT_FIELDS.has(field) ? [] : null);
  }

  if (input.locations !== undefined || input.location !== undefined || input.wardCodes !== undefined) {
    const locInput: { locations?: string[]; location?: string | null; wardCodes?: string[] } = {};
    if (input.locations !== undefined) locInput.locations = input.locations;
    if (input.location !== undefined) locInput.location = input.location;
    if (input.wardCodes !== undefined) locInput.wardCodes = input.wardCodes;
    const resolved = resolveLocationsWithWards(existing, locInput);
    data['locations'] = resolved.locations;
    data['wardCodes'] = resolved.wardCodes;
  }

  return data as Prisma.CandidateCvUncheckedUpdateInput;
}

export function evaluateCvReadiness(
  cv: Pick<
    CandidateCv,
    'avatar' | 'fullName' | 'title' | 'bio' | 'contactEmail' | 'contactPhone' | 'locations' | 'knowledge' | 'skills' | 'attitude'
  >,
  account: ReadinessAccount,
  experiencesCount: number
): CandidateCvReadinessResult {
  return evaluateCandidateCvReadiness({
    name: account.name,
    email: account.email,
    phone: account.phone,
    profile: cv,
    experiencesCount,
  });
}

const toSafeNumber = (value: bigint | null): number | null => (value == null ? null : Number(value));

export function serializeCvExperience(exp: CandidateCvExperience) {
  return {
    id: exp.id,
    role: exp.role,
    company: exp.company,
    startDate: exp.startDate,
    endDate: exp.endDate,
    period: exp.period,
    desc: exp.desc,
    achievements: exp.achievements,
    order: exp.order,
  };
}

export function serializeCvEducation(edu: CandidateCvEducation) {
  return {
    id: edu.id,
    school: edu.school,
    degree: edu.degree,
    startDate: edu.startDate,
    endDate: edu.endDate,
    period: edu.period,
    gpa: edu.gpa,
    honors: edu.honors,
    order: edu.order,
  };
}

/** Field nội dung CV theo shape `profile` cũ (dùng cho cả API mới và adapter /me/profile). */
export function serializeCvContent(cv: CandidateCv) {
  return {
    avatar: cv.avatar,
    fullName: cv.fullName,
    title: cv.title,
    headline: cv.headline,
    bio: cv.bio,
    skills: cv.skills,
    cvUrl: cv.cvUrl,
    locations: cv.locations,
    wardCodes: cv.wardCodes,
    specificAddress: cv.specificAddress,
    ...(cv.locations.length > 0
      ? { location: getProvinceNameByCode(cv.locations[0]) ?? cv.locations[0] }
      : {}),
    website: cv.website,
    linkedin: cv.linkedin,
    github: cv.github,
    contactEmail: cv.contactEmail,
    contactPhone: cv.contactPhone,
    visibility: cv.visibility,
    knowledge: cv.knowledge,
    attitude: cv.attitude,
    expectedSalaryMin: toSafeNumber(cv.expectedSalaryMin),
    expectedSalaryMax: toSafeNumber(cv.expectedSalaryMax),
    salaryCurrency: cv.salaryCurrency,
    workMode: cv.workMode,
    expectedCulture: cv.expectedCulture,
    careerGoals: cv.careerGoals,
    gender: cv.gender,
    dayOfBirth: cv.dayOfBirth,
    monthOfBirth: cv.monthOfBirth,
    yearOfBirth: cv.yearOfBirth,
    educationLevel: cv.educationLevel,
  };
}

/** Tên chưa dùng dựa trên `base`, thêm hậu tố " (n)" khi trùng. */
export function pickAvailableCvName(base: string, takenNormalized: Set<string>): string {
  const trimmedBase = base.slice(0, CV_NAME_MAX_LENGTH).trim();
  if (!takenNormalized.has(normalizeCvName(trimmedBase))) return trimmedBase;
  for (let n = 2; n < 100; n += 1) {
    const suffix = ` (${n})`;
    const candidate = `${trimmedBase.slice(0, CV_NAME_MAX_LENGTH - suffix.length).trim()}${suffix}`;
    if (!takenNormalized.has(normalizeCvName(candidate))) return candidate;
  }
  throw cvNameDuplicate();
}

export class CandidateCvService {
  private async loadAccount(userId: string): Promise<ReadinessAccount> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true },
    });
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    return user;
  }

  private async getDefaultCvId(userId: string): Promise<string | null> {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { defaultCvId: true },
    });
    return profile?.defaultCvId ?? null;
  }

  private syncIfDefault(userId: string, cvId: string, defaultCvId: string | null): void {
    if (cvId === defaultCvId) {
      void syncCandidateToEs(userId);
    }
  }

  /**
   * Đảm bảo user có profile + CV mặc định (user social login / đăng ký cũ chưa có).
   * Trả về id CV mặc định.
   */
  async ensureDefaultCv(userId: string): Promise<string> {
    const existing = await this.getDefaultCvId(userId);
    if (existing) return existing;

    return prisma.$transaction(async (tx) => {
      await lockUserCvs(tx, userId);
      const profile = await tx.userProfile.findUnique({
        where: { userId },
        select: { defaultCvId: true },
      });
      if (profile?.defaultCvId) return profile.defaultCvId;

      const oldest = await tx.candidateCv.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      const cvId =
        oldest?.id ??
        (
          await tx.candidateCv.create({
            data: { userId, name: DEFAULT_CV_NAME, nameNormalized: normalizeCvName(DEFAULT_CV_NAME) },
            select: { id: true },
          })
        ).id;

      await tx.userProfile.upsert({
        where: { userId },
        update: { defaultCvId: cvId },
        create: { userId, defaultCvId: cvId, skills: [], knowledge: [], attitude: [], careerGoals: [] },
      });
      return cvId;
    });
  }

  /** Lấy CV kèm exp/edu, chỉ khi thuộc user; ngược lại 404 chung. */
  async getOwnedCv(userId: string, cvId: string): Promise<CvWithSections> {
    const cv = await prisma.candidateCv.findFirst({
      where: { id: cvId, userId },
      include: CV_WITH_SECTIONS_INCLUDE,
    });
    if (!cv) throw cvNotFound();
    return cv;
  }

  async assertOwnership(userId: string, cvId: string): Promise<void> {
    const cv = await prisma.candidateCv.findFirst({ where: { id: cvId, userId }, select: { id: true } });
    if (!cv) throw cvNotFound();
  }

  /** CV đích cho thao tác: `cvId` nếu có (kiểm tra sở hữu), ngược lại CV mặc định. */
  async resolveTargetCvId(userId: string, cvId?: string | null): Promise<string> {
    if (cvId) {
      await this.assertOwnership(userId, cvId);
      return cvId;
    }
    return this.ensureDefaultCv(userId);
  }

  async list(userId: string) {
    const defaultCvId = await this.ensureDefaultCv(userId);
    const [account, cvs] = await Promise.all([
      this.loadAccount(userId),
      prisma.candidateCv.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { experiences: true } } },
      }),
    ]);

    const items = cvs.map((cv) => ({
      id: cv.id,
      name: cv.name,
      isDefault: cv.id === defaultCvId,
      title: cv.title,
      avatar: cv.avatar,
      readiness: evaluateCvReadiness(cv, account, cv._count.experiences),
      createdAt: cv.createdAt,
      updatedAt: cv.updatedAt,
    }));

    return {
      cvs: items.sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
      limit: CV_LIMIT,
      defaultCvId,
    };
  }

  async get(userId: string, cvId: string) {
    const [cv, account, defaultCvId] = await Promise.all([
      this.getOwnedCv(userId, cvId),
      this.loadAccount(userId),
      this.getDefaultCvId(userId),
    ]);
    return this.serializeDetail(cv, account, defaultCvId);
  }

  serializeDetail(cv: CvWithSections, account: ReadinessAccount, defaultCvId: string | null) {
    return {
      id: cv.id,
      name: cv.name,
      isDefault: cv.id === defaultCvId,
      ...serializeCvContent(cv),
      readiness: evaluateCvReadiness(cv, account, cv.experiences.length),
      experiences: cv.experiences.map(serializeCvExperience),
      educations: cv.educations.map(serializeCvEducation),
      createdAt: cv.createdAt,
      updatedAt: cv.updatedAt,
    };
  }

  async create(userId: string, input: CreateCvInput) {
    await this.ensureDefaultCv(userId);
    const nameNormalized = normalizeCvName(input.name);

    let cvId: string;
    try {
      cvId = await prisma.$transaction(async (tx) => {
        await lockUserCvs(tx, userId);
        const existing = await tx.candidateCv.findMany({ where: { userId }, select: { nameNormalized: true } });
        if (existing.length >= CV_LIMIT) throw cvLimitReached();
        if (existing.some((cv) => cv.nameNormalized === nameNormalized)) throw cvNameDuplicate();
        const created = await tx.candidateCv.create({
          data: { userId, name: input.name, nameNormalized },
          select: { id: true },
        });
        return created.id;
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw cvNameDuplicate();
      throw err;
    }

    return this.get(userId, cvId);
  }

  async duplicate(userId: string, sourceCvId: string, input: DuplicateCvInput) {
    await this.ensureDefaultCv(userId);

    let cvId: string;
    try {
      cvId = await prisma.$transaction(async (tx) => {
        await lockUserCvs(tx, userId);
        const source = await tx.candidateCv.findFirst({
          where: { id: sourceCvId, userId },
          include: CV_WITH_SECTIONS_INCLUDE,
        });
        if (!source) throw cvNotFound();

        const existing = await tx.candidateCv.findMany({ where: { userId }, select: { nameNormalized: true } });
        if (existing.length >= CV_LIMIT) throw cvLimitReached();
        const taken = new Set(existing.map((cv) => cv.nameNormalized));

        const name = input.name ?? pickAvailableCvName(`Bản sao của ${source.name}`, taken);
        const nameNormalized = normalizeCvName(name);
        if (taken.has(nameNormalized)) throw cvNameDuplicate();

        const created = await tx.candidateCv.create({
          data: {
            userId,
            name,
            nameNormalized,
            ...pickCvContent(source),
            experiences: {
              create: source.experiences.map((exp) => ({
                role: exp.role,
                company: exp.company,
                startDate: exp.startDate,
                endDate: exp.endDate,
                period: exp.period,
                desc: exp.desc,
                achievements: exp.achievements,
                order: exp.order,
              })),
            },
            educations: {
              create: source.educations.map((edu) => ({
                school: edu.school,
                degree: edu.degree,
                startDate: edu.startDate,
                endDate: edu.endDate,
                period: edu.period,
                gpa: edu.gpa,
                honors: edu.honors,
                order: edu.order,
              })),
            },
          },
          select: { id: true },
        });
        return created.id;
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw cvNameDuplicate();
      throw err;
    }

    return this.get(userId, cvId);
  }

  async update(userId: string, cvId: string, input: UpdateCvInput) {
    const { name, ...content } = input;

    try {
      await prisma.$transaction(async (tx) => {
        const cv = await tx.candidateCv.findFirst({
          where: { id: cvId, userId },
          select: { id: true, locations: true, wardCodes: true, nameNormalized: true },
        });
        if (!cv) throw cvNotFound();

        const data = buildCvContentData(cv, content);

        if (name !== undefined) {
          const nameNormalized = normalizeCvName(name);
          if (nameNormalized !== cv.nameNormalized) {
            await lockUserCvs(tx, userId);
            const clash = await tx.candidateCv.findFirst({
              where: { userId, nameNormalized, id: { not: cvId } },
              select: { id: true },
            });
            if (clash) throw cvNameDuplicate();
          }
          data.name = name;
          data.nameNormalized = nameNormalized;
        }

        await tx.candidateCv.update({ where: { id: cvId }, data });
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw cvNameDuplicate();
      throw err;
    }

    const defaultCvId = await this.getDefaultCvId(userId);
    this.syncIfDefault(userId, cvId, defaultCvId);
    return this.get(userId, cvId);
  }

  async remove(userId: string, cvId: string) {
    await prisma.$transaction(async (tx) => {
      await lockUserCvs(tx, userId);
      const cv = await tx.candidateCv.findFirst({ where: { id: cvId, userId }, select: { id: true } });
      if (!cv) throw cvNotFound();

      const count = await tx.candidateCv.count({ where: { userId } });
      if (count <= 1) {
        throw new AppError('Bạn cần giữ lại ít nhất 1 CV', 409, 'CV_LAST_ONE');
      }
      const profile = await tx.userProfile.findUnique({ where: { userId }, select: { defaultCvId: true } });
      if (profile?.defaultCvId === cvId) {
        throw new AppError('Không thể xóa CV mặc định. Hãy chọn CV mặc định khác trước.', 409, 'CV_IS_DEFAULT');
      }

      await tx.candidateCv.delete({ where: { id: cvId } });
    });
    return { success: true };
  }

  async setDefault(userId: string, cvId: string) {
    await this.ensureDefaultCv(userId);
    await this.assertOwnership(userId, cvId);
    await prisma.userProfile.update({ where: { userId }, data: { defaultCvId: cvId } });
    void syncCandidateToEs(userId);
    return this.list(userId);
  }

  private async touchCv(cvId: string, userId: string): Promise<void> {
    await prisma.candidateCv.update({ where: { id: cvId }, data: { updatedAt: new Date() } });
    const defaultCvId = await this.getDefaultCvId(userId);
    this.syncIfDefault(userId, cvId, defaultCvId);
  }

  // ─── Experiences ─────────────────────────────────────────────────────────────

  async listExperiences(userId: string, cvId: string) {
    await this.assertOwnership(userId, cvId);
    const items = await prisma.candidateCvExperience.findMany({ where: { cvId }, orderBy: CV_SECTION_ORDER_BY });
    return items.map(serializeCvExperience);
  }

  async createExperience(userId: string, cvId: string, data: CvExperienceInput) {
    await this.assertOwnership(userId, cvId);
    const created = await prisma.candidateCvExperience.create({
      data: {
        cvId,
        role: data.role,
        company: data.company,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        period: data.period ?? null,
        desc: data.desc ?? null,
        achievements: data.achievements ?? [],
        order: data.order,
      },
    });
    await this.touchCv(cvId, userId);
    return serializeCvExperience(created);
  }

  async updateExperience(userId: string, cvId: string, itemId: string, data: CvExperiencePatch) {
    await this.assertOwnership(userId, cvId);
    const existing = await prisma.candidateCvExperience.findFirst({ where: { id: itemId, cvId }, select: { id: true } });
    if (!existing) throw new AppError('Experience not found', 404, 'EXPERIENCE_NOT_FOUND');
    const updated = await prisma.candidateCvExperience.update({
      where: { id: itemId },
      data: removeUndefined(data) as Prisma.CandidateCvExperienceUpdateInput,
    });
    await this.touchCv(cvId, userId);
    return serializeCvExperience(updated);
  }

  async deleteExperience(userId: string, cvId: string, itemId: string) {
    await this.assertOwnership(userId, cvId);
    const deleted = await prisma.candidateCvExperience.deleteMany({ where: { id: itemId, cvId } });
    if (deleted.count === 0) throw new AppError('Experience not found', 404, 'EXPERIENCE_NOT_FOUND');
    await this.touchCv(cvId, userId);
    return { success: true };
  }

  // ─── Educations ──────────────────────────────────────────────────────────────

  async listEducations(userId: string, cvId: string) {
    await this.assertOwnership(userId, cvId);
    const items = await prisma.candidateCvEducation.findMany({ where: { cvId }, orderBy: CV_SECTION_ORDER_BY });
    return items.map(serializeCvEducation);
  }

  async createEducation(userId: string, cvId: string, data: CvEducationInput) {
    await this.assertOwnership(userId, cvId);
    const created = await prisma.candidateCvEducation.create({
      data: {
        cvId,
        school: data.school,
        degree: data.degree,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        period: data.period ?? null,
        gpa: data.gpa ?? null,
        honors: data.honors ?? null,
        order: data.order,
      },
    });
    await this.touchCv(cvId, userId);
    return serializeCvEducation(created);
  }

  async updateEducation(userId: string, cvId: string, itemId: string, data: CvEducationPatch) {
    await this.assertOwnership(userId, cvId);
    const existing = await prisma.candidateCvEducation.findFirst({ where: { id: itemId, cvId }, select: { id: true } });
    if (!existing) throw new AppError('Education not found', 404, 'EDUCATION_NOT_FOUND');
    const updated = await prisma.candidateCvEducation.update({
      where: { id: itemId },
      data: removeUndefined(data) as Prisma.CandidateCvEducationUpdateInput,
    });
    await this.touchCv(cvId, userId);
    return serializeCvEducation(updated);
  }

  async deleteEducation(userId: string, cvId: string, itemId: string) {
    await this.assertOwnership(userId, cvId);
    const deleted = await prisma.candidateCvEducation.deleteMany({ where: { id: itemId, cvId } });
    if (deleted.count === 0) throw new AppError('Education not found', 404, 'EDUCATION_NOT_FOUND');
    await this.touchCv(cvId, userId);
    return { success: true };
  }
}
