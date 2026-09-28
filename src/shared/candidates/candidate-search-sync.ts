import type { Prisma } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { syncUserToEs, type UserForEs } from '@/shared/elasticsearch/sync';

/** Select cho doc ứng viên trên ES: settings trên profile + nội dung CV mặc định. */
export const CANDIDATE_ES_SELECT = {
  id: true,
  name: true,
  email: true,
  slug: true,
  createdAt: true,
  profile: {
    select: {
      isPublic: true,
      isSearchingJob: true,
      defaultCv: {
        select: { headline: true, bio: true, skills: true, locations: true },
      },
    },
  },
} satisfies Prisma.UserSelect;

export type CandidateEsRow = Prisma.UserGetPayload<{ select: typeof CANDIDATE_ES_SELECT }>;

export function toUserForEs(user: CandidateEsRow): UserForEs {
  const cv = user.profile?.defaultCv ?? null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    slug: user.slug,
    createdAt: user.createdAt,
    profile: user.profile
      ? {
          headline: cv?.headline ?? null,
          bio: cv?.bio ?? null,
          skills: cv?.skills ?? [],
          locations: cv?.locations ?? [],
          isPublic: user.profile.isPublic,
          isSearchingJob: user.profile.isSearchingJob,
        }
      : null,
  };
}

/** Đồng bộ doc ứng viên trên ES từ settings trên profile + nội dung CV mặc định. */
export async function syncCandidateToEs(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: CANDIDATE_ES_SELECT,
  });
  if (!user) return;
  await syncUserToEs(toUserForEs(user));
}
