import { CandidateCvService } from '@/modules/candidate-cvs/candidate-cvs.service';
import type { CvExperiencePatch } from '@/modules/candidate-cvs/candidate-cvs.schema';
import { ExperienceInput } from './users.schema';

/** Adapter `/api/users/me/experiences` → kinh nghiệm của CV mặc định. */
export class UserExperienceService {
  constructor(private cvService: CandidateCvService = new CandidateCvService()) {}

  async getExperiences(userId: string) {
    const cvId = await this.cvService.ensureDefaultCv(userId);
    return this.cvService.listExperiences(userId, cvId);
  }

  async createExperience(userId: string, data: ExperienceInput) {
    const cvId = await this.cvService.ensureDefaultCv(userId);
    return this.cvService.createExperience(userId, cvId, data);
  }

  async updateExperience(userId: string, experienceId: string, data: CvExperiencePatch) {
    const cvId = await this.cvService.ensureDefaultCv(userId);
    return this.cvService.updateExperience(userId, cvId, experienceId, data);
  }

  async deleteExperience(userId: string, experienceId: string) {
    const cvId = await this.cvService.ensureDefaultCv(userId);
    return this.cvService.deleteExperience(userId, cvId, experienceId);
  }
}
