import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { CandidateImportRecordStatus, UserAccountStatus } from '@prisma/client';
import { config } from '@/config/env';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { emailService } from '@/shared/services/email.service';
import { sendEmailInBackground } from '@/shared/services/send-email-async';
import { hashPassword } from '@/shared/security/password-hash';
import type { OnboardingActivateInput, OnboardingResendInput } from './onboarding.schema';

const ONBOARDING_TOKEN_TTL_MS = config.ONBOARDING_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const ONBOARDING_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

type OnboardingTokenStatus = 'VALID' | 'EXPIRED' | 'USED' | 'INVALID';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function createOnboardingToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + ONBOARDING_TOKEN_TTL_MS);
  return { raw, hash, expiresAt };
}

function buildActivationUrl(rawToken: string): string {
  return `${config.FRONTEND_ORIGIN}/onboarding?token=${encodeURIComponent(rawToken)}`;
}

function generateTokens(userId: string): AuthTokens {
  const accessToken = jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '15d' });
  const refreshToken = jwt.sign({ userId }, config.REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

export class OnboardingService {
  async getTokenStatus(rawToken: string): Promise<{
    status: OnboardingTokenStatus;
    expiresAt?: string;
    usedAt?: string;
    user?: { name: string | null };
  }> {
    const tokenHash = hashToken(rawToken);
    const token = await prisma.onboardingToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!token) {
      return { status: 'INVALID' };
    }

    if (token.usedAt) {
      return {
        status: 'USED',
        usedAt: token.usedAt.toISOString(),
        expiresAt: token.expiresAt.toISOString(),
        user: {
          name: token.user.name,
        },
      };
    }

    if (token.expiresAt.getTime() <= Date.now()) {
      return {
        status: 'EXPIRED',
        expiresAt: token.expiresAt.toISOString(),
        user: {
          name: token.user.name,
        },
      };
    }

    return {
      status: 'VALID',
      expiresAt: token.expiresAt.toISOString(),
      user: {
        name: token.user.name,
      },
    };
  }

  async activate(data: OnboardingActivateInput): Promise<{
    user: {
      id: string;
      email: string;
      name: string | null;
      role: string;
    };
    tokens: AuthTokens;
  }> {
    const tokenHash = hashToken(data.token);
    const token = await prisma.onboardingToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            accountStatus: true,
          },
        },
      },
    });

    if (!token) {
      throw new AppError('Link kích hoạt không hợp lệ', 400, 'ONBOARDING_TOKEN_INVALID');
    }
    if (token.usedAt) {
      throw new AppError('Link kích hoạt đã được sử dụng', 400, 'ONBOARDING_TOKEN_USED');
    }
    if (token.expiresAt.getTime() <= Date.now()) {
      throw new AppError('Link kích hoạt đã hết hạn', 400, 'ONBOARDING_TOKEN_EXPIRED');
    }
    if (token.user.accountStatus === UserAccountStatus.SUSPENDED) {
      throw new AppError('Tài khoản đã bị tạm khóa', 403, 'ACCOUNT_SUSPENDED');
    }

    const passwordHash = await hashPassword(data.password);
    const now = new Date();

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: token.user.id },
        data: {
          password: passwordHash,
          emailVerified: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      await tx.onboardingToken.update({
        where: { id: token.id },
        data: { usedAt: now },
      });

      if (token.batchId) {
        await tx.candidateImportRecord.updateMany({
          where: {
            batchId: token.batchId,
            userId: token.user.id,
            status: CandidateImportRecordStatus.CREATED,
          },
          data: {
            activatedAt: now,
          },
        });
      } else {
        await tx.candidateImportRecord.updateMany({
          where: {
            userId: token.user.id,
            status: CandidateImportRecordStatus.CREATED,
          },
          data: {
            activatedAt: now,
          },
        });
      }

      return updatedUser;
    });

    return {
      user,
      tokens: generateTokens(user.id),
    };
  }

  async resend(data: OnboardingResendInput): Promise<{ message: string }> {
    const normalizedEmail = data.email.trim().toLowerCase();
    const genericResponse = {
      message: 'Nếu email hợp lệ, chúng tôi đã gửi lại link kích hoạt tài khoản.',
    };

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        accountStatus: true,
      },
    });

    if (!user || user.emailVerified || user.accountStatus === UserAccountStatus.SUSPENDED) {
      return genericResponse;
    }

    const latestRecord = await prisma.candidateImportRecord.findFirst({
      where: {
        userId: user.id,
        status: CandidateImportRecordStatus.CREATED,
        activatedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        batchId: true,
      },
    });

    if (!latestRecord) {
      return genericResponse;
    }

    const latestToken = await prisma.onboardingToken.findFirst({
      where: {
        userId: user.id,
        batchId: latestRecord.batchId,
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (latestToken) {
      const elapsed = Date.now() - latestToken.createdAt.getTime();
      if (elapsed < ONBOARDING_RESEND_COOLDOWN_MS) {
        return genericResponse;
      }
    }

    const token = createOnboardingToken();
    await prisma.onboardingToken.create({
      data: {
        userId: user.id,
        batchId: latestRecord.batchId,
        tokenHash: token.hash,
        expiresAt: token.expiresAt,
      },
    });

    sendEmailInBackground(
      () => emailService.sendCandidateOnboardingEmail(user.email, user.name, buildActivationUrl(token.raw)),
      `onboarding resend ${user.email}`,
    );

    return genericResponse;
  }

  async getMe(userId: string): Promise<{
    user: {
      id: string;
      email: string;
      name: string | null;
      phone: string | null;
      profile: {
        fullName: string | null;
        title: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        locations: string[];
        wardCodes: string[];
        linkedin: string | null;
      } | null;
    };
    importRecord: {
      id: string;
      rawName: string | null;
      rawPhone: string | null;
      rawProvince: string | null;
      rawDistrict: string | null;
      rawPosition: string | null;
      rawSalary: string | null;
      rawExperience: string | null;
      rawSocialLink: string | null;
      rawCvLink: string | null;
      rawPortfolioLink: string | null;
      cvLinkType: string;
      activatedAt: string | null;
    } | null;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        profile: {
          select: {
            fullName: true,
            title: true,
            contactEmail: true,
            contactPhone: true,
            locations: true,
            wardCodes: true,
            linkedin: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
    }

    const importRecord = await prisma.candidateImportRecord.findFirst({
      where: {
        userId,
        status: CandidateImportRecordStatus.CREATED,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rawName: true,
        rawPhone: true,
        rawProvince: true,
        rawDistrict: true,
        rawPosition: true,
        rawSalary: true,
        rawExperience: true,
        rawSocialLink: true,
        rawCvLink: true,
        rawPortfolioLink: true,
        cvLinkType: true,
        activatedAt: true,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        profile: user.profile
          ? {
              fullName: user.profile.fullName,
              title: user.profile.title,
              contactEmail: user.profile.contactEmail,
              contactPhone: user.profile.contactPhone,
              locations: user.profile.locations,
              wardCodes: user.profile.wardCodes,
              linkedin: user.profile.linkedin,
            }
          : null,
      },
      importRecord: importRecord
        ? {
            id: importRecord.id,
            rawName: importRecord.rawName,
            rawPhone: importRecord.rawPhone,
            rawProvince: importRecord.rawProvince,
            rawDistrict: importRecord.rawDistrict,
            rawPosition: importRecord.rawPosition,
            rawSalary: importRecord.rawSalary,
            rawExperience: importRecord.rawExperience,
            rawSocialLink: importRecord.rawSocialLink,
            rawCvLink: importRecord.rawCvLink,
            rawPortfolioLink: importRecord.rawPortfolioLink,
            cvLinkType: importRecord.cvLinkType,
            activatedAt: importRecord.activatedAt ? importRecord.activatedAt.toISOString() : null,
          }
        : null,
    };
  }
}
