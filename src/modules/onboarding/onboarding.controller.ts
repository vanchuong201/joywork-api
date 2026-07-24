import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedRequest } from '@/modules/auth/auth.middleware';
import { AppError } from '@/shared/errors/errorHandler';
import { onboardingActivateSchema, onboardingResendSchema } from './onboarding.schema';
import { OnboardingService } from './onboarding.service';

export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  async getTokenStatus(request: FastifyRequest, reply: FastifyReply) {
    const { token } = request.params as { token?: string };
    if (!token) {
      throw new AppError('Thiếu token kích hoạt', 400, 'ONBOARDING_TOKEN_REQUIRED');
    }

    const result = await this.onboardingService.getTokenStatus(token);
    return reply.send({ data: result });
  }

  async activate(request: FastifyRequest, reply: FastifyReply) {
    const input = onboardingActivateSchema.parse(request.body);
    const result = await this.onboardingService.activate(input);

    reply.setCookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return reply.send({
      data: {
        message: 'Kích hoạt tài khoản thành công',
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    });
  }

  async resend(request: FastifyRequest, reply: FastifyReply) {
    const input = onboardingResendSchema.parse(request.body);
    const result = await this.onboardingService.resend(input);
    return reply.send({ data: result });
  }

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as AuthenticatedRequest).user?.userId;
    if (!userId) {
      throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');
    }

    const result = await this.onboardingService.getMe(userId);
    return reply.send({ data: result });
  }
}
