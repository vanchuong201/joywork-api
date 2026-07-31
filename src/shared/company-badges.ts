import type { CompanyBadgeType } from '@prisma/client';

export interface CompanyBadgeRecord {
  type: CompanyBadgeType;
}

export const companyBadgesSelect = {
  select: {
    type: true,
  },
} as const;

export function toBadgeTypes(badges: CompanyBadgeRecord[] | null | undefined): CompanyBadgeType[] {
  return badges?.map((badge) => badge.type) ?? [];
}
