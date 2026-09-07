import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CvFlipService } from '../cv-flip.service';
import { signCvFlipEmailActionToken } from '../cv-flip-email-token';

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
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
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
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
    avatar: 'https://cdn/avatar.jpg',
    fullName: 'Ứng viên A',
    headline: 'Senior Backend Engineer',
    title: 'Backend Engineer',
    skills: ['Node.js'],
    locations: ['ha-noi'],
    wardCodes: ['ha-noi/00004'],
    specificAddress: 'Cầu Giấy',
    expectedSalaryMin: 15000000n,
    expectedSalaryMax: 25000000n,
    salaryCurrency: 'VND',
    workMode: 'ONSITE',
    gender: 'MALE',
    dayOfBirth: 1,
    monthOfBirth: 1,
    yearOfBirth: 1995,
    educationLevel: 'BACHELOR',
    status: 'OPEN_TO_WORK',
  },
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

    const countWhere = vi.mocked(prisma.user.count).mock.calls[0][0]?.where as {
      AND?: Array<Record<string, unknown>>;
    };
    const readinessCondition = (countWhere.AND ?? []).find((condition) => Array.isArray(condition.AND));
    expect(readinessCondition).toBeTruthy();
    expect(readinessCondition?.AND).toContainEqual({ experiences: { some: {} } });
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
