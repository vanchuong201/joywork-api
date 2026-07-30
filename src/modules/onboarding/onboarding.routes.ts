import type { FastifyInstance } from 'fastify';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

export async function onboardingRoutes(fastify: FastifyInstance) {
  const onboardingService = new OnboardingService();
  const onboardingController = new OnboardingController(onboardingService);
  const authService = new AuthService();
  const authMiddleware = new AuthMiddleware(authService);

  fastify.get('/token/:token', {
    schema: {
      description: 'Kiểm tra trạng thái token kích hoạt onboarding.',
      tags: ['Onboarding'],
      params: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['VALID', 'EXPIRED', 'USED', 'INVALID'] },
                expiresAt: { type: 'string', nullable: true },
                usedAt: { type: 'string', nullable: true },
                user: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    name: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, onboardingController.getTokenStatus.bind(onboardingController));

  fastify.post('/activate', {
    schema: {
      description: 'Kích hoạt tài khoản onboarding, đặt mật khẩu và auto-login.',
      tags: ['Onboarding'],
      body: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: { type: 'string' },
          password: { type: 'string', minLength: 6 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                accessToken: { type: 'string' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string', nullable: true },
                    role: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, onboardingController.activate.bind(onboardingController));

  fastify.post('/resend', {
    schema: {
      description: 'Gửi lại email onboarding bằng token mới (response luôn chung).',
      tags: ['Onboarding'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, onboardingController.resend.bind(onboardingController));

  fastify.get('/me', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Lấy dữ liệu onboarding của người dùng hiện tại.',
      tags: ['Onboarding'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string', nullable: true },
                    phone: { type: 'string', nullable: true },
                    profile: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        fullName: { type: 'string', nullable: true },
                        title: { type: 'string', nullable: true },
                        contactEmail: { type: 'string', nullable: true },
                        contactPhone: { type: 'string', nullable: true },
                        locations: { type: 'array', items: { type: 'string' } },
                        wardCodes: { type: 'array', items: { type: 'string' } },
                        linkedin: { type: 'string', nullable: true },
                      },
                    },
                  },
                },
                importRecord: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    id: { type: 'string' },
                    rawName: { type: 'string', nullable: true },
                    rawPhone: { type: 'string', nullable: true },
                    rawProvince: { type: 'string', nullable: true },
                    rawDistrict: { type: 'string', nullable: true },
                    rawPosition: { type: 'string', nullable: true },
                    rawSalary: { type: 'string', nullable: true },
                    rawExperience: { type: 'string', nullable: true },
                    rawSocialLink: { type: 'string', nullable: true },
                    rawCvLink: { type: 'string', nullable: true },
                    rawPortfolioLink: { type: 'string', nullable: true },
                    cvLinkType: { type: 'string' },
                    linkAction: { type: 'string' },
                    activatedAt: { type: 'string', nullable: true },
                  },
                },
                cvImport: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    jobId: { type: 'string' },
                    status: { type: 'string' },
                    errorMessage: { type: 'string', nullable: true },
                  },
                },
                cvStatus: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    },
  }, onboardingController.getMe.bind(onboardingController));
}
