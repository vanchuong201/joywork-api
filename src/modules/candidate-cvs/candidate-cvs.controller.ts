import { FastifyReply, FastifyRequest } from 'fastify';
import { removeUndefined } from '@/shared/utils';
import { CandidateCvService } from './candidate-cvs.service';
import {
  createCvSchema,
  cvEducationPatchSchema,
  cvEducationSchema,
  cvExperiencePatchSchema,
  cvExperienceSchema,
  cvIdParamsSchema,
  cvItemParamsSchema,
  duplicateCvSchema,
  updateCvSchema,
} from './candidate-cvs.schema';

const getUserId = (request: FastifyRequest): string => (request as any).user?.userId;

export class CandidateCvController {
  constructor(private cvService: CandidateCvService) {}

  async list(request: FastifyRequest, reply: FastifyReply) {
    const data = await this.cvService.list(getUserId(request));
    return reply.send({ data });
  }

  async get(request: FastifyRequest, reply: FastifyReply) {
    const { id } = cvIdParamsSchema.parse(request.params);
    const cv = await this.cvService.get(getUserId(request), id);
    return reply.send({ data: { cv } });
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = createCvSchema.parse(request.body);
    const cv = await this.cvService.create(getUserId(request), input);
    return reply.status(201).send({ data: { cv } });
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = cvIdParamsSchema.parse(request.params);
    const input = updateCvSchema.parse(request.body);
    const cv = await this.cvService.update(getUserId(request), id, input);
    return reply.send({ data: { cv } });
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = cvIdParamsSchema.parse(request.params);
    await this.cvService.remove(getUserId(request), id);
    return reply.send({ data: { success: true } });
  }

  async duplicate(request: FastifyRequest, reply: FastifyReply) {
    const { id } = cvIdParamsSchema.parse(request.params);
    const input = duplicateCvSchema.parse(request.body ?? {});
    const cv = await this.cvService.duplicate(getUserId(request), id, input);
    return reply.status(201).send({ data: { cv } });
  }

  async setDefault(request: FastifyRequest, reply: FastifyReply) {
    const { id } = cvIdParamsSchema.parse(request.params);
    const data = await this.cvService.setDefault(getUserId(request), id);
    return reply.send({ data });
  }

  async listExperiences(request: FastifyRequest, reply: FastifyReply) {
    const { id } = cvIdParamsSchema.parse(request.params);
    const experiences = await this.cvService.listExperiences(getUserId(request), id);
    return reply.send({ data: { experiences } });
  }

  async createExperience(request: FastifyRequest, reply: FastifyReply) {
    const { id } = cvIdParamsSchema.parse(request.params);
    const input = cvExperienceSchema.parse(request.body);
    const experience = await this.cvService.createExperience(getUserId(request), id, input);
    return reply.status(201).send({ data: { experience } });
  }

  async updateExperience(request: FastifyRequest, reply: FastifyReply) {
    const { id, itemId } = cvItemParamsSchema.parse(request.params);
    const input = removeUndefined(cvExperiencePatchSchema.parse(request.body));
    const experience = await this.cvService.updateExperience(getUserId(request), id, itemId, input);
    return reply.send({ data: { experience } });
  }

  async deleteExperience(request: FastifyRequest, reply: FastifyReply) {
    const { id, itemId } = cvItemParamsSchema.parse(request.params);
    await this.cvService.deleteExperience(getUserId(request), id, itemId);
    return reply.send({ data: { success: true } });
  }

  async listEducations(request: FastifyRequest, reply: FastifyReply) {
    const { id } = cvIdParamsSchema.parse(request.params);
    const educations = await this.cvService.listEducations(getUserId(request), id);
    return reply.send({ data: { educations } });
  }

  async createEducation(request: FastifyRequest, reply: FastifyReply) {
    const { id } = cvIdParamsSchema.parse(request.params);
    const input = cvEducationSchema.parse(request.body);
    const education = await this.cvService.createEducation(getUserId(request), id, input);
    return reply.status(201).send({ data: { education } });
  }

  async updateEducation(request: FastifyRequest, reply: FastifyReply) {
    const { id, itemId } = cvItemParamsSchema.parse(request.params);
    const input = removeUndefined(cvEducationPatchSchema.parse(request.body));
    const education = await this.cvService.updateEducation(getUserId(request), id, itemId, input);
    return reply.send({ data: { education } });
  }

  async deleteEducation(request: FastifyRequest, reply: FastifyReply) {
    const { id, itemId } = cvItemParamsSchema.parse(request.params);
    await this.cvService.deleteEducation(getUserId(request), id, itemId);
    return reply.send({ data: { success: true } });
  }
}
