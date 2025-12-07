import { FastifyRequest, FastifyReply } from 'fastify';
import { HashtagsService } from './hashtags.service';

export class HashtagsController {
  constructor(private readonly hashtagsService: HashtagsService) {}

  async suggest(req: FastifyRequest, reply: FastifyReply) {
    const query = (req.query as any)?.query ?? '';
    const limit = Number((req.query as any)?.limit ?? 10);
    const items = await this.hashtagsService.suggest(String(query), limit);
    return reply.send({ data: { items } });
  }

  async trending(req: FastifyRequest, reply: FastifyReply) {
    const window = ((req.query as any)?.window ?? '7d') as '7d' | '30d' | 'all';
    const limit = Number((req.query as any)?.limit ?? 10);
    const items = await this.hashtagsService.trending(window, limit);
    return reply.send({ data: { items } });
  }

  async getBySlug(req: FastifyRequest, reply: FastifyReply) {
    const slug = (req.params as any).slug as string;
    const hashtag = await this.hashtagsService.getBySlug(slug);
    if (!hashtag) {
      return reply.status(404).send({
        error: {
          code: 'HASHTAG_NOT_FOUND',
          message: 'Hashtag not found',
        },
      });
    }
    return reply.send({ data: { hashtag } });
  }
}


