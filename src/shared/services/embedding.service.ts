import OpenAI from 'openai';
import { config } from '@/config/env';
import { prisma } from '@/shared/database/prisma';

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!config.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    openaiClient = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Strip Markdown syntax before embedding to avoid embedding formatting tokens.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')   // code blocks
    .replace(/`[^`]*`/g, '')           // inline code
    .replace(/#{1,6}\s/g, '')          // headings
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1') // bold/italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')           // links
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')               // images
    .replace(/[-*+]\s/g, '')           // list markers
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

interface JobTextFields {
  title: string;
  mission: string;
  tasks: string;
  knowledge: string;
  skills: string;
  attitude: string;
  generalInfo?: string;
  benefitsPerks?: string | null;
  careerPath?: string | null;
}

export function buildJobText(job: JobTextFields): string {
  const parts = [
    job.title,
    job.title, // repeat title for weight
    job.mission,
    job.tasks,
    job.knowledge,
    job.skills,
    job.attitude,
  ];
  if (job.generalInfo) parts.push(job.generalInfo);
  if (job.benefitsPerks) parts.push(job.benefitsPerks);
  if (job.careerPath) parts.push(job.careerPath);
  return parts.map(stripMarkdown).filter(Boolean).join(' ');
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: config.OPENAI_EMBEDDING_MODEL,
    input: text.slice(0, 8000), // stay within token limits
  });
  return response.data[0].embedding;
}

export async function upsertJobEmbedding(jobId: string, embedding: number[]): Promise<void> {
  const vectorLiteral = `[${embedding.join(',')}]`;
  await prisma.$executeRawUnsafe(
    `UPDATE jobs SET "embedding" = $1::vector WHERE id = $2`,
    vectorLiteral,
    jobId,
  );
}

export async function generateAndStoreJobEmbedding(job: JobTextFields & { id: string }): Promise<void> {
  try {
    const text = buildJobText(job);
    const embedding = await generateEmbedding(text);
    await upsertJobEmbedding(job.id, embedding);
  } catch (err) {
    // Non-critical — log and continue
    console.error(`[embedding] Failed to generate embedding for job ${job.id}:`, err);
  }
}
