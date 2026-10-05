/**
 * Nhắc doanh nghiệp phản hồi hồ sơ đã đủ 5 ngày, rồi tự đóng hồ sơ đã nhắc đủ 3 ngày.
 *
 * Run: npm run applications:remind-responses
 * Dry-run: npm run applications:remind-responses -- --dry-run
 * Cron (host, 08:00 ICT): docker exec joywork-api npm run applications:remind-responses
 * See joywork-deploy/QUICK_OPS.md
 */

import { config as loadEnv } from 'dotenv';
loadEnv();

import { JobsService } from '../src/modules/jobs/jobs.service';
import { prisma } from '../src/shared/database/prisma';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const service = new JobsService();
  const result = await service.processApplicationResponseReminders({ dryRun });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: result.failedCompanies === 0, ...result }));
  if (result.failedCompanies > 0) {
    process.exitCode = 1;
  }
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
