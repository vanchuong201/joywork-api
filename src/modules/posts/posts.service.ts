import { PostAuditAction } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { deleteS3Objects } from '@/shared/storage/s3';
import {
  CreatePostInput,
  UpdatePostInput,
  GetCompanyPostsInput,
  GetFeedPostsInput,
} from './posts.schema';

// Chuẩn hoá hashtag: tạo slug từ text user nhập
function normalizeHashtag(input: string): { slug: string; label: string } {
  const raw = input.trim();
  const label = raw.startsWith('#') ? raw.slice(1).trim() : raw;

  // remove accents
  const withoutAccents = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // to slug: lowercase, keep a-z0-9-_, spaces to dash
  const slug = withoutAccents
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 50);

  return {
    slug,
    label: label || slug,
  };
}

export interface Post {
  id: string;
  companyId: string;
  title: string;
  content: string;
  excerpt?: string;
  coverUrl?: string;
  type: string;
  visibility: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
  company: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
  };
  images?: Array<{ id: string; url: string; width?: number | null; height?: number | null; order: number }>;
  likes: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      name?: string;
    };
  }>;
  _count: {
    likes: number;
  };
  jobs?: Array<{
    id: string;
    title: string;
    location?: string | null;
    employmentType: string;
    isActive: boolean;
  }>;
  hashtags?: Array<{
    id: string;
    slug: string;
    label: string;
  }>;
}

export interface PostWithLikes extends Post {
  isLiked: boolean;
  isSaved?: boolean;
  reactions?: {
    JOY: number;
    TRUST: number;
    SKEPTIC: number;
  };
  userReaction?: 'JOY' | 'TRUST' | 'SKEPTIC' | null;
}

function mapPostEntity(post: any): Post {
  return {
    id: post.id,
    companyId: post.companyId,
    title: post.title,
    content: post.content,
    excerpt: post.excerpt ?? undefined,
    coverUrl: post.coverUrl ?? undefined,
    type: post.type,
    visibility: post.visibility,
    publishedAt: post.publishedAt ?? undefined,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    createdBy: post.createdBy
      ? {
          id: post.createdBy.id,
          email: post.createdBy.email,
          name: post.createdBy.name ?? undefined,
        }
      : null,
    company: post.company,
    images: post.images
      ? post.images.map((image: any) => ({
          id: image.id,
          url: image.url,
          width: image.width ?? undefined,
          height: image.height ?? undefined,
          order: image.order ?? undefined,
        }))
      : undefined,
    likes: post.likes.map((like: any) => ({
      id: like.id,
      userId: like.userId,
      user: {
        id: like.user.id,
        name: like.user.name,
      },
    })),
    _count: post._count,
    jobs: Array.isArray(post.postJobs)
      ? post.postJobs.map((pj: any) => ({
          id: pj.job.id,
          title: pj.job.title,
          location: pj.job.location,
          employmentType: pj.job.employmentType,
          isActive: pj.job.isActive,
        }))
      : [],
    hashtags: Array.isArray(post.hashtags)
      ? post.hashtags.map((ph: any) => ({
          id: ph.hashtag.id,
          slug: ph.hashtag.slug,
          label: ph.hashtag.label,
        }))
      : [],
  };
}

export class PostsService {
  // Create post
  async createPost(companyId: string, userId: string, data: CreatePostInput): Promise<Post> {
    const { images, publishNow, publishedAt, jobIds, hashtags, ...postData } = data;

    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to create posts for this company', 403, 'FORBIDDEN');
    }

    const normalizedImages = images?.map((image, index) => ({
      url: image.url,
      storageKey: image.key,
      width: image.width ?? null,
      height: image.height ?? null,
      order: image.order ?? index,
    }));

    const resolvedPublishedAt = publishedAt
      ? new Date(publishedAt)
      : publishNow
      ? new Date()
      : null;

    const postDataToCreate: any = {
        companyId,
        createdById: userId,
      title: postData.title,
      content: postData.content,
      type: postData.type,
      visibility: postData.visibility,
      coverUrl: (normalizedImages && normalizedImages.length > 0) ? normalizedImages[0]!.url : null,
        publishedAt: resolvedPublishedAt,
      excerpt: ((postData as any).excerpt !== undefined && (postData as any).excerpt !== null) ? (postData as any).excerpt : null,
    };
    
    if (normalizedImages && normalizedImages.length > 0) {
      postDataToCreate.images = {
              create: normalizedImages,
      };
            }
    
    const post = await prisma.post.create({
      data: {
        ...postDataToCreate,
        ...(Array.isArray(jobIds) && jobIds.length > 0
          ? {
              postJobs: {
                create: jobIds.slice(0, 10).map((jid) => ({ jobId: jid })),
              },
            }
          : {}),
        ...(Array.isArray(hashtags) && hashtags.length > 0
          ? {
              hashtags: {
                create: await Promise.all(
                  Array.from(
                    new Map(
                      hashtags
                        .map((h) => normalizeHashtag(h))
                        .filter((h) => h.slug)
                        .map((h) => [h.slug, h])
                    ).values()
                  )
                    .slice(0, 5)
                    .map(async (h) => ({
                      hashtag: {
                        connectOrCreate: {
                          where: { slug: h.slug },
                          create: {
                            slug: h.slug,
                            label: h.label,
                          },
                        },
                      },
                    }))
                ),
              },
            }
          : {}),
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        images: {
          select: { id: true, url: true, width: true, height: true, order: true, storageKey: true },
          orderBy: { order: 'asc' },
        },
        postJobs: {
          include: {
            job: { select: { id: true, title: true, location: true, employmentType: true, isActive: true } },
          },
        },
        hashtags: {
          include: {
            hashtag: {
              select: { id: true, slug: true, label: true },
            },
          },
        },
        likes: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
    });

    await prisma.postAuditLog.create({
      data: {
        postId: post.id,
        actorId: userId,
        action: PostAuditAction.CREATE,
        metadata: {
          postId: post.id,
          imageCount: normalizedImages?.length ?? 0,
          visibility: post.visibility,
          type: post.type,
        },
      },
    });

    return mapPostEntity(post);
  }

  // Update post
  async updatePost(postId: string, userId: string, data: UpdatePostInput): Promise<Post> {
    // Get post with company info
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        company: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
        images: {
          select: {
            storageKey: true,
          },
        },
      },
    });

    if (!post) {
      throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    }

    // Check permissions:
    // - OWNER/ADMIN: có thể sửa mọi bài trong công ty mình quản lý
    // - MEMBER: chỉ được sửa bài do chính mình tạo
    const membership = post.company.members[0];
    if (!membership) {
      throw new AppError('You do not have permission to update this post', 403, 'FORBIDDEN');
    }
    const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(membership.role);
    const isMemberEditingOwnPost = membership.role === 'MEMBER' && post.createdById === userId;
    if (!(isOwnerOrAdmin || isMemberEditingOwnPost)) {
      throw new AppError('You do not have permission to update this post', 403, 'FORBIDDEN');
    }

    // Update post
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt ?? null;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.visibility !== undefined) updateData.visibility = data.visibility;
    if (data.publishedAt !== undefined) updateData.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
    
    // Handle images replacement if provided
    if (data['images'] !== undefined) {
      const currentImages = await prisma.postImage.findMany({
        where: { postId },
        select: { id: true, url: true, storageKey: true },
      });
      const desired = (data['images'] as any[]).map(img => ({
        id: img.id as string | undefined,
        key: img.key as string | undefined,
        url: img.url as string,
        width: img.width as number | undefined,
        height: img.height as number | undefined,
        order: img.order as number | undefined,
      }));
      // Cập nhật coverUrl theo bộ ảnh mới:
      // - Nếu còn ảnh: lấy ảnh đầu tiên làm cover
      // - Nếu không còn ảnh: xoá coverUrl (null)
      const newCoverUrl: string | null = desired.length > 0 ? desired[0]!.url : null;
      const currentById = new Map(currentImages.map(ci => [ci.id, ci]));
      const currentByUrl = new Map(currentImages.map(ci => [ci.url, ci]));
      const desiredIds = new Set(desired.filter(d => d.id).map(d => d.id as string));
      const toDelete = currentImages.filter(ci => !desiredIds.has(ci.id));
      // Delete removed images in DB and S3
      if (toDelete.length) {
        const keysToDelete = toDelete.map(d => d.storageKey).filter(Boolean) as string[];
        if (keysToDelete.length) {
          await deleteS3Objects(keysToDelete);
        }
        await prisma.postImage.deleteMany({
          where: { id: { in: toDelete.map(d => d.id) } },
        });
      }
      // Upsert/update desired images
      for (const d of desired) {
        const ord = d.order ?? 0;
        const width = d.width ?? null;
        const height = d.height ?? null;
        if (d.id && currentById.has(d.id)) {
          await prisma.postImage.update({
            where: { id: d.id },
            data: {
              url: d.url,
              width,
              height,
              order: ord,
            },
          });
        } else {
          // find storageKey: prefer provided key; else try match by url from current
          const storageKey = d.key ?? currentByUrl.get(d.url)?.storageKey ?? null;
          await prisma.postImage.create({
            data: {
              postId,
              url: d.url,
              storageKey,
              width,
              height,
              order: ord,
            },
          });
        }
      }
      // Ghi nhận coverUrl mới vào updateData để đảm bảo client không còn hiển thị cover cũ
      updateData.coverUrl = newCoverUrl;
    }
    
    // Handle attached jobs replacement if provided
    if (data['jobIds'] !== undefined) {
      const desiredJobIds = Array.from(
        new Set(((data['jobIds'] as unknown as string[]) || []).filter(Boolean))
      ).slice(0, 10);
      
      // Validate all desired jobs belong to the same company as the post
      if (desiredJobIds.length > 0) {
        const jobs = await prisma.job.findMany({
          where: { id: { in: desiredJobIds } },
          select: { id: true, companyId: true },
        });
        const invalid = jobs.some((j) => j.companyId !== post.companyId);
        if (invalid || jobs.length !== desiredJobIds.length) {
          throw new AppError('Some jobs are invalid or do not belong to this company', 400, 'INVALID_JOB_IDS');
        }
      }
      
      const currentPostJobs = await prisma.postJob.findMany({
        where: { postId },
        select: { id: true, jobId: true },
      });
      const currentJobIds = new Set(currentPostJobs.map((pj) => pj.jobId));
      const desiredSet = new Set(desiredJobIds);
      
      const toDeleteJobIds = currentPostJobs.filter((pj) => !desiredSet.has(pj.jobId)).map((pj) => pj.jobId);
      const toAddJobIds = desiredJobIds.filter((jid) => !currentJobIds.has(jid));
      
      if (toDeleteJobIds.length > 0) {
        await prisma.postJob.deleteMany({
          where: {
            postId,
            jobId: { in: toDeleteJobIds },
          },
        });
      }
      if (toAddJobIds.length > 0) {
        await prisma.postJob.createMany({
          data: toAddJobIds.map((jid) => ({ postId, jobId: jid })),
          skipDuplicates: true,
        });
      }
    }

    // Handle hashtags replacement if provided
    if (data['hashtags'] !== undefined) {
      const raw = (data['hashtags'] as unknown as string[]) || [];
      const normalizedUnique = Array.from(
        new Map(
          raw
            .map((h) => normalizeHashtag(h))
            .filter((h) => h.slug)
            .map((h) => [h.slug, h])
        ).values()
      ).slice(0, 5);

      // Xoá toàn bộ liên kết cũ
      await prisma.postHashtag.deleteMany({
        where: { postId },
      });

      if (normalizedUnique.length > 0) {
        // Tạo lại các liên kết mới
        for (const h of normalizedUnique) {
          const hashtag = await prisma.hashtag.upsert({
            where: { slug: h.slug },
            update: {},
            create: {
              slug: h.slug,
              label: h.label,
            },
          });

          await prisma.postHashtag.create({
            data: {
              postId,
              hashtagId: hashtag.id,
            },
          });
        }
      }
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: updateData,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        images: {
          select: { id: true, url: true, width: true, height: true, order: true, storageKey: true },
          orderBy: { order: 'asc' },
        },
        postJobs: {
          include: {
            job: { select: { id: true, title: true, location: true, employmentType: true, isActive: true } },
          },
        },
        hashtags: {
          include: {
            hashtag: {
              select: { id: true, slug: true, label: true },
            },
          },
        },
        likes: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
    });

    await prisma.postAuditLog.create({
      data: {
        postId,
        actorId: userId,
        action: PostAuditAction.UPDATE,
        metadata: {
          postId,
          fields: Object.keys(data),
        },
      },
    });

    return mapPostEntity(updatedPost);
  }

  // Get post by ID
  async getPostById(postId: string, userId?: string): Promise<PostWithLikes | null> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        images: {
          select: { id: true, url: true, width: true, height: true, order: true, storageKey: true },
          orderBy: { order: 'asc' },
        },
        hashtags: {
          include: {
            hashtag: {
              select: { id: true, slug: true, label: true },
            },
          },
        },
        likes: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
    });

    if (!post) {
      return null;
    }

    // Check reactions/likes/saved for this post
    let isLiked = false;
    let isSaved = false;
    let userReaction: 'JOY' | 'TRUST' | 'SKEPTIC' | null = null;
    const reactions = { JOY: 0, TRUST: 0, SKEPTIC: 0 };
    reactions.JOY = await prisma.postReaction.count({ where: { postId, type: 'JOY' as any } });
    reactions.TRUST = await prisma.postReaction.count({ where: { postId, type: 'TRUST' as any } });
    reactions.SKEPTIC = await prisma.postReaction.count({ where: { postId, type: 'SKEPTIC' as any } });
    if (userId) {
      const like = await prisma.like.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });
      isLiked = !!like;
      const myReaction = await prisma.postReaction.findUnique({
        where: { userId_postId: { userId, postId } },
      });
      userReaction = (myReaction?.type as any) ?? null;
      const favorite = await prisma.postFavorite.findUnique({
        where: {
          userId_postId: { userId, postId },
        },
      });
      isSaved = !!favorite;
    }

    const base = mapPostEntity(post);
    return {
      ...base,
      isLiked,
      isSaved,
      reactions,
      userReaction,
    };
  }

  // Get company posts
  async getCompanyPosts(data: GetCompanyPostsInput, userId?: string): Promise<{
    posts: PostWithLikes[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { companyId, type, visibility, page, limit } = data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { companyId };

    if (type) {
      where.type = type;
    }

    if (visibility) {
      where.visibility = visibility;
    }

    // Get posts with pagination
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          images: {
            select: { id: true, url: true, width: true, height: true, order: true, storageKey: true },
            orderBy: { order: 'asc' },
          },
          postJobs: {
            include: { job: { select: { id: true, title: true, location: true, employmentType: true, isActive: true } } },
          },
          hashtags: {
            include: {
              hashtag: {
                select: { id: true, slug: true, label: true },
              },
            },
          },
          likes: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              likes: true,
            },
          },
        },
      }),
      prisma.post.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Check reactions and favorites for each post
    const postsWithLikes: PostWithLikes[] = [];
    for (const post of posts) {
      let isLiked = false;
      let isSaved = false;
      let userReaction: 'JOY' | 'TRUST' | 'SKEPTIC' | null = null;
      const reactions = { JOY: 0, TRUST: 0, SKEPTIC: 0 };
      reactions.JOY = await prisma.postReaction.count({ where: { postId: post.id, type: 'JOY' as any } });
      reactions.TRUST = await prisma.postReaction.count({ where: { postId: post.id, type: 'TRUST' as any } });
      reactions.SKEPTIC = await prisma.postReaction.count({ where: { postId: post.id, type: 'SKEPTIC' as any } });
      if (userId) {
        const like = await prisma.like.findUnique({
          where: {
            userId_postId: {
              userId,
              postId: post.id,
            },
          },
        });
        isLiked = !!like;
        const myReaction = await prisma.postReaction.findUnique({
          where: { userId_postId: { userId, postId: post.id } },
        });
        userReaction = (myReaction?.type as any) ?? null;
        const favorite = await prisma.postFavorite.findUnique({
          where: {
            userId_postId: { userId, postId: post.id },
          },
        });
        isSaved = !!favorite;
      }

      postsWithLikes.push({
        ...mapPostEntity(post),
        isLiked,
        isSaved,
        reactions,
        userReaction,
      });
    }

    return {
      posts: postsWithLikes,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Get feed posts (public posts)
  async getFeedPosts(data: GetFeedPostsInput, userId?: string): Promise<{
    posts: PostWithLikes[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { type, companyId, hashtag, following, page, limit } = data;
    const skip = (page - 1) * limit;

    // Build where clause - only public posts
    const where: any = { 
      visibility: 'PUBLIC',
      publishedAt: { not: null }, // Only published posts
    };

    if (type) {
      where.type = type;
    }

    if (hashtag) {
      const tag = await prisma.hashtag.findUnique({ where: { slug: hashtag } });
      if (tag) {
        where.hashtags = {
          some: {
            hashtagId: tag.id,
          },
        };
      } else {
        return {
          posts: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }
    }

    // Following filter: restrict to companies current user follows
    if (following) {
      if (!userId) {
        return {
          posts: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }
      const follows = await prisma.follow.findMany({
        where: { userId },
        select: { companyId: true },
      });
      const followedCompanyIds = follows.map((f) => f.companyId);
      if (followedCompanyIds.length === 0) {
        return {
          posts: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }
      if (companyId) {
        // Intersect with selected companyId to ensure only followed companies
        const intersection = followedCompanyIds.filter((id) => id === companyId);
        if (intersection.length === 0) {
          return {
            posts: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
          };
        }
        where.companyId = { in: intersection };
      } else {
        where.companyId = { in: followedCompanyIds };
      }
    } else if (companyId) {
      where.companyId = companyId;
    }

    // Get posts with pagination
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          images: {
            select: { id: true, url: true, width: true, height: true, order: true, storageKey: true },
            orderBy: { order: 'asc' },
          },
          postJobs: {
            include: { job: { select: { id: true, title: true, location: true, employmentType: true, isActive: true } } },
          },
          hashtags: {
            include: {
              hashtag: {
                select: { id: true, slug: true, label: true },
              },
            },
          },
          likes: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              likes: true,
            },
          },
        },
      }),
      prisma.post.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Check reactions and favorites for each post
    const postsWithLikes: PostWithLikes[] = [];
    for (const post of posts) {
      let isLiked = false;
      let isSaved = false;
      let userReaction: 'JOY' | 'TRUST' | 'SKEPTIC' | null = null;
      const reactions = { JOY: 0, TRUST: 0, SKEPTIC: 0 };
      reactions.JOY = await prisma.postReaction.count({ where: { postId: post.id, type: 'JOY' as any } });
      reactions.TRUST = await prisma.postReaction.count({ where: { postId: post.id, type: 'TRUST' as any } });
      reactions.SKEPTIC = await prisma.postReaction.count({ where: { postId: post.id, type: 'SKEPTIC' as any } });
      if (userId) {
        const like = await prisma.like.findUnique({
          where: {
            userId_postId: {
              userId,
              postId: post.id,
            },
          },
        });
        isLiked = !!like;
        const myReaction = await prisma.postReaction.findUnique({
          where: { userId_postId: { userId, postId: post.id } },
        });
        userReaction = (myReaction?.type as any) ?? null;
        const favorite = await prisma.postFavorite.findUnique({
          where: {
            userId_postId: { userId, postId: post.id },
          },
        });
        isSaved = !!favorite;
      }

      postsWithLikes.push({
        ...mapPostEntity(post),
        isLiked,
        isSaved,
        reactions,
        userReaction,
      });
    }

    return {
      posts: postsWithLikes,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Save post to favorites
  async addFavorite(postId: string, userId: string): Promise<void> {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    }
    const existing = await prisma.postFavorite.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (existing) return;
    await prisma.postFavorite.create({
      data: { userId, postId },
    });
  }

  // Remove from favorites
  async removeFavorite(postId: string, userId: string): Promise<void> {
    const existing = await prisma.postFavorite.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (!existing) {
      throw new AppError('Post not saved', 404, 'POST_NOT_SAVED');
    }
    await prisma.postFavorite.delete({
      where: { userId_postId: { userId, postId } },
    });
  }

  // Get my saved posts
  async getMyFavorites(userId: string, data: { page: number; limit: number }): Promise<{
    favorites: Array<{
      id: string;
      createdAt: Date;
      post: PostWithLikes;
    }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { page, limit } = data;
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      prisma.postFavorite.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          post: {
            include: {
              company: { select: { id: true, name: true, slug: true, logoUrl: true } },
              images: { select: { id: true, url: true, width: true, height: true, order: true }, orderBy: { order: 'asc' } },
              createdBy: { select: { id: true, email: true, name: true } },
              likes: {
                include: {
                  user: { select: { id: true, name: true } },
                },
              },
              _count: { select: { likes: true } },
              hashtags: {
                include: {
                  hashtag: {
                    select: { id: true, slug: true, label: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.postFavorite.count({ where: { userId } }),
    ]);

    return {
      favorites: favorites.map((fav) => {
        const mapped = mapPostEntity(fav.post as any);
        const liked = (fav.post.likes ?? []).some((like: any) => like.userId === userId);
        return {
          id: fav.id,
          createdAt: fav.createdAt,
          post: {
            ...mapped,
            isLiked: liked,
            isSaved: true,
          },
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Like post
  async likePost(postId: string, userId: string): Promise<void> {
    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    }

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (existingLike) {
      throw new AppError('Post already liked', 409, 'ALREADY_LIKED');
    }

    // Create like
    await prisma.like.create({
      data: {
        userId,
        postId,
      },
    });
  }

  // Unlike post
  async unlikePost(postId: string, userId: string): Promise<void> {
    // Check if like exists
    const like = await prisma.like.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (!like) {
      throw new AppError('Post not liked', 404, 'NOT_LIKED');
    }

    // Delete like
    await prisma.like.delete({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });
  }

  // Publish post
  async publishPost(postId: string, userId: string): Promise<void> {
    // Get post with company info
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        company: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!post) {
      throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    }

    // Check if user is member of company
    const membership = post.company.members[0];
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new AppError('You do not have permission to publish this post', 403, 'FORBIDDEN');
    }

    // Publish post
    await prisma.post.update({
      where: { id: postId },
      data: {
        publishedAt: new Date(),
      },
    });

    await prisma.postAuditLog.create({
      data: {
        postId,
        actorId: userId,
        action: PostAuditAction.PUBLISH,
        metadata: {
          postId,
        },
      },
    });
  }

  // Unpublish post
  async unpublishPost(postId: string, userId: string): Promise<void> {
    // Get post with company info
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        company: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!post) {
      throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    }

    // Check if user is member of company
    const membership = post.company.members[0];
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new AppError('You do not have permission to unpublish this post', 403, 'FORBIDDEN');
    }

    // Unpublish post
    await prisma.post.update({
      where: { id: postId },
      data: {
        publishedAt: null,
      },
    });

    await prisma.postAuditLog.create({
      data: {
        postId,
        actorId: userId,
        action: PostAuditAction.UNPUBLISH,
        metadata: {
          postId,
        },
      },
    });
  }

  // Delete post
  async deletePost(postId: string, userId: string): Promise<void> {
    // Get post with company info
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        company: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
        images: {
          select: {
            storageKey: true,
          },
        },
      },
    });

    if (!post) {
      throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    }

    // Check permissions
    const membership = post.company.members[0];
    if (!membership) {
      throw new AppError('You do not have permission to delete this post', 403, 'FORBIDDEN');
    }
    const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(membership.role);
    const isMemberDeletingOwnPost = membership.role === 'MEMBER' && post.createdById === userId;
    if (!(isOwnerOrAdmin || isMemberDeletingOwnPost)) {
      throw new AppError('You do not have permission to delete this post', 403, 'FORBIDDEN');
    }

    const imageKeys = ((post as any).images || [])
      .map((image: any) => image.storageKey)
      .filter((key: any): key is string => Boolean(key));

    if (imageKeys.length) {
      await deleteS3Objects(imageKeys);
    }

    await prisma.postAuditLog.create({
      data: {
        postId,
        actorId: userId,
        action: PostAuditAction.DELETE,
        metadata: {
          postId,
          title: post.title,
          companyId: post.companyId,
          imageCount: imageKeys.length,
        },
      },
    });

    await prisma.post.delete({
      where: { id: postId },
    });
  }

  // React to post (create or change)
  async reactPost(postId: string, userId: string, type: 'JOY' | 'TRUST' | 'SKEPTIC'): Promise<void> {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    const existing = await prisma.postReaction.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (!existing) {
      await prisma.postReaction.create({ data: { userId, postId, type: type as any } });
      return;
    }
    if (existing.type !== (type as any)) {
      await prisma.postReaction.update({ where: { id: existing.id }, data: { type: type as any } });
    }
  }

  // Remove reaction
  async removeReaction(postId: string, userId: string): Promise<void> {
    const existing = await prisma.postReaction.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (!existing) throw new AppError('Reaction not found', 404, 'REACTION_NOT_FOUND');
    await prisma.postReaction.delete({ where: { id: existing.id } });
  }
}
