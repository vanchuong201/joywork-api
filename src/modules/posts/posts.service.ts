import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import {
  CreatePostInput,
  UpdatePostInput,
  GetPostInput,
  GetCompanyPostsInput,
  GetFeedPostsInput,
  LikePostInput,
  UnlikePostInput,
  PublishPostInput,
  UnpublishPostInput,
} from './posts.schema';

export interface Post {
  id: string;
  companyId: string;
  title: string;
  content: string;
  excerpt?: string;
  type: string;
  visibility: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  company: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
  };
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

export class PostsService {
  // Create post
  async createPost(companyId: string, userId: string, data: CreatePostInput): Promise<Post> {
    // Check if user is member of company
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        role: { in: ['OWNER', 'ADMIN', 'MEMBER'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to create posts for this company', 403, 'FORBIDDEN');
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        ...data,
        companyId,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
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

    return {
      id: post.id,
      companyId: post.companyId,
      title: post.title,
      content: post.content,
      excerpt: post.excerpt,
      type: post.type,
      visibility: post.visibility,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      company: post.company,
      likes: post.likes.map(like => ({
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
      },
    });

    if (!post) {
      throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    }

    // Check if user is member of company
    const membership = post.company.members[0];
    if (!membership || !['OWNER', 'ADMIN', 'MEMBER'].includes(membership.role)) {
      throw new AppError('You do not have permission to update this post', 403, 'FORBIDDEN');
    }

    // Update post
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        ...data,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
        updatedAt: new Date(),
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

    return {
      id: updatedPost.id,
      companyId: updatedPost.companyId,
      title: updatedPost.title,
      content: updatedPost.content,
      excerpt: updatedPost.excerpt,
      type: updatedPost.type,
      visibility: updatedPost.visibility,
      publishedAt: updatedPost.publishedAt,
      createdAt: updatedPost.createdAt,
      updatedAt: updatedPost.updatedAt,
      company: updatedPost.company,
      likes: updatedPost.likes.map(like => ({
        id: like.id,
        userId: like.userId,
        user: {
          id: like.user.id,
          name: like.user.name,
        },
      })),
      _count: updatedPost._count,
    };
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

    return {
      id: post.id,
      companyId: post.companyId,
      title: post.title,
      content: post.content,
      excerpt: post.excerpt,
      type: post.type,
      visibility: post.visibility,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      company: post.company,
      likes: post.likes.map(like => ({
        id: like.id,
        userId: like.userId,
        user: {
          id: like.user.id,
          name: like.user.name,
        },
      })),
      _count: post._count,
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
        id: post.id,
        companyId: post.companyId,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        type: post.type,
        visibility: post.visibility,
        publishedAt: post.publishedAt,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        company: post.company,
        likes: post.likes.map(like => ({
          id: like.id,
          userId: like.userId,
          user: {
            id: like.user.id,
            name: like.user.name,
          },
        })),
        _count: post._count,
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
        id: post.id,
        companyId: post.companyId,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        type: post.type,
        visibility: post.visibility,
        publishedAt: post.publishedAt,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        company: post.company,
        likes: post.likes.map(like => ({
          id: like.id,
          userId: like.userId,
          user: {
            id: like.user.id,
            name: like.user.name,
          },
        })),
        _count: post._count,
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
    if (!membership || !['OWNER', 'ADMIN', 'MEMBER'].includes(membership.role)) {
      throw new AppError('You do not have permission to publish this post', 403, 'FORBIDDEN');
    }

    // Publish post
    await prisma.post.update({
      where: { id: postId },
      data: {
        publishedAt: new Date(),
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
    if (!membership || !['OWNER', 'ADMIN', 'MEMBER'].includes(membership.role)) {
      throw new AppError('You do not have permission to unpublish this post', 403, 'FORBIDDEN');
    }

    // Unpublish post
    await prisma.post.update({
      where: { id: postId },
      data: {
        publishedAt: null,
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

    // Delete post
    await prisma.post.delete({
      where: { id: postId },
    });
  }
}
