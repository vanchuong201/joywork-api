/**
 * Canonical list of headcount bands used as the company "size" attribute.
 *
 * Kept in sync with `joywork-web/src/lib/provinces.ts` (COMPANY_SIZE_OPTIONS).
 * The value stored in `companies.size` is the band string itself (no labels).
 */
export const COMPANY_SIZE_BANDS = [
  '0-10',
  '10-30',
  '30-50',
  '50-70',
  '70-100',
  '100-150',
  '150-200',
  '200-300',
  '300-500',
  '500-700',
  '700-1000',
  '1000+',
  '2000+',
] as const;

export type CompanySizeBand = (typeof COMPANY_SIZE_BANDS)[number];

const COMPANY_SIZE_BAND_SET = new Set<string>(COMPANY_SIZE_BANDS);

/**
 * Map historical CompanySize enum values to the closest current band so older
 * payloads (and direct API callers that have not yet been updated) keep working.
 */
const LEGACY_COMPANY_SIZE_MAP: Record<string, CompanySizeBand> = {
  STARTUP: '10-30',
  SMALL: '30-50',
  MEDIUM: '100-150',
  LARGE: '500-700',
  ENTERPRISE: '1000+',
};

/**
 * Normalize an incoming size string to a canonical band when possible:
 * trims whitespace, strips spaces around the dash, and maps legacy enum values.
 * Returns the original (trimmed) value when it does not match a known band so
 * the schema can still reject it explicitly downstream.
 */
export function normalizeCompanySize(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const collapsed = trimmed.replace(/\s*-\s*/g, '-');
  if (COMPANY_SIZE_BAND_SET.has(collapsed)) {
    return collapsed;
  }

  const upper = collapsed.toUpperCase();
  if (LEGACY_COMPANY_SIZE_MAP[upper]) {
    return LEGACY_COMPANY_SIZE_MAP[upper];
  }

  return collapsed;
}

export function isCompanySizeBand(value: string | null | undefined): value is CompanySizeBand {
  return !!value && COMPANY_SIZE_BAND_SET.has(value);
}
