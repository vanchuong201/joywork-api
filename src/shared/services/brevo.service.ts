import { BrevoClient } from '@getbrevo/brevo';
import { config } from '@/config/env';
import type { BrevoImportContact } from './brevo-contact.mapper';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
/**
 * Brevo import API ignores boolean attributes; set them via updateBatchContacts.
 * Keep chunks small and spaced — batch endpoint is stricter on rate limits than import.
 * updateBatchContacts fails the entire chunk if any email is missing (404 indexes).
 */
const UPDATE_BATCH_SIZE = 50;
const UPDATE_CHUNK_DELAY_MS = 400;
const UPDATE_MAX_RETRIES = 4;

export type BrevoImportResult = {
  processId: number;
  status: string;
};

function getClient(): BrevoClient | null {
  if (!config.BREVO_API_KEY) {
    return null;
  }
  return new BrevoClient({
    apiKey: config.BREVO_API_KEY,
    maxRetries: 2,
    timeoutInSeconds: 60,
  });
}

export function isBrevoConfigured(): boolean {
  return Boolean(config.BREVO_API_KEY);
}

export function getBrevoListId(): number {
  return config.BREVO_LIST_ID;
}

function textAttributesForImport(
  attributes: BrevoImportContact['attributes'],
): Record<string, unknown> {
  const { CV_ACTIVATE: _cvActivate, ...rest } = attributes;
  return rest;
}

function formatBrevoError(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err);
  }
  const anyErr = err as Error & {
    statusCode?: number;
    body?: unknown;
  };
  const status = typeof anyErr.statusCode === 'number' ? ` status=${anyErr.statusCode}` : '';
  let detail = '';
  if (anyErr.body && typeof anyErr.body === 'object') {
    const body = anyErr.body as { message?: string; code?: string };
    if (body.message || body.code) {
      detail = ` code=${body.code ?? ''} message=${body.message ?? ''}`;
    }
  }
  return `${anyErr.message}${status}${detail}`.trim();
}

function getErrorStatusCode(err: unknown): number | undefined {
  return (err as { statusCode?: number })?.statusCode;
}

function getErrorMessage(err: unknown): string {
  const anyErr = err as { message?: string; body?: { message?: string } };
  return anyErr.body?.message || anyErr.message || '';
}

/** Parse "No contact found for indexes 24,39" → [24, 39]. */
export function parseMissingContactIndexes(message: string): number[] {
  const match = message.match(/indexes?\s+([\d,\s]+)/i);
  if (!match?.[1]) {
    return [];
  }
  return match[1]
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0);
}

/**
 * Import a batch of contacts (upsert text attrs + list). Returns process id; caller may poll.
 * Boolean attrs (CV_ACTIVATE) must be set separately via updateContactsAttributesBatch —
 * Brevo import silently drops booleans.
 */
export async function importContactsBatch(
  contacts: BrevoImportContact[],
): Promise<{ processId: number }> {
  const client = getClient();
  if (!client) {
    throw new Error('BREVO_API_KEY is not configured');
  }
  if (contacts.length === 0) {
    throw new Error('importContactsBatch requires at least one contact');
  }

  const listId = getBrevoListId();
  const response = await client.contacts.importContacts({
    jsonBody: contacts.map((c) => ({
      email: c.email,
      attributes: textAttributesForImport(c.attributes),
    })),
    listIds: [listId],
    updateExistingContacts: true,
    emptyContactsAttributes: false,
    disableNotification: true,
  });

  const processId = response.processId;
  if (typeof processId !== 'number') {
    throw new Error('Brevo importContacts did not return processId');
  }
  return { processId };
}

async function createOrUpdateContact(
  client: BrevoClient,
  contact: BrevoImportContact,
): Promise<void> {
  const listId = getBrevoListId();
  await client.contacts.createContact({
    email: contact.email,
    attributes: {
      ...textAttributesForImport(contact.attributes),
      CV_ACTIVATE: contact.attributes.CV_ACTIVATE,
    },
    listIds: [listId],
    updateEnabled: true,
  });
}

async function updateContactsChunkWithRetry(
  client: BrevoClient,
  chunk: BrevoImportContact[],
): Promise<{ createdMissing: number }> {
  let remaining = [...chunk];
  let createdMissing = 0;
  let lastError: unknown;

  for (let attempt = 1; attempt <= UPDATE_MAX_RETRIES; attempt++) {
    if (remaining.length === 0) {
      return { createdMissing };
    }

    try {
      await client.contacts.updateBatchContacts({
        contacts: remaining.map((c) => ({
          email: c.email,
          attributes: { CV_ACTIVATE: c.attributes.CV_ACTIVATE },
        })),
      });
      return { createdMissing };
    } catch (err) {
      lastError = err;
      const status = getErrorStatusCode(err);
      const message = getErrorMessage(err);

      if (status === 404) {
        const indexes = parseMissingContactIndexes(message);
        if (indexes.length === 0) {
          throw err;
        }

        const missingSet = new Set(indexes.filter((i) => i < remaining.length));
        const missingContacts = remaining.filter((_, i) => missingSet.has(i));
        const nextRemaining = remaining.filter((_, i) => !missingSet.has(i));

        for (const contact of missingContacts) {
          try {
            await createOrUpdateContact(client, contact);
            createdMissing++;
          } catch (createErr) {
            // Still count as failure for this contact; continue others.
            console.error(
              `[brevo] createContact failed email=${contact.email}: ${formatBrevoError(createErr)}`,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        remaining = nextRemaining;
        continue;
      }

      const retryable = status === 429 || status === 503;
      if (!retryable || attempt === UPDATE_MAX_RETRIES) {
        throw err;
      }
      const backoffMs = UPDATE_CHUNK_DELAY_MS * attempt * 2;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}

/**
 * Update CV_ACTIVATE via POST /contacts/batch (import drops booleans).
 * If a chunk contains emails not yet in Brevo, create them then finish the rest.
 */
export async function updateContactsAttributesBatch(
  contacts: BrevoImportContact[],
): Promise<{ chunksOk: number; chunksFailed: number; createdMissing: number }> {
  const client = getClient();
  if (!client) {
    throw new Error('BREVO_API_KEY is not configured');
  }
  if (contacts.length === 0) {
    return { chunksOk: 0, chunksFailed: 0, createdMissing: 0 };
  }

  let chunksOk = 0;
  let chunksFailed = 0;
  let createdMissing = 0;

  for (let i = 0; i < contacts.length; i += UPDATE_BATCH_SIZE) {
    const chunk = contacts.slice(i, i + UPDATE_BATCH_SIZE);
    try {
      const result = await updateContactsChunkWithRetry(client, chunk);
      createdMissing += result.createdMissing;
      chunksOk++;
    } catch (err) {
      chunksFailed++;
      console.error(
        `[brevo] updateBatchContacts failed chunk=${Math.floor(i / UPDATE_BATCH_SIZE) + 1} size=${chunk.length}: ${formatBrevoError(err)}`,
      );
    }
    if (i + UPDATE_BATCH_SIZE < contacts.length) {
      await new Promise((resolve) => setTimeout(resolve, UPDATE_CHUNK_DELAY_MS));
    }
  }

  return { chunksOk, chunksFailed, createdMissing };
}

export async function getImportProcessStatus(processId: number): Promise<BrevoImportResult> {
  const client = getClient();
  if (!client) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  const process = await client.process.getProcess({ processId });
  return {
    processId: process.id ?? processId,
    status: process.status ?? 'unknown',
  };
}

/**
 * Poll until import process reaches a terminal status.
 */
export async function waitForImportProcess(
  processId: number,
  options?: { pollIntervalMs?: number; timeoutMs?: number },
): Promise<BrevoImportResult> {
  const pollIntervalMs = options?.pollIntervalMs ?? 2_000;
  const timeoutMs = options?.timeoutMs ?? 10 * 60 * 1_000;
  const started = Date.now();

  for (;;) {
    const result = await getImportProcessStatus(processId);
    if (TERMINAL_STATUSES.has(result.status)) {
      return result;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(
        `Brevo import process ${processId} timed out after ${timeoutMs}ms (last status=${result.status})`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}
