import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { EducationInput } from './users.schema';
import { removeUndefined } from '@/shared/utils';

export class UserEducationService {
  // Get all educations for a user
  async getEducations(userId: string) {
    return await prisma.userEducation.findMany({
      where: { userId },
      orderBy: [
        { order: 'asc' },
        { startDate: 'desc' },
      ],
    });
  }

  // Create education
  async createEducation(userId: string, data: EducationInput) {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return await prisma.userEducation.create({
      data: {
        userId,
        school: data.school,
        degree: data.degree,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        period: data.period ?? null,
        gpa: data.gpa ?? null,
        honors: data.honors ?? null,
        order: data.order,
      },
    });
  }

  // Update education
  async updateEducation(userId: string, educationId: string, data: Partial<EducationInput>) {
    // Verify ownership
    const education = await prisma.userEducation.findUnique({
      where: { id: educationId },
      select: { userId: true },
    });

    if (!education) {
      throw new AppError('Education not found', 404, 'EDUCATION_NOT_FOUND');
    }

    if (education.userId !== userId) {
      throw new AppError('Unauthorized', 403, 'UNAUTHORIZED');
    }

    const cleanData = removeUndefined(data);

    return await prisma.userEducation.update({
      where: { id: educationId },
      data: cleanData as any,
    });
  }

  // Delete education
  async deleteEducation(userId: string, educationId: string) {
    // Verify ownership
    const education = await prisma.userEducation.findUnique({
      where: { id: educationId },
      select: { userId: true },
    });

    if (!education) {
      throw new AppError('Education not found', 404, 'EDUCATION_NOT_FOUND');
    }

    if (education.userId !== userId) {
      throw new AppError('Unauthorized', 403, 'UNAUTHORIZED');
    }

    await prisma.userEducation.delete({
      where: { id: educationId },
    });

    return { success: true };
  }
}

