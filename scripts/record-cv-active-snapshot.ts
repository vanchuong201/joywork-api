/**
 * Ghi nhận snapshot tổng CV ready (buildCvReadyUserWhere) cho ngày lịch VN hiện tại.
 *
 * Run: npm run metrics:cv-active
 * Cron (host): 10 3 * * * docker exec joywork-api npm run metrics:cv-active
 * See joywork-deploy/QUICK_OPS.md
 */

import { config as loadEnv } from 'dotenv';
loadEnv();

import { SystemService } from '../src/modules/system/system.service';
import { prisma } from '../src/shared/database/prisma';

async function main() {
  const service = new SystemService();
  const snapshot = await service.recordCvActiveSnapshot();
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      ok: true,
      periodDate: snapshot.periodDate,
      count: snapshot.count,
      recordedAt: snapshot.recordedAt,
    })
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
