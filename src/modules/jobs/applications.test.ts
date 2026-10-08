import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, evaluateCvReadinessMock } = vi.hoisted(() => {
  const prismaMock = {
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    job: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    candidateCv: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    application: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    companyMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
  };
  return { prismaMock, evaluateCvReadinessMock: vi.fn() };
});

vi.mock('@/shared/database/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@/config/env', () => ({
  config: {
    FRONTEND_ORIGIN: 'http://localhost:3000',
  },
}));

vi.mock('@/shared/elasticsearch/client', () => ({
  getEsClient: vi.fn(() => null),
}));

vi.mock('@/shared/elasticsearch/sync', () => ({
  syncJobToEs: vi.fn(),
  deleteJobFromEs: vi.fn(),
}));

vi.mock('@/shared/services/email.service', () => ({
  emailService: {},
}));

vi.mock('@/shared/services/send-email-async', () => ({
  sendEmailInBackground: vi.fn(),
}));

vi.mock('@/shared/services/email-helper.service', () => ({
  getVerifiedEmailForUser: vi.fn().mockResolvedValue(null),
  getVerifiedEmailsForUsers: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('@/shared/services/notification.service', () => ({
  notificationService: {
    createNotificationsForUsers: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/shared/services/embedding.service', () => ({
  generateAndStoreJobEmbedding: vi.fn(),
  generateEmbedding: vi.fn(),
}));

vi.mock('@/modules/candidate-cvs/candidate-cvs.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/candidate-cvs/candidate-cvs.service')>();
  return { ...actual, evaluateCvReadiness: evaluateCvReadinessMock };
});

import { JobsService } from './jobs.service';
import type { CandidateCvService } from '@/modules/candidate-cvs/candidate-cvs.service';

const USER_ID = 'user-1';
const JOB_ID = 'job-1';
const CV_A = 'cv-a';
const CV_B = 'cv-b';

const cvService = {
  resolveTargetCvId: vi.fn(async (_userId: string, cvId?: string) => cvId ?? CV_A),
} as unknown as CandidateCvService;

const service = new JobsService(cvService);

function buildCv(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    userId: USER_ID,
    name: `CV ${id}`,
    avatar: null,
    fullName: 'Nguyễn Văn A',
    title: 'Kỹ sư phần mềm',
    headline: 'Backend',
    bio: 'Giới thiệu',
    skills: ['Node.js'],
    knowledge: [],
    attitude: [],
    cvUrl: null,
    locations: ['01'],
    wardCodes: [],
    specificAddress: null,
    website: null,
    linkedin: null,
    github: null,
    contactEmail: 'a@example.com',
    contactPhone: '0900000000',
    visibility: null,
    expectedSalaryMin: null,
    expectedSalaryMax: null,
    salaryCurrency: 'VND',
    workMode: null,
    expectedCulture: null,
    careerGoals: [],
    gender: null,
    dayOfBirth: null,
    monthOfBirth: null,
    yearOfBirth: null,
    educationLevel: null,
    experiences: [],
    educations: [],
    ...overrides,
  };
}

function mockActiveJob() {
  prismaMock.job.findUnique.mockResolvedValue({
    id: JOB_ID,
    title: 'Backend Developer',
    companyId: 'company-1',
    isActive: true,
    applicationDeadline: null,
    company: { id: 'company-1', name: 'JoyWork', slug: 'joywork', visibilityStatus: 'ACTIVE' },
  });
}

function mockApplyTransaction(options: { cv?: ReturnType<typeof buildCv> | null; previous?: unknown[] }) {
  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
    callback(prismaMock)
  );
  prismaMock.$executeRaw.mockResolvedValue(1);
  prismaMock.candidateCv.findFirst.mockResolvedValue(options.cv === undefined ? buildCv(CV_A) : options.cv);
  prismaMock.user.findUniqueOrThrow.mockResolvedValue({
    id: USER_ID,
    name: 'Nguyễn Văn A',
    email: 'a@example.com',
    phone: null,
    slug: 'nguyen-van-a',
  });
  prismaMock.application.findMany.mockResolvedValue(options.previous ?? []);
  prismaMock.application.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'app-new',
    appliedAt: new Date('2026-09-28T10:00:00.000Z'),
    ...data,
  }));
  prismaMock.job.update.mockResolvedValue({});
  prismaMock.companyMember.findMany.mockResolvedValue([]);
}

describe('JobsService.applyForJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateCvReadinessMock.mockReturnValue({ isReady: true, missingSections: [] });
    mockActiveJob();
  });

  it('tạo đơn với snapshot của CV được chọn và trả applicationId', async () => {
    mockApplyTransaction({ cv: buildCv(CV_B) });

    const result = await service.applyForJob(USER_ID, { jobId: JOB_ID, cvId: CV_B });

    expect(result).toEqual({ applicationId: 'app-new' });
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
    const { data } = prismaMock.application.create.mock.calls[0]![0] as { data: Record<string, any> };
    expect(data.sourceCvId).toBe(CV_B);
    expect(data.cvSnapshotVersion).toBe(1);
    expect(data.cvSnapshot).toMatchObject({ version: 1, source: 'apply', cvId: CV_B, cvName: `CV ${CV_B}` });
  });

  it('từ chối ứng tuyển khi công ty đang ẩn và không tạo đơn', async () => {
    prismaMock.job.findUnique.mockResolvedValue({
      id: JOB_ID,
      isActive: true,
      deadline: null,
      title: 'Backend',
      companyId: 'company-1',
      company: { id: 'company-1', name: 'Joy', slug: 'joy', visibilityStatus: 'HIDDEN' },
    });

    await expect(service.applyForJob(USER_ID, { jobId: JOB_ID, cvId: CV_A })).rejects.toMatchObject({
      statusCode: 404,
      code: 'JOB_NOT_FOUND',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('cho phép apply lại cùng CV khi đơn cũ còn mở', async () => {
    mockApplyTransaction({
      previous: [{ id: 'app-old', status: 'SUITABLE', sourceCvId: CV_A }],
    });

    await expect(service.applyForJob(USER_ID, { jobId: JOB_ID })).resolves.toEqual({
      applicationId: 'app-new',
    });
    expect(prismaMock.application.create).toHaveBeenCalledTimes(1);
  });

  it('cho phép apply lại bằng CV khác khi đơn cũ còn mở', async () => {
    mockApplyTransaction({
      cv: buildCv(CV_B),
      previous: [{ id: 'app-old', status: 'RECEIVED', sourceCvId: CV_A }],
    });

    await expect(service.applyForJob(USER_ID, { jobId: JOB_ID, cvId: CV_B })).resolves.toEqual({
      applicationId: 'app-new',
    });
  });

  it('cho phép apply lại cùng CV khi đơn cũ đã đóng (NOT_SUITABLE)', async () => {
    mockApplyTransaction({
      previous: [{ id: 'app-old', status: 'NOT_SUITABLE', sourceCvId: CV_A }],
    });

    await expect(service.applyForJob(USER_ID, { jobId: JOB_ID })).resolves.toEqual({
      applicationId: 'app-new',
    });
  });

  it('cho phép apply lại cùng CV khi đơn cũ đã đóng (NOT_SUITABLE_SAVED)', async () => {
    mockApplyTransaction({
      previous: [{ id: 'app-old', status: 'NOT_SUITABLE_SAVED', sourceCvId: CV_A }],
    });

    await expect(service.applyForJob(USER_ID, { jobId: JOB_ID })).resolves.toEqual({
      applicationId: 'app-new',
    });
  });

  it('400 CV_PROFILE_INCOMPLETE khi CV chưa đủ thông tin', async () => {
    mockApplyTransaction({});
    evaluateCvReadinessMock.mockReturnValue({ isReady: false, missingSections: ['kinh nghiệm'] });

    await expect(service.applyForJob(USER_ID, { jobId: JOB_ID })).rejects.toMatchObject({
      statusCode: 400,
      code: 'CV_PROFILE_INCOMPLETE',
    });
  });

  it('404 khi CV không thuộc người dùng', async () => {
    mockApplyTransaction({ cv: null });

    await expect(service.applyForJob(USER_ID, { jobId: JOB_ID, cvId: 'cv-other' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'CV_NOT_FOUND',
    });
  });
});

describe('JobsService.getApplications authz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('400 khi thiếu cả companyId và jobId', async () => {
    await expect(service.getApplications({ page: 1, limit: 20 }, USER_ID)).rejects.toMatchObject({
      statusCode: 400,
      code: 'COMPANY_OR_JOB_REQUIRED',
    });
  });

  it('403 khi người xem không thuộc công ty', async () => {
    prismaMock.companyMember.findFirst.mockResolvedValue(null);

    await expect(
      service.getApplications({ companyId: 'company-1', page: 1, limit: 20 }, USER_ID)
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(prismaMock.application.findMany).not.toHaveBeenCalled();
  });

  it('chỉ có jobId → suy ra công ty của job để kiểm tra quyền', async () => {
    prismaMock.job.findUnique.mockResolvedValue({ companyId: 'company-2' });
    prismaMock.companyMember.findFirst.mockResolvedValue(null);

    await expect(service.getApplications({ jobId: JOB_ID, page: 1, limit: 20 }, USER_ID)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(prismaMock.companyMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-2' }) })
    );
  });

  it('trả "lần n" và đơn trước theo cùng (userId, jobId)', async () => {
    prismaMock.companyMember.findFirst.mockResolvedValue({ id: 'member-1' });
    prismaMock.company.findUnique.mockResolvedValue({ visibilityStatus: 'ACTIVE' });
    const appliedAt = new Date('2026-09-28T10:00:00.000Z');
    prismaMock.application.findMany
      .mockResolvedValueOnce([
        {
          id: 'app-2',
          jobId: JOB_ID,
          userId: USER_ID,
          status: 'RECEIVED',
          coverLetter: null,
          resumeUrl: null,
          notes: null,
          appliedAt,
          updatedAt: appliedAt,
          sourceCvId: CV_B,
          cvSnapshot: null,
          job: {
            id: JOB_ID,
            slug: 'backend',
            title: 'Backend Developer',
            company: { id: 'company-1', name: 'JoyWork', slug: 'joywork', logoUrl: null, badges: [] },
          },
          user: { id: USER_ID, name: 'A', email: 'a@example.com', slug: null, profile: null },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'app-1', userId: USER_ID, jobId: JOB_ID, appliedAt: new Date('2026-09-01'), status: 'NOT_SUITABLE', sourceCvId: CV_A, cvSnapshot: null, sourceCv: { name: 'CV cũ' } },
        { id: 'app-2', userId: USER_ID, jobId: JOB_ID, appliedAt, status: 'RECEIVED', sourceCvId: CV_B, cvSnapshot: null, sourceCv: null },
      ]);
    prismaMock.application.count.mockResolvedValue(1);

    const result = await service.getApplications({ companyId: 'company-1', page: 1, limit: 20 }, USER_ID);

    const [app] = result.applications as any[];
    expect(app.reapplyIndex).toBe(2);
    expect(app.previousApplications).toEqual([
      expect.objectContaining({ id: 'app-1', status: 'NOT_SUITABLE', sourceCvName: 'CV cũ' }),
    ]);
  });
});

describe('JobsService.getApplicationDetail authz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('404 như nhau khi đơn không tồn tại hoặc người xem không có quyền', async () => {
    prismaMock.application.findUnique.mockResolvedValueOnce(null);
    await expect(service.getApplicationDetail('app-x', USER_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'APPLICATION_NOT_FOUND',
    });

    prismaMock.application.findUnique.mockResolvedValueOnce({
      id: 'app-1',
      userId: 'candidate-1',
      jobId: JOB_ID,
      job: { id: JOB_ID, companyId: 'company-1' },
    });
    prismaMock.companyMember.findFirst.mockResolvedValueOnce(null);
    await expect(service.getApplicationDetail('app-1', USER_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'APPLICATION_NOT_FOUND',
    });
  });

  it('403 COMPANY_HIDDEN khi thành viên mở đơn của công ty đang ẩn', async () => {
    prismaMock.application.findUnique.mockResolvedValue({
      id: 'app-1',
      userId: 'candidate-1',
      jobId: JOB_ID,
      job: {
        id: JOB_ID,
        slug: 'backend',
        title: 'Backend',
        companyId: 'company-1',
        company: { id: 'company-1', name: 'Joy', slug: 'joy', logoUrl: null },
      },
    });
    prismaMock.companyMember.findFirst.mockResolvedValue({ id: 'member-1' });
    prismaMock.company.findUnique.mockResolvedValue({ visibilityStatus: 'HIDDEN' });

    await expect(service.getApplicationDetail('app-1', USER_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: 'COMPANY_HIDDEN',
    });
  });
});

describe('JobsService.getMyApplications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('vẫn trả đơn khi công ty đang ẩn', async () => {
    const appliedAt = new Date('2026-09-28T10:00:00.000Z');
    const row = {
      id: 'app-1',
      jobId: JOB_ID,
      userId: USER_ID,
      status: 'RECEIVED',
      coverLetter: null,
      resumeUrl: null,
      notes: null,
      appliedAt,
      updatedAt: appliedAt,
      sourceCvId: null,
      cvSnapshot: null,
      job: {
        id: JOB_ID,
        slug: 'backend',
        title: 'Backend',
        company: { id: 'company-1', name: 'Joy ẩn', slug: 'joy', logoUrl: null, badges: [] },
      },
      user: { id: USER_ID, name: 'A', email: 'a@example.com', slug: null, profile: null },
    };
    prismaMock.application.findMany.mockResolvedValueOnce([row]).mockResolvedValueOnce([
      {
        id: 'app-1',
        userId: USER_ID,
        jobId: JOB_ID,
        appliedAt,
        status: 'RECEIVED',
        sourceCvId: null,
        cvSnapshot: null,
        sourceCv: null,
      },
    ]);
    prismaMock.application.count.mockResolvedValue(1);

    const result = await service.getMyApplications(USER_ID, { page: 1, limit: 20 });

    expect(prismaMock.application.findMany.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ where: { userId: USER_ID } }),
    );
    expect(JSON.stringify(prismaMock.application.findMany.mock.calls[0]?.[0])).not.toContain('visibilityStatus');
    expect(result.applications[0]?.job.company.name).toBe('Joy ẩn');
  });
});
