import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { extractS3KeyFromPublicObjectUrl, getS3BucketName, s3Client } from '@/shared/storage/s3';
import {
  CV_IMPORT_DOCX_MIME,
  CV_IMPORT_PDF_MIME,
  extractCvText,
  inferMimeFromKey,
  isSupportedCvMime,
  type SupportedCvMime,
} from './cv-file-extractor';
import {
  applyCvImportSchema,
  type ApplyCvImportInput,
  type CreateCvImportInput,
  type CvImportSection,
  type ParsedCv,
} from './cv-imports.schema';
import type { CvParserProvider } from './providers/cv-parser.provider';
import { OpenAiCvParserProvider } from './providers/openai-cv-parser.provider';

const MAX_CV_FILE_SIZE = 10 * 1024 * 1024;

/** Section -> field hồ sơ chính tương ứng. Dùng cho fill_missing và snapshot. */
const PROFILE_SECTION_FIELDS: Record<Exclude<CvImportSection, 'experiences' | 'educations'>, string[]> = {
  basicInfo: ['fullName', 'title', 'headline', 'bio', 'gender', 'yearOfBirth'],
  contact: ['contactEmail', 'contactPhone', 'website', 'linkedin', 'github'],
  skills: ['skills'],
  knowledge: ['knowledge'],
  attitude: ['attitude'],
  careerGoals: ['careerGoals'],
  expectations: ['expectedSalaryMin', 'expectedSalaryMax', 'salaryCurrency', 'workMode'],
};

interface ImportJobRecord {
  id: string;
  userId: string;
  sourceCvUrl: string | null;
  sourceKey: string | null;
  fileName: string | null;
  fileType: string | null;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'APPLIED';
  parsedData: Prisma.JsonValue | null;
  warnings: Prisma.JsonValue | null;
  confidence: number | null;
  applyMode: string | null;
  appliedSections: string[];
  snapshotBefore: Prisma.JsonValue | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  appliedAt: Date | null;
}

export class CvImportsService {
  private cachedProvider: CvParserProvider | null = null;
  private readonly providerOverride: CvParserProvider | null;

  /**
   * Provider parse CV được khởi tạo lười để server có thể start ngay cả khi chưa
   * cấu hình OPENAI_API_KEY (chỉ báo lỗi 503 khi user thực sự gọi import).
   */
  constructor(provider?: CvParserProvider) {
    this.providerOverride = provider ?? null;
  }

  private getParser(): CvParserProvider {
    if (this.providerOverride) return this.providerOverride;
    if (!this.cachedProvider) {
      this.cachedProvider = new OpenAiCvParserProvider();
    }
    return this.cachedProvider;
  }

  /**
   * Tạo CvImportJob mới và parse CV ngay trong request (MVP).
   * - Chỉ chấp nhận sourceKey/cvUrl trỏ vào S3 bucket JoyWork.
   * - Bắt buộc file thuộc thư mục `users/{userId}/cv/`.
   */
  async createImport(userId: string, input: CreateCvImportInput): Promise<ImportJobRecord> {
    const resolved = this.resolveSourceForUser(userId, input);

    const job = await prisma.cvImportJob.create({
      data: {
        userId,
        sourceCvUrl: resolved.cvUrl,
        sourceKey: resolved.sourceKey,
        fileName: resolved.fileName,
        fileType: resolved.mime,
        status: 'PROCESSING',
      },
    });

    try {
      const buffer = await this.downloadFromS3(resolved.sourceKey);
      this.assertFileSize(buffer.byteLength);

      const extracted = await extractCvText({ buffer, mime: resolved.mime });
      const parsedResult = await this.getParser().parse({ text: extracted.text, localeHint: 'auto' });
      const sanitized = this.sanitizeParsedCv(parsedResult.parsed);

      const warnings = [...(sanitized.warnings ?? [])];
      if (extracted.truncated) {
        warnings.push('CV bị cắt do quá dài, một số phần ở cuối có thể bị thiếu.');
      }

      const updated = await prisma.cvImportJob.update({
        where: { id: job.id },
        data: {
          status: 'READY',
          parsedData: this.parsedCvToJson({ ...sanitized, warnings }),
          warnings: warnings as unknown as Prisma.InputJsonValue,
          confidence: typeof sanitized.confidence === 'number' ? sanitized.confidence : null,
        },
      });

      return updated as ImportJobRecord;
    } catch (error) {
      const errorCode = error instanceof AppError ? error.code : 'CV_IMPORT_PROCESSING_FAILED';
      const errorMessage =
        error instanceof AppError
          ? error.message
          : 'Không thể xử lý CV vào lúc này, vui lòng thử lại.';

      await prisma.cvImportJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorCode,
          errorMessage,
        },
      });

      throw error instanceof AppError
        ? error
        : new AppError(errorMessage, 500, errorCode);
    }
  }

  async getImport(userId: string, jobId: string): Promise<ImportJobRecord> {
    const job = await prisma.cvImportJob.findUnique({ where: { id: jobId } });
    if (!job || job.userId !== userId) {
      throw new AppError('Không tìm thấy phiên import CV', 404, 'CV_IMPORT_NOT_FOUND');
    }
    return job as ImportJobRecord;
  }

  async applyImport(userId: string, jobId: string, input: ApplyCvImportInput): Promise<ImportJobRecord> {
    const parsedInput = applyCvImportSchema.parse(input);

    const job = await this.getImport(userId, jobId);
    if (job.status === 'APPLIED') {
      throw new AppError('Phiên import đã được áp dụng trước đó', 409, 'CV_IMPORT_ALREADY_APPLIED');
    }
    if (job.status !== 'READY') {
      throw new AppError('Phiên import chưa sẵn sàng', 409, 'CV_IMPORT_NOT_READY');
    }

    const parsed = this.parsedCvFromJson(job.parsedData);

    const updated = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          experiences: { orderBy: [{ order: 'asc' }, { startDate: 'desc' }] },
          educations: { orderBy: [{ order: 'asc' }, { startDate: 'desc' }] },
        },
      });
      if (!existingUser) {
        throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
      }

      const snapshot = this.buildSnapshot(existingUser);

      const profileData = this.buildProfileUpdate({
        mode: parsedInput.mode,
        sections: parsedInput.sections,
        parsed,
        existingProfile: existingUser.profile,
      });

      if (profileData !== null) {
        await tx.userProfile.upsert({
          where: { userId },
          update: profileData,
          create: { ...(profileData as Prisma.UserProfileUncheckedCreateInput), userId },
        });
      }

      const shouldReplaceExperiences = this.shouldReplaceList({
        mode: parsedInput.mode,
        section: 'experiences',
        sections: parsedInput.sections,
        parsedHasItems: parsed.experiences.length > 0,
        existingHasItems: existingUser.experiences.length > 0,
      });

      if (shouldReplaceExperiences) {
        await tx.userExperience.deleteMany({ where: { userId } });
        const rows = parsed.experiences
          .map((exp, index) => this.buildExperienceCreate({ userId, exp, order: index }))
          .filter((row): row is Prisma.UserExperienceCreateManyInput => row !== null);
        if (rows.length > 0) {
          await tx.userExperience.createMany({ data: rows });
        }
      }

      const shouldReplaceEducations = this.shouldReplaceList({
        mode: parsedInput.mode,
        section: 'educations',
        sections: parsedInput.sections,
        parsedHasItems: parsed.educations.length > 0,
        existingHasItems: existingUser.educations.length > 0,
      });

      if (shouldReplaceEducations) {
        await tx.userEducation.deleteMany({ where: { userId } });
        const rows = parsed.educations
          .map((edu, index) => this.buildEducationCreate({ userId, edu, order: index }))
          .filter((row): row is Prisma.UserEducationCreateManyInput => row !== null);
        if (rows.length > 0) {
          await tx.userEducation.createMany({ data: rows });
        }
      }

      return tx.cvImportJob.update({
        where: { id: jobId },
        data: {
          status: 'APPLIED',
          applyMode: parsedInput.mode,
          appliedSections: parsedInput.sections,
          snapshotBefore: snapshot as unknown as Prisma.InputJsonValue,
          appliedAt: new Date(),
        },
      });
    });

    return updated as ImportJobRecord;
  }

  // ----------------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------------

  private resolveSourceForUser(
    userId: string,
    input: CreateCvImportInput
  ): { sourceKey: string; cvUrl: string | null; mime: SupportedCvMime; fileName: string | null } {
    let sourceKey = input.sourceKey?.trim() || null;
    let cvUrl = input.cvUrl?.trim() || null;

    if (!sourceKey && cvUrl) {
      sourceKey = extractS3KeyFromPublicObjectUrl(cvUrl);
      if (!sourceKey) {
        throw new AppError(
          'CV không thuộc hệ thống JOYWORK. Vui lòng upload lại file qua trang hồ sơ.',
          400,
          'CV_IMPORT_INVALID_SOURCE'
        );
      }
    }

    if (!sourceKey) {
      throw new AppError('Thiếu file CV để import', 400, 'CV_IMPORT_SOURCE_REQUIRED');
    }

    const expectedPrefix = `users/${userId}/cv/`;
    if (!sourceKey.startsWith(expectedPrefix)) {
      throw new AppError('Bạn không có quyền dùng tệp này để import CV', 403, 'CV_IMPORT_NOT_OWNER');
    }

    const mime = inferMimeFromKey(sourceKey);
    if (!mime || !isSupportedCvMime(mime)) {
      throw new AppError(
        'Định dạng CV chưa được hỗ trợ. Hãy upload PDF hoặc DOCX.',
        400,
        'CV_IMPORT_UNSUPPORTED_TYPE'
      );
    }

    const fileName = sourceKey.split('/').pop() ?? null;
    return { sourceKey, cvUrl, mime, fileName };
  }

  private async downloadFromS3(key: string): Promise<Buffer> {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: getS3BucketName(),
        Key: key,
      })
    );

    const body = response.Body as
      | { transformToByteArray?: () => Promise<Uint8Array> }
      | null
      | undefined;

    if (!body || typeof body.transformToByteArray !== 'function') {
      throw new AppError('Không thể tải file CV từ kho lưu trữ', 500, 'CV_IMPORT_DOWNLOAD_FAILED');
    }

    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  private assertFileSize(size: number) {
    if (size <= 0) {
      throw new AppError('File CV rỗng', 422, 'CV_IMPORT_EMPTY_FILE');
    }
    if (size > MAX_CV_FILE_SIZE) {
      throw new AppError('CV vượt quá 10MB', 413, 'CV_IMPORT_FILE_TOO_LARGE');
    }
  }

  private sanitizeParsedCv(parsed: ParsedCv): ParsedCv {
    const trimArray = (arr: string[] | undefined, max: number) =>
      (arr ?? [])
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .slice(0, max);

    const experiences = (parsed.experiences ?? []).map((exp) => ({
      ...exp,
      achievements: trimArray(exp.achievements, 20),
    }));

    return {
      basicInfo: parsed.basicInfo ?? {},
      contact: parsed.contact ?? {},
      skills: trimArray(parsed.skills, 20),
      knowledge: trimArray(parsed.knowledge, 30),
      attitude: trimArray(parsed.attitude, 30),
      careerGoals: trimArray(parsed.careerGoals, 10),
      expectations: parsed.expectations ?? {},
      experiences: experiences.slice(0, 30),
      educations: (parsed.educations ?? []).slice(0, 20),
      warnings: trimArray(parsed.warnings, 20),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
    };
  }

  private parsedCvToJson(parsed: ParsedCv): Prisma.InputJsonValue {
    return parsed as unknown as Prisma.InputJsonValue;
  }

  private parsedCvFromJson(value: Prisma.JsonValue | null): ParsedCv {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new AppError('Phiên import CV không có dữ liệu', 409, 'CV_IMPORT_NO_DATA');
    }
    return value as unknown as ParsedCv;
  }

  /** Lưu snapshot tối giản trước khi apply (chỉ profile + experiences + educations). */
  private buildSnapshot(user: {
    profile: Prisma.JsonObject | unknown;
    experiences: unknown[];
    educations: unknown[];
  }): Prisma.JsonObject {
    return {
      profile: (user.profile as unknown as Prisma.JsonObject) ?? null,
      experiences: user.experiences as unknown as Prisma.JsonObject[],
      educations: user.educations as unknown as Prisma.JsonObject[],
    };
  }

  /**
   * Quyết định section nào áp dụng và build object update cho UserProfile.
   * Trả về `null` nếu không có gì cần update để tránh upsert thừa.
   */
  private buildProfileUpdate(params: {
    mode: 'fill_missing' | 'overwrite';
    sections: CvImportSection[];
    parsed: ParsedCv;
    existingProfile: {
      fullName: string | null;
      title: string | null;
      headline: string | null;
      bio: string | null;
      gender: string | null;
      yearOfBirth: number | null;
      contactEmail: string | null;
      contactPhone: string | null;
      website: string | null;
      linkedin: string | null;
      github: string | null;
      skills: string[];
      knowledge: string[];
      attitude: string[];
      careerGoals: string[];
      expectedSalaryMin: bigint | null;
      expectedSalaryMax: bigint | null;
      salaryCurrency: string | null;
      workMode: string | null;
    } | null;
  }): Prisma.UserProfileUncheckedUpdateInput | null {
    const { mode, sections, parsed, existingProfile } = params;
    const data: Prisma.UserProfileUncheckedUpdateInput = {};
    const allowSection = (section: CvImportSection): boolean => sections.includes(section);

    const setIfApplicable = <K extends keyof Prisma.UserProfileUncheckedUpdateInput>(
      key: K,
      value: Prisma.UserProfileUncheckedUpdateInput[K],
      isMissing: boolean
    ) => {
      if (value === undefined || value === null) return;
      if (mode === 'fill_missing' && !isMissing) return;
      data[key] = value;
    };

    if (allowSection('basicInfo')) {
      const basic = parsed.basicInfo ?? {};
      setIfApplicable('fullName', basic.fullName ?? undefined, !existingProfile?.fullName);
      setIfApplicable('title', basic.title ?? undefined, !existingProfile?.title);
      setIfApplicable('headline', basic.headline ?? undefined, !existingProfile?.headline);
      setIfApplicable('bio', basic.bio ?? undefined, !existingProfile?.bio);
      if (basic.gender) {
        setIfApplicable('gender', basic.gender, !existingProfile?.gender);
      }
      if (typeof basic.yearOfBirth === 'number') {
        setIfApplicable('yearOfBirth', basic.yearOfBirth, !existingProfile?.yearOfBirth);
      }
    }

    if (allowSection('contact')) {
      const contact = parsed.contact ?? {};
      setIfApplicable('contactEmail', contact.contactEmail ?? undefined, !existingProfile?.contactEmail);
      setIfApplicable('contactPhone', contact.contactPhone ?? undefined, !existingProfile?.contactPhone);
      setIfApplicable('website', contact.website ?? undefined, !existingProfile?.website);
      setIfApplicable('linkedin', contact.linkedin ?? undefined, !existingProfile?.linkedin);
      setIfApplicable('github', contact.github ?? undefined, !existingProfile?.github);
    }

    if (allowSection('skills') && parsed.skills.length > 0) {
      const existingEmpty = !existingProfile?.skills || existingProfile.skills.length === 0;
      if (mode === 'overwrite' || existingEmpty) {
        data.skills = parsed.skills;
      }
    }
    if (allowSection('knowledge') && parsed.knowledge.length > 0) {
      const existingEmpty = !existingProfile?.knowledge || existingProfile.knowledge.length === 0;
      if (mode === 'overwrite' || existingEmpty) {
        data.knowledge = parsed.knowledge;
      }
    }
    if (allowSection('attitude') && parsed.attitude.length > 0) {
      const existingEmpty = !existingProfile?.attitude || existingProfile.attitude.length === 0;
      if (mode === 'overwrite' || existingEmpty) {
        data.attitude = parsed.attitude;
      }
    }
    if (allowSection('careerGoals') && parsed.careerGoals.length > 0) {
      const existingEmpty = !existingProfile?.careerGoals || existingProfile.careerGoals.length === 0;
      if (mode === 'overwrite' || existingEmpty) {
        data.careerGoals = parsed.careerGoals;
      }
    }

    if (allowSection('expectations')) {
      const exp = parsed.expectations ?? {};
      if (typeof exp.expectedSalaryMin === 'number') {
        setIfApplicable(
          'expectedSalaryMin',
          BigInt(Math.max(0, Math.floor(exp.expectedSalaryMin))),
          existingProfile?.expectedSalaryMin == null
        );
      }
      if (typeof exp.expectedSalaryMax === 'number') {
        setIfApplicable(
          'expectedSalaryMax',
          BigInt(Math.max(0, Math.floor(exp.expectedSalaryMax))),
          existingProfile?.expectedSalaryMax == null
        );
      }
      if (exp.salaryCurrency) {
        setIfApplicable('salaryCurrency', exp.salaryCurrency, !existingProfile?.salaryCurrency);
      }
      if (exp.workMode) {
        setIfApplicable('workMode', exp.workMode, !existingProfile?.workMode);
      }
    }

    if (Object.keys(data).length === 0) {
      return null;
    }
    return data;
  }

  private shouldReplaceList(params: {
    mode: 'fill_missing' | 'overwrite';
    section: 'experiences' | 'educations';
    sections: CvImportSection[];
    parsedHasItems: boolean;
    existingHasItems: boolean;
  }): boolean {
    const { mode, section, sections, parsedHasItems, existingHasItems } = params;
    if (!sections.includes(section)) return false;
    if (!parsedHasItems) return false;
    if (mode === 'overwrite') return true;
    return !existingHasItems;
  }

  private buildExperienceCreate(params: {
    userId: string;
    exp: ParsedCv['experiences'][number];
    order: number;
  }): Prisma.UserExperienceCreateManyInput | null {
    const role = params.exp.role?.trim();
    const company = params.exp.company?.trim();
    if (!role || !company) return null;

    return {
      userId: params.userId,
      role,
      company,
      startDate: this.parseDateString(params.exp.startDate),
      endDate: this.parseDateString(params.exp.endDate),
      period: params.exp.period?.trim() || null,
      desc: params.exp.desc?.trim() || null,
      achievements: params.exp.achievements ?? [],
      order: params.order,
    };
  }

  private buildEducationCreate(params: {
    userId: string;
    edu: ParsedCv['educations'][number];
    order: number;
  }): Prisma.UserEducationCreateManyInput | null {
    const school = params.edu.school?.trim();
    const degree = params.edu.degree?.trim();
    if (!school || !degree) return null;

    return {
      userId: params.userId,
      school,
      degree,
      startDate: this.parseDateString(params.edu.startDate),
      endDate: this.parseDateString(params.edu.endDate),
      period: params.edu.period?.trim() || null,
      gpa: params.edu.gpa?.trim() || null,
      honors: params.edu.honors?.trim() || null,
      order: params.order,
    };
  }

  private parseDateString(value: string | null | undefined): Date | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Hỗ trợ YYYY, YYYY-MM, YYYY-MM-DD; reject các format mơ hồ như "Hiện tại".
    if (/^\d{4}$/.test(trimmed)) {
      return new Date(`${trimmed}-01-01T00:00:00.000Z`);
    }
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}-01T00:00:00.000Z`);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const dt = new Date(`${trimmed}T00:00:00.000Z`);
      if (!Number.isNaN(dt.getTime())) return dt;
    }
    return null;
  }
}

/** Re-export một số hằng số để consumer khác (FE) tham chiếu nếu cần. */
export const SUPPORTED_CV_MIME_TYPES = [CV_IMPORT_PDF_MIME, CV_IMPORT_DOCX_MIME];
export const PROFILE_SECTION_FIELDS_MAP = PROFILE_SECTION_FIELDS;
