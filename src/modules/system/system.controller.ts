import { FastifyReply, FastifyRequest } from 'fastify';
import { SystemService } from './system.service';
import { AppError } from '@/shared/errors/errorHandler';
import type { AuthenticatedRequest } from '@/modules/auth/auth.middleware';
import {
  adminCompaniesQuerySchema,
  adminJobsQuerySchema,
  adminPostFeedVisibilityPatchSchema,
  adminPostsQuerySchema,
  adminCompanyPremiumPatchSchema,
  adminReportTimeseriesQuerySchema,
  adminUserAccountPatchSchema,
  adminUsersQuerySchema,
} from '@/modules/system/system.schema';

export class SystemController {
  constructor(private systemService: SystemService) {}

  async getOverview(_request: FastifyRequest, reply: FastifyReply) {
    const stats = await this.systemService.getOverview();

    return reply.send({
      data: { stats },
    });
  }

  async listProvinces(_request: FastifyRequest, reply: FastifyReply) {
    const result = await this.systemService.listProvinceRegistryForAdmin();
    return reply.send({ data: result });
  }

  async listUsers(request: FastifyRequest, reply: FastifyReply) {
    const parsed = adminUsersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const result = await this.systemService.listUsersForAdmin(parsed.data);
    return reply.send({ data: result });
  }

  async patchUserAccountStatus(request: AuthenticatedRequest, reply: FastifyReply) {
    const adminId = request.user?.userId;
    if (!adminId) {
      throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');
    }
    const { userId } = request.params as { userId: string };
    const parsed = adminUserAccountPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const user = await this.systemService.setUserAccountStatus(
      adminId,
      userId,
      parsed.data.accountStatus
    );
    return reply.send({ data: { user } });
  }

  async listCompanies(request: FastifyRequest, reply: FastifyReply) {
    const parsed = adminCompaniesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const result = await this.systemService.listCompaniesForAdmin(parsed.data);
    return reply.send({ data: result });
  }

  async patchCompanyPremiumStatus(request: AuthenticatedRequest, reply: FastifyReply) {
    const { companyId } = request.params as { companyId: string };
    const parsed = adminCompanyPremiumPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const company = await this.systemService.setCompanyPremiumStatus(companyId, parsed.data.isPremium);
    return reply.send({ data: { company } });
  }

  async listJobs(request: FastifyRequest, reply: FastifyReply) {
    const parsed = adminJobsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const result = await this.systemService.listJobsForAdmin(parsed.data);
    return reply.send({ data: result });
  }

  async listPosts(request: FastifyRequest, reply: FastifyReply) {
    const parsed = adminPostsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const result = await this.systemService.listPostsForAdmin(parsed.data);
    return reply.send({ data: result });
  }

  async patchPostFeedVisibility(request: FastifyRequest, reply: FastifyReply) {
    const { postId } = request.params as { postId: string };
    const parsed = adminPostFeedVisibilityPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const post = await this.systemService.setPostFeedVisibility(postId, parsed.data.hiddenFromFeed);
    return reply.send({ data: { post } });
  }

  async sendJobReminder(request: FastifyRequest, reply: FastifyReply) {
    const { jobId } = request.params as { jobId: string };
    const job = await this.systemService.sendExpiringReminderForJob(jobId);
    return reply.send({ data: { job } });
  }

  async closeJob(request: FastifyRequest, reply: FastifyReply) {
    const { jobId } = request.params as { jobId: string };
    const job = await this.systemService.closeJobByAdmin(jobId);
    return reply.send({ data: { job } });
  }

  async closeExpiredJobs(_request: FastifyRequest, reply: FastifyReply) {
    const result = await this.systemService.closeExpiredJobsByAdmin();
    return reply.send({ data: result });
  }

  async getReportTimeseries(request: FastifyRequest, reply: FastifyReply) {
    const parsed = adminReportTimeseriesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const result = await this.systemService.getReportTimeseries(parsed.data);
    return reply.send({ data: result });
  }

  async listCompanyVerifications(request: FastifyRequest, reply: FastifyReply) {
    const { status } = request.query as { status?: string };
    const items = await this.systemService.listCompanyVerifications(status);
    return reply.send({ data: { companies: items } });
  }

  async approveCompanyVerification(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = request.user?.userId;
    if (!userId) {
      throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');
    }
    const { companyId } = request.params as { companyId: string };
    const company = await this.systemService.approveCompanyVerification(companyId, userId);
    return reply.send({ data: { company } });
  }

  async rejectCompanyVerification(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = request.user?.userId;
    if (!userId) {
      throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');
    }
    const { companyId } = request.params as { companyId: string };
    const { reason } = request.body as { reason?: string };
    const company = await this.systemService.rejectCompanyVerification(companyId, userId, reason);
    return reply.send({ data: { company } });
  }

  async getCompanyVerificationDownload(request: FastifyRequest, reply: FastifyReply) {
    const { companyId } = request.params as { companyId: string };
    try {
      const data = await this.systemService.getCompanyVerificationDownloadUrl(companyId);
      return reply.send({ data });
    } catch {
      return reply.status(404).send({
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Không tìm thấy hồ sơ xác thực',
        },
      });
    }
  }
}
