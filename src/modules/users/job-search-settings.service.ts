import type { UserStatus } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { syncCandidateToEs } from '@/shared/candidates/candidate-search-sync';
import { CandidateCvService } from '@/modules/candidate-cvs/candidate-cvs.service';
import type { JobSearchSettingsInput } from './users.schema';

export type JobSearchSettings = {
  isSearchingJob: boolean;
  allowCvFlip: boolean;
  defaultCvId: string | null;
};

/** Payload settings cũ từ PATCH /me/profile (status / isPublic / isSearchingJob / allowCvFlip). */
export type LegacySettingsInput = {
  status?: UserStatus | null | undefined;
  isPublic?: boolean | undefined;
  isSearchingJob?: boolean | undefined;
  allowCvFlip?: boolean | undefined;
};

/**
 * "Bật/Tắt tìm việc" là toggle duy nhất: `isSearchingJob` quyết định,
 * `status` và `isPublic` luôn đồng bộ theo để các reader cũ không lệch.
 */
export function searchingJobToProfileFields(isSearchingJob: boolean) {
  return {
    isSearchingJob,
    isPublic: isSearchingJob,
    status: (isSearchingJob ? 'OPEN_TO_WORK' : 'NOT_AVAILABLE') as UserStatus,
  };
}

/** Suy ra toggle từ payload cũ; ưu tiên isSearchingJob > isPublic > status. */
export function resolveLegacySearchingJob(input: LegacySettingsInput): boolean | undefined {
  if (input.isSearchingJob !== undefined) return input.isSearchingJob;
  if (input.isPublic !== undefined) return input.isPublic;
  if (input.status !== undefined && input.status !== null) return input.status !== 'NOT_AVAILABLE';
  return undefined;
}

export class JobSearchSettingsService {
  constructor(private cvService: CandidateCvService = new CandidateCvService()) {}

  async get(userId: string): Promise<JobSearchSettings> {
    await this.cvService.ensureDefaultCv(userId);
    const profile = await prisma.userProfile.findUniqueOrThrow({
      where: { userId },
      select: { isSearchingJob: true, allowCvFlip: true, defaultCvId: true },
    });
    return profile;
  }

  async update(userId: string, input: JobSearchSettingsInput): Promise<JobSearchSettings> {
    await this.cvService.ensureDefaultCv(userId);
    const data: Record<string, unknown> = {};
    if (input.isSearchingJob !== undefined) Object.assign(data, searchingJobToProfileFields(input.isSearchingJob));
    if (input.allowCvFlip !== undefined) data['allowCvFlip'] = input.allowCvFlip;

    if (Object.keys(data).length > 0) {
      await prisma.userProfile.update({ where: { userId }, data });
      void syncCandidateToEs(userId);
    }
    return this.get(userId);
  }

  async applyLegacy(userId: string, input: LegacySettingsInput): Promise<void> {
    const isSearchingJob = resolveLegacySearchingJob(input);
    const next: JobSearchSettingsInput = {};
    if (isSearchingJob !== undefined) next.isSearchingJob = isSearchingJob;
    if (input.allowCvFlip !== undefined) next.allowCvFlip = input.allowCvFlip;
    if (Object.keys(next).length > 0) {
      await this.update(userId, next);
    }
  }
}
