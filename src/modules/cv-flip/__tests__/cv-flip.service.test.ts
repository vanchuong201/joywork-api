import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CvFlipService } from '../cv-flip.service';
import { signCvFlipEmailActionToken } from '../cv-flip-email-token';
import { buildDiscoverableUserWhere } from '@/shared/candidates/discoverable';

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    application: {
      findFirst: vi.fn(),
    },
    companyMember: {
      findFirst: vi.fn(),
    },
    cvFlipRequest: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    cvFlipConnection: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    cvFlipUsage: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    companyFeatureEntitlement: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

vi.mock('@/config/env', () => ({
  config: {
    FRONTEND_ORIGIN: 'http://localhost:3000',
    JWT_SECRET: 'a'.repeat(32),
    REFRESH_SECRET: 'b'.repeat(32),
  },
}));

vi.mock('@/shared/services/email-helper.service', () => ({
  getVerifiedEmailForUser: vi.fn(),
}));

vi.mock('@/shared/services/email.service', () => ({
  emailService: {},
}));

vi.mock('@/shared/services/notification.service', () => ({
  notificationService: {
    createNotification: vi.fn(),
  },
}));

import { prisma } from '@/shared/database/prisma';

const service = new CvFlipService();

const baseUser = {
  id: 'user-1',
  name: 'Ẩn danh',
  slug: 'ung-vien-1',
  profile: {
    status: 'OPEN_TO_WORK',
    defaultCv: {
      fullName: 'Ứng viên A',
      headline: 'Senior Backend Engineer',
      title: 'Backend Engineer',
      skills: ['Node.js'],
      locations: ['ha-noi'],
      expectedSalaryMin: 15000000n,
      expectedSalaryMax: 25000000n,
      salaryCurrency: 'VND',
      workMode: 'ONSITE',
      gender: 'MALE',
      educationLevel: 'BACHELOR',
      experiences: [
        {
          id: 'exp-1',
          role: 'Backend Developer',
          company: 'JoyWork',
          period: '2022-2024',
          desc: 'Build APIs',
          achievements: [],
          order: 1,
        },
      ],
      educations: [],
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CvFlipService.listCandidates', () => {
  it('áp dụng điều kiện CV đủ chuẩn trước count và phân trang', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(1);
    vi.mocked(prisma.user.findMany).mockResolvedValue([baseUser] as never);

    const result = await service.listCandidates({
      page: 1,
      limit: 10,
      salaryCurrency: 'VND',
    });

    expect(result.pagination.total).toBe(1);
    expect(result.candidates).toHaveLength(1);

    const countWhere = vi.mocked(prisma.user.count).mock.calls[0][0]?.where;
    expect(countWhere).toEqual(expect.objectContaining({ AND: expect.arrayContaining([buildDiscoverableUserWhere()]) }));
    expect(JSON.stringify(countWhere)).toContain('"defaultCv":{"is":{"experiences":{"some":{}}}}');
    expect(JSON.stringify(countWhere)).toContain('"isSearchingJob":true');
    expect(result.candidates[0]).toMatchObject({ title: 'Backend Engineer', expectedSalaryMin: 15000000 });
  });

  it('giữ keyword ranking và vẫn lọc theo điều kiện CV đủ chuẩn', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'user-1' }] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([baseUser] as never);

    const result = await service.listCandidates({
      page: 1,
      limit: 10,
      keyword: 'backend',
      salaryCurrency: 'VND',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.user.count).not.toHaveBeenCalled();
    expect(result.pagination.total).toBe(1);
    expect(result.candidates[0]?.userId).toBe('user-1');
  });
});

describe('CvFlipService.getCandidateDetail', () => {
  const companyId = 'clxxxxxxxxxxxxxxxxxxxxxx1';
  const detailUser = (isSearchingJob: boolean) => ({
    id: 'cand-1',
    name: 'Ứng viên A',
    slug: 'ung-vien-a',
    email: 'a@example.com',
    phone: '0900000000',
    avatar: null,
    accountStatus: 'ACTIVE',
    profile: {
      status: 'OPEN_TO_WORK',
      isSearchingJob,
      allowCvFlip: true,
      defaultCv: {
        ...baseUser.profile.defaultCv,
        avatar: null,
        bio: 'Bio',
        cvUrl: 'https://cdn/cv.pdf',
        wardCodes: [],
        specificAddress: null,
        website: null,
        linkedin: null,
        github: null,
        contactEmail: 'contact@example.com',
        contactPhone: '0911111111',
        knowledge: [],
        attitude: [],
        careerGoals: [],
        expectedCulture: null,
        dayOfBirth: null,
        monthOfBirth: null,
        yearOfBirth: 1995,
        experiences: [],
        educations: [],
      },
    },
  });

  it('404 khi ứng viên tắt tìm việc, kể cả DN đã nhận đơn', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(detailUser(false) as never);

    await expect(
      service.getCandidateDetail('ung-vien-a', 'hr-1', { companyId })
    ).rejects.toMatchObject({ statusCode: 404, code: 'CANDIDATE_NOT_FOUND' });
    expect(prisma.application.findFirst).not.toHaveBeenCalled();
  });

  it('DN đã nhận đơn nhưng chưa mở CV vẫn bị ẩn liên hệ', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(detailUser(true) as never);
    vi.mocked(prisma.companyMember.findFirst).mockResolvedValue({ id: 'member-1' } as never);
    vi.mocked(prisma.application.findFirst).mockResolvedValue({ id: 'app-1' } as never);
    vi.mocked(prisma.cvFlipConnection.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.cvFlipRequest.findUnique).mockResolvedValue(null);

    const result = await service.getCandidateDetail('ung-vien-a', 'hr-1', { companyId });

    expect(result.access).toMatchObject({ isFlipped: false, hasAppliedToCompany: true });
    expect(result.candidate.profile).toMatchObject({
      contactEmail: null,
      contactPhone: null,
      cvUrl: null,
      title: 'Backend Engineer',
      isSearchingJob: true,
    });
  });

  it('đã có connection thì mở liên hệ từ CV mặc định', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(detailUser(true) as never);
    vi.mocked(prisma.companyMember.findFirst).mockResolvedValue({ id: 'member-1' } as never);
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.cvFlipConnection.findUnique).mockResolvedValue({
      id: 'conn-1',
      flippedAt: new Date('2026-09-01T00:00:00.000Z'),
    } as never);
    vi.mocked(prisma.cvFlipRequest.findUnique).mockResolvedValue(null);

    const result = await service.getCandidateDetail('ung-vien-a', 'hr-1', { companyId });

    expect(result.access.isFlipped).toBe(true);
    expect(result.candidate.profile).toMatchObject({
      contactEmail: 'contact@example.com',
      contactPhone: '0911111111',
      cvUrl: 'https://cdn/cv.pdf',
    });
  });
});

describe('CvFlipService.listCompanyRequests', () => {
  const companyId = 'clxxxxxxxxxxxxxxxxxxxxxx1';
  const actorId = 'clxxxxxxxxxxxxxxxxxxxxxx2';

  it('từ chối MEMBER không có quyền OWNER/ADMIN', async () => {
    vi.mocked(prisma.companyMember.findFirst).mockResolvedValue(null);

    await expect(
      service.listCompanyRequests(actorId, {
        companyId,
        page: 1,
        limit: 20,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'COMPANY_PERMISSION_DENIED',
    });

    expect(prisma.cvFlipRequest.findMany).not.toHaveBeenCalled();
  });

  it('lọc theo status và phân trang', async () => {
    vi.mocked(prisma.companyMember.findFirst).mockResolvedValue({ id: 'member-1' } as never);
    vi.mocked(prisma.cvFlipRequest.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.cvFlipRequest.findMany).mockResolvedValue([
      {
        id: 'req-1',
        status: 'PENDING',
        expiresAt: new Date('2026-09-14T00:00:00.000Z'),
        createdAt: new Date('2026-09-07T00:00:00.000Z'),
        respondedAt: null,
        message: 'Xin chào',
        job: { id: 'job-1', title: 'Backend', slug: 'backend' },
        user: { id: 'cand-1', name: 'Ứng viên A', slug: 'ung-vien-a', avatar: null },
      },
    ] as never);
    vi.mocked(prisma.cvFlipRequest.count).mockResolvedValue(21);

    const result = await service.listCompanyRequests(actorId, {
      companyId,
      page: 2,
      limit: 10,
      status: 'PENDING',
    });

    expect(prisma.cvFlipRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId,
          status: 'PENDING',
        }),
      }),
    );
    expect(prisma.cvFlipRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId, status: 'PENDING' },
        skip: 10,
        take: 10,
      }),
    );
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
    expect(result.requests[0]).toMatchObject({
      id: 'req-1',
      status: 'PENDING',
      message: 'Xin chào',
      source: 'REQUEST',
      candidate: { id: 'cand-1', name: 'Ứng viên A', slug: 'ung-vien-a', avatar: null },
      job: { id: 'job-1', title: 'Backend', slug: 'backend' },
    });
    expect(prisma.cvFlipConnection.findMany).not.toHaveBeenCalled();
  });

  it('tab Đã đồng ý gộp CV mở thẳng và không trùng request đã duyệt', async () => {
    vi.mocked(prisma.companyMember.findFirst).mockResolvedValue({ id: 'member-1' } as never);
    vi.mocked(prisma.cvFlipRequest.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.cvFlipRequest.findMany)
      .mockResolvedValueOnce([
        { id: 'req-approved', createdAt: new Date('2026-09-06T00:00:00.000Z') },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: 'req-approved',
          status: 'APPROVED',
          expiresAt: new Date('2026-09-13T00:00:00.000Z'),
          createdAt: new Date('2026-09-06T00:00:00.000Z'),
          respondedAt: new Date('2026-09-06T12:00:00.000Z'),
          message: 'Xin chào',
          job: { id: 'job-1', title: 'Backend', slug: 'backend' },
          user: { id: 'cand-1', name: 'Ứng viên A', slug: 'ung-vien-a', avatar: null },
        },
      ] as never);
    vi.mocked(prisma.cvFlipConnection.findMany)
      .mockResolvedValueOnce([
        { id: 'conn-direct', flippedAt: new Date('2026-09-07T00:00:00.000Z') },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: 'conn-direct',
          flippedAt: new Date('2026-09-07T00:00:00.000Z'),
          user: { id: 'cand-2', name: 'Ứng viên B', slug: 'ung-vien-b', avatar: null },
        },
      ] as never);

    const result = await service.listCompanyRequests(actorId, {
      companyId,
      page: 1,
      limit: 10,
      status: 'APPROVED',
    });

    expect(prisma.cvFlipConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId,
          user: {
            cvFlipRequestsReceived: {
              none: { companyId, status: 'APPROVED' },
            },
          },
        }),
      }),
    );
    expect(result.pagination.total).toBe(2);
    expect(result.requests.map((row) => row.id)).toEqual(['direct:conn-direct', 'req-approved']);
    expect(result.requests[0]).toMatchObject({
      status: 'APPROVED',
      source: 'DIRECT_OPEN',
      candidate: { id: 'cand-2', slug: 'ung-vien-b' },
      job: null,
      message: null,
    });
    expect(result.requests[1]).toMatchObject({
      source: 'REQUEST',
      status: 'APPROVED',
    });
  });
});

describe('CvFlipService.consumeEmailAction', () => {
  it('từ chối token không hợp lệ', async () => {
    await expect(service.consumeEmailAction('not-a-jwt')).rejects.toMatchObject({
      code: 'CV_FLIP_EMAIL_TOKEN_INVALID',
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('action list cấp session mà không đổi request', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ accountStatus: 'ACTIVE' } as never);
    const token = signCvFlipEmailActionToken({
      userId: 'user-1',
      requestId: 'req-1',
      action: 'list',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await service.consumeEmailAction(token);

    expect(result.action).toBe('list');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(prisma.cvFlipRequest.findUnique).not.toHaveBeenCalled();
  });

  it('reject thành công khi request còn PENDING', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ accountStatus: 'ACTIVE' } as never);
    vi.mocked(prisma.cvFlipRequest.findUnique).mockResolvedValue({
      id: 'req-1',
      companyId: 'company-1',
      userId: 'user-1',
      requestedBy: 'hr-1',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
      company: { name: 'ACME' },
      user: { name: 'Ứng viên A', slug: 'ung-vien-a' },
    } as never);
    vi.mocked(prisma.cvFlipRequest.update).mockResolvedValue({} as never);

    const token = signCvFlipEmailActionToken({
      userId: 'user-1',
      requestId: 'req-1',
      action: 'reject',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await service.consumeEmailAction(token);

    expect(result).toMatchObject({
      action: 'reject',
      requestStatus: 'REJECTED',
    });
    expect(result.accessToken).toBeTruthy();
    expect(prisma.cvFlipRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: { status: 'REJECTED', respondedAt: expect.any(Date) },
    });
  });
});

describe('CvFlipService.flipCandidate (mở trực tiếp)', () => {
  const companyId = 'clxxxxxxxxxxxxxxxxxxxxxx1';
  const actorId = 'clxxxxxxxxxxxxxxxxxxxxxx2';
  const candidateUserId = 'clxxxxxxxxxxxxxxxxxxxxxx3';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.companyMember.findFirst).mockResolvedValue({ id: 'member-1' } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: candidateUserId,
      slug: 'ung-vien',
      name: 'Ứng viên',
      accountStatus: 'ACTIVE',
      profile: { id: 'p-1', isSearchingJob: true, allowCvFlip: true, defaultCvId: 'cv-1' },
    } as never);
    vi.mocked(prisma.companyFeatureEntitlement.findUnique).mockResolvedValue({
      enabled: true,
      metadata: { monthlyTotalLimit: 2 },
      expiresAt: null,
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma)) as never);
    vi.mocked(prisma.cvFlipRequest.updateMany).mockResolvedValue({ count: 0 } as never);
  });

  it('khóa lượt theo công ty và chặn khi request song song đã dùng hết lượt', async () => {
    vi.mocked(prisma.cvFlipConnection.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.cvFlipUsage.findUnique)
      .mockResolvedValueOnce({ totalCount: 1, requestCount: 0 } as never)
      .mockResolvedValueOnce({ totalCount: 2 } as never);

    await expect(service.flipCandidate(actorId, { companyId, candidateUserId })).rejects.toMatchObject({
      statusCode: 429,
      code: 'CV_FLIP_TOTAL_LIMIT_REACHED',
    });
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.cvFlipConnection.create).not.toHaveBeenCalled();
    expect(prisma.cvFlipUsage.upsert).not.toHaveBeenCalled();
  });

  it('không tính thêm lượt khi request song song đã mở CV', async () => {
    vi.mocked(prisma.cvFlipConnection.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'conn-1', flippedAt: new Date('2026-09-01') } as never);
    vi.mocked(prisma.cvFlipUsage.findUnique).mockResolvedValue({ totalCount: 1, requestCount: 0 } as never);

    const result = await service.flipCandidate(actorId, { companyId, candidateUserId });

    expect(result).toMatchObject({ status: 'ALREADY_FLIPPED', connectionId: 'conn-1' });
    expect(prisma.cvFlipConnection.create).not.toHaveBeenCalled();
    expect(prisma.cvFlipUsage.upsert).not.toHaveBeenCalled();
  });

  it('mở thành công và tăng lượt khi còn hạn mức', async () => {
    vi.mocked(prisma.cvFlipConnection.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.cvFlipUsage.findUnique).mockResolvedValue({ totalCount: 0, requestCount: 0 } as never);
    vi.mocked(prisma.cvFlipConnection.create).mockResolvedValue({
      id: 'conn-2',
      flippedAt: new Date('2026-09-02'),
    } as never);

    const result = await service.flipCandidate(actorId, { companyId, candidateUserId });

    expect(result).toMatchObject({ status: 'FLIPPED', connectionId: 'conn-2' });
    expect(prisma.cvFlipUsage.upsert).toHaveBeenCalledTimes(1);
  });
});
