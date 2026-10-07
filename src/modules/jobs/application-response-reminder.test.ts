import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, emailMock, verifiedEmailsMock, notificationMock } = vi.hoisted(() => ({
  prismaMock: {
    application: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    companyMember: {
      findMany: vi.fn(),
    },
  },
  emailMock: {
    sendApplicationResponseReminderEmail: vi.fn(),
    sendApplicationStatusUpdateEmail: vi.fn(),
  },
  verifiedEmailsMock: vi.fn(),
  notificationMock: {
    createNotification: vi.fn(),
  },
}));

vi.mock('@/shared/database/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@/config/env', () => ({
  config: { FRONTEND_ORIGIN: 'http://localhost:3000' },
}));

vi.mock('@/shared/elasticsearch/client', () => ({
  getEsClient: vi.fn(() => null),
}));

vi.mock('@/shared/elasticsearch/sync', () => ({
  syncJobToEs: vi.fn(),
  deleteJobFromEs: vi.fn(),
}));

vi.mock('@/shared/services/email.service', () => ({
  emailService: emailMock,
}));

vi.mock('@/shared/services/send-email-async', () => ({
  sendEmailInBackground: vi.fn(),
}));

vi.mock('@/shared/services/email-helper.service', () => ({
  getVerifiedEmailForUser: vi.fn().mockResolvedValue('candidate@example.com'),
  getVerifiedEmailsForUsers: verifiedEmailsMock,
}));

vi.mock('@/shared/services/notification.service', () => ({
  notificationService: notificationMock,
}));

vi.mock('@/shared/services/embedding.service', () => ({
  generateAndStoreJobEmbedding: vi.fn(),
  generateEmbedding: vi.fn(),
}));

import { JobsService } from './jobs.service';

const service = new JobsService();
const now = new Date('2026-10-04T01:00:00.000Z');

function dueApp(id: string, appliedAt: string) {
  return {
    id,
    appliedAt: new Date(appliedAt),
    user: { name: `Ứng viên ${id}` },
    job: {
      title: `Vị trí ${id}`,
      company: { id: 'company-1', name: 'Joy', slug: 'joy' },
    },
  };
}

describe('JobsService.processApplicationResponseReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emailMock.sendApplicationResponseReminderEmail.mockResolvedValue(undefined);
    emailMock.sendApplicationStatusUpdateEmail.mockResolvedValue(undefined);
    notificationMock.createNotification.mockResolvedValue(undefined);
    prismaMock.application.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.companyMember.findMany.mockResolvedValue([
      { companyId: 'company-1', userId: 'admin-1' },
    ]);
    verifiedEmailsMock.mockResolvedValue(new Map([['admin-1', 'admin@example.com']]));
  });

  it('gửi một mail, chỉ hiện 2 hồ sơ và Xem thêm khi có hơn 2, rồi đánh dấu mọi hồ sơ của công ty', async () => {
    prismaMock.application.findMany
      .mockResolvedValueOnce([
        dueApp('a', '2026-09-01T02:00:00.000Z'),
        dueApp('b', '2026-09-02T02:00:00.000Z'),
        dueApp('c', '2026-09-03T02:00:00.000Z'),
      ])
      .mockResolvedValueOnce([]);

    const result = await service.processApplicationResponseReminders({ now });

    expect(emailMock.sendApplicationResponseReminderEmail).toHaveBeenCalledTimes(1);
    const payload = emailMock.sendApplicationResponseReminderEmail.mock.calls[0]![1];
    expect(payload.applications).toHaveLength(2);
    expect(payload.applications[0].candidateName).toBe('Ứng viên a');
    expect(payload.showSeeMore).toBe(true);
    expect(payload.listUrl).toBe('http://localhost:3000/companies/joy/manage?tab=applications&responseDue=1');
    expect(payload.heading).toBe('Bạn có 3 ứng tuyển cần phản hồi');
    expect(prismaMock.application.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['a', 'b', 'c'] },
          responseReminderSentAt: null,
          companyRespondedAt: null,
        }),
      }),
    );
    expect(result.remindedApplications).toBe(3);
    expect(result.closedApplications).toBe(0);
  });

  it('không gửi lại và không đánh dấu khi công ty không có email đã xác minh', async () => {
    verifiedEmailsMock.mockResolvedValue(new Map());
    prismaMock.application.findMany.mockResolvedValueOnce([dueApp('a', '2026-09-01T02:00:00.000Z')]).mockResolvedValueOnce([]);

    const result = await service.processApplicationResponseReminders({ now });

    expect(emailMock.sendApplicationResponseReminderEmail).not.toHaveBeenCalled();
    expect(prismaMock.application.updateMany).not.toHaveBeenCalled();
    expect(result.skippedCompaniesWithoutEmail).toBe(1);
    expect(prismaMock.application.findMany.mock.calls[0]![0].where.responseReminderSentAt).toBeNull();
  });

  it('dry-run không gửi mail và không ghi database', async () => {
    prismaMock.application.findMany
      .mockResolvedValueOnce([dueApp('a', '2026-09-01T02:00:00.000Z'), dueApp('b', '2026-09-02T02:00:00.000Z')])
      .mockResolvedValueOnce([{ id: 'old' }]);

    const result = await service.processApplicationResponseReminders({ dryRun: true, now });

    expect(emailMock.sendApplicationResponseReminderEmail).not.toHaveBeenCalled();
    expect(prismaMock.application.updateMany).not.toHaveBeenCalled();
    expect(result.remindedApplications).toBe(2);
    expect(result.closedApplications).toBe(1);
    expect(result.dryRun).toBe(true);
  });

  it('đúng 2 hồ sơ thì không kèm Xem thêm', async () => {
    prismaMock.application.findMany
      .mockResolvedValueOnce([
        dueApp('a', '2026-09-01T02:00:00.000Z'),
        dueApp('b', '2026-09-02T02:00:00.000Z'),
      ])
      .mockResolvedValueOnce([]);

    await service.processApplicationResponseReminders({ now });

    expect(emailMock.sendApplicationResponseReminderEmail.mock.calls[0]![1].showSeeMore).toBe(false);
    expect(emailMock.sendApplicationResponseReminderEmail.mock.calls[0]![1].applications).toHaveLength(2);
  });

  it('không đóng hồ sơ đã có companyRespondedAt và báo ứng viên khi đóng', async () => {
    prismaMock.application.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'old',
        userId: 'candidate-1',
        jobId: 'job-1',
        user: { name: 'Mai' },
        job: { title: 'Editor', company: { name: 'Joy' } },
      },
    ]);

    const result = await service.processApplicationResponseReminders({ now });

    expect(prismaMock.application.findMany.mock.calls[1]![0].where).toEqual(
      expect.objectContaining({
        status: 'RECEIVED',
        companyRespondedAt: null,
        responseReminderSentAt: { lt: expect.any(Date) },
      }),
    );
    expect(prismaMock.application.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'old', status: 'RECEIVED', companyRespondedAt: null },
        data: expect.objectContaining({ status: 'NOT_SUITABLE_SAVED' }),
      }),
    );
    expect(notificationMock.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'candidate-1',
        metadata: expect.objectContaining({ status: 'NOT_SUITABLE_SAVED' }),
      }),
    );
    expect(result.closedApplications).toBe(1);
  });

  it('ghi companyRespondedAt khi doanh nghiệp đổi trạng thái, không ghi khi chỉ sửa ghi chú', async () => {
    prismaMock.application.findUnique.mockResolvedValue({
      id: 'app-1',
      status: 'RECEIVED',
      notes: null,
      userId: 'candidate-1',
      jobId: 'job-1',
      job: { title: 'Editor', company: { name: 'Joy', members: [{ role: 'OWNER' }] } },
      user: { id: 'candidate-1', name: 'Mai', email: 'mai@example.com' },
    });
    prismaMock.application.update.mockResolvedValue({});

    await service.updateApplicationStatus('admin-1', {
      applicationId: 'app-1',
      status: 'SUITABLE',
    });
    expect(prismaMock.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SUITABLE',
          companyRespondedAt: expect.any(Date),
        }),
      }),
    );

    prismaMock.application.update.mockClear();
    await service.updateApplicationStatus('admin-1', {
      applicationId: 'app-1',
      status: 'RECEIVED',
      notes: 'Đã xem',
    });
    expect(prismaMock.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ companyRespondedAt: expect.any(Date) }),
      }),
    );
  });
});
