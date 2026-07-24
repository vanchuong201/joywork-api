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

describe('OnboardingService', () => {
  const service = new OnboardingService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock));
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
});
