import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CvFlipService } from '../cv-flip.service';

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/config/env', () => ({
  config: {
    FRONTEND_ORIGIN: 'http://localhost:3000',
  },
}));

vi.mock('@/shared/services/email-helper.service', () => ({
  getVerifiedEmailForUser: vi.fn(),
}));

vi.mock('@/shared/services/email.service', () => ({
  emailService: {},
}));

vi.mock('@/shared/services/notification.service', () => ({
  notificationService: {},
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
