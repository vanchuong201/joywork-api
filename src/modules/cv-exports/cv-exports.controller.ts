import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '@/modules/auth/auth.middleware';
import { AppError } from '@/shared/errors/errorHandler';
import { CvExportsService } from './cv-exports.service';
import {
  exportCandidatePdfParamsSchema,
  exportCandidatePdfQuerySchema,
} from './cv-exports.schema';

export class CvExportsController {
  constructor(private readonly service: CvExportsService) {}

  private getUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.userId;
    if (!userId) {
      throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');
    }
    return userId;
  }

  /**
   * Tên file có dấu tiếng Việt gửi qua `filename*=UTF-8''` (RFC 5987);
   * `filename=` chỉ chứa ASCII làm fallback cho client cũ — header HTTP
   * không được chứa ký tự non-ASCII trực tiếp.
   */
  private buildContentDisposition(fileName: string): string {
    const asciiFallback = fileName
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '_');

    const encoded = encodeURIComponent(fileName).replace(
      /['()*]/g,
      char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    );

    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
  }

  private sendPdf(
    reply: FastifyReply,
    params: { fileName: string; buffer: Buffer }
  ) {
    return reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        this.buildContentDisposition(params.fileName)
      )
      .header('Content-Length', String(params.buffer.byteLength))
      .send(params.buffer);
  }

  async exportOwnPdf(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = this.getUserId(request);
    const result = await this.service.exportOwnCvPdf(userId);
    return this.sendPdf(reply, result);
  }

  async exportCandidatePdf(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = this.getUserId(request);
    const paramsParsed = exportCandidatePdfParamsSchema.safeParse(
      request.params
    );
    if (!paramsParsed.success) {
      throw new AppError(
        'Tham số không hợp lệ',
        400,
        'VALIDATION_ERROR',
        paramsParsed.error.flatten()
      );
    }

    const queryParsed = exportCandidatePdfQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      throw new AppError(
        'Tham số không hợp lệ',
        400,
        'VALIDATION_ERROR',
        queryParsed.error.flatten()
      );
    }

    const result = await this.service.exportCandidateCvPdf({
      slug: paramsParsed.data.slug,
      viewerUserId: userId,
      companyId: queryParsed.data.companyId,
    });
    return this.sendPdf(reply, result);
  }
}
