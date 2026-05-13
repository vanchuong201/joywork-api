import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { ExperienceInput } from './users.schema';
import { removeUndefined } from '@/shared/utils';
import { searchIndexService } from '@/shared/search/search-index.service';

export class UserExperienceService {
  // Get all experiences for a user
  async getExperiences(userId: string) {
    return await prisma.userExperience.findMany({
      where: { userId },
      orderBy: [
        { order: 'asc' },
        { startDate: 'desc' },
      ],
    });
  }

  // Create experience
  async createExperience(userId: string, data: ExperienceInput) {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const result = await prisma.userExperience.create({
      data: {
        userId,
        role: data.role,
        company: data.company,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        period: data.period ?? null,
        desc: data.desc ?? null,
        achievements: data.achievements ?? [],
        order: data.order,
      },
    });

    await searchIndexService.indexCandidate(userId);

    return result;
  }

  // Update experience
  async updateExperience(userId: string, experienceId: string, data: Partial<ExperienceInput>) {
    // Verify ownership
    const experience = await prisma.userExperience.findUnique({
      where: { id: experienceId },
      select: { userId: true },
    });

    if (!experience) {
      throw new AppError('Experience not found', 404, 'EXPERIENCE_NOT_FOUND');
    }

    if (experience.userId !== userId) {
      throw new AppError('Unauthorized', 403, 'UNAUTHORIZED');
    }

    const cleanData = removeUndefined(data);

    const result = await prisma.userExperience.update({
      where: { id: experienceId },
      data: cleanData as any,
    });

    await searchIndexService.indexCandidate(userId);

    return result;
  }

  // Delete experience
  async deleteExperience(userId: string, experienceId: string) {
    // Verify ownership
    const experience = await prisma.userExperience.findUnique({
      where: { id: experienceId },
      select: { userId: true },
    });

    if (!experience) {
      throw new AppError('Experience not found', 404, 'EXPERIENCE_NOT_FOUND');
    }

    if (experience.userId !== userId) {
      throw new AppError('Unauthorized', 403, 'UNAUTHORIZED');
    }

    await prisma.userExperience.delete({
      where: { id: experienceId },
    });

    await searchIndexService.indexCandidate(userId);

    return { success: true };
  }
}

