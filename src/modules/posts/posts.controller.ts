import { FastifyRequest, FastifyReply } from 'fastify';
import { PostsService } from './posts.service';
import {
  createPostSchema,
  updatePostSchema,
  getPostSchema,
  getCompanyPostsSchema,
  getFeedPostsSchema,
  likePostSchema,
  unlikePostSchema,
  publishPostSchema,
  unpublishPostSchema,
} from './posts.schema';

export class PostsController {
  constructor(private postsService: PostsService) {}

  // Create post
  async createPost(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { companyId } = request.params as { companyId: string };
    const data = createPostSchema.parse(request.body);
    
    const post = await this.postsService.createPost(companyId, userId, data);
    
    return reply.status(201).send({
      data: { post },
    });
  }

  // Update post
  async updatePost(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { postId } = getPostSchema.parse(request.params);
    const data = updatePostSchema.parse(request.body);
    
    const post = await this.postsService.updatePost(postId, userId, data);
    
    return reply.send({
      data: { post },
    });
  }

  // Get post by ID
  async getPost(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { postId } = getPostSchema.parse(request.params);
    
    const post = await this.postsService.getPostById(postId, userId);
    
    if (!post) {
      return reply.status(404).send({
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found',
        },
      });
    }

    return reply.send({
      data: { post },
    });
  }

  // Get company posts
  async getCompanyPosts(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { companyId } = request.params as { companyId: string };
    const queryData = getCompanyPostsSchema.parse(request.query);
    
    const result = await this.postsService.getCompanyPosts(
      { ...queryData, companyId },
      userId
    );
    
    return reply.send({
      data: result,
    });
  }

  // Get feed posts
  async getFeedPosts(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = getFeedPostsSchema.parse(request.query);
    
    const result = await this.postsService.getFeedPosts(data, userId);
    
    return reply.send({
      data: result,
    });
  }

  // Like post
  async likePost(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { postId } = likePostSchema.parse(request.params);
    
    await this.postsService.likePost(postId, userId);
    
    return reply.status(201).send({
      data: {
        message: 'Post liked successfully',
      },
    });
  }

  // Unlike post
  async unlikePost(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { postId } = unlikePostSchema.parse(request.params);
    
    await this.postsService.unlikePost(postId, userId);
    
    return reply.send({
      data: {
        message: 'Post unliked successfully',
      },
    });
  }

  // Publish post
  async publishPost(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { postId } = publishPostSchema.parse(request.params);
    
    await this.postsService.publishPost(postId, userId);
    
    return reply.send({
      data: {
        message: 'Post published successfully',
      },
    });
  }

  // Unpublish post
  async unpublishPost(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { postId } = unpublishPostSchema.parse(request.params);
    
    await this.postsService.unpublishPost(postId, userId);
    
    return reply.send({
      data: {
        message: 'Post unpublished successfully',
      },
    });
  }

  // Delete post
  async deletePost(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { postId } = getPostSchema.parse(request.params);
    
    await this.postsService.deletePost(postId, userId);
    
    return reply.send({
      data: {
        message: 'Post deleted successfully',
      },
    });
  }
}
