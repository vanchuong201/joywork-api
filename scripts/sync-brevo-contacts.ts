/**
 * Periodic Brevo CRM contact sync (all users → list identified_contacts).
 *
 * Run: npm run brevo:sync
 * Dry-run: npm run brevo:sync -- --dry-run   OR   BREVO_SYNC_DRY_RUN=1
 *
 * Cron (host): 0 3 * * * docker exec joywork-api npm run brevo:sync
 * See joywork-deploy/QUICK_OPS.md
 */

import { config as loadEnv } from 'dotenv';
loadEnv();

import { openSync, closeSync, unlinkSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { prisma } from '../src/shared/database/prisma';
import { config } from '../src/config/env';
import { mapUserToBrevoContact, type BrevoImportContact } from '../src/shared/services/brevo-contact.mapper';
import {
  importContactsBatch,
  isBrevoConfigured,
  waitForImportProcess,
  getBrevoListId,
} from '../src/shared/services/brevo.service';

const BATCH_SIZE = 500;
const LOCK_PATH = '/tmp/brevo-sync.lock';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wantsDryRun(argv: string[]): boolean {
  if (argv.includes('--dry-run')) return true;
  return config.BREVO_SYNC_DRY_RUN === true;
}

function acquireLock(): number | null {
  try {
    mkdirSync(dirname(LOCK_PATH), { recursive: true });
    // wx: fail if exists (another sync running)
    const fd = openSync(LOCK_PATH, 'wx');
    writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`);
    return fd;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') {
      return null;
    }
    throw err;
  }
}

function releaseLock(fd: number | null) {
  if (fd == null) return;
  try {
    closeSync(fd);
  } catch {
    // ignore
  }
  try {
    unlinkSync(LOCK_PATH);
  } catch {
    // ignore
  }
}

async function main() {
  const dryRun = wantsDryRun(process.argv.slice(2));
  console.log(
    `[brevo-sync] Starting (dryRun=${dryRun}, listId=${getBrevoListId()})...`,
  );

  if (!dryRun && !isBrevoConfigured()) {
    console.log('[brevo-sync] BREVO_API_KEY missing — skip (exit 0)');
    await prisma.$disconnect();
    return;
  }

  const lockFd = dryRun ? null : acquireLock();
  if (!dryRun && lockFd == null) {
    console.log(`[brevo-sync] Lock exists at ${LOCK_PATH} — another sync running; skip`);
    await prisma.$disconnect();
    return;
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
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
            expectedCulture: true,
            careerGoals: true,
            expectedSalaryMin: true,
            expectedSalaryMax: true,
            workMode: true,
            linkedin: true,
          },
        },
        experiences: { select: { id: true } },
        educations: { select: { id: true } },
      },
    });

    console.log(`[brevo-sync] Loaded ${users.length} users from DB`);

    let skippedInvalidEmail = 0;
    let cvCompletedCount = 0;
    const contacts: BrevoImportContact[] = [];

    for (const user of users) {
      const mapped = mapUserToBrevoContact(user);
      if (!mapped) {
        skippedInvalidEmail++;
        continue;
      }
      if (mapped.attributes.CV_COMPLETED) {
        cvCompletedCount++;
      }
      contacts.push(mapped);
    }

    console.log(
      `[brevo-sync] Mapped=${contacts.length}, skippedInvalidEmail=${skippedInvalidEmail}, cvCompleted=${cvCompletedCount}`,
    );

    if (dryRun) {
      console.log('[brevo-sync] Dry-run complete — no Brevo API calls');
      return;
    }

    if (contacts.length === 0) {
      console.log('[brevo-sync] Nothing to import');
      return;
    }

    let batchesOk = 0;
    let batchesFailed = 0;

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      const batchNo = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(contacts.length / BATCH_SIZE);

      try {
        console.log(
          `[brevo-sync] Import batch ${batchNo}/${totalBatches} (size=${batch.length})...`,
        );
        const { processId } = await importContactsBatch(batch);
        console.log(`[brevo-sync] Batch ${batchNo} processId=${processId}, waiting...`);
        const result = await waitForImportProcess(processId);
        if (result.status === 'completed') {
          batchesOk++;
          console.log(`[brevo-sync] Batch ${batchNo} completed`);
        } else {
          batchesFailed++;
          console.error(
            `[brevo-sync] Batch ${batchNo} ended with status=${result.status}`,
          );
        }
      } catch (err) {
        batchesFailed++;
        console.error(
          `[brevo-sync] Batch ${batchNo} failed:`,
          err instanceof Error ? err.message : err,
        );
      }

      if (i + BATCH_SIZE < contacts.length) {
        await sleep(500);
      }
    }

    console.log(
      `[brevo-sync] Done. batchesOk=${batchesOk}, batchesFailed=${batchesFailed}, contacts=${contacts.length}`,
    );

    if (batchesFailed > 0) {
      process.exitCode = 1;
    }
  } finally {
    releaseLock(lockFd);
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error('[brevo-sync] Fatal error:', err);
  try {
    unlinkSync(LOCK_PATH);
  } catch {
    // ignore
  }
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
