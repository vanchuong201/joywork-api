/**
 * Periodic Brevo CRM contact sync (users → list identified_contacts).
 *
 * Run: npm run brevo:sync
 * Dry-run: npm run brevo:sync -- --dry-run
 * Modes: --mode=incremental (default) | --mode=full
 * Attributes only: --attributes-only
 * Status: npm run brevo:sync:status
 *
 * Cron (host): see joywork-deploy/QUICK_OPS.md
 */

import { config as loadEnv } from 'dotenv';
loadEnv();

import {
  openSync,
  closeSync,
  unlinkSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
} from 'fs';
import { dirname } from 'path';
import { prisma } from '../src/shared/database/prisma';
import { config } from '../src/config/env';
import {
  mapUserToBrevoContact,
  withBrevoSyncHash,
  type BrevoMappedContact,
} from '../src/shared/services/brevo-contact.mapper';
import {
  importContactsBatch,
  isBrevoConfigured,
  waitForImportProcess,
  updateContactsAttributesBatch,
  getBrevoListId,
  type BrevoEmailFailure,
} from '../src/shared/services/brevo.service';

const BATCH_SIZE = 500;
const PAGE_SIZE = 500;
const LOCK_PATH = '/tmp/brevo-sync.lock';
const LOCK_TTL_MS = 2 * 60 * 60 * 1000; // 2h
const LAST_RUN_PATH = '/tmp/brevo-sync-last-run.json';
const USER_SELECT = {
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
} as const;

type SyncMode = 'incremental' | 'full';

type RunStats = {
  mode: string;
  startedAt: string;
  finishedAt?: string;
  contactsAttempted: number;
  dirtySelected: number;
  skippedInvalidEmail: number;
  cvActivateCount: number;
  importOk: number;
  importFailed: number;
  attrChunksOk: number;
  attrChunksFailed: number;
  createdMissing: number;
  markedSynced: number;
  exitCode: number;
  failures: BrevoEmailFailure[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wantsDryRun(argv: string[]): boolean {
  if (argv.includes('--dry-run')) return true;
  return config.BREVO_SYNC_DRY_RUN === true;
}

function wantsAttributesOnly(argv: string[]): boolean {
  return argv.includes('--attributes-only');
}

function parseMode(argv: string[]): SyncMode {
  const flag = argv.find((a) => a.startsWith('--mode='));
  if (flag) {
    const value = flag.slice('--mode='.length);
    if (value === 'full' || value === 'incremental') return value;
  }
  const idx = argv.indexOf('--mode');
  if (idx >= 0) {
    const value = argv[idx + 1];
    if (value === 'full' || value === 'incremental') return value;
  }
  return 'incremental';
}

function clearStaleLock(): boolean {
  if (!existsSync(LOCK_PATH)) return false;
  try {
    const raw = readFileSync(LOCK_PATH, 'utf8');
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const startedAt = lines[1] ? Date.parse(lines[1]) : NaN;
    if (!Number.isFinite(startedAt)) {
      unlinkSync(LOCK_PATH);
      return true;
    }
    if (Date.now() - startedAt > LOCK_TTL_MS) {
      console.warn(
        `[brevo-sync] Stale lock (age>${LOCK_TTL_MS}ms) at ${LOCK_PATH} — removing`,
      );
      unlinkSync(LOCK_PATH);
      return true;
    }
  } catch {
    try {
      unlinkSync(LOCK_PATH);
      return true;
    } catch {
      // ignore
    }
  }
  return false;
}

function acquireLock(): number | null {
  mkdirSync(dirname(LOCK_PATH), { recursive: true });
  clearStaleLock();
  try {
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

async function notifySyncAlert(text: string): Promise<void> {
  const webhook = config.LARK_COMPANY_VERIFICATION_WEBHOOK;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'text',
        content: { text },
      }),
    });
  } catch (err) {
    console.error(
      '[brevo-sync] Alert webhook failed:',
      err instanceof Error ? err.message : err,
    );
  }
}

function writeLastRunReport(stats: RunStats): void {
  try {
    writeFileSync(LAST_RUN_PATH, `${JSON.stringify(stats, null, 2)}\n`);
  } catch (err) {
    console.error(
      '[brevo-sync] Failed to write last-run report:',
      err instanceof Error ? err.message : err,
    );
  }
}

async function persistRunReport(stats: RunStats): Promise<string | null> {
  try {
    const run = await prisma.brevoSyncRun.create({
      data: {
        mode: stats.mode,
        startedAt: new Date(stats.startedAt),
        finishedAt: stats.finishedAt ? new Date(stats.finishedAt) : new Date(),
        contactsAttempted: stats.contactsAttempted,
        dirtySelected: stats.dirtySelected,
        skippedInvalidEmail: stats.skippedInvalidEmail,
        cvActivateCount: stats.cvActivateCount,
        importOk: stats.importOk,
        importFailed: stats.importFailed,
        attrChunksOk: stats.attrChunksOk,
        attrChunksFailed: stats.attrChunksFailed,
        createdMissing: stats.createdMissing,
        exitCode: stats.exitCode,
        failures: {
          create: stats.failures.slice(0, 500).map((f) => ({
            email: f.email,
            reason: f.reason.slice(0, 500),
          })),
        },
      },
    });
    return run.id;
  } catch (err) {
    console.error(
      '[brevo-sync] Failed to persist BrevoSyncRun:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function markContactsSynced(contacts: BrevoMappedContact[]): Promise<number> {
  if (contacts.length === 0) return 0;
  const now = new Date();
  let marked = 0;
  const CONCURRENCY = 25;
  for (let i = 0; i < contacts.length; i += CONCURRENCY) {
    const slice = contacts.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map((c) =>
        prisma.user.update({
          where: { id: c.userId },
          data: {
            brevoSyncedAt: now,
            brevoSyncHash: c.syncHash,
          },
        }),
      ),
    );
    marked += slice.length;
  }
  return marked;
}

async function* iterateUsers() {
  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.user.findMany({
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: USER_SELECT,
    });
    if (page.length === 0) break;
    yield page;
    cursor = page[page.length - 1]?.id;
    if (page.length < PAGE_SIZE) break;
  }
}

function isDirtyContact(
  user: { brevoSyncHash: string | null },
  syncHash: string,
  mode: SyncMode,
  attributesOnly: boolean,
): boolean {
  if (attributesOnly || mode === 'full') return true;
  return !user.brevoSyncHash || user.brevoSyncHash !== syncHash;
}

async function syncBatch(
  batch: BrevoMappedContact[],
  stats: RunStats,
  attributesOnly: boolean,
): Promise<void> {
  const byEmail = new Map<string, BrevoMappedContact>();
  for (const c of batch) {
    byEmail.set(c.email, c);
  }
  const unique = [...byEmail.values()];
  if (unique.length === 0) return;

  const markSucceeded = async (emails: string[]) => {
    const set = new Set(emails.map((e) => e.toLowerCase()));
    const ok = unique.filter((c) => set.has(c.email.toLowerCase()));
    stats.markedSynced += await markContactsSynced(ok);
  };

  if (attributesOnly) {
    const attrResult = await updateContactsAttributesBatch(unique);
    stats.attrChunksOk += attrResult.chunksOk;
    stats.attrChunksFailed += attrResult.chunksFailed;
    stats.createdMissing += attrResult.createdMissing;
    stats.failures.push(...attrResult.failedEmails);
    await markSucceeded(attrResult.succeededEmails);
    return;
  }

  try {
    const { processId } = await importContactsBatch(unique);
    console.log(`[brevo-sync] import processId=${processId}, waiting...`);
    const result = await waitForImportProcess(processId);
    if (result.status !== 'completed') {
      stats.importFailed++;
      const reason = `import status=${result.status}`;
      console.error(`[brevo-sync] import ended with ${reason}`);
      for (const c of unique) {
        stats.failures.push({ email: c.email, reason });
      }
      return;
    }
    stats.importOk++;
    await sleep(1_000);

    const attrResult = await updateContactsAttributesBatch(unique);
    stats.attrChunksOk += attrResult.chunksOk;
    stats.attrChunksFailed += attrResult.chunksFailed;
    stats.createdMissing += attrResult.createdMissing;
    stats.failures.push(...attrResult.failedEmails);
    await markSucceeded(attrResult.succeededEmails);
    console.log(
      `[brevo-sync] attributes chunksOk=${attrResult.chunksOk}, chunksFailed=${attrResult.chunksFailed}, createdMissing=${attrResult.createdMissing}`,
    );
  } catch (err) {
    stats.importFailed++;
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[brevo-sync] batch failed:', reason);
    for (const c of unique) {
      stats.failures.push({ email: c.email, reason });
    }
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = wantsDryRun(argv);
  const attributesOnly = wantsAttributesOnly(argv);
  const mode = parseMode(argv);
  const effectiveMode = attributesOnly ? `attributes-only:${mode}` : mode;
  const startedAt = new Date().toISOString();

  const stats: RunStats = {
    mode: effectiveMode,
    startedAt,
    contactsAttempted: 0,
    dirtySelected: 0,
    skippedInvalidEmail: 0,
    cvActivateCount: 0,
    importOk: 0,
    importFailed: 0,
    attrChunksOk: 0,
    attrChunksFailed: 0,
    createdMissing: 0,
    markedSynced: 0,
    exitCode: 0,
    failures: [],
  };

  console.log(
    `[brevo-sync] Starting (dryRun=${dryRun}, mode=${effectiveMode}, listId=${getBrevoListId()})...`,
  );

  if (!dryRun && !isBrevoConfigured()) {
    console.error('[brevo-sync] BREVO_API_KEY missing — fail (exit 1)');
    stats.exitCode = 1;
    stats.finishedAt = new Date().toISOString();
    writeLastRunReport(stats);
    await notifySyncAlert(
      `[Brevo sync FAILED] BREVO_API_KEY missing\nmode=${effectiveMode}\nat=${startedAt}`,
    );
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const lockFd = dryRun ? null : acquireLock();
  if (!dryRun && lockFd == null) {
    console.error(`[brevo-sync] Lock exists at ${LOCK_PATH} — another sync running; fail (exit 1)`);
    stats.exitCode = 1;
    stats.finishedAt = new Date().toISOString();
    writeLastRunReport(stats);
    await notifySyncAlert(
      `[Brevo sync FAILED] lock held\npath=${LOCK_PATH}\nmode=${effectiveMode}`,
    );
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  try {
    const buffer: BrevoMappedContact[] = [];
    let batchNo = 0;

    for await (const page of iterateUsers()) {
      stats.contactsAttempted += page.length;

      for (const user of page) {
        const mapped = mapUserToBrevoContact(user);
        if (!mapped) {
          stats.skippedInvalidEmail++;
          continue;
        }
        const withHash = withBrevoSyncHash(user.id, mapped);
        if (withHash.attributes.CV_ACTIVATE) {
          stats.cvActivateCount++;
        }

        if (!isDirtyContact(user, withHash.syncHash, mode, attributesOnly)) {
          continue;
        }

        stats.dirtySelected++;
        if (dryRun) {
          continue;
        }

        buffer.push(withHash);
        while (buffer.length >= BATCH_SIZE) {
          batchNo++;
          const batch = buffer.splice(0, BATCH_SIZE);
          console.log(
            `[brevo-sync] Flush batch ${batchNo} (size=${batch.length}, dirtySoFar=${stats.dirtySelected})...`,
          );
          await syncBatch(batch, stats, attributesOnly);
          await sleep(500);
        }
      }
    }

    if (dryRun) {
      console.log(
        `[brevo-sync] Dry-run complete — users=${stats.contactsAttempted}, dirty=${stats.dirtySelected}, skippedInvalidEmail=${stats.skippedInvalidEmail}, cvActivate=${stats.cvActivateCount}`,
      );
      stats.finishedAt = new Date().toISOString();
      writeLastRunReport(stats);
      return;
    }

    if (buffer.length > 0) {
      batchNo++;
      console.log(`[brevo-sync] Flush final batch ${batchNo} (size=${buffer.length})...`);
      await syncBatch(buffer, stats, attributesOnly);
    }

    if (stats.dirtySelected === 0) {
      console.log('[brevo-sync] Nothing dirty to sync');
    }

    if (stats.importFailed > 0 || stats.attrChunksFailed > 0 || stats.failures.length > 0) {
      stats.exitCode = 1;
    }

    stats.finishedAt = new Date().toISOString();
    writeLastRunReport(stats);
    const runId = await persistRunReport(stats);

    console.log(
      `[brevo-sync] Done. mode=${effectiveMode}, users=${stats.contactsAttempted}, dirty=${stats.dirtySelected}, importOk=${stats.importOk}, importFailed=${stats.importFailed}, attrChunksOk=${stats.attrChunksOk}, attrChunksFailed=${stats.attrChunksFailed}, createdMissing=${stats.createdMissing}, markedSynced=${stats.markedSynced}, failures=${stats.failures.length}, runId=${runId ?? 'n/a'}, exitCode=${stats.exitCode}`,
    );

    if (stats.exitCode !== 0) {
      process.exitCode = 1;
      const sample = stats.failures
        .slice(0, 5)
        .map((f) => `${f.email}: ${f.reason}`)
        .join('\n');
      await notifySyncAlert(
        `[Brevo sync FAILED] exit=${stats.exitCode}\nmode=${effectiveMode}\ndirty=${stats.dirtySelected}\nimportFailed=${stats.importFailed}\nattrChunksFailed=${stats.attrChunksFailed}\nfailures=${stats.failures.length}\nrunId=${runId ?? 'n/a'}\n${sample}`,
      );
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
  try {
    await notifySyncAlert(
      `[Brevo sync FATAL] ${err instanceof Error ? err.message : String(err)}`,
    );
  } catch {
    // ignore
  }
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
