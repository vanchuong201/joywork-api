import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@/shared/errors/errorHandler';
import type { AuthenticatedRequest } from '@/modules/auth/auth.middleware';
import { generateTemplate, importCompaniesAndJobs } from './system-import.service';

export class SystemImportController {
  async downloadTemplate(_request: FastifyRequest, reply: FastifyReply) {
    const buffer = await generateTemplate();

    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', 'attachment; filename="joywork-import-template.xlsx"')
      .send(buffer);
  }

  async importCompaniesJobs(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as AuthenticatedRequest).user?.userId;
    if (!userId) {
      throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');
    }

    const data = await request.file();
    if (!data) {
      throw new AppError('Vui lòng upload file Excel (.xlsx)', 400, 'FILE_REQUIRED');
    }

    const mime = data.mimetype;
    const validMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!validMimes.includes(mime)) {
      throw new AppError('Chỉ chấp nhận file Excel (.xlsx)', 400, 'INVALID_FILE_TYPE');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    if (fileBuffer.length === 0) {
      throw new AppError('File rỗng', 400, 'EMPTY_FILE');
    }

    const report = await importCompaniesAndJobs(fileBuffer, userId);

    return reply.send({ data: { report } });
  }
}
