import { FastifyRequest, FastifyReply } from 'fastify';
import { UserExperienceService } from './user-experience.service';
import { experienceSchema } from './users.schema';
import { removeUndefined } from '@/shared/utils';

export class UserExperienceController {
  constructor(private experienceService: UserExperienceService) {}

  // Get all experiences
  async getExperiences(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    
    const experiences = await this.experienceService.getExperiences(userId);
    
    return reply.send({
      data: { experiences },
    });
  }

  // Create experience
  async createExperience(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = experienceSchema.parse(request.body);
    
    const experience = await this.experienceService.createExperience(userId, data);
    
    return reply.status(201).send({
      data: { experience },
    });
  }

  // Update experience
  async updateExperience(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { id } = request.params as { id: string };
    const rawData = experienceSchema.partial().parse(request.body);
    const data = removeUndefined(rawData);
    
    const experience = await this.experienceService.updateExperience(userId, id, data as any);
    
    return reply.send({
      data: { experience },
    });
  }

  // Delete experience
  async deleteExperience(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { id } = request.params as { id: string };
    
    await this.experienceService.deleteExperience(userId, id);
    
    return reply.send({
      data: { success: true },
    });
  }
}

