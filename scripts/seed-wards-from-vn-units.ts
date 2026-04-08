/**
 * Đọc documents/full_json_generated_data_vn_units.json (hoặc VN_UNITS_JSON_PATH),
 * map tỉnh/thành về mã slug trong province_registry, upsert ward_registry.
 *
 * Chạy: npm run db:seed:wards
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type VnWard = {
  Type: string;
  Code: string;
  Name: string;
  FullName?: string;
  ProvinceCode: string;
  AdministrativeUnitShortName?: string;
};

type VnProvince = {
  Type: string;
  Code: string;
  Name: string;
  Wards: VnWard[];
};

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildWardCode(provinceSlug: string, officialWardCode: string): string {
  return `${provinceSlug}/${String(officialWardCode).trim()}`;
}

function loadProvinceNameToSlug(): Map<string, string> {
  const raw = readFileSync(join(__dirname, '../docs/province.json'), 'utf8');
  const provinces = JSON.parse(raw) as Array<{
    code: string;
    name: string;
    merged_from?: string[];
  }>;
  const map = new Map<string, string>();
  for (const p of provinces) {
    map.set(normalizeName(p.name), p.code);
    for (const m of p.merged_from ?? []) {
      map.set(normalizeName(m), p.code);
    }
  }
  map.set(normalizeName('Hồ Chí Minh'), 'tp-ho-chi-minh');
  return map;
}

async function main(): Promise<void> {
  const jsonPath = process.env.VN_UNITS_JSON_PATH
    ? resolve(process.env.VN_UNITS_JSON_PATH)
    : join(__dirname, '../../documents/full_json_generated_data_vn_units.json');

  const rows: VnProvince[] = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const nameToSlug = loadProvinceNameToSlug();

  const batch: Array<{
    code: string;
    provinceCode: string;
    officialCode: string;
    name: string;
    fullName: string | null;
    unitType: string | null;
    isActive: boolean;
  }> = [];

  for (const prov of rows) {
    const slug = nameToSlug.get(normalizeName(prov.Name));
    if (!slug) {
      throw new Error(`Không map được tỉnh từ file VN units: "${prov.Name}"`);
    }
    for (const w of prov.Wards ?? []) {
      const official = String(w.Code).trim();
      batch.push({
        code: buildWardCode(slug, official),
        provinceCode: slug,
        officialCode: official,
        name: w.Name,
        fullName: w.FullName ?? null,
        unitType: w.AdministrativeUnitShortName ?? null,
        isActive: true,
      });
    }
  }

  const chunk = 400;
  for (let i = 0; i < batch.length; i += chunk) {
    const part = batch.slice(i, i + chunk);
    await prisma.$transaction(
      part.map((row) =>
        prisma.wardRegistry.upsert({
          where: { code: row.code },
          create: row,
          update: {
            name: row.name,
            fullName: row.fullName,
            unitType: row.unitType,
            isActive: row.isActive,
            updatedAt: new Date(),
          },
        }),
      ),
    );
  }

  console.log(`✅ seed ward_registry: ${batch.length} dòng (từ ${rows.length} tỉnh/TP)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
