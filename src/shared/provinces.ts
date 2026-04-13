import { prisma } from '@/shared/database/prisma';
import { DEFAULT_PROVINCES, ProvinceItem, ProvinceRegion } from './province-defaults';

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value: string): string {
  return normalizeText(value).replace(/\s+/g, '-');
}

function hydrateRegistry(items: ProvinceItem[]): void {
  PROVINCES.splice(0, PROVINCES.length, ...items);
  PROVINCE_BY_CODE.clear();
  PROVINCE_NAME_TO_CODE.clear();

  for (const province of PROVINCES) {
    PROVINCE_BY_CODE.set(province.code, province);
    PROVINCE_NAME_TO_CODE.set(normalizeText(province.name), province.code);
    PROVINCE_NAME_TO_CODE.set(slugify(province.name), province.code);

    for (const oldName of province.merged_from ?? []) {
      PROVINCE_NAME_TO_CODE.set(normalizeText(oldName), province.code);
      PROVINCE_NAME_TO_CODE.set(slugify(oldName), province.code);
    }

    for (const oldCode of province.merged_from_codes ?? []) {
      PROVINCE_NAME_TO_CODE.set(oldCode, province.code);
    }
  }
}

export const PROVINCES: ProvinceItem[] = [];
export const PROVINCE_BY_CODE = new Map<string, ProvinceItem>();
export const PROVINCE_NAME_TO_CODE = new Map<string, string>();

hydrateRegistry(DEFAULT_PROVINCES);

async function loadProvinceRegistryFromDb(): Promise<ProvinceItem[]> {
  const rows = await prisma.provinceRegistry.findMany({
    where: { isActive: true },
    include: {
      aliases: {
        where: { isActive: true },
        orderBy: { aliasSlug: 'asc' },
      },
    },
    orderBy: { code: 'asc' },
  });

  if (!rows.length) return [];

  return rows.map((row) => {
    const mergedFromNames = row.aliases
      .filter((alias) => alias.aliasType === 'LEGACY_NAME')
      .map((alias) => alias.aliasText);
    const mergedFromCodes = row.aliases
      .filter((alias) => alias.aliasType === 'LEGACY_CODE')
      .map((alias) => alias.aliasText);

    return {
      code: row.code,
      name: row.name,
      type: row.type,
      region: row.region as ProvinceRegion,
      merged: row.merged,
      merged_from: mergedFromNames.length ? mergedFromNames : [row.name],
      merged_from_codes: mergedFromCodes.length ? mergedFromCodes : [row.code],
    };
  });
}

export async function seedProvinceRegistryIfEmpty(): Promise<void> {
  const count = await prisma.provinceRegistry.count();
  if (count > 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.provinceRegistry.createMany({
      data: DEFAULT_PROVINCES.map((province) => ({
        code: province.code,
        name: province.name,
        type: province.type,
        region: province.region,
        merged: province.merged,
        isActive: true,
      })),
      skipDuplicates: true,
    });

    const aliases = DEFAULT_PROVINCES.flatMap((province) => {
      const rows: Array<{
        provinceCode: string;
        aliasText: string;
        aliasSlug: string;
        aliasType: string;
        isActive: boolean;
      }> = [];

      rows.push({
        provinceCode: province.code,
        aliasText: province.name,
        aliasSlug: slugify(province.name),
        aliasType: 'DISPLAY_NAME',
        isActive: true,
      });

      for (const oldName of province.merged_from ?? []) {
        rows.push({
          provinceCode: province.code,
          aliasText: oldName,
          aliasSlug: slugify(oldName),
          aliasType: oldName === province.name ? 'DISPLAY_NAME' : 'LEGACY_NAME',
          isActive: true,
        });
      }

      for (const oldCode of province.merged_from_codes ?? []) {
        rows.push({
          provinceCode: province.code,
          aliasText: oldCode,
          aliasSlug: oldCode,
          aliasType: oldCode === province.code ? 'DISPLAY_CODE' : 'LEGACY_CODE',
          isActive: true,
        });
      }

      return rows;
    });

    for (const row of aliases) {
      await tx.provinceAlias.upsert({
        where: {
          provinceCode_aliasSlug: {
            provinceCode: row.provinceCode,
            aliasSlug: row.aliasSlug,
          },
        },
        update: {
          aliasText: row.aliasText,
          aliasType: row.aliasType,
          isActive: row.isActive,
        },
        create: row,
      });
    }
  });
}

export async function refreshProvinceRegistryFromDatabase(): Promise<boolean> {
  const dbItems = await loadProvinceRegistryFromDb();
  if (!dbItems.length) return false;
  hydrateRegistry(dbItems);
  return true;
}

export async function initializeProvinceRegistry(): Promise<void> {
  await seedProvinceRegistryIfEmpty();
  await refreshProvinceRegistryFromDatabase();
}

export function resolveProvinceCode(nameOrCode: string | null | undefined): string | null {
  if (!nameOrCode) return null;

  const raw = String(nameOrCode).trim();
  if (!raw) return null;

  const exactCode = PROVINCE_BY_CODE.get(raw);
  if (exactCode) return exactCode.code;

  const slugCode = PROVINCE_NAME_TO_CODE.get(slugify(raw));
  if (slugCode) return slugCode;

  const normalizedCode = PROVINCE_NAME_TO_CODE.get(normalizeText(raw));
  if (normalizedCode) return normalizedCode;

  return null;
}

export function resolveProvinceCodes(values: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    const code = resolveProvinceCode(value);
    if (code) unique.add(code);
  }
  return Array.from(unique);
}

export function getProvincesByRegion(region: ProvinceRegion): ProvinceItem[] {
  return PROVINCES.filter((province) => province.region === region);
}

export function getProvinceNameByCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return PROVINCE_BY_CODE.get(code)?.name ?? null;
}

/** Lưu Company.location dưới dạng tên hiển thị chuẩn khi map được từ mã/tên/alias. */
export function normalizeCompanyLocationForStorage(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const code = resolveProvinceCode(trimmed);
  if (code) {
    return getProvinceNameByCode(code) ?? trimmed;
  }
  return trimmed;
}

/** Mã tỉnh để kiểm tra ward — location có thể đang lưu tên thay vì slug. */
export function resolveProvinceCodeForWardCheck(location: string | null | undefined): string | null {
  if (location == null || location === '') return null;
  return resolveProvinceCode(String(location).trim());
}

export function getProvinceRegionByCode(code: string | null | undefined): ProvinceRegion | null {
  if (!code) return null;
  return PROVINCE_BY_CODE.get(code)?.region ?? null;
}
