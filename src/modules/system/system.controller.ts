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
}


