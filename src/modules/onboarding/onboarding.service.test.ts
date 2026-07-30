import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserAccountStatus } from '@prisma/client';
import { OnboardingService } from './onboarding.service';

const {
  prismaMock,
  txMock,
  emailServiceMock,
  sendEmailInBackgroundMock,
  hashPasswordMock,
} = vi.hoisted(() => ({
  prismaMock: {
    onboardingToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    candidateImportRecord: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    cvImportJob: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  txMock: {
    user: {
      update: vi.fn(),
    },
    onboardingToken: {
      update: vi.fn(),
    },
    candidateImportRecord: {
      updateMany: vi.fn(),
    },
  },
  emailServiceMock: {
    sendCandidateOnboardingEmail: vi.fn(),
  },
  sendEmailInBackgroundMock: vi.fn(async (runner: () => Promise<void>) => {
    await runner();
  }),
  hashPasswordMock: vi.fn(),
}));

vi.mock('@/shared/database/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@/config/env', () => ({
  config: {
    FRONTEND_ORIGIN: 'http://localhost:3000',
    JWT_SECRET: 'jwt-secret-very-long-for-tests',
    REFRESH_SECRET: 'refresh-secret-very-long-for-tests',
    ONBOARDING_TOKEN_TTL_DAYS: 90,
  },
}));

vi.mock('@/shared/services/email.service', () => ({
  emailService: emailServiceMock,
}));

vi.mock('@/shared/services/send-email-async', () => ({
  sendEmailInBackground: sendEmailInBackgroundMock,
}));

vi.mock('@/shared/security/password-hash', () => ({
  hashPassword: hashPasswordMock,
}));

vi.mock('@/modules/cv-imports/cv-imports.service', () => ({
  CvImportsService: class {
    createImportFromExternalLink = vi.fn();
    importApplyAndSyncFromExternalLink = vi.fn();
  },
}));

describe('OnboardingService', () => {
  const service = new OnboardingService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock));
    prismaMock.candidateImportRecord.findFirst.mockResolvedValue(null);
  });

  it('activate: set password, mark token used và auto-login', async () => {
    prismaMock.onboardingToken.findUnique.mockResolvedValue({
      id: 'token-1',
      batchId: 'batch-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        email: 'candidate@example.com',
        name: 'Candidate A',
        role: 'USER',
        accountStatus: UserAccountStatus.ACTIVE,
      },
    });
    hashPasswordMock.mockResolvedValue('hashed-password');
    txMock.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'candidate@example.com',
      name: 'Candidate A',
      role: 'USER',
    });

    const result = await service.activate({
      token: 'raw-token-abcdefghijklmnopqrstuvwxyz',
      password: '123456',
    });

    expect(hashPasswordMock).toHaveBeenCalledWith('123456');
    expect(txMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          password: 'hashed-password',
          emailVerified: true,
        }),
      }),
    );
    expect(txMock.onboardingToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'token-1' },
      }),
    );
    expect(txMock.candidateImportRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          batchId: 'batch-1',
          userId: 'user-1',
          status: 'CREATED',
        }),
      }),
    );
    expect(result.user.email).toBe('candidate@example.com');
    expect(result.tokens.accessToken.length).toBeGreaterThan(20);
    expect(result.tokens.refreshToken.length).toBeGreaterThan(20);
  });

  it('resend: luôn trả message chung khi email không tồn tại', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await service.resend({
      email: 'missing@example.com',
    });

    expect(result.message).toContain('Nếu email hợp lệ');
    expect(prismaMock.onboardingToken.create).not.toHaveBeenCalled();
    expect(sendEmailInBackgroundMock).not.toHaveBeenCalled();
  });

  it('resend: tạo token mới và gửi email khi user chưa kích hoạt', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'pending@example.com',
      name: 'Pending User',
      emailVerified: false,
      accountStatus: UserAccountStatus.ACTIVE,
    });
    prismaMock.candidateImportRecord.findFirst.mockResolvedValue({
      batchId: 'batch-2',
    });
    prismaMock.onboardingToken.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    });

    const result = await service.resend({
      email: 'pending@example.com',
    });

    expect(result.message).toContain('Nếu email hợp lệ');
    expect(prismaMock.onboardingToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-2',
          batchId: 'batch-2',
        }),
      }),
    );
    expect(sendEmailInBackgroundMock).toHaveBeenCalledTimes(1);
    expect(emailServiceMock.sendCandidateOnboardingEmail).toHaveBeenCalledWith(
      'pending@example.com',
      'Pending User',
      expect.stringContaining('/onboarding?token='),
    );
  });

  it('getMe: không mượn latest job khi record import manual chưa có cvImportJobId', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-3',
      email: 'manual@example.com',
      name: 'Manual User',
      phone: null,
      profile: null,
    });
    prismaMock.candidateImportRecord.findFirst.mockResolvedValue({
      id: 'record-1',
      rawName: 'Manual User',
      rawPhone: '0900000000',
      rawProvince: null,
      rawDistrict: null,
      rawPosition: null,
      rawSalary: null,
      rawExperience: null,
      rawSocialLink: null,
      rawCvLink: 'https://www.canva.com/design/mock-cv',
      rawPortfolioLink: null,
      cvLinkType: 'CANVA',
      activatedAt: new Date('2026-07-31T00:00:00.000Z'),
      cvImportJobId: null,
    });
    prismaMock.cvImportJob.findFirst.mockResolvedValue({
      id: 'latest-job',
      status: 'APPLIED',
      errorMessage: null,
    });

    const result = await service.getMe('user-3');

    expect(prismaMock.cvImportJob.findFirst).not.toHaveBeenCalled();
    expect(result.cvImport).toBeNull();
    expect(result.cvStatus).toBe('CV_MANUAL_PENDING');
    expect(result.importRecord?.linkAction).toBe('MANUAL_UPLOAD');
  });
});
