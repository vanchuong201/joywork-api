import type { CompanyBadgeType } from '@prisma/client';

export interface CompanyBadgeRecord {
  type: CompanyBadgeType;
}

export const VALID_BADGE_TYPES: CompanyBadgeType[] = ['GOOD_COMPANY', 'BASIC_COMMITMENT'];

export const companyBadgesSelect = {
  select: {
    type: true,
  },
} as const;

export function toBadgeTypes(badges: CompanyBadgeRecord[] | null | undefined): CompanyBadgeType[] {
  return badges?.map((badge) => badge.type) ?? [];
}

/** Parse CSV query param (e.g. "GOOD_COMPANY,BASIC_COMMITMENT") into valid badge types. */
export function parseCompanyBadgeTypes(raw?: string): CompanyBadgeType[] {
  if (!raw) return [];
  const values = raw.split(',').map((v) => v.trim()).filter(Boolean);
  return values.filter((v): v is CompanyBadgeType => (VALID_BADGE_TYPES as string[]).includes(v));
}
