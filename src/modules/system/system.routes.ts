import { FastifyInstance } from 'fastify';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { SystemTalentPoolController } from './system-talent-pool.controller';
import { TalentPoolService } from '@/modules/talent-pool/talent-pool.service';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';

export async function systemRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const authMiddleware = new AuthMiddleware(authService);
  const systemService = new SystemService();
  const systemController = new SystemController(systemService);
  const talentPoolService = new TalentPoolService();
  const tpController = new SystemTalentPoolController(talentPoolService);

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

  fastify.get('/provinces', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Danh sách tỉnh/thành và alias phục vụ matching',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                provinces: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      code: { type: 'string' },
                      name: { type: 'string' },
                      type: { type: 'string' },
                      region: { type: 'string' },
                      merged: { type: 'boolean' },
                      isActive: { type: 'boolean' },
                      effectiveFrom: { type: ['string', 'null'] },
                      effectiveTo: { type: ['string', 'null'] },
                      aliases: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            aliasText: { type: 'string' },
                            aliasSlug: { type: 'string' },
                            aliasType: { type: 'string' },
                            isActive: { type: 'boolean' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.listProvinces.bind(systemController));

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
                      isPremium: { type: 'boolean' },
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

  fastify.patch('/companies/:companyId/premium', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Cập nhật trạng thái Premium của doanh nghiệp',
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
        required: ['isPremium'],
        properties: {
          isPremium: { type: 'boolean' },
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
                    isPremium: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.patchCompanyPremiumStatus.bind(systemController));

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

  // ── Talent Pool: Requests ──

  const adminPre = [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)];

  fastify.get('/talent-pool/requests', {
    preHandler: adminPre,
    schema: {
      description: 'Danh sách yêu cầu tham gia Talent Pool',
      tags: ['System - Talent Pool'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
          q: { type: 'string' },
        },
      },
    },
  }, tpController.listRequests.bind(tpController));

  fastify.patch('/talent-pool/requests/:id/approve', {
    preHandler: adminPre,
    schema: {
      description: 'Duyệt yêu cầu tham gia Talent Pool',
      tags: ['System - Talent Pool'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, tpController.approveRequest.bind(tpController));

  fastify.patch('/talent-pool/requests/:id/reject', {
    preHandler: adminPre,
    schema: {
      description: 'Từ chối yêu cầu tham gia Talent Pool',
      tags: ['System - Talent Pool'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', maxLength: 2000 } } },
    },
  }, tpController.rejectRequest.bind(tpController));

  // ── Talent Pool: Members ──

  fastify.get('/talent-pool/members', {
    preHandler: adminPre,
    schema: {
      description: 'Danh sách thành viên Talent Pool',
      tags: ['System - Talent Pool'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          q: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'REMOVED'] },
        },
      },
    },
  }, tpController.listMembers.bind(tpController));

  fastify.get('/talent-pool/members/lookup', {
    preHandler: adminPre,
    schema: {
      description: 'Tra cứu người dùng theo email (preview trước khi add)',
      tags: ['System - Talent Pool'],
      security: [{ bearerAuth: [] }],
      querystring: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
    },
  }, tpController.lookupUser.bind(tpController));

  fastify.post('/talent-pool/members', {
    preHandler: adminPre,
    schema: {
      description: 'Thêm thủ công thành viên vào Talent Pool',
      tags: ['System - Talent Pool'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['email', 'reason'],
        properties: {
          email: { type: 'string', format: 'email' },
          reason: { type: 'string', maxLength: 2000 },
        },
      },
    },
  }, tpController.addMember.bind(tpController));

  fastify.patch('/talent-pool/members/:id/remove', {
    preHandler: adminPre,
    schema: {
      description: 'Gỡ thành viên khỏi Talent Pool',
      tags: ['System - Talent Pool'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', maxLength: 2000 } } },
    },
  }, tpController.removeMember.bind(tpController));

  // ── Talent Pool: Entitlements ──

  fastify.get('/talent-pool/entitlements', {
    preHandler: adminPre,
    schema: {
      description: 'Danh sách công ty + trạng thái Talent Pool entitlement',
      tags: ['System - Talent Pool'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          q: { type: 'string' },
        },
      },
    },
  }, tpController.listEntitlements.bind(tpController));

  fastify.patch('/talent-pool/entitlements/:companyId', {
    preHandler: adminPre,
    schema: {
      description: 'Bật/tắt Talent Pool cho công ty',
      tags: ['System - Talent Pool'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['companyId'], properties: { companyId: { type: 'string' } } },
      body: { type: 'object', required: ['enabled'], properties: { enabled: { type: 'boolean' } } },
    },
  }, tpController.toggleEntitlement.bind(tpController));
}
