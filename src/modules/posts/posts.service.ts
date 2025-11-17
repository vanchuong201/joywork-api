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
}

export interface PostWithLikes extends Post {
  isLiked: boolean;
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
  };
}

export class PostsService {
  // Create post
  async createPost(companyId: string, userId: string, data: CreatePostInput): Promise<Post> {
    const { images, publishNow, publishedAt, ...postData } = data;

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
      data: postDataToCreate,
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

    // Check if user is member of company
    const membership = post.company.members[0];
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
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

    // Check if user liked this post
    let isLiked = false;
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
    }

    const base = mapPostEntity(post);
    return {
      ...base,
      isLiked,
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

    // Check if user liked each post
    const postsWithLikes: PostWithLikes[] = [];
    for (const post of posts) {
      let isLiked = false;
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
      }

      postsWithLikes.push({
        ...mapPostEntity(post),
        isLiked,
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
    const { type, companyId, page, limit } = data;
    const skip = (page - 1) * limit;

    // Build where clause - only public posts
    const where: any = { 
      visibility: 'PUBLIC',
      publishedAt: { not: null }, // Only published posts
    };

    if (type) {
      where.type = type;
    }

    if (companyId) {
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

    // Check if user liked each post
    const postsWithLikes: PostWithLikes[] = [];
    for (const post of posts) {
      let isLiked = false;
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
      }

      postsWithLikes.push({
        ...mapPostEntity(post),
        isLiked,
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
      },
    });

    if (!post) {
      throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    }

    // Check if user is member of company
    const membership = post.company.members[0];
    if (!membership || !['OWNER', 'ADMIN', 'MEMBER'].includes(membership.role)) {
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
}
