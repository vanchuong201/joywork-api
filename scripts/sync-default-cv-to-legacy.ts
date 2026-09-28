/**
 * Rollback SCRUM-578: copy CV mặc định (candidate_cvs) ngược về bảng legacy
 * user_profiles / user_experiences / user_educations để code cũ đọc đúng dữ liệu mới nhất.
 *
 * Run (dry-run, mặc định): npm run cv:sync-legacy
 * Ghi thật:                npm run cv:sync-legacy -- --apply
 */

import { config as loadEnv } from 'dotenv';
loadEnv();

import { Prisma } from '@prisma/client';
import { prisma } from '../src/shared/database/prisma';

const BATCH_SIZE = 200;
const apply = process.argv.includes('--apply');

async function main() {
  let cursor: string | undefined;
  let profiles = 0;
  let experiences = 0;
  let educations = 0;

  for (;;) {
    const batch = await prisma.userProfile.findMany({
      where: { defaultCvId: { not: null } },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        userId: true,
        defaultCv: {
          include: {
            experiences: { orderBy: { order: 'asc' } },
            educations: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1]!.id;

    for (const profile of batch) {
      const cv = profile.defaultCv;
      if (!cv) continue;
      profiles++;
      experiences += cv.experiences.length;
      educations += cv.educations.length;
      if (!apply) continue;

      await prisma.$transaction([
        prisma.userProfile.update({
          where: { id: profile.id },
          data: {
            avatar: cv.avatar,
            headline: cv.headline,
            bio: cv.bio,
            skills: cv.skills,
            cvUrl: cv.cvUrl,
            locations: cv.locations,
            wardCodes: cv.wardCodes,
            specificAddress: cv.specificAddress,
            website: cv.website,
            linkedin: cv.linkedin,
            github: cv.github,
            contactEmail: cv.contactEmail,
            contactPhone: cv.contactPhone,
            fullName: cv.fullName,
            title: cv.title,
            visibility: cv.visibility ?? Prisma.DbNull,
            knowledge: cv.knowledge,
            attitude: cv.attitude,
            expectedSalaryMin: cv.expectedSalaryMin,
            expectedSalaryMax: cv.expectedSalaryMax,
            salaryCurrency: cv.salaryCurrency,
            workMode: cv.workMode,
            expectedCulture: cv.expectedCulture,
            careerGoals: cv.careerGoals,
            gender: cv.gender,
            dayOfBirth: cv.dayOfBirth,
            monthOfBirth: cv.monthOfBirth,
            yearOfBirth: cv.yearOfBirth,
            educationLevel: cv.educationLevel,
          },
        }),
        prisma.userExperience.deleteMany({ where: { userId: profile.userId } }),
        prisma.userExperience.createMany({
          data: cv.experiences.map((e) => ({
            id: e.id,
            userId: profile.userId,
            role: e.role,
            company: e.company,
            startDate: e.startDate,
            endDate: e.endDate,
            period: e.period,
            desc: e.desc,
            achievements: e.achievements,
            order: e.order,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
          })),
          skipDuplicates: true,
        }),
        prisma.userEducation.deleteMany({ where: { userId: profile.userId } }),
        prisma.userEducation.createMany({
          data: cv.educations.map((e) => ({
            id: e.id,
            userId: profile.userId,
            school: e.school,
            degree: e.degree,
            startDate: e.startDate,
            endDate: e.endDate,
            period: e.period,
            gpa: e.gpa,
            honors: e.honors,
            order: e.order,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
          })),
          skipDuplicates: true,
        }),
      ]);
    }
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, mode: apply ? 'apply' : 'dry-run', profiles, experiences, educations }));
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
