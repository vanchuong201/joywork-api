/**
 * Seed snapshot CV active giả lập để xem chart/report admin.
 *
 * Run: npm run metrics:cv-active:seed
 * Options:
 *   --days=200     số ngày (mặc định 200, đủ test monthly)
 *   --base=90      count quanh mức này
 */

import { config as loadEnv } from 'dotenv';
loadEnv();

import {
  addCalendarDays,
  formatYmd,
  getVnYmd,
} from '../src/modules/system/admin-date-range';
import { periodDateFromYmd } from '../src/modules/system/cv-active-snapshot';
import { prisma } from '../src/shared/database/prisma';

function parseArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return fallback;
  const n = Number(hit.slice(prefix.length));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function main() {
  const days = Math.min(parseArg('days', 200), 400);
  const base = parseArg('base', 90);
  const now = new Date();
  const today = getVnYmd(now);

  let upserted = 0;
  for (let i = days - 1; i >= 0; i--) {
    const ymd = addCalendarDays(today.y, today.m, today.day, -i);
    const periodDate = periodDateFromYmd(ymd.y, ymd.m, ymd.day);
    // Stock giả lập: xu hướng tăng chậm + dao động tuần
    const wave = Math.round(8 * Math.sin((days - i) / 9));
    const drift = Math.round(((days - 1 - i) / Math.max(days - 1, 1)) * 25);
    const count = Math.max(1, base - 20 + drift + wave + ((i * 3) % 7));
    const recordedAt = new Date(periodDate);
    recordedAt.setUTCHours(10, 0, 0, 0); // ~17:00 VN

    await prisma.cvActiveDailySnapshot.upsert({
      where: { periodDate },
      create: {
        periodDate,
        count,
        recordedAt,
      },
      update: {
        count,
        recordedAt,
      },
    });
    upserted += 1;
  }

  const fromYmd = addCalendarDays(today.y, today.m, today.day, -(days - 1));
  const latest = await prisma.cvActiveDailySnapshot.findFirst({
    orderBy: { periodDate: 'desc' },
  });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        upserted,
        from: formatYmd(fromYmd.y, fromYmd.m, fromYmd.day),
        to: formatYmd(today.y, today.m, today.day),
        latest: latest
          ? {
              periodDate: latest.periodDate.toISOString().slice(0, 10),
              count: latest.count,
            }
          : null,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
