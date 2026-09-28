import { CandidateCvService } from '@/modules/candidate-cvs/candidate-cvs.service';
import type { CvEducationPatch } from '@/modules/candidate-cvs/candidate-cvs.schema';
import { EducationInput } from './users.schema';

/** Adapter `/api/users/me/educations` → học vấn của CV mặc định. */
export class UserEducationService {
  constructor(private cvService: CandidateCvService = new CandidateCvService()) {}

  async getEducations(userId: string) {
    const cvId = await this.cvService.ensureDefaultCv(userId);
    return this.cvService.listEducations(userId, cvId);
  }

  async createEducation(userId: string, data: EducationInput) {
    const cvId = await this.cvService.ensureDefaultCv(userId);
    return this.cvService.createEducation(userId, cvId, data);
  }

  async updateEducation(userId: string, educationId: string, data: CvEducationPatch) {
    const cvId = await this.cvService.ensureDefaultCv(userId);
    return this.cvService.updateEducation(userId, cvId, educationId, data);
  }

  async deleteEducation(userId: string, educationId: string) {
    const cvId = await this.cvService.ensureDefaultCv(userId);
    return this.cvService.deleteEducation(userId, cvId, educationId);
  }
}
