import { FastifyInstance } from 'fastify';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';
import { CandidateCvController } from './candidate-cvs.controller';
import { CandidateCvService } from './candidate-cvs.service';
import { CV_LIMIT, CV_NAME_MAX_LENGTH } from './candidate-cvs.schema';

const TAGS = ['Candidate CVs'];

const looseObject = { type: 'object', additionalProperties: true } as const;

const dataResponse = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties: {
    data: { type: 'object', properties },
  },
});

const cvIdParams = {
  type: 'object',
  properties: { id: { type: 'string' } },
  required: ['id'],
} as const;

const cvItemParams = {
  type: 'object',
  properties: { id: { type: 'string' }, itemId: { type: 'string' } },
  required: ['id', 'itemId'],
} as const;

const cvNameProperty = { type: 'string', minLength: 1, maxLength: CV_NAME_MAX_LENGTH };

const cvListResponse = dataResponse({
  cvs: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        isDefault: { type: 'boolean' },
        title: { type: 'string', nullable: true },
        avatar: { type: 'string', nullable: true },
        readiness: {
          type: 'object',
          properties: {
            hasBasicInfo: { type: 'boolean' },
            hasKsa: { type: 'boolean' },
            hasExperiences: { type: 'boolean' },
            isReady: { type: 'boolean' },
            missingSections: { type: 'array', items: { type: 'string' } },
          },
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  },
  limit: { type: 'integer' },
  defaultCvId: { type: 'string', nullable: true },
});

const experienceBody = {
  type: 'object',
  properties: {
    role: { type: 'string', minLength: 1, maxLength: 200 },
    company: { type: 'string', minLength: 1, maxLength: 200 },
    startDate: { type: 'string', format: 'date-time', nullable: true },
    endDate: { type: 'string', format: 'date-time', nullable: true },
    period: { type: 'string', maxLength: 100, nullable: true },
    desc: { type: 'string', maxLength: 2000, nullable: true },
    achievements: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    order: { type: 'number', minimum: 0 },
  },
} as const;

const educationBody = {
  type: 'object',
  properties: {
    school: { type: 'string', minLength: 1, maxLength: 200 },
    degree: { type: 'string', minLength: 1, maxLength: 200 },
    startDate: { type: 'string', format: 'date-time', nullable: true },
    endDate: { type: 'string', format: 'date-time', nullable: true },
    period: { type: 'string', maxLength: 100, nullable: true },
    gpa: { type: 'string', maxLength: 50, nullable: true },
    honors: { type: 'string', maxLength: 200, nullable: true },
    order: { type: 'number', minimum: 0 },
  },
} as const;

export async function candidateCvsRoutes(fastify: FastifyInstance) {
  const authMiddleware = new AuthMiddleware(new AuthService());
  const controller = new CandidateCvController(new CandidateCvService());
  const auth = [authMiddleware.verifyToken.bind(authMiddleware)];
  const security = [{ bearerAuth: [] }];

  fastify.get('/', {
    preHandler: auth,
    schema: {
      description: `Danh sách CV của ứng viên (tối đa ${CV_LIMIT}). Tự tạo "CV của tôi" nếu user chưa có CV.`,
      tags: TAGS,
      security,
      response: { 200: cvListResponse },
    },
  }, controller.list.bind(controller));

  fastify.post('/', {
    preHandler: auth,
    schema: {
      description: `Tạo CV rỗng. 409 CV_LIMIT_REACHED khi đủ ${CV_LIMIT} CV, 409 CV_NAME_DUPLICATE khi trùng tên (không phân biệt hoa thường).`,
      tags: TAGS,
      security,
      body: { type: 'object', properties: { name: cvNameProperty }, required: ['name'] },
      response: { 201: dataResponse({ cv: looseObject }) },
    },
  }, controller.create.bind(controller));

  fastify.get('/:id', {
    preHandler: auth,
    schema: {
      description: 'Chi tiết CV (nội dung, kinh nghiệm, học vấn, readiness). 404 CV_NOT_FOUND nếu không thuộc user.',
      tags: TAGS,
      security,
      params: cvIdParams,
      response: { 200: dataResponse({ cv: looseObject }) },
    },
  }, controller.get.bind(controller));

  fastify.patch('/:id', {
    preHandler: auth,
    schema: {
      description:
        'Cập nhật tên và/hoặc nội dung CV. Field nội dung giống PATCH /api/users/me/profile (trừ name/slug/status/isPublic/isSearchingJob/allowCvFlip).',
      tags: TAGS,
      security,
      params: cvIdParams,
      body: { type: 'object', properties: { name: cvNameProperty }, additionalProperties: true },
      response: { 200: dataResponse({ cv: looseObject }) },
    },
  }, controller.update.bind(controller));

  fastify.delete('/:id', {
    preHandler: auth,
    schema: {
      description: 'Xóa CV. 409 CV_IS_DEFAULT nếu là CV mặc định, 409 CV_LAST_ONE nếu là CV duy nhất.',
      tags: TAGS,
      security,
      params: cvIdParams,
      response: { 200: dataResponse({ success: { type: 'boolean' } }) },
    },
  }, controller.remove.bind(controller));

  fastify.post('/:id/duplicate', {
    preHandler: auth,
    schema: {
      description: 'Nhân bản CV (kèm kinh nghiệm, học vấn). Tên mặc định "Bản sao của …".',
      tags: TAGS,
      security,
      params: cvIdParams,
      body: { type: 'object', nullable: true, properties: { name: cvNameProperty } },
      response: { 201: dataResponse({ cv: looseObject }) },
    },
  }, controller.duplicate.bind(controller));

  fastify.post('/:id/set-default', {
    preHandler: auth,
    schema: {
      description: 'Đặt CV mặc định (CV doanh nghiệp tìm thấy khi bật tìm việc). Trả về danh sách CV mới.',
      tags: TAGS,
      security,
      params: cvIdParams,
      response: { 200: cvListResponse },
    },
  }, controller.setDefault.bind(controller));

  // ─── Experiences ─────────────────────────────────────────────────────────────

  fastify.get('/:id/experiences', {
    preHandler: auth,
    schema: {
      description: 'Danh sách kinh nghiệm của CV',
      tags: TAGS,
      security,
      params: cvIdParams,
      response: { 200: dataResponse({ experiences: { type: 'array', items: looseObject } }) },
    },
  }, controller.listExperiences.bind(controller));

  fastify.post('/:id/experiences', {
    preHandler: auth,
    schema: {
      description: 'Thêm kinh nghiệm vào CV',
      tags: TAGS,
      security,
      params: cvIdParams,
      body: { ...experienceBody, required: ['role', 'company'] },
      response: { 201: dataResponse({ experience: looseObject }) },
    },
  }, controller.createExperience.bind(controller));

  fastify.patch('/:id/experiences/:itemId', {
    preHandler: auth,
    schema: {
      description: 'Cập nhật kinh nghiệm của CV',
      tags: TAGS,
      security,
      params: cvItemParams,
      body: experienceBody,
      response: { 200: dataResponse({ experience: looseObject }) },
    },
  }, controller.updateExperience.bind(controller));

  fastify.delete('/:id/experiences/:itemId', {
    preHandler: auth,
    schema: {
      description: 'Xóa kinh nghiệm của CV',
      tags: TAGS,
      security,
      params: cvItemParams,
      response: { 200: dataResponse({ success: { type: 'boolean' } }) },
    },
  }, controller.deleteExperience.bind(controller));

  // ─── Educations ──────────────────────────────────────────────────────────────

  fastify.get('/:id/educations', {
    preHandler: auth,
    schema: {
      description: 'Danh sách học vấn của CV',
      tags: TAGS,
      security,
      params: cvIdParams,
      response: { 200: dataResponse({ educations: { type: 'array', items: looseObject } }) },
    },
  }, controller.listEducations.bind(controller));

  fastify.post('/:id/educations', {
    preHandler: auth,
    schema: {
      description: 'Thêm học vấn vào CV',
      tags: TAGS,
      security,
      params: cvIdParams,
      body: { ...educationBody, required: ['school', 'degree'] },
      response: { 201: dataResponse({ education: looseObject }) },
    },
  }, controller.createEducation.bind(controller));

  fastify.patch('/:id/educations/:itemId', {
    preHandler: auth,
    schema: {
      description: 'Cập nhật học vấn của CV',
      tags: TAGS,
      security,
      params: cvItemParams,
      body: educationBody,
      response: { 200: dataResponse({ education: looseObject }) },
    },
  }, controller.updateEducation.bind(controller));

  fastify.delete('/:id/educations/:itemId', {
    preHandler: auth,
    schema: {
      description: 'Xóa học vấn của CV',
      tags: TAGS,
      security,
      params: cvItemParams,
      response: { 200: dataResponse({ success: { type: 'boolean' } }) },
    },
  }, controller.deleteEducation.bind(controller));
}
