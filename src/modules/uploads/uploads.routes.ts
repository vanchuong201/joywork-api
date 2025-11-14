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
}

