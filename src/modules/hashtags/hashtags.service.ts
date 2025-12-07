import { prisma } from '@/shared/database/prisma';

export class HashtagsService {
  /**
   * Suggest hashtags by keyword (prefix match on slug or label)
   */
  async suggest(query: string, limit = 10) {
    const q = query.trim();
    if (!q) return [];

    const lower = q.toLowerCase();

    const items = await prisma.hashtag.findMany({
      where: {
        OR: [
          { slug: { startsWith: lower } },
          { label: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: {
        slug: 'asc',
      },
      take: Math.min(limit, 20),
    });

    return items.map((h) => ({
      id: h.id,
      slug: h.slug,
      label: h.label,
    }));
  }

  /**
   * Trending hashtags theo cửa sổ thời gian (7d, 30d, all)
   * Đơn giản: đếm số PostHashtag trong khoảng thời gian
   */
  async trending(window: '7d' | '30d' | 'all', limit = 10) {
    const now = new Date();
    let from: Date | undefined;

    if (window === '7d') {
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (window === '30d') {
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Đếm số lần được gắn ở PostHashtag, chỉ tính bài PUBLIC + đã publish
    const rows = await prisma.postHashtag.groupBy({
      by: ['hashtagId'],
      where: {
        ...(from
          ? {
              createdAt: {
                gte: from,
              },
            }
          : {}),
        post: {
          visibility: 'PUBLIC',
          publishedAt: {
            not: null,
          },
        },
      },
      _count: {
        hashtagId: true,
      },
      orderBy: {
        _count: {
          hashtagId: 'desc',
        },
      },
      take: Math.min(limit, 50),
    });

    const ids = rows.map((r) => r.hashtagId);
    if (!ids.length) return [];

    const hashtags = await prisma.hashtag.findMany({
      where: { id: { in: ids } },
    });
    const mapById = new Map(hashtags.map((h) => [h.id, h]));

    return rows
      .map((r) => {
        const h = mapById.get(r.hashtagId);
        if (!h) return null;
        return {
          id: h.id,
          slug: h.slug,
          label: h.label,
          count: r._count.hashtagId,
        };
      })
      .filter(Boolean) as Array<{ id: string; slug: string; label: string; count: number }>;
  }

  /**
   * Lấy thông tin hashtag + (tạm thời) chỉ trả meta,
   * danh sách bài viết sẽ dùng API feed theo hashtag riêng (sau này nếu cần).
   */
  async getBySlug(slug: string) {
    const h = await prisma.hashtag.findUnique({
      where: { slug },
    });
    if (!h) return null;
    return {
      id: h.id,
      slug: h.slug,
      label: h.label,
      createdAt: h.createdAt,
    };
  }
}


