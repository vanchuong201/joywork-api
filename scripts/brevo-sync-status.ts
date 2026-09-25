/**
 * Report Brevo sync status: dirty vs synced counts, last run, recent failures.
 *
 * Usage: npx tsx scripts/brevo-sync-status.ts [--sample=20]
 */
import { config as loadEnv } from 'dotenv';
loadEnv();

import { prisma } from '../src/shared/database/prisma';
import {
  mapUserToBrevoContact,
  withBrevoSyncHash,
} from '../src/shared/services/brevo-contact.mapper';

const PAGE_SIZE = 500;

function sampleLimit(argv: string[]): number {
  const flag = argv.find((a) => a.startsWith('--sample='));
  if (flag) {
    const n = Number.parseInt(flag.slice('--sample='.length), 10);
    if (Number.isFinite(n) && n > 0) return Math.min(n, 100);
  }
  return 10;
}

async function main() {
  const limit = sampleLimit(process.argv.slice(2));

  let total = 0;
  let invalidEmail = 0;
  let synced = 0;
  let dirty = 0;
  let neverSynced = 0;
  const dirtySamples: Array<{ id: string; email: string; reason: string }> = [];

  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.user.findMany({
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        brevoSyncedAt: true,
        brevoSyncHash: true,
        profile: {
          select: {
            fullName: true,
            title: true,
            bio: true,
            contactEmail: true,
            contactPhone: true,
            locations: true,
            knowledge: true,
            skills: true,
            attitude: true,
            linkedin: true,
          },
        },
        experiences: { select: { id: true } },
      },
    });
    if (page.length === 0) break;

    for (const user of page) {
      total++;
      const mapped = mapUserToBrevoContact(user);
      if (!mapped) {
        invalidEmail++;
        continue;
      }
      const withHash = withBrevoSyncHash(user.id, mapped);
      if (!user.brevoSyncHash) {
        neverSynced++;
        dirty++;
        if (dirtySamples.length < limit) {
          dirtySamples.push({ id: user.id, email: withHash.email, reason: 'never_synced' });
        }
        continue;
      }
      if (user.brevoSyncHash !== withHash.syncHash) {
        dirty++;
        if (dirtySamples.length < limit) {
          dirtySamples.push({ id: user.id, email: withHash.email, reason: 'hash_mismatch' });
        }
        continue;
      }
      synced++;
    }

    cursor = page[page.length - 1]?.id;
    if (page.length < PAGE_SIZE) break;
  }

  const lastRun = await prisma.brevoSyncRun.findFirst({
    orderBy: { startedAt: 'desc' },
    include: {
      failures: { take: 10, orderBy: { createdAt: 'desc' } },
      _count: { select: { failures: true } },
    },
  });

  console.log(
    JSON.stringify(
      {
        totals: {
          users: total,
          invalidEmail,
          synced,
          dirty,
          neverSynced,
        },
        dirtySamples,
        lastRun: lastRun
          ? {
              id: lastRun.id,
              mode: lastRun.mode,
              startedAt: lastRun.startedAt,
              finishedAt: lastRun.finishedAt,
              exitCode: lastRun.exitCode,
              dirtySelected: lastRun.dirtySelected,
              importOk: lastRun.importOk,
              importFailed: lastRun.importFailed,
              attrChunksOk: lastRun.attrChunksOk,
              attrChunksFailed: lastRun.attrChunksFailed,
              createdMissing: lastRun.createdMissing,
              failureCount: lastRun._count.failures,
              failures: lastRun.failures.map((f) => ({
                email: f.email,
                reason: f.reason,
              })),
            }
          : null,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
