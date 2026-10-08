import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, deleteCompanyFromEsMock, deleteJobFromEsMock, syncCompanyToEsMock, syncJobToEsMock } =
  vi.hoisted(() => ({
    prismaMock: {
      company: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      job: {
        findMany: vi.fn(),
      },
    },
    deleteCompanyFromEsMock: vi.fn(),
    deleteJobFromEsMock: vi.fn(),
    syncCompanyToEsMock: vi.fn(),
    syncJobToEsMock: vi.fn(),
  }));

vi.mock('@/shared/database/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@/config/env', () => ({
  config: {
    FRONTEND_ORIGIN: 'http://localhost:3000',
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
  },
}));

vi.mock('@/shared/elasticsearch/sync', () => ({
  deleteCompanyFromEs: deleteCompanyFromEsMock,
  deleteJobFromEs: deleteJobFromEsMock,
  syncCompanyToEs: syncCompanyToEsMock,
  syncJobToEs: syncJobToEsMock,
}));

vi.mock('@/shared/services/email.service', () => ({
  emailService: {},
}));

vi.mock('@/shared/services/notification.service', () => ({
  notificationService: {},
}));

vi.mock('@/shared/storage/s3', () => ({
  buildS3ObjectUrl: vi.fn(),
  createPresignedDownloadUrl: vi.fn(),
  getS3BucketName: vi.fn(),
  resolveReadableS3ObjectUrl: vi.fn(),
  s3Client: {},
}));

import { SystemService } from './system.service';

const service = new SystemService();

const activeCompany = {
  id: 'company-1',
  slug: 'joy',
  name: 'Joy',
  legalName: null,
  tagline: null,
  description: null,
  industry: null,
  location: null,
  size: null,
  isVerified: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  visibilityStatus: 'ACTIVE',
  hiddenAt: null,
  hiddenById: null,
  hiddenReason: null,
};

describe('SystemService.setCompanyVisibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.job.findMany.mockResolvedValue([]);
    deleteCompanyFromEsMock.mockResolvedValue(undefined);
    deleteJobFromEsMock.mockResolvedValue(undefined);
    syncCompanyToEsMock.mockResolvedValue(undefined);
    syncJobToEsMock.mockResolvedValue(undefined);
  });

  it('ẩn công ty ghi đủ 4 field và xóa khỏi tìm kiếm', async () => {
    prismaMock.company.findUnique.mockResolvedValue(activeCompany);
    prismaMock.company.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...activeCompany,
      ...data,
    }));
    prismaMock.job.findMany.mockResolvedValue([{ id: 'job-1' }]);

    const result = await service.setCompanyVisibility('company-1', 'admin-1', {
      visibilityStatus: 'HIDDEN',
      reason: '  trùng tin rác  ',
    });

    expect(prismaMock.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visibilityStatus: 'HIDDEN',
          hiddenById: 'admin-1',
          hiddenReason: 'trùng tin rác',
        }),
      }),
    );
    expect(result.hiddenReason).toBe('trùng tin rác');
    expect(deleteCompanyFromEsMock).toHaveBeenCalledWith('company-1');
    expect(deleteJobFromEsMock).toHaveBeenCalledWith('job-1');
  });

  it('ẩn lần nữa cập nhật lý do', async () => {
    prismaMock.company.findUnique.mockResolvedValue({
      ...activeCompany,
      visibilityStatus: 'HIDDEN',
      hiddenReason: 'lý do cũ',
    });
    prismaMock.company.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...activeCompany,
      visibilityStatus: 'HIDDEN',
      ...data,
    }));

    const result = await service.setCompanyVisibility('company-1', 'admin-2', {
      visibilityStatus: 'HIDDEN',
      reason: 'lý do mới',
    });

    expect(result.hiddenReason).toBe('lý do mới');
    expect(result.hiddenById).toBe('admin-2');
  });

  it('khôi phục xóa các field ẩn', async () => {
    prismaMock.company.findUnique.mockResolvedValue({
      ...activeCompany,
      visibilityStatus: 'HIDDEN',
      hiddenAt: new Date(),
      hiddenById: 'admin-1',
      hiddenReason: 'rác',
    });
    prismaMock.company.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...activeCompany,
      ...data,
    }));

    const result = await service.setCompanyVisibility('company-1', 'admin-1', {
      visibilityStatus: 'ACTIVE',
    });

    expect(prismaMock.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          visibilityStatus: 'ACTIVE',
          hiddenAt: null,
          hiddenById: null,
          hiddenReason: null,
        },
      }),
    );
    expect(result.visibilityStatus).toBe('ACTIVE');
    expect(result.hiddenReason).toBeNull();
    expect(syncCompanyToEsMock).toHaveBeenCalled();
  });

  it('khôi phục công ty đang hiện không ghi DB', async () => {
    prismaMock.company.findUnique.mockResolvedValue(activeCompany);

    const result = await service.setCompanyVisibility('company-1', 'admin-1', {
      visibilityStatus: 'ACTIVE',
    });

    expect(prismaMock.company.update).not.toHaveBeenCalled();
    expect(result.visibilityStatus).toBe('ACTIVE');
  });

  it('404 khi không có công ty', async () => {
    prismaMock.company.findUnique.mockResolvedValue(null);

    await expect(
      service.setCompanyVisibility('missing', 'admin-1', { visibilityStatus: 'HIDDEN', reason: 'rác' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'COMPANY_NOT_FOUND' });
  });

  it('lỗi tìm kiếm không làm hỏng lần ẩn', async () => {
    prismaMock.company.findUnique.mockResolvedValue(activeCompany);
    prismaMock.company.update.mockResolvedValue({
      ...activeCompany,
      visibilityStatus: 'HIDDEN',
      hiddenReason: 'rác',
      hiddenById: 'admin-1',
      hiddenAt: new Date(),
    });
    deleteCompanyFromEsMock.mockRejectedValue(new Error('es down'));

    await expect(
      service.setCompanyVisibility('company-1', 'admin-1', { visibilityStatus: 'HIDDEN', reason: 'rác' }),
    ).resolves.toMatchObject({ visibilityStatus: 'HIDDEN' });
  });
});
