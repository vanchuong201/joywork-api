import type { CompanyVisibilityStatus } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';

export function publicCompanyWhere(): { visibilityStatus: 'ACTIVE' } {
  return { visibilityStatus: 'ACTIVE' };
}

export function isCompanyPublic(company: { visibilityStatus: CompanyVisibilityStatus }): boolean {
  return company.visibilityStatus === 'ACTIVE';
}

export function assertCompanyManageable(company: { visibilityStatus: CompanyVisibilityStatus }): void {
  if (company.visibilityStatus === 'HIDDEN') {
    throw new AppError('Company is hidden', 403, 'COMPANY_HIDDEN');
  }
}

export function assertHideReason(reason: string | undefined): string {
  const trimmed = reason?.trim() ?? '';
  if (trimmed.length < 1 || trimmed.length > 500) {
    throw new AppError('Lý do không hợp lệ', 400, 'VALIDATION_ERROR');
  }
  return trimmed;
}

export function hideCompanyData(adminId: string, reason: string, hiddenAt = new Date()) {
  return {
    visibilityStatus: 'HIDDEN' as const,
    hiddenAt,
    hiddenById: adminId,
    hiddenReason: reason,
  };
}

export function restoreCompanyData() {
  return {
    visibilityStatus: 'ACTIVE' as const,
    hiddenAt: null,
    hiddenById: null,
    hiddenReason: null,
  };
}

export async function assertCompanyManageableById(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { visibilityStatus: true },
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
  }

  assertCompanyManageable(company);
}
