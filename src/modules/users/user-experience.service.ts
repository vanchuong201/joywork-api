import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { ExperienceInput } from './users.schema';
import { removeUndefined } from '@/shared/utils';

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

    return await prisma.userExperience.create({
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

    return await prisma.userExperience.update({
      where: { id: experienceId },
      data: cleanData as any,
    });
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

    return { success: true };
  }
}

