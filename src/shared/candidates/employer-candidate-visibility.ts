import { prisma } from '@/shared/database/prisma';
import { hasUserAppliedToCompany } from '@/shared/applications/has-applied-to-company';

const TALENT_POOL_FEATURE_KEY = 'TALENT_POOL';

export type CandidateProfileVisibility = {
  isPublic: boolean;
  isSearchingJob: boolean;
} | null;

export type EmployerCandidateVisibility = {
  hasAppliedToCompany: boolean;
  canViewViaTalentPool: boolean;
};

async function isCompanyManager(viewerUserId: string, companyId: string): Promise<boolean> {
  const membership = await prisma.companyMember.findFirst({
    where: {
      userId: viewerUserId,
      companyId,
      role: { in: ['OWNER', 'ADMIN'] },
    },
    select: { id: true },
  });
  return Boolean(membership);
}

/** Quyền xem shell hồ sơ — khớp user-profile.service (public / apply / talent pool). */
export function canEmployerViewCandidateShell(params: {
  isOwner: boolean;
  profile: CandidateProfileVisibility;
  hasAppliedToCompany: boolean;
  canViewViaTalentPool: boolean;
}): boolean {
  if (params.isOwner) {
    return true;
  }
  if (!params.profile) {
    return params.hasAppliedToCompany || params.canViewViaTalentPool;
  }
  if (params.profile.isPublic) {
    return true;
  }
  return params.hasAppliedToCompany || params.canViewViaTalentPool;
}

/**
 * Quyền xem trong ngữ cảnh companyId (CV flip).
 * isSearchingJob chỉ bắt buộc khi browse talent pool, không áp dụng khi đã apply.
 */
export function canEmployerViewInCompanyCvFlipContext(params: {
  isOwner: boolean;
  profile: CandidateProfileVisibility;
  hasAppliedToCompany: boolean;
  canViewViaTalentPool: boolean;
  hasCompanyContext: boolean;
}): boolean {
  if (!canEmployerViewCandidateShell(params)) {
    return false;
  }
  if (!params.hasCompanyContext) {
    return params.isOwner;
  }
  if (params.isOwner) {
    return true;
  }
  if (params.hasAppliedToCompany || params.canViewViaTalentPool) {
    return true;
  }
  if (!params.profile) {
    return false;
  }
  return params.profile.isSearchingJob;
}

export async function resolveEmployerCandidateVisibility(params: {
  viewerUserId: string;
  candidateUserId: string;
  companyId: string | null;
  isOwner: boolean;
}): Promise<EmployerCandidateVisibility> {
  const { viewerUserId, candidateUserId, companyId, isOwner } = params;
  if (isOwner || !companyId) {
    return { hasAppliedToCompany: false, canViewViaTalentPool: false };
  }

  const isManager = await isCompanyManager(viewerUserId, companyId);
  if (!isManager) {
    return { hasAppliedToCompany: false, canViewViaTalentPool: false };
  }

  const hasAppliedToCompany = await hasUserAppliedToCompany({
    userId: candidateUserId,
    companyId,
  });

  let canViewViaTalentPool = false;
  const entitlement = await prisma.companyFeatureEntitlement.findUnique({
    where: {
      companyId_featureKey: {
        companyId,
        featureKey: TALENT_POOL_FEATURE_KEY,
      },
    },
    select: { enabled: true },
  });
  if (entitlement?.enabled) {
    const member = await prisma.talentPoolMember.findUnique({
      where: { userId: candidateUserId },
      select: { status: true },
    });
    canViewViaTalentPool = member?.status === 'ACTIVE';
  }

  return { hasAppliedToCompany, canViewViaTalentPool };
}

/** CV đính kèm đơn ứng tuyển gần nhất (khi UV chưa có UserProfile). */
export async function getLatestApplicationResumeUrl(
  userId: string,
  companyId: string
): Promise<string | null> {
  const application = await prisma.application.findFirst({
    where: {
      userId,
      job: { companyId },
    },
    orderBy: { appliedAt: 'desc' },
    select: { resumeUrl: true },
  });
  return application?.resumeUrl ?? null;
}
