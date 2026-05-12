-- Normalize Company.size to a single canonical set of headcount bands shared with the web UI
-- (matches COMPANY_SIZE_OPTIONS in joywork-web/src/lib/provinces.ts).

-- 1. Map legacy CompanySize enum strings (still present as TEXT after a prior refactor) to the
--    closest band representing the previous label.
UPDATE "companies" SET "size" = '10-30'  WHERE "size" = 'STARTUP';
UPDATE "companies" SET "size" = '30-50'  WHERE "size" = 'SMALL';
UPDATE "companies" SET "size" = '100-150' WHERE "size" = 'MEDIUM';
UPDATE "companies" SET "size" = '500-700' WHERE "size" = 'LARGE';
UPDATE "companies" SET "size" = '1000+'  WHERE "size" = 'ENTERPRISE';

-- 2. Backfill from the legacy profile JSON (training.workforceSize) when companies.size is empty,
--    stripping any surrounding whitespace and the deprecated "0 - 10" spaced variant.
UPDATE "companies" c
SET "size" = REGEXP_REPLACE(TRIM(BOTH FROM (cp."training"->>'workforceSize')), '\s*-\s*', '-', 'g')
FROM "company_profiles" cp
WHERE cp."companyId" = c."id"
  AND (c."size" IS NULL OR length(trim(c."size")) = 0)
  AND cp."training" IS NOT NULL
  AND cp."training" ? 'workforceSize'
  AND cp."training"->>'workforceSize' IS NOT NULL
  AND length(trim(cp."training"->>'workforceSize')) > 0;

-- 3. Normalize any remaining spaced variants stored directly on companies.size.
UPDATE "companies"
SET "size" = REGEXP_REPLACE("size", '\s*-\s*', '-', 'g')
WHERE "size" IS NOT NULL AND "size" ~ '\s';

-- 4. Drop the now-redundant workforceSize key from the training JSON. companies.size is the
--    single source of truth going forward; the profile section reads from it.
UPDATE "company_profiles"
SET "training" = "training" - 'workforceSize'
WHERE "training" IS NOT NULL AND "training" ? 'workforceSize';
