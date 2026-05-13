import { config } from '@/config/env';
import { AppError } from '@/shared/errors/errorHandler';

export type SearchIndexName = 'companies' | 'jobs' | 'candidates';

interface ElasticsearchSearchResponse {
  hits?: {
    total?: number | { value?: number };
    hits?: Array<{ _id?: string }>;
  };
}

const indexPrefix = config.ELASTICSEARCH_INDEX_PREFIX;

const indexes: Record<SearchIndexName, string> = {
  companies: `${indexPrefix}-companies`,
  jobs: `${indexPrefix}-jobs`,
  candidates: `${indexPrefix}-candidates`,
};

const buildAuthHeader = (): string | undefined => {
  if (config.ELASTICSEARCH_API_KEY) {
    return `ApiKey ${config.ELASTICSEARCH_API_KEY}`;
  }

  if (config.ELASTICSEARCH_USERNAME && config.ELASTICSEARCH_PASSWORD) {
    const token = Buffer.from(
      `${config.ELASTICSEARCH_USERNAME}:${config.ELASTICSEARCH_PASSWORD}`
    ).toString('base64');
    return `Basic ${token}`;
  }

  return undefined;
};

const buildUrl = (path: string): string => {
  const baseUrl = config.ELASTICSEARCH_NODE?.replace(/\/+$/, '');
  if (!baseUrl) {
    throw new AppError(
      'Elasticsearch is not configured',
      503,
      'ELASTICSEARCH_NOT_CONFIGURED'
    );
  }

  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const authHeader = buildAuthHeader();
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');

  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  if (authHeader) {
    headers.set('authorization', authHeader);
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new AppError(
      'Elasticsearch operation failed',
      503,
      'ELASTICSEARCH_OPERATION_FAILED',
      {
        statusCode: response.status,
        details: details.slice(0, 500),
      }
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const isElasticsearchEnabled = (): boolean =>
  config.ELASTICSEARCH_ENABLED && !!config.ELASTICSEARCH_NODE;

export const getSearchIndexName = (name: SearchIndexName): string =>
  indexes[name];

export const indexSearchDocument = async (
  name: SearchIndexName,
  id: string,
  document: Record<string, unknown>
): Promise<void> => {
  if (!isElasticsearchEnabled()) return;

  await request(
    `/${encodeURIComponent(getSearchIndexName(name))}/_doc/${encodeURIComponent(id)}?refresh=${config.ELASTICSEARCH_REFRESH_ON_WRITE ? 'true' : 'false'}`,
    {
      method: 'PUT',
      body: JSON.stringify(document),
    }
  );
};

export const deleteSearchDocument = async (
  name: SearchIndexName,
  id: string
): Promise<void> => {
  if (!isElasticsearchEnabled()) return;

  const index = encodeURIComponent(getSearchIndexName(name));
  const documentId = encodeURIComponent(id);
  const authHeader = buildAuthHeader();
  const headers = new Headers({ accept: 'application/json' });

  if (authHeader) {
    headers.set('authorization', authHeader);
  }

  const response = await fetch(
    buildUrl(
      `/${index}/_doc/${documentId}?refresh=${config.ELASTICSEARCH_REFRESH_ON_WRITE ? 'true' : 'false'}`
    ),
    {
      method: 'DELETE',
      headers,
    }
  );

  if (!response.ok && response.status !== 404) {
    const details = await response.text();
    throw new AppError(
      'Elasticsearch delete failed',
      503,
      'ELASTICSEARCH_OPERATION_FAILED',
      {
        statusCode: response.status,
        details: details.slice(0, 500),
      }
    );
  }
};

export const searchDocumentIds = async (
  name: SearchIndexName,
  body: Record<string, unknown>
): Promise<{ ids: string[]; total: number }> => {
  if (!isElasticsearchEnabled()) {
    return { ids: [], total: 0 };
  }

  const response = await request<ElasticsearchSearchResponse>(
    `/${encodeURIComponent(getSearchIndexName(name))}/_search`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

  const total =
    typeof response.hits?.total === 'number'
      ? response.hits.total
      : (response.hits?.total?.value ?? 0);

  return {
    ids:
      response.hits?.hits
        ?.map(hit => hit._id)
        .filter((id): id is string => typeof id === 'string') ?? [],
    total,
  };
};
