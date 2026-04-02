import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

type ProvinceSeed = {
  code: string;
  name: string;
  type: string;
  region: 'north' | 'central' | 'south';
  merged: boolean;
  merged_from: string[];
  merged_from_codes: string[];
};

const prisma = new PrismaClient();

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

function loadProvinceJson(): ProvinceSeed[] {
  const filePath = path.resolve(process.cwd(), 'docs/province.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as ProvinceSeed[];
}

async function main() {
  const provinces = loadProvinceJson();

  await prisma.$transaction(async (tx) => {
    await tx.provinceAlias.deleteMany({});
    await tx.provinceRegistry.deleteMany({});

    await tx.provinceRegistry.createMany({
      data: provinces.map((province) => ({
        code: province.code,
        name: province.name,
        type: province.type,
        region: province.region,
        merged: province.merged,
        isActive: true,
      })),
    });

    for (const province of provinces) {
      const aliases: Array<{
        provinceCode: string;
        aliasText: string;
        aliasSlug: string;
        aliasType: string;
        isActive: boolean;
      }> = [];

      aliases.push({
        provinceCode: province.code,
        aliasText: province.name,
        aliasSlug: slugify(province.name),
        aliasType: 'DISPLAY_NAME',
        isActive: true,
      });

      for (const oldName of province.merged_from ?? []) {
        aliases.push({
          provinceCode: province.code,
          aliasText: oldName,
          aliasSlug: slugify(oldName),
          aliasType: oldName === province.name ? 'DISPLAY_NAME' : 'LEGACY_NAME',
          isActive: true,
        });
      }

      for (const oldCode of province.merged_from_codes ?? []) {
        aliases.push({
          provinceCode: province.code,
          aliasText: oldCode,
          aliasSlug: oldCode,
          aliasType: oldCode === province.code ? 'DISPLAY_CODE' : 'LEGACY_CODE',
          isActive: true,
        });
      }

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
    }
  });
}

main()
  .catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
