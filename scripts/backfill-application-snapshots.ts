/**
 * SCRUM-578: gắn cvSnapshot cho đơn ứng tuyển cũ (trước multi-CV) từ CV mặc định hiện tại.
 * Idempotent: chỉ xử lý đơn có "cvSnapshot" IS NULL.
 *
 * Run (dry-run): npm run applications:backfill-snapshots -- --dry-run
 * Ghi thật:      npm run applications:backfill-snapshots
 */

import { config as loadEnv } from 'dotenv';
loadEnv();

import { Prisma } from '@prisma/client';
import { prisma } from '../src/shared/database/prisma';
import { CV_SECTION_ORDER_BY } from '../src/modules/candidate-cvs/candidate-cvs.service';
import { buildCvSnapshot, CV_SNAPSHOT_VERSION } from '../src/modules/candidate-cvs/cv-snapshot';

const BATCH_SIZE = 500;
const dryRun = process.argv.includes('--dry-run');

async function main() {
  let cursor: string | undefined;
  let scanned = 0;
  let updated = 0;
  let skippedNoCv = 0;

  for (;;) {
    const batch = await prisma.application.findMany({
      where: { cvSnapshot: { equals: Prisma.DbNull }, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      select: { id: true, userId: true },
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1]!.id;
    scanned += batch.length;

    const userIds = [...new Set(batch.map((a) => a.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        slug: true,
        profile: {
          select: {
            defaultCv: {
              include: {
                experiences: { orderBy: CV_SECTION_ORDER_BY },
                educations: { orderBy: CV_SECTION_ORDER_BY },
              },
            },
          },
        },
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const capturedAt = new Date();

    for (const application of batch) {
      const user = userMap.get(application.userId);
      const cv = user?.profile?.defaultCv;
      if (!user || !cv) {
        skippedNoCv++;
        continue;
      }
      updated++;
      if (dryRun) continue;

      const snapshot = buildCvSnapshot({
        cv,
        account: { id: user.id, name: user.name, email: user.email, phone: user.phone, slug: user.slug },
        source: 'backfill',
        capturedAt,
      });
      await prisma.application.updateMany({
        where: { id: application.id, cvSnapshot: { equals: Prisma.DbNull } },
        data: {
          cvSnapshot: snapshot,
          cvSnapshotVersion: CV_SNAPSHOT_VERSION,
          sourceCvId: cv.id,
        },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, mode: dryRun ? 'dry-run' : 'apply', scanned, updated, skippedNoCv }));
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
