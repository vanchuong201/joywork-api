import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '@/config/env';
import { AppError } from '@/shared/errors/errorHandler';

export const CV_FLIP_EMAIL_ACTIONS = ['approve', 'reject', 'list'] as const;
export type CvFlipEmailAction = (typeof CV_FLIP_EMAIL_ACTIONS)[number];

const TOKEN_PURPOSE = 'cv_flip_email';

type EmailActionPayload = {
  purpose: typeof TOKEN_PURPOSE;
  userId: string;
  requestId: string;
  action: CvFlipEmailAction;
};

function emailActionSecret(): string {
  return createHash('sha256').update(`${config.JWT_SECRET}:cv_flip_email`).digest('hex');
}

export function signCvFlipEmailActionToken(input: {
  userId: string;
  requestId: string;
  action: CvFlipEmailAction;
  expiresAt: Date;
}): string {
  const expiresIn = Math.floor((input.expiresAt.getTime() - Date.now()) / 1000);
  if (expiresIn <= 0) {
    throw new AppError('Yêu cầu đã hết hạn', 409, 'CV_FLIP_REQUEST_EXPIRED');
  }

  return jwt.sign(
    {
      purpose: TOKEN_PURPOSE,
      userId: input.userId,
      requestId: input.requestId,
      action: input.action,
    } satisfies EmailActionPayload,
    emailActionSecret(),
    { expiresIn },
  );
}

export function verifyCvFlipEmailActionToken(token: string): EmailActionPayload {
  try {
    const decoded = jwt.verify(token, emailActionSecret()) as jwt.JwtPayload & Partial<EmailActionPayload>;
    if (
      decoded.purpose !== TOKEN_PURPOSE ||
      typeof decoded.userId !== 'string' ||
      typeof decoded.requestId !== 'string' ||
      !CV_FLIP_EMAIL_ACTIONS.includes(decoded.action as CvFlipEmailAction)
    ) {
      throw new AppError('Link không hợp lệ', 400, 'CV_FLIP_EMAIL_TOKEN_INVALID');
    }

    return {
      purpose: TOKEN_PURPOSE,
      userId: decoded.userId,
      requestId: decoded.requestId,
      action: decoded.action as CvFlipEmailAction,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Link đã hết hạn', 409, 'CV_FLIP_EMAIL_TOKEN_EXPIRED');
    }
    throw new AppError('Link không hợp lệ', 400, 'CV_FLIP_EMAIL_TOKEN_INVALID');
  }
}

export function buildCvFlipEmailActionUrl(token: string): string {
  const base = config.FRONTEND_ORIGIN || 'https://joywork.vn';
  return `${base}/connections/from-email?token=${encodeURIComponent(token)}`;
}
