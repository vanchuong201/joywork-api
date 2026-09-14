import type { FastifyInstance } from 'fastify';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';
import { SeoUrlsController } from './seo-urls.controller';
import { SeoUrlsImportService } from './seo-urls-import.service';
import { SeoUrlsService } from './seo-urls.service';

function buildController() {
  const service = new SeoUrlsService();
  return new SeoUrlsController(service, new SeoUrlsImportService(service));
}

/** Public SEO URL routes — mount at `/api/seo-urls`. */
export async function seoUrlsRoutes(fastify: FastifyInstance) {
  const controller = buildController();

  fastify.get(
    '/',
    {
      schema: {
        description: 'Danh sách SEO URL đã publish (dùng cho sitemap)',
        tags: ['SEO URLs'],
        querystring: {
          type: 'object',
          properties: {
            includeEmpty: { type: 'boolean', description: 'Bao gồm cả trang chưa có kết quả' },
          },
        },
      },
    },
    controller.listPublic.bind(controller),
  );

  fastify.get(
    '/jobs/:slug',
    {
      schema: {
        description: 'Resolve SEO URL /jobs/{slug} thành nội dung đích đã render',
        tags: ['SEO URLs'],
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' },
          },
        },
      },
    },
    controller.resolvePublic.bind(controller),
  );
}

/** Admin SEO URL routes — mount at `/api/system/seo-urls`. */
export async function seoUrlsAdminRoutes(fastify: FastifyInstance) {
  const authMiddleware = new AuthMiddleware(new AuthService());
  const adminPre = [
    authMiddleware.verifyToken.bind(authMiddleware),
    authMiddleware.requireAdmin.bind(authMiddleware),
  ];
  const controller = buildController();

  fastify.get(
    '/',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: danh sách SEO URL mapping',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
            page: { type: 'integer', minimum: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
      },
    },
    controller.listAdmin.bind(controller),
  );

  fastify.post(
    '/preview',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: parse URL gốc và xem trước bộ lọc đích, số kết quả, xung đột',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.preview.bind(controller),
  );

  fastify.post(
    '/',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: tạo SEO URL mapping (trạng thái Draft)',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.create.bind(controller),
  );

  fastify.patch(
    '/:id',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: cập nhật SEO URL mapping',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.update.bind(controller),
  );

  fastify.post(
    '/:id/publish',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: publish SEO URL',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.publish.bind(controller),
  );

  fastify.post(
    '/:id/unpublish',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: đưa SEO URL về Draft',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.unpublish.bind(controller),
  );

  fastify.post(
    '/:id/canonical',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: đặt SEO URL này làm URL chính (canonical) của nhóm cùng bộ lọc',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.setCanonical.bind(controller),
  );

  fastify.post(
    '/:id/archive',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: lưu trữ SEO URL',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.archive.bind(controller),
  );

  fastify.post(
    '/bulk-publish',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: publish nhiều SEO URL',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.bulkPublish.bind(controller),
  );

  fastify.delete(
    '/:id',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: xóa SEO URL mapping',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.remove.bind(controller),
  );

  fastify.post(
    '/import/dry-run',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: kiểm tra file Excel 4 cột trước khi import',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
      },
    },
    controller.importDryRun.bind(controller),
  );

  fastify.post(
    '/import/commit',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: import file Excel thành SEO URL Draft',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
      },
    },
    controller.importCommit.bind(controller),
  );
}
