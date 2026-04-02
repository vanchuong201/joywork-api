import fs from 'node:fs';
import path from 'node:path';

export type ProvinceRegion = 'north' | 'central' | 'south';

export interface ProvinceItem {
  code: string;
  name: string;
  type: string;
  region: ProvinceRegion;
  merged: boolean;
  merged_from: string[];
  merged_from_codes: string[];
}

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

function loadProvinceRegistry(): ProvinceItem[] {
  const filePath = path.resolve(process.cwd(), 'docs/province.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw) as ProvinceItem[];
  return data;
}

export const PROVINCES = loadProvinceRegistry();

export const PROVINCE_BY_CODE = new Map<string, ProvinceItem>(
  PROVINCES.map((province) => [province.code, province]),
);

export const PROVINCE_NAME_TO_CODE = new Map<string, string>();

for (const province of PROVINCES) {
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
