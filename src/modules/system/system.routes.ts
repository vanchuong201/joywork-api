import { FastifyInstance } from 'fastify';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';

export async function systemRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const authMiddleware = new AuthMiddleware(authService);
  const systemService = new SystemService();
  const systemController = new SystemController(systemService);

  fastify.get('/overview', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Get system overview stats',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                stats: {
                  type: 'object',
                  properties: {
                    users: { type: 'number' },
                    companies: { type: 'number' },
                    posts: { type: 'number' },
                    jobs: { type: 'number' },
                    applications: { type: 'number' },
                    follows: { type: 'number' },
                    jobFavorites: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.getOverview.bind(systemController));

  fastify.get('/users', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Danh sách người dùng (admin, có phân trang)',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          q: { type: 'string' },
          role: { type: 'string', enum: ['USER', 'ADMIN'] },
          accountStatus: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                users: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: ['string', 'null'] },
                      slug: { type: ['string', 'null'] },
                      role: { type: 'string' },
                      emailVerified: { type: 'boolean' },
                      accountStatus: { type: 'string' },
                      createdAt: { type: 'string' },
                    },
                  },
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    total: { type: 'number' },
                    totalPages: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.listUsers.bind(systemController));

  fastify.patch('/users/:userId/account-status', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Đặt trạng thái tài khoản (ACTIVE / SUSPENDED) — không áp dụng cho chính admin đang thao tác',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['accountStatus'],
        properties: {
          accountStatus: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
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
                    accountStatus: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.patchUserAccountStatus.bind(systemController));

  fastify.get('/companies', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Danh sách công ty (admin, có phân trang và đếm thành viên/tin tuyển)',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          q: { type: 'string' },
          verificationStatus: {
            type: 'string',
            enum: ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'],
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                companies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      slug: { type: 'string' },
                      legalName: { type: ['string', 'null'] },
                      verificationStatus: { type: 'string' },
                      isVerified: { type: 'boolean' },
                      createdAt: { type: 'string' },
                      memberCount: { type: 'number' },
                      jobCount: { type: 'number' },
                    },
                  },
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    total: { type: 'number' },
                    totalPages: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.listCompanies.bind(systemController));

  fastify.get('/reports/timeseries', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Chuỗi thời gian đăng ký user và ứng tuyển theo ngày (UTC, PostgreSQL)',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 7, maximum: 90 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                days: { type: 'number' },
                userSignups: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      date: { type: 'string' },
                      count: { type: 'number' },
                    },
                  },
                },
                applications: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      date: { type: 'string' },
                      count: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.getReportTimeseries.bind(systemController));

  fastify.get('/company-verifications', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'List company verification submissions',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                companies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      legalName: { type: ['string', 'null'] },
                      slug: { type: 'string' },
                      verificationStatus: { type: 'string' },
                      verificationFileUrl: { type: ['string', 'null'] },
                      verificationSubmittedAt: { type: ['string', 'null'] },
                      verificationReviewedAt: { type: ['string', 'null'] },
                      verificationReviewedById: { type: ['string', 'null'] },
                      verificationRejectReason: { type: ['string', 'null'] },
                      isVerified: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.listCompanyVerifications.bind(systemController));

  fastify.patch('/company-verifications/:companyId/approve', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Approve company verification',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['companyId'],
        properties: {
          companyId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                company: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    verificationStatus: { type: 'string' },
                    isVerified: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.approveCompanyVerification.bind(systemController));

  fastify.patch('/company-verifications/:companyId/reject', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Reject company verification',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['companyId'],
        properties: {
          companyId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string', maxLength: 500 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                company: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    verificationStatus: { type: 'string' },
                    isVerified: { type: 'boolean' },
                    verificationRejectReason: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.rejectCompanyVerification.bind(systemController));

  fastify.get('/company-verifications/:companyId/download', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Get presigned download URL for company verification document',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['companyId'],
        properties: {
          companyId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                url: { type: 'string' },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, systemController.getCompanyVerificationDownload.bind(systemController));
}


