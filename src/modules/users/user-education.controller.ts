import { FastifyRequest, FastifyReply } from 'fastify';
import { UserEducationService } from './user-education.service';
import { educationSchema } from './users.schema';
import { removeUndefined } from '@/shared/utils';

export class UserEducationController {
  constructor(private educationService: UserEducationService) {}

  // Get all educations
  async getEducations(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    
    const educations = await this.educationService.getEducations(userId);
    
    return reply.send({
      data: { educations },
    });
  }

  // Create education
  async createEducation(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = educationSchema.parse(request.body);
    
    const education = await this.educationService.createEducation(userId, data);
    
    return reply.status(201).send({
      data: { education },
    });
  }

  // Update education
  async updateEducation(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { id } = request.params as { id: string };
    const rawData = educationSchema.partial().parse(request.body);
    const data = removeUndefined(rawData);
    
    const education = await this.educationService.updateEducation(userId, id, data as any);
    
    return reply.send({
      data: { education },
    });
  }

  // Delete education
  async deleteEducation(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { id } = request.params as { id: string };
    
    await this.educationService.deleteEducation(userId, id);
    
    return reply.send({
      data: { success: true },
    });
  }
}

