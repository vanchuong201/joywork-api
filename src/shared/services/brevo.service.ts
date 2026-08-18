import { BrevoClient } from '@getbrevo/brevo';
import { config } from '@/config/env';
import type { BrevoImportContact } from './brevo-contact.mapper';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
/** Brevo import API ignores boolean attributes; set them via updateBatchContacts. */
const UPDATE_BATCH_SIZE = 100;

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

/**
 * Update contacts via POST /contacts/batch (supports boolean attributes like CV_ACTIVATE).
 * Chunks requests; also re-attaches list membership.
 */
export async function updateContactsAttributesBatch(
  contacts: BrevoImportContact[],
): Promise<{ chunksOk: number; chunksFailed: number }> {
  const client = getClient();
  if (!client) {
    throw new Error('BREVO_API_KEY is not configured');
  }
  if (contacts.length === 0) {
    return { chunksOk: 0, chunksFailed: 0 };
  }

  const listId = getBrevoListId();
  let chunksOk = 0;
  let chunksFailed = 0;

  for (let i = 0; i < contacts.length; i += UPDATE_BATCH_SIZE) {
    const chunk = contacts.slice(i, i + UPDATE_BATCH_SIZE);
    try {
      await client.contacts.updateBatchContacts({
        contacts: chunk.map((c) => ({
          email: c.email,
          attributes: c.attributes as Record<string, unknown>,
          listIds: [listId],
        })),
      });
      chunksOk++;
    } catch {
      chunksFailed++;
    }
    if (i + UPDATE_BATCH_SIZE < contacts.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return { chunksOk, chunksFailed };
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
