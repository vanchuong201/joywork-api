import type { FastifyReply } from 'fastify';
import { AppError } from '@/shared/errors/errorHandler';
import type { AuthenticatedRequest } from '@/modules/auth/auth.middleware';
import { CvFlipService } from './cv-flip.service';
import {
  candidateDetailQuerySchema,
  candidatesQuerySchema,
  flipBodySchema,
  requestsQuerySchema,
  respondRequestBodySchema,
  usageQuerySchema,
} from './cv-flip.schema';

export class CvFlipController {
  constructor(private readonly service: CvFlipService) {}

  private getUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.userId;
    if (!userId) {
      throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');
    }
    return userId;
  }

  async checkAccess(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = this.getUserId(request);
    const result = await this.service.checkAccess(userId);
    return reply.send({ data: result });
  }

  async listCandidates(request: AuthenticatedRequest, reply: FastifyReply) {
    this.getUserId(request);
    const parsed = candidatesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const result = await this.service.listCandidates(parsed.data);
    return reply.send({ data: result });
  }

  async getCandidateDetail(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = this.getUserId(request);
    const { slug } = request.params as { slug: string };
    const parsed = candidateDetailQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const result = await this.service.getCandidateDetail(slug, userId, parsed.data);
    return reply.send({ data: result });
  }

  async flipCandidate(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = this.getUserId(request);
    const parsed = flipBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const result = await this.service.flipCandidate(userId, parsed.data.companyId, parsed.data.candidateUserId);
    return reply.send({ data: result });
  }

  async getUsage(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = this.getUserId(request);
    const parsed = usageQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const result = await this.service.getUsage(userId, parsed.data.companyId);
    return reply.send({ data: result });
  }

  async listMyRequests(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = this.getUserId(request);
    const parsed = requestsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const result = await this.service.listMyRequests(userId, parsed.data);
    return reply.send({ data: result });
  }

  async respondRequest(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = this.getUserId(request);
    const { requestId } = request.params as { requestId: string };
    const parsed = respondRequestBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const result = await this.service.respondRequest(userId, requestId, parsed.data.action);
    return reply.send({ data: result });
  }
}
