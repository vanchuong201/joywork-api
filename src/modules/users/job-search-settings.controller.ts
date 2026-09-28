import { FastifyReply, FastifyRequest } from 'fastify';
import { JobSearchSettingsService } from './job-search-settings.service';
import { jobSearchSettingsSchema } from './users.schema';

export class JobSearchSettingsController {
  constructor(private settingsService: JobSearchSettingsService) {}

  async get(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const settings = await this.settingsService.get(userId);
    return reply.send({ data: settings });
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const input = jobSearchSettingsSchema.parse(request.body ?? {});
    const settings = await this.settingsService.update(userId, input);
    return reply.send({ data: settings });
  }
}
