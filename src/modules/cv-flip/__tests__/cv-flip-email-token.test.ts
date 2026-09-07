import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/env', () => ({
  config: {
    JWT_SECRET: 'a'.repeat(32),
    FRONTEND_ORIGIN: 'http://localhost:3000',
  },
}));

import {
  buildCvFlipEmailActionUrl,
  signCvFlipEmailActionToken,
  verifyCvFlipEmailActionToken,
} from '../cv-flip-email-token';

describe('cv-flip email action token', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('ký và verify token list/approve', () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const token = signCvFlipEmailActionToken({
      userId: 'user-1',
      requestId: 'req-1',
      action: 'approve',
      expiresAt,
    });

    expect(verifyCvFlipEmailActionToken(token)).toMatchObject({
      purpose: 'cv_flip_email',
      userId: 'user-1',
      requestId: 'req-1',
      action: 'approve',
    });
    expect(buildCvFlipEmailActionUrl(token)).toContain('/connections/from-email?token=');
  });

  it('từ chối token hết hạn', () => {
    expect(() =>
      signCvFlipEmailActionToken({
        userId: 'user-1',
        requestId: 'req-1',
        action: 'list',
        expiresAt: new Date(Date.now() - 1000),
      }),
    ).toThrowError(expect.objectContaining({ code: 'CV_FLIP_REQUEST_EXPIRED' }));
  });

  it('từ chối token giả', () => {
    expect(() => verifyCvFlipEmailActionToken('not-a-jwt')).toThrowError(
      expect.objectContaining({ code: 'CV_FLIP_EMAIL_TOKEN_INVALID' }),
    );
  });
});
