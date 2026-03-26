import { FastifyReply } from 'fastify';
import { TalentPoolService } from '@/modules/talent-pool/talent-pool.service';
import { AppError } from '@/shared/errors/errorHandler';
import type { AuthenticatedRequest } from '@/modules/auth/auth.middleware';
import {
  adminRequestsQuerySchema,
  adminRejectBodySchema,
  adminMembersQuerySchema,
  adminAddMemberBodySchema,
  adminRemoveMemberBodySchema,
  adminLookupQuerySchema,
  adminEntitlementsQuerySchema,
  adminToggleEntitlementBodySchema,
} from '@/modules/talent-pool/talent-pool.schema';

export class SystemTalentPoolController {
  constructor(private service: TalentPoolService) {}

  // ── Requests ──

  async listRequests(request: AuthenticatedRequest, reply: FastifyReply) {
    const parsed = adminRequestsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const result = await this.service.listRequests(parsed.data);
    return reply.send({ data: result });
  }

  async approveRequest(request: AuthenticatedRequest, reply: FastifyReply) {
    const adminId = request.user?.userId;
    if (!adminId) throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');
    const { id } = request.params as { id: string };
    const result = await this.service.approveRequest(id, adminId);
    return reply.send({ data: result });
  }

  async rejectRequest(request: AuthenticatedRequest, reply: FastifyReply) {
    const adminId = request.user?.userId;
    if (!adminId) throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');
    const { id } = request.params as { id: string };
    const parsed = adminRejectBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const result = await this.service.rejectRequest(id, adminId, parsed.data.reason);
    return reply.send({ data: result });
  }

  // ── Members ──

  async listMembers(request: AuthenticatedRequest, reply: FastifyReply) {
    const parsed = adminMembersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const result = await this.service.listMembers(parsed.data);
    return reply.send({ data: result });
  }

  async lookupUser(request: AuthenticatedRequest, reply: FastifyReply) {
    const parsed = adminLookupQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const user = await this.service.lookupUserByEmail(parsed.data.email);
    return reply.send({ data: { user } });
  }

  async addMember(request: AuthenticatedRequest, reply: FastifyReply) {
    const adminId = request.user?.userId;
    if (!adminId) throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');
    const parsed = adminAddMemberBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const result = await this.service.adminAddMember(adminId, parsed.data);
    return reply.send({ data: result });
  }

  async removeMember(request: AuthenticatedRequest, reply: FastifyReply) {
    const adminId = request.user?.userId;
    if (!adminId) throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');
    const { id } = request.params as { id: string };
    const parsed = adminRemoveMemberBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const result = await this.service.removeMember(id, adminId, parsed.data.reason);
    return reply.send({ data: result });
  }

  // ── Entitlements ──

  async listEntitlements(request: AuthenticatedRequest, reply: FastifyReply) {
    const parsed = adminEntitlementsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const result = await this.service.listEntitlements(parsed.data);
    return reply.send({ data: result });
  }

  async toggleEntitlement(request: AuthenticatedRequest, reply: FastifyReply) {
    const { companyId } = request.params as { companyId: string };
    const parsed = adminToggleEntitlementBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const result = await this.service.toggleEntitlement(companyId, parsed.data.enabled);
    return reply.send({ data: result });
  }
}
