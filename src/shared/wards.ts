import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { getProvinceNameByCode } from '@/shared/provinces';

export const WARD_CODE_PATTERN = /^[a-z0-9-]+\/[0-9]+$/;

export interface WardItem {
  code: string;
  provinceCode: string;
  officialCode: string;
  name: string;
  fullName: string | null;
  unitType: string | null;
}

export const WARD_BY_CODE = new Map<string, WardItem>();
const WARDS_BY_PROVINCE = new Map<string, WardItem[]>();

/** True when last DB load failed because `ward_registry` does not exist (P2021). */
let wardRegistryTableMissing = false;

export function isWardRegistryTableMissing(): boolean {
  return wardRegistryTableMissing;
}

function sortWards(items: WardItem[]): WardItem[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

function hydrateWards(items: WardItem[]): void {
  WARD_BY_CODE.clear();
  WARDS_BY_PROVINCE.clear();

  for (const ward of items) {
    WARD_BY_CODE.set(ward.code, ward);
    const list = WARDS_BY_PROVINCE.get(ward.provinceCode) ?? [];
    list.push(ward);
    WARDS_BY_PROVINCE.set(ward.provinceCode, list);
  }

  for (const [provinceCode, list] of WARDS_BY_PROVINCE.entries()) {
    WARDS_BY_PROVINCE.set(provinceCode, sortWards(list));
  }
}

export function buildWardCode(provinceSlug: string, officialWardCode: string): string {
  return `${provinceSlug}/${String(officialWardCode).trim()}`;
}

export async function loadWardsFromDatabase(): Promise<WardItem[]> {
  wardRegistryTableMissing = false;
  try {
    const rows = await prisma.wardRegistry.findMany({
      where: { isActive: true },
      orderBy: [{ provinceCode: 'asc' }, { name: 'asc' }],
    });

    return rows.map((row) => ({
      code: row.code,
      provinceCode: row.provinceCode,
      officialCode: row.officialCode,
      name: row.name,
      fullName: row.fullName,
      unitType: row.unitType,
    }));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2021') {
      wardRegistryTableMissing = true;
      hydrateWards([]);
      return [];
    }
    throw e;
  }
}

export async function refreshWardRegistryFromDatabase(): Promise<boolean> {
  const items = await loadWardsFromDatabase();
  if (!items.length) {
    hydrateWards([]);
    return false;
  }
  hydrateWards(items);
  return true;
}

export async function initializeWardRegistry(): Promise<void> {
  await refreshWardRegistryFromDatabase();
}

export function getWardsByProvinceCode(provinceCode: string): WardItem[] {
  return WARDS_BY_PROVINCE.get(provinceCode) ?? [];
}

export function getWardsForProvinceCodes(provinceCodes: string[]): WardItem[] {
  const out: WardItem[] = [];
  const seen = new Set<string>();
  for (const code of provinceCodes) {
    for (const w of getWardsByProvinceCode(code)) {
      if (!seen.has(w.code)) {
        seen.add(w.code);
        out.push(w);
      }
    }
  }
  return sortWards(out);
}

export function getProvinceCodesFromWardCodes(wardCodes: string[]): string[] {
  const provinces = new Set<string>();
  for (const code of wardCodes) {
    const row = WARD_BY_CODE.get(code);
    if (row) provinces.add(row.provinceCode);
  }
  return Array.from(provinces);
}

export function mergeLocationsWithWardProvinces(locations: string[], wardCodes: string[]): string[] {
  const merged = new Set(locations);
  for (const p of getProvinceCodesFromWardCodes(wardCodes)) merged.add(p);
  return Array.from(merged);
}

/**
 * Chuẩn hóa locations + wardCodes: bổ sung tỉnh từ phường/xã và kiểm tra ward thuộc tỉnh đã chọn.
 */
export function resolveLocationsWithWards(
  existing: { locations: string[]; wardCodes: string[] } | null | undefined,
  input: { locations?: string[]; location?: string | null; wardCodes?: string[] },
): { locations: string[]; wardCodes: string[] } {
  let nextLocations = existing?.locations ?? [];
  if (input.locations !== undefined) nextLocations = input.locations;
  else if (input.location !== undefined) nextLocations = input.location ? [input.location] : [];

  let nextWards = existing?.wardCodes ?? [];
  if (input.wardCodes !== undefined) nextWards = input.wardCodes;

  nextLocations = mergeLocationsWithWardProvinces(nextLocations, nextWards);
  assertWardsBelongToProvinces(nextWards, new Set(nextLocations));
  return { locations: nextLocations, wardCodes: nextWards };
}

export function assertWardsBelongToProvinces(
  wardCodes: string[],
  allowedProvinces: Set<string>,
): void {
  for (const w of wardCodes) {
    const row = WARD_BY_CODE.get(w);
    if (!row || !allowedProvinces.has(row.provinceCode)) {
      throw new AppError('Phường/xã không khớp với tỉnh/thành đã chọn', 400, 'WARD_PROVINCE_MISMATCH');
    }
  }
}

export function getWardLabel(wardCode: string | null | undefined): string | null {
  if (!wardCode) return null;
  const row = WARD_BY_CODE.get(wardCode);
  if (!row) return wardCode;
  const provinceName = getProvinceNameByCode(row.provinceCode);
  if (!provinceName) return row.fullName ?? row.name;
  return `${row.fullName ?? row.name} — ${provinceName}`;
}
