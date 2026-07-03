import { FastifyReply } from 'fastify';
import { AppError } from '@/shared/errors/errorHandler';
import { ApiTokenService } from './api-token.service';
import {
  createApiTokenSchema,
  updateApiTokenSchema,
  apiTokenParamSchema,
  validateApiTokenBodySchema,
} from './api-token.schema';
import type { AuthenticatedRequest } from '@/modules/auth/auth.middleware';

export class ApiTokenController {
  constructor(private service: ApiTokenService) {}

  async create(request: AuthenticatedRequest, reply: FastifyReply) {
    const adminId = request.user?.userId;
    if (!adminId) throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');

    const parsed = createApiTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const result = await this.service.createToken(adminId, parsed.data);
    return reply.status(201).send({ data: result });
  }

  async list(_request: AuthenticatedRequest, reply: FastifyReply) {
    const tokens = await this.service.listTokens();
    return reply.send({ data: { tokens } });
  }

  async update(request: AuthenticatedRequest, reply: FastifyReply) {
    const paramParsed = apiTokenParamSchema.safeParse(request.params);
    if (!paramParsed.success) {
      throw new AppError('ID không hợp lệ', 400, 'VALIDATION_ERROR');
    }

    const bodyParsed = updateApiTokenSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', bodyParsed.error.flatten());
    }

    const token = await this.service.updateToken(paramParsed.data.id, bodyParsed.data);
    return reply.send({ data: { token } });
  }

  async remove(request: AuthenticatedRequest, reply: FastifyReply) {
    const paramParsed = apiTokenParamSchema.safeParse(request.params);
    if (!paramParsed.success) {
      throw new AppError('ID không hợp lệ', 400, 'VALIDATION_ERROR');
    }

    await this.service.deleteToken(paramParsed.data.id);
    return reply.status(204).send();
  }

  async validate(request: AuthenticatedRequest, reply: FastifyReply) {
    const parsed = validateApiTokenBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Token không hợp lệ', 400, 'VALIDATION_ERROR');
    }

    const result = await this.service.validateToken(parsed.data.token);
    return reply.send({ data: result });
  }
}
