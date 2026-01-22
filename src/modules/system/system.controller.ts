import { FastifyReply, FastifyRequest } from 'fastify';
import { SystemService } from './system.service';

export class SystemController {
  constructor(private systemService: SystemService) {}

  async getOverview(_request: FastifyRequest, reply: FastifyReply) {
    const stats = await this.systemService.getOverview();

    return reply.send({
      data: { stats },
    });
  }

  async listCompanyVerifications(request: FastifyRequest, reply: FastifyReply) {
    const { status } = request.query as { status?: string };
    const items = await this.systemService.listCompanyVerifications(status);
    return reply.send({ data: { companies: items } });
  }

  async approveCompanyVerification(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { companyId } = request.params as { companyId: string };
    const company = await this.systemService.approveCompanyVerification(companyId, userId);
    return reply.send({ data: { company } });
  }

  async rejectCompanyVerification(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
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


