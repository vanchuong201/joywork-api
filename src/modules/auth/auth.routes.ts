import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthMiddleware } from './auth.middleware';
import { registerSchema } from './auth.schema';

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const authController = new AuthController(authService);
  const authMiddleware = new AuthMiddleware(authService);

  // Test route
  fastify.get('/test', async () => {
    return { message: 'Auth routes working' };
  });

  // Test register route
  fastify.post('/test-register', async (request, reply) => {
    try {
      const data = registerSchema.parse(request.body);
      const result = await authService.register(data);
      return reply.send({ success: true, user: result.user });
    } catch (error) {
      console.error('Test register error:', error);
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // Simple register route
  fastify.post('/register-simple', async (request, reply) => {
    try {
      const data = registerSchema.parse(request.body);
      const result = await authService.register(data);
      
      // Set refresh token as HTTP-only cookie
      reply.setCookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      return reply.status(201).send({
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
        },
      });
    } catch (error) {
      console.error('Simple register error:', error);
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // Register routes
  fastify.post('/register', {
    schema: {
      description: 'Register a new user',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string', minLength: 2 },
        },
      },
      response: {
        201: {
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
                    role: { type: 'string' },
                  },
                },
                accessToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, authController.register.bind(authController));

  fastify.post('/login', {
    schema: {
      description: 'Login user',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
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
                    role: { type: 'string' },
                  },
                },
                accessToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, authController.login.bind(authController));

  fastify.post('/refresh', {
    schema: {
      description: 'Refresh access token',
      tags: ['Auth'],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, authController.refreshToken.bind(authController));

  fastify.post('/logout', {
    schema: {
      description: 'Logout user',
      tags: ['Auth'],
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
  }, authController.logout.bind(authController));

  // Social login - Google
  fastify.get('/google/start', {
    schema: {
      description: 'Bắt đầu đăng nhập với Google (OAuth2)',
      tags: ['Auth'],
      querystring: {
        type: 'object',
        properties: {
          mode: { type: 'string', description: 'popup | redirect', default: 'popup' },
          action: { type: 'string', description: 'login | link', nullable: true },
          auth_token: { type: 'string', description: 'Bearer access token khi action=link', nullable: true },
        },
      },
    },
  }, authController.googleStart.bind(authController));

  fastify.get('/google/callback', {
    schema: {
      description: 'Callback từ Google OAuth2',
      tags: ['Auth'],
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
        },
      },
    },
  }, authController.googleCallback.bind(authController));

  // Google One Tap
  fastify.post('/google/one-tap', {
    schema: {
      description: 'Đăng nhập bằng Google One Tap (nhận ID Token)',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['credential'],
        properties: {
          credential: { type: 'string' },
        },
      },
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
                    role: { type: 'string' },
                    emailVerified: { type: 'boolean' },
                  },
                },
                accessToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, authController.googleOneTap.bind(authController));

  // Social login - Facebook
  fastify.get('/facebook/start', {
    schema: {
      description: 'Bắt đầu đăng nhập với Facebook (OAuth2)',
      tags: ['Auth'],
      querystring: {
        type: 'object',
        properties: {
          mode: { type: 'string', description: 'popup | redirect', default: 'popup' },
        },
      },
    },
  }, authController.facebookStart.bind(authController));

  fastify.get('/facebook/callback', {
    schema: {
      description: 'Callback từ Facebook OAuth2',
      tags: ['Auth'],
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
        },
      },
    },
  }, authController.facebookCallback.bind(authController));

  fastify.post('/facebook/complete', {
    schema: {
      description: 'Hoàn tất đăng nhập Facebook khi provider không trả email (user nhập email tay)',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['token', 'email'],
        properties: {
          token: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
    },
  }, authController.facebookComplete.bind(authController));

  fastify.get('/me/social-accounts', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get linked social accounts',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                accounts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      provider: { type: 'string' },
                      email: { type: 'string', nullable: true },
                      createdAt: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, authController.getLinkedSocialAccounts.bind(authController));

  fastify.post('/change-password', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Change user password',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 6 },
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
  }, authController.changePassword.bind(authController));

  fastify.get('/me', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get current user profile',
      tags: ['Auth'],
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
                    role: { type: 'string' },
                    emailVerified: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, authController.getMe.bind(authController));

  fastify.get('/verify-email', {
    schema: {
      description: 'Verify email với token',
      tags: ['Auth'],
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', description: 'Verification token' },
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
  }, authController.verifyEmail.bind(authController));

  fastify.post('/resend-verification-email', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Gửi lại email xác thực',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
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
  }, authController.resendVerificationEmail.bind(authController));

  fastify.post('/forgot-password', {
    schema: {
      description: 'Gửi email đặt lại mật khẩu',
      tags: ['Auth'],
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
  }, authController.forgotPassword.bind(authController));

  fastify.post('/reset-password', {
    schema: {
      description: 'Đặt lại mật khẩu với token',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: { type: 'string' },
          newPassword: { type: 'string', minLength: 6 },
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
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string', nullable: true },
                    role: { type: 'string' },
                  },
                },
                accessToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, authController.resetPassword.bind(authController));
}
