import { prisma } from '@/shared/database/prisma';
import { syncUserToEs } from '@/shared/elasticsearch/sync';

/** Đồng bộ doc ứng viên trên ES từ settings trên profile + nội dung CV mặc định. */
export async function syncCandidateToEs(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
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
    },
  });
  if (!user) return;

  const cv = user.profile?.defaultCv ?? null;
  await syncUserToEs({
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
  });
}
