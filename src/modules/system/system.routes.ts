import { FastifyInstance } from 'fastify';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { SystemImportController } from './system-import.controller';
import { SystemTalentPoolController } from './system-talent-pool.controller';
import { TalentPoolService } from '@/modules/talent-pool/talent-pool.service';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';
import { CourseAdminController } from '@/modules/courses/course-admin.controller';
import { CourseAdminService } from '@/modules/courses/course-admin.service';

export async function systemRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const authMiddleware = new AuthMiddleware(authService);
  const systemService = new SystemService();
  const systemController = new SystemController(systemService);
  const importController = new SystemImportController();
  const talentPoolService = new TalentPoolService();
  const tpController = new SystemTalentPoolController(talentPoolService);
  const courseAdminService = new CourseAdminService();
  const courseAdminController = new CourseAdminController(courseAdminService);
  const adminPre = [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)];

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
          premiumStatus: {
            type: 'string',
            enum: ['premium', 'free'],
          },
          cvFlipStatus: {
            type: 'string',
            enum: ['enabled', 'disabled'],
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
                      cvFlipEnabled: { type: 'boolean' },
                      cvFlipMonthlyTotalLimit: { type: 'number' },
                      cvFlipMonthlyRequestLimit: { type: 'number' },
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

  fastify.get('/companies/showcase/:type', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Danh sách công ty trong mục hiển thị trang jobs (FEATURED/TOP)',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['FEATURED', 'TOP'] },
        },
      },
    },
  }, systemController.listCompanyShowcase.bind(systemController));

  fastify.post('/companies/showcase/:type', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Thêm công ty vào danh sách hiển thị FEATURED/TOP',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['FEATURED', 'TOP'] },
        },
      },
      body: {
        type: 'object',
        required: ['companyId'],
        properties: {
          companyId: { type: 'string' },
          coverUrl: { type: 'string' },
        },
      },
    },
  }, systemController.addCompanyToShowcase.bind(systemController));

  fastify.delete('/companies/showcase/:type/:companyId', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Loại bỏ công ty khỏi danh sách hiển thị FEATURED/TOP',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['type', 'companyId'],
        properties: {
          type: { type: 'string', enum: ['FEATURED', 'TOP'] },
          companyId: { type: 'string' },
        },
      },
    },
  }, systemController.removeCompanyFromShowcase.bind(systemController));

  fastify.patch('/companies/showcase/:type/reorder', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Sắp xếp thứ tự công ty trong danh sách hiển thị FEATURED/TOP',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['FEATURED', 'TOP'] },
        },
      },
      body: {
        type: 'object',
        required: ['companyIds'],
        properties: {
          companyIds: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  }, systemController.reorderCompanyShowcase.bind(systemController));

  fastify.post('/companies/showcase/featured-cover/upload', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Upload ảnh cover riêng cho mục công ty nổi bật',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['fileName', 'fileType', 'fileData'],
        properties: {
          fileName: { type: 'string' },
          fileType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] },
          fileData: { type: 'string' },
        },
      },
    },
  }, systemController.uploadFeaturedShowcaseCover.bind(systemController));

  fastify.patch('/companies/showcase/featured/:companyId/cover', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Gán cover riêng cho 1 công ty trong danh sách FEATURED',
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
        required: ['coverUrl'],
        properties: {
          coverUrl: { type: 'string' },
        },
      },
    },
  }, systemController.patchFeaturedShowcaseCover.bind(systemController));

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

  fastify.patch('/companies/:companyId/cv-flip', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Cập nhật entitlement Mở CV của doanh nghiệp',
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
        required: ['enabled'],
        properties: {
          enabled: { type: 'boolean' },
          monthlyTotalLimit: { type: 'integer', minimum: 1 },
          monthlyRequestLimit: { type: 'integer', minimum: 1 },
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
                    enabled: { type: 'boolean' },
                    monthlyTotalLimit: { type: 'number' },
                    monthlyRequestLimit: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.patchCompanyCvFlipStatus.bind(systemController));

  fastify.get('/jobs', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Danh sách job cho admin theo trạng thái sắp hết hạn / quá hạn',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          q: { type: 'string' },
          filter: { type: 'string', enum: ['expiring_soon', 'expired', 'all'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                jobs: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      companyId: { type: 'string' },
                      companyName: { type: 'string' },
                      companySlug: { type: 'string' },
                      updatedAt: { type: 'string' },
                      createdAt: { type: 'string' },
                      reminderSentAt: { type: ['string', 'null'] },
                      adminEmails: { type: 'array', items: { type: 'string' } },
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
  }, systemController.listJobs.bind(systemController));

  fastify.get('/posts', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Danh sách bài viết cho admin theo thứ tự mới nhất',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          q: { type: 'string' },
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
                posts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      type: { type: 'string' },
                      visibility: { type: 'string' },
                      hiddenFromFeed: { type: 'boolean' },
                      deletedByJoyworkAt: { type: ['string', 'null'] },
                      deletedByJoyworkReason: { type: ['string', 'null'] },
                      companyId: { type: 'string' },
                      companyName: { type: 'string' },
                      companySlug: { type: 'string' },
                      createdAt: { type: 'string' },
                      publishedAt: { type: ['string', 'null'] },
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
  }, systemController.listPosts.bind(systemController));

  fastify.patch('/posts/:postId/feed-visibility', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Ẩn hoặc hiện bài viết trên new feed',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['postId'],
        properties: {
          postId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['hiddenFromFeed'],
        properties: {
          hiddenFromFeed: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                post: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    hiddenFromFeed: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.patchPostFeedVisibility.bind(systemController));

  fastify.patch('/posts/:postId/delete', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Xóa mềm bài viết bởi JOYWORK và lưu lý do',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['postId'],
        properties: {
          postId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string', minLength: 5, maxLength: 1000 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                post: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    deletedByJoyworkAt: { type: ['string', 'null'] },
                    deletedByJoyworkReason: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.deletePostByJoywork.bind(systemController));

  fastify.patch('/posts/:postId/restore', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Khôi phục bài viết đã xóa mềm bởi JOYWORK',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['postId'],
        properties: {
          postId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                post: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    deletedByJoyworkAt: { type: ['string', 'null'] },
                    deletedByJoyworkReason: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.restorePostByJoywork.bind(systemController));

  fastify.post('/jobs/:jobId/send-reminder', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Gửi email nhắc nhở cho job sắp hết hạn',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['jobId'],
        properties: {
          jobId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                job: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    reminderSentAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.sendJobReminder.bind(systemController));

  fastify.patch('/jobs/:jobId/close', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Đóng một job theo thao tác admin',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['jobId'],
        properties: {
          jobId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                job: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    isActive: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.closeJob.bind(systemController));

  fastify.post('/jobs/close-expired', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Đóng tất cả job quá hạn 20 ngày không tương tác',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                closedCount: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, systemController.closeExpiredJobs.bind(systemController));

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

  // ── Import: Bulk create companies + jobs ──

  fastify.get('/import/template', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Tải file Excel mẫu để import hàng loạt công ty + tin tuyển dụng',
      tags: ['System - Import'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'string',
          description: 'Excel file (.xlsx)',
        },
      },
    },
  }, importController.downloadTemplate.bind(importController));

  fastify.post('/import/companies-jobs', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)],
    schema: {
      description: 'Import hàng loạt công ty và tin tuyển dụng từ file Excel',
      tags: ['System - Import'],
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                report: {
                  type: 'object',
                  properties: {
                    totalCompanies: { type: 'number' },
                    successCompanies: { type: 'number' },
                    failedCompanies: { type: 'number' },
                    totalJobs: { type: 'number' },
                    successJobs: { type: 'number' },
                    failedJobs: { type: 'number' },
                    skippedJobs: { type: 'number' },
                    errors: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          sheet: { type: 'string' },
                          row: { type: 'number' },
                          field: { type: 'string' },
                          message: { type: 'string' },
                        },
                      },
                    },
                    duration: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, importController.importCompaniesJobs.bind(importController));

  // ── Courses (admin) ──

  fastify.get('/courses', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: danh sách khóa học',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 200 },
          q: { type: 'string' },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'HIDDEN'] },
          visibility: { type: 'string', enum: ['PUBLIC', 'PRIVATE'] },
        },
      },
    },
  }, courseAdminController.list.bind(courseAdminController));

  fastify.post('/courses', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: tạo khóa học',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'shortDescription'],
        properties: {
          title: { type: 'string' },
          shortDescription: { type: 'string' },
          description: { type: 'string' },
          thumbnailUrl: { type: ['string', 'null'] },
          visibility: { type: 'string', enum: ['PUBLIC', 'PRIVATE'] },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'HIDDEN'] },
        },
      },
    },
  }, courseAdminController.create.bind(courseAdminController));

  fastify.get('/courses/:courseId', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: chi tiết khóa học',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['courseId'], properties: { courseId: { type: 'string' } } },
    },
  }, courseAdminController.getOne.bind(courseAdminController));

  fastify.patch('/courses/:courseId', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: cập nhật khóa học',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['courseId'], properties: { courseId: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          shortDescription: { type: 'string' },
          description: { type: 'string' },
          thumbnailUrl: { type: ['string', 'null'] },
          visibility: { type: 'string', enum: ['PUBLIC', 'PRIVATE'] },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'HIDDEN'] },
        },
      },
    },
  }, courseAdminController.patch.bind(courseAdminController));

  fastify.delete('/courses/:courseId', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: xóa khóa học',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['courseId'], properties: { courseId: { type: 'string' } } },
    },
  }, courseAdminController.remove.bind(courseAdminController));

  fastify.patch('/courses/:courseId/lessons/reorder', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: sắp xếp bài học',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['courseId'], properties: { courseId: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['lessonIds'],
        properties: { lessonIds: { type: 'array', items: { type: 'string' } } },
      },
    },
  }, courseAdminController.reorderLessons.bind(courseAdminController));

  fastify.post('/courses/:courseId/lessons', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: thêm bài học',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['courseId'], properties: { courseId: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['title'],
        properties: { title: { type: 'string' }, sortOrder: { type: 'integer' } },
      },
    },
  }, courseAdminController.createLesson.bind(courseAdminController));

  fastify.patch('/courses/:courseId/lessons/:lessonId', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: sửa bài học',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['courseId', 'lessonId'],
        properties: { courseId: { type: 'string' }, lessonId: { type: 'string' } },
      },
      body: { type: 'object', properties: { title: { type: 'string' }, sortOrder: { type: 'integer' } } },
    },
  }, courseAdminController.patchLesson.bind(courseAdminController));

  fastify.delete('/courses/:courseId/lessons/:lessonId', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: xóa bài học',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['courseId', 'lessonId'],
        properties: { courseId: { type: 'string' }, lessonId: { type: 'string' } },
      },
    },
  }, courseAdminController.deleteLesson.bind(courseAdminController));

  fastify.post('/courses/:courseId/lessons/:lessonId/videos', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: thêm video bài học',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['courseId', 'lessonId'],
        properties: { courseId: { type: 'string' }, lessonId: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['source', 'value'],
        properties: {
          source: { type: 'string', enum: ['URL', 'S3_KEY'] },
          value: { type: 'string' },
          sortOrder: { type: 'integer' },
        },
      },
    },
  }, courseAdminController.createVideo.bind(courseAdminController));

  fastify.patch('/courses/:courseId/lessons/:lessonId/videos/:videoId', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: sửa video',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['courseId', 'lessonId', 'videoId'],
        properties: {
          courseId: { type: 'string' },
          lessonId: { type: 'string' },
          videoId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          source: { type: 'string', enum: ['URL', 'S3_KEY'] },
          value: { type: 'string' },
          sortOrder: { type: 'integer' },
        },
      },
    },
  }, courseAdminController.patchVideo.bind(courseAdminController));

  fastify.delete('/courses/:courseId/lessons/:lessonId/videos/:videoId', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: xóa video',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['courseId', 'lessonId', 'videoId'],
        properties: {
          courseId: { type: 'string' },
          lessonId: { type: 'string' },
          videoId: { type: 'string' },
        },
      },
    },
  }, courseAdminController.deleteVideo.bind(courseAdminController));

  fastify.post('/courses/:courseId/lessons/:lessonId/attachments', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: thêm tệp đính kèm',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['courseId', 'lessonId'],
        properties: { courseId: { type: 'string' }, lessonId: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['name', 'source', 'value'],
        properties: {
          name: { type: 'string' },
          source: { type: 'string', enum: ['URL', 'S3_KEY'] },
          value: { type: 'string' },
          sortOrder: { type: 'integer' },
        },
      },
    },
  }, courseAdminController.createAttachment.bind(courseAdminController));

  fastify.patch('/courses/:courseId/lessons/:lessonId/attachments/:attachmentId', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: sửa tệp đính kèm',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['courseId', 'lessonId', 'attachmentId'],
        properties: {
          courseId: { type: 'string' },
          lessonId: { type: 'string' },
          attachmentId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          source: { type: 'string', enum: ['URL', 'S3_KEY'] },
          value: { type: 'string' },
          sortOrder: { type: 'integer' },
        },
      },
    },
  }, courseAdminController.patchAttachment.bind(courseAdminController));

  fastify.delete('/courses/:courseId/lessons/:lessonId/attachments/:attachmentId', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: xóa tệp đính kèm',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['courseId', 'lessonId', 'attachmentId'],
        properties: {
          courseId: { type: 'string' },
          lessonId: { type: 'string' },
          attachmentId: { type: 'string' },
        },
      },
    },
  }, courseAdminController.deleteAttachment.bind(courseAdminController));

  fastify.get('/courses/:courseId/enrollments', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: danh sách học viên (private)',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['courseId'], properties: { courseId: { type: 'string' } } },
    },
  }, courseAdminController.listEnrollments.bind(courseAdminController));

  fastify.post('/courses/:courseId/enrollments', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: thêm học viên',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['courseId'], properties: { courseId: { type: 'string' } } },
      body: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
    },
  }, courseAdminController.addEnrollment.bind(courseAdminController));

  fastify.delete('/courses/:courseId/enrollments/:enrollmentId', {
    preHandler: adminPre,
    schema: {
      description: 'Admin: gỡ học viên',
      tags: ['System - Courses'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['courseId', 'enrollmentId'],
        properties: { courseId: { type: 'string' }, enrollmentId: { type: 'string' } },
      },
    },
  }, courseAdminController.removeEnrollment.bind(courseAdminController));

  // ── Talent Pool: Requests ──

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
          enabled: { type: 'boolean' },
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
