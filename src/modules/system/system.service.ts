import { prisma } from '@/shared/database/prisma';

export interface SystemOverview {
  users: number;
  companies: number;
  posts: number;
  jobs: number;
  applications: number;
  follows: number;
  jobFavorites: number;
}

export class SystemService {
  async getOverview(): Promise<SystemOverview> {
    const [users, companies, posts, jobs, applications, follows, jobFavorites] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.post.count(),
      prisma.job.count(),
      prisma.application.count(),
      prisma.follow.count(),
      prisma.jobFavorite.count(),
    ]);

    return {
      users,
      companies,
      posts,
      jobs,
      applications,
      follows,
      jobFavorites,
    };
  }
}


