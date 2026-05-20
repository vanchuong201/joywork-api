import { getEsClient } from './client';

// ─── Index names ─────────────────────────────────────────────────────────────

export const JOBS_INDEX = 'joywork_jobs';
export const COMPANIES_INDEX = 'joywork_companies';
export const USERS_INDEX = 'joywork_users';

// ─── Shared analysis settings ────────────────────────────────────────────────

const viAnalysisSettings = {
  analysis: {
    analyzer: {
      vi_analyzer: {
        type: 'custom',
        tokenizer: 'icu_tokenizer',
        filter: ['icu_folding', 'lowercase'],
      },
      vi_search_analyzer: {
        type: 'custom',
        tokenizer: 'icu_tokenizer',
        filter: ['icu_folding', 'lowercase'],
      },
    },
  },
};

const indexSettings = {
  ...viAnalysisSettings,
  index: {
    number_of_shards: 1,
    number_of_replicas: 1,
  },
};

// ─── Jobs index ───────────────────────────────────────────────────────────────

export const jobsIndexConfig = {
  settings: indexSettings,
  mappings: {
    properties: {
      id:              { type: 'keyword' },
      companyId:       { type: 'keyword' },
      slug:            { type: 'keyword' },
      isActive:        { type: 'boolean' },
      remote:          { type: 'boolean' },
      locations:       { type: 'keyword' },
      wardCodes:       { type: 'keyword' },
      employmentType:  { type: 'keyword' },
      experienceLevel: { type: 'keyword' },
      jobLevel:        { type: 'keyword' },
      educationLevel:  { type: 'keyword' },
      gender:          { type: 'keyword' },
      currency:        { type: 'keyword' },
      salaryMin:       { type: 'long' },
      salaryMax:       { type: 'long' },
      tags:            { type: 'keyword' },
      applicationDeadline: { type: 'date' },
      createdAt:       { type: 'date' },
      updatedAt:       { type: 'date' },
      title: {
        type: 'text',
        analyzer: 'vi_analyzer',
        search_analyzer: 'vi_search_analyzer',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      generalInfo: { type: 'text', analyzer: 'vi_analyzer', search_analyzer: 'vi_search_analyzer' },
      mission:     { type: 'text', analyzer: 'vi_analyzer', search_analyzer: 'vi_search_analyzer' },
      tasks:       { type: 'text', analyzer: 'vi_analyzer', search_analyzer: 'vi_search_analyzer' },
      knowledge:   { type: 'text', analyzer: 'vi_analyzer', search_analyzer: 'vi_search_analyzer' },
      skills:      { type: 'text', analyzer: 'vi_analyzer', search_analyzer: 'vi_search_analyzer' },
      attitude:    { type: 'text', analyzer: 'vi_analyzer', search_analyzer: 'vi_search_analyzer' },
    },
  },
};

// ─── Companies index ──────────────────────────────────────────────────────────

export const companiesIndexConfig = {
  settings: indexSettings,
  mappings: {
    properties: {
      id:         { type: 'keyword' },
      slug:       { type: 'keyword' },
      industry:   { type: 'keyword' },
      location:   { type: 'keyword' },
      size:       { type: 'keyword' },
      isVerified: { type: 'boolean' },
      createdAt:  { type: 'date' },
      name: {
        type: 'text',
        analyzer: 'vi_analyzer',
        search_analyzer: 'vi_search_analyzer',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      legalName:   { type: 'text', analyzer: 'vi_analyzer', search_analyzer: 'vi_search_analyzer' },
      tagline:     { type: 'text', analyzer: 'vi_analyzer', search_analyzer: 'vi_search_analyzer' },
      description: { type: 'text', analyzer: 'vi_analyzer', search_analyzer: 'vi_search_analyzer' },
    },
  },
};

// ─── Users index ─────────────────────────────────────────────────────────────

export const usersIndexConfig = {
  settings: indexSettings,
  mappings: {
    properties: {
      id:               { type: 'keyword' },
      slug:             { type: 'keyword' },
      isPublic:         { type: 'boolean' },
      isSearchingJob:   { type: 'boolean' },
      profileSkills:    { type: 'keyword' },
      profileLocations: { type: 'keyword' },
      createdAt:        { type: 'date' },
      name:     { type: 'text', analyzer: 'vi_analyzer', search_analyzer: 'vi_search_analyzer' },
      email:    { type: 'text', analyzer: 'standard' },
      headline: { type: 'text', analyzer: 'vi_analyzer', search_analyzer: 'vi_search_analyzer' },
      bio:      { type: 'text', analyzer: 'vi_analyzer', search_analyzer: 'vi_search_analyzer' },
    },
  },
};

// ─── Index initialization ─────────────────────────────────────────────────────

export async function initializeIndices(): Promise<void> {
  const client = getEsClient();
  if (!client) {
    console.log('ℹ️  Elasticsearch not configured — skipping index initialization');
    return;
  }

  const indices = [
    { name: JOBS_INDEX, config: jobsIndexConfig },
    { name: COMPANIES_INDEX, config: companiesIndexConfig },
    { name: USERS_INDEX, config: usersIndexConfig },
  ];

  for (const { name, config: cfg } of indices) {
    try {
      const exists = await client.indices.exists({ index: name });
      if (!exists) {
        await client.indices.create({ index: name, settings: cfg.settings as Record<string, unknown>, mappings: cfg.mappings as Record<string, unknown> });
        console.log(`✅ ES index created: ${name}`);
      } else {
        await client.indices.putMapping({ index: name, ...cfg.mappings as Record<string, unknown> });
        console.log(`✅ ES index mapping updated: ${name}`);
      }
    } catch (err) {
      console.error(`⚠️  Failed to initialize ES index ${name}:`, err);
    }
  }
}
