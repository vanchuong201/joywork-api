import { FastifyReply } from 'fastify';
import { TalentPoolService } from './talent-pool.service';
import { AppError } from '@/shared/errors/errorHandler';
import type { AuthenticatedRequest } from '@/modules/auth/auth.middleware';
import {
  createRequestBodySchema,
  candidatesQuerySchema,
} from './talent-pool.schema';

export class TalentPoolController {
  constructor(private service: TalentPoolService) {}

  async getMyStatus(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = request.user?.userId;
    if (!userId) throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');

    const result = await this.service.getMyStatus(userId);
    return reply.send({ data: result });
  }

  async createRequest(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = request.user?.userId;
    if (!userId) throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');

    const parsed = createRequestBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const result = await this.service.createRequest(userId, parsed.data.message);
    return reply.status(201).send({ data: { request: result } });
  }

  async checkAccess(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = request.user?.userId;
    if (!userId) throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');

    const result = await this.service.checkAccess(userId);
    return reply.send({ data: result });
  }

  async listCandidates(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = request.user?.userId;
    if (!userId) throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');

    const access = await this.service.checkAccess(userId);
    if (!access.hasAccess) {
      throw new AppError('Bạn không có quyền truy cập Talent Pool', 403, 'PREMIUM_REQUIRED');
    }

    const parsed = candidatesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const result = await this.service.listCandidates(parsed.data);
    return reply.send({ data: result });
  }
}
