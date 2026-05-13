import { searchDocumentIds } from '@/shared/search/elasticsearch';

interface SearchResultIds {
  ids: string[];
  total: number;
}

const terms = (field: string, values: unknown[] | undefined) => {
  if (!values?.length) return undefined;
  return { terms: { [field]: values } };
};

const term = (field: string, value: unknown) => {
  if (value === undefined) return undefined;
  return { term: { [field]: value } };
};

const appendDefined = (
  target: unknown[],
  ...items: Array<unknown | undefined>
) => {
  for (const item of items) {
    if (item !== undefined) target.push(item);
  }
};

export class SearchQueryService {
  async searchCompanies(data: {
    q?: string | undefined;
    industry?: string | undefined;
    location?: string | undefined;
    size?: string | undefined;
    page: number;
    limit: number;
  }): Promise<SearchResultIds> {
    const filter: unknown[] = [];
    appendDefined(
      filter,
      term('location', data.location),
      term('size.keyword', data.size)
    );

    if (data.industry) {
      filter.push({
        match: { industry: { query: data.industry, operator: 'and' } },
      });
    }

    const must: unknown[] = [];
    if (data.q) {
      must.push({
        multi_match: {
          query: data.q,
          fields: [
            'name^4',
            'legalName^3',
            'tagline^2',
            'description',
            'industry',
            'profile.*',
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    return await searchDocumentIds('companies', {
      from: (data.page - 1) * data.limit,
      size: data.limit,
      track_total_hits: true,
      query: {
        bool: {
          ...(must.length ? { must } : { must: [{ match_all: {} }] }),
          ...(filter.length ? { filter } : {}),
        },
      },
      sort: data.q
        ? ['_score', { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }],
    });
  }

  async searchJobs(data: {
    q?: string | undefined;
    location?: string | undefined;
    ward?: string | undefined;
    remote?: boolean | undefined;
    employmentType?: string | undefined;
    experienceLevel?: string | undefined;
    jobLevel?: string | undefined;
    educationLevel?: string | undefined;
    gender?: string | undefined;
    salaryMin?: number | undefined;
    salaryMax?: number | undefined;
    salaryCurrency?: string | undefined;
    skills?: string | undefined;
    companyId?: string | undefined;
    isActive?: boolean | undefined;
    page: number;
    limit: number;
  }): Promise<SearchResultIds> {
    const filter: unknown[] = [];
    appendDefined(
      filter,
      term('isActive', data.isActive),
      terms('locations', data.location ? [data.location] : undefined),
      terms('wardCodes', data.ward ? [data.ward] : undefined),
      term('remote', data.remote),
      term('employmentType.keyword', data.employmentType),
      term('experienceLevel.keyword', data.experienceLevel),
      term('companyId.keyword', data.companyId)
    );

    if (data.jobLevel) {
      filter.push({
        bool: {
          should: [
            { bool: { must_not: { exists: { field: 'jobLevel' } } } },
            term('jobLevel.keyword', data.jobLevel),
          ],
          minimum_should_match: 1,
        },
      });
    }

    if (data.educationLevel) {
      filter.push({
        bool: {
          should: [
            { bool: { must_not: { exists: { field: 'educationLevel' } } } },
            term('educationLevel.keyword', data.educationLevel),
          ],
          minimum_should_match: 1,
        },
      });
    }

    if (data.gender) {
      filter.push({
        bool: {
          should: [
            { bool: { must_not: { exists: { field: 'gender' } } } },
            term('gender.keyword', data.gender),
          ],
          minimum_should_match: 1,
        },
      });
    }

    if (data.salaryMin !== undefined || data.salaryMax !== undefined) {
      const salaryRange: unknown[] = [
        {
          bool: {
            must_not: [
              { exists: { field: 'salaryMin' } },
              { exists: { field: 'salaryMax' } },
            ],
          },
        },
      ];
      const overlap: unknown[] = [];
      if (data.salaryMin !== undefined)
        overlap.push({ range: { salaryMax: { gte: data.salaryMin } } });
      if (data.salaryMax !== undefined)
        overlap.push({ range: { salaryMin: { lte: data.salaryMax } } });
      if (data.salaryCurrency)
        overlap.push(term('currency.keyword', data.salaryCurrency));
      salaryRange.push({ bool: { filter: overlap } });
      filter.push({ bool: { should: salaryRange, minimum_should_match: 1 } });
    }

    const must: unknown[] = [];
    if (data.q) {
      must.push({
        multi_match: {
          query: data.q,
          fields: [
            'title^5',
            'company.name^3',
            'company.legalName^2',
            'department^2',
            'tags^2',
            'generalInfo',
            'mission',
            'tasks',
            'knowledge',
            'skills',
            'attitude',
            'kpis',
            'benefitsIncome',
            'benefitsPerks',
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (data.skills) {
      for (const skill of data.skills
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)) {
        must.push({ match: { skills: { query: skill, operator: 'and' } } });
      }
    }

    return await searchDocumentIds('jobs', {
      from: (data.page - 1) * data.limit,
      size: data.limit,
      track_total_hits: true,
      query: {
        bool: {
          ...(must.length ? { must } : { must: [{ match_all: {} }] }),
          ...(filter.length ? { filter } : {}),
        },
      },
      sort:
        data.q || data.skills
          ? ['_score', { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }],
    });
  }

  async searchCandidates(data: {
    q?: string | undefined;
    skills?: string | undefined;
    location?: string | undefined;
    page: number;
    limit: number;
  }): Promise<SearchResultIds> {
    const filter: unknown[] = [];
    appendDefined(
      filter,
      terms('profile.locations', data.location ? [data.location] : undefined)
    );

    const must: unknown[] = [];
    if (data.q) {
      must.push({
        multi_match: {
          query: data.q,
          fields: [
            'name^4',
            'profile.fullName^4',
            'profile.headline^3',
            'profile.title^3',
            'profile.bio',
            'profile.skills^3',
            'profile.knowledge^2',
            'profile.attitude^2',
            'profile.careerGoals',
            'experiences.role^2',
            'experiences.company^2',
            'experiences.desc',
            'experiences.achievements',
            'educations.school^2',
            'educations.degree^2',
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (data.skills) {
      must.push({
        terms: {
          'profile.skills.keyword': data.skills
            .split(',')
            .map(value => value.trim())
            .filter(Boolean),
        },
      });
    }

    return await searchDocumentIds('candidates', {
      from: (data.page - 1) * data.limit,
      size: data.limit,
      track_total_hits: true,
      query: {
        bool: {
          ...(must.length ? { must } : { must: [{ match_all: {} }] }),
          ...(filter.length ? { filter } : {}),
        },
      },
      sort:
        data.q || data.skills
          ? ['_score', { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }],
    });
  }
}

export const searchQueryService = new SearchQueryService();
