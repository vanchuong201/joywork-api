import { FastifyInstance } from 'fastify';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';

export async function uploadsRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const authMiddleware = new AuthMiddleware(authService);
  const uploadsService = new UploadsService();
  const uploadsController = new UploadsController(uploadsService);
  const adminPre = [authMiddleware.verifyToken.bind(authMiddleware), authMiddleware.requireAdmin.bind(authMiddleware)];

  fastify.post(
    '/presign',
    {
      preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
      schema: {
        description: 'Tạo presigned URL để tải ảnh lên S3',
        tags: ['Uploads'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['companyId', 'fileName', 'fileType', 'fileSize'],
          properties: {
            companyId: { type: 'string', description: 'ID của công ty', minLength: 1 },
            fileName: { type: 'string', description: 'Tên tệp gốc', minLength: 1 },
            fileType: { type: 'string', description: 'MIME type của tệp', minLength: 1 },
            fileSize: { type: 'number', description: 'Kích thước tệp (bytes)', minimum: 1 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  uploadUrl: { type: 'string' },
                  assetUrl: { type: 'string' },
                  expiresIn: { type: 'number' },
                  maxFileSize: { type: 'number' },
                  allowedTypes: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    uploadsController.createPresign.bind(uploadsController),
  );

  fastify.post(
    '/profile/avatar/presign',
    {
      preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
      schema: {
        description: 'Tạo presigned URL để tải ảnh đại diện người dùng',
        tags: ['Uploads'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['fileName', 'fileType', 'fileSize'],
          properties: {
            fileName: { type: 'string', description: 'Tên tệp gốc', minLength: 1 },
            fileType: { type: 'string', description: 'MIME type của tệp', minLength: 1 },
            fileSize: { type: 'number', description: 'Kích thước tệp (bytes)', minimum: 1 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  uploadUrl: { type: 'string' },
                  assetUrl: { type: 'string' },
                  expiresIn: { type: 'number' },
                  maxFileSize: { type: 'number' },
                  allowedTypes: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    uploadsController.createProfileAvatarPresign.bind(uploadsController),
  );

  fastify.post(
    '/system/course-asset/presign',
    {
      preHandler: adminPre,
      schema: {
        description: 'ADMIN: presigned upload cho thumbnail / video / đính kèm khóa học',
        tags: ['Uploads'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['kind', 'fileName', 'fileType', 'fileSize'],
          properties: {
            kind: { type: 'string', enum: ['thumbnail', 'video', 'attachment'] },
            fileName: { type: 'string' },
            fileType: { type: 'string' },
            fileSize: { type: 'number' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  uploadUrl: { type: 'string' },
                  assetUrl: { type: 'string' },
                  expiresIn: { type: 'number' },
                  maxFileSize: { type: 'number' },
                  allowedTypes: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
    uploadsController.createCourseAssetPresign.bind(uploadsController),
  );

  fastify.post(
    '/profile/avatar',
    {
      preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
      schema: {
        description: 'Tải ảnh đại diện người dùng trực tiếp lên S3 thông qua máy chủ',
        tags: ['Uploads'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['fileName', 'fileType', 'fileData'],
          properties: {
            fileName: { type: 'string', description: 'Tên tệp gốc', minLength: 1 },
            fileType: { type: 'string', description: 'MIME type của tệp', minLength: 1 },
            fileData: { type: 'string', description: 'Dữ liệu ảnh dạng base64' },
            previousKey: { type: 'string' },
            target: { type: 'string', enum: ['account', 'profile'], description: 'Target: account for User.avatar, profile for UserProfile.avatar', default: 'profile' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  assetUrl: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    uploadsController.uploadProfileAvatar.bind(uploadsController),
  );

  fastify.post(
    '/profile/cv',
    {
      preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
      schema: {
        description: 'Tải file CV người dùng trực tiếp lên S3 thông qua máy chủ',
        tags: ['Uploads'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['fileName', 'fileType', 'fileData'],
          properties: {
            fileName: { type: 'string', description: 'Tên tệp gốc', minLength: 1 },
            fileType: { type: 'string', description: 'MIME type của tệp (application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document)', minLength: 1 },
            fileData: { type: 'string', description: 'Dữ liệu file dạng base64' },
            previousKey: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  assetUrl: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    uploadsController.uploadProfileCV.bind(uploadsController),
  );

  fastify.post(
    '/company/verification-document',
    {
      bodyLimit: 30 * 1024 * 1024,
      preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
      schema: {
        description: 'Tải hồ sơ xác thực doanh nghiệp (DKKD)',
        tags: ['Uploads'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['companyId', 'fileName', 'fileType', 'fileData'],
          properties: {
            companyId: { type: 'string', description: 'ID công ty', minLength: 1 },
            fileName: { type: 'string', description: 'Tên tệp gốc', minLength: 1 },
            fileType: { type: 'string', description: 'MIME type của tệp', minLength: 1 },
            fileData: { type: 'string', description: 'Dữ liệu file dạng base64' },
            previousKey: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  assetUrl: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    uploadsController.uploadCompanyVerification.bind(uploadsController),
  );

  fastify.get(
    '/company/verification-document/download',
    {
      preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
      schema: {
        description: 'Lấy link tải hồ sơ xác thực doanh nghiệp (DKKD)',
        tags: ['Uploads'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['companyId'],
          properties: {
            companyId: { type: 'string', minLength: 1 },
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
        },
      },
    },
    uploadsController.getCompanyVerificationDownload.bind(uploadsController),
  );

  fastify.post(
    '/company/post-image',
    {
      // NOTE: video upload uses base64 in JSON body, which inflates payload size by ~33%.
      // A 50MB video becomes ~67MB base64 + JSON overhead, so we must allow larger body here.
      bodyLimit: 100 * 1024 * 1024, // 100MB
      preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
      schema: {
        description: 'Tải ảnh bài đăng của doanh nghiệp thông qua máy chủ',
        tags: ['Uploads'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['companyId', 'fileName', 'fileType', 'fileData'],
          properties: {
            companyId: { type: 'string', description: 'ID của công ty', minLength: 1 },
            fileName: { type: 'string', description: 'Tên tệp gốc', minLength: 1 },
            fileType: { type: 'string', description: 'MIME type của tệp', minLength: 1 },
            fileData: { type: 'string', description: 'Dữ liệu ảnh dạng base64' },
            previousKey: { type: 'string', description: 'Đường dẫn ảnh cũ cần xoá (nếu có)' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  assetUrl: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    uploadsController.uploadCompanyPostImage.bind(uploadsController),
  );

  fastify.post(
    '/company/logo',
    {
      preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
      schema: {
        description: 'Tải logo công ty trực tiếp lên S3 thông qua máy chủ',
        tags: ['Uploads'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['companyId', 'fileName', 'fileType', 'fileData'],
          properties: {
            companyId: { type: 'string', description: 'ID của công ty', minLength: 1 },
            fileName: { type: 'string', description: 'Tên tệp gốc', minLength: 1 },
            fileType: { type: 'string', description: 'MIME type của tệp', minLength: 1 },
            fileData: { type: 'string', description: 'Dữ liệu ảnh dạng base64' },
            previousKey: { type: 'string', description: 'Đường dẫn logo cũ cần xoá (nếu có)' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  assetUrl: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    uploadsController.uploadCompanyLogo.bind(uploadsController),
  );

  fastify.post(
    '/company/cover',
    {
      preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
      schema: {
        description: 'Tải ảnh cover công ty trực tiếp lên S3 thông qua máy chủ',
        tags: ['Uploads'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['companyId', 'fileName', 'fileType', 'fileData'],
          properties: {
            companyId: { type: 'string', description: 'ID của công ty', minLength: 1 },
            fileName: { type: 'string', description: 'Tên tệp gốc', minLength: 1 },
            fileType: { type: 'string', description: 'MIME type của tệp', minLength: 1 },
            fileData: { type: 'string', description: 'Dữ liệu ảnh dạng base64' },
            previousKey: { type: 'string', description: 'Đường dẫn cover cũ cần xoá (nếu có)' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  assetUrl: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    uploadsController.uploadCompanyCover.bind(uploadsController),
  );

  fastify.delete('/object', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Xóa một tệp đã tải lên S3',
      tags: ['Uploads'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string', description: 'Đường dẫn (key) của object trong S3' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, uploadsController.deleteObject.bind(uploadsController));

  /** Multipart dùng plugin đã đăng ký ở app (giới hạn ~210MB) — không đăng ký lại @fastify/multipart. */
  fastify.post(
    '/system/course-asset/upload',
    {
      preHandler: adminPre,
      schema: {
        description:
          'ADMIN: upload khóa học qua API (multipart). Dùng thay cho PUT presigned trực tiếp lên S3 khi bucket chưa cấu hình CORS.',
        tags: ['Uploads'],
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        querystring: {
          type: 'object',
          required: ['kind'],
          properties: {
            kind: { type: 'string', enum: ['thumbnail', 'video', 'attachment'] },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  assetUrl: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    uploadsController.uploadCourseAssetMultipart.bind(uploadsController),
  );
}

