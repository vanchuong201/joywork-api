import type { FastifyInstance } from 'fastify';
import { listCompaniesForSitemap, listJobCategoriesForSitemap, listJobsForSitemap } from './sitemap.service';

/** Public sitemap data. Mount at `/api/sitemap`. Query errors propagate as 500. */
export async function sitemapRoutes(fastify: FastifyInstance) {
  fastify.get('/companies', async () => ({ data: { companies: await listCompaniesForSitemap() } }));
  fastify.get('/jobs', async () => ({ data: { jobs: await listJobsForSitemap() } }));
  fastify.get('/job-categories', async () => ({ data: { pages: await listJobCategoriesForSitemap() } }));
}
