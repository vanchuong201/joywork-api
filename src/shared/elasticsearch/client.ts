import { Client } from '@elastic/elasticsearch';
import { config } from '@/config/env';

let _client: Client | null = null;

export function getEsClient(): Client | null {
  if (!config.ELASTICSEARCH_URL) return null;
  if (!_client) {
    _client = new Client({
      node: config.ELASTICSEARCH_URL,
      requestTimeout: 5000,
      maxRetries: 1,
    });
  }
  return _client;
}

export async function isEsAvailable(): Promise<boolean> {
  const client = getEsClient();
  if (!client) return false;
  try {
    await client.ping();
    return true;
  } catch {
    return false;
  }
}
