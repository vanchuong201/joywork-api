import { z } from 'zod';

// Create post schema
export const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  content: z.string().min(1, 'Content is required').max(10000, 'Content must be less than 10000 characters'),
  excerpt: z.string().max(500, 'Excerpt must be less than 500 characters').optional(),
  type: z.enum(['STORY', 'ANNOUNCEMENT', 'EVENT']).default('STORY'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  publishedAt: z.string().datetime().optional(),
});

// Update post schema
export const updatePostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters').optional(),
  content: z.string().min(1, 'Content is required').max(10000, 'Content must be less than 10000 characters').optional(),
  excerpt: z.string().max(500, 'Excerpt must be less than 500 characters').optional(),
  type: z.enum(['STORY', 'ANNOUNCEMENT', 'EVENT']).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  publishedAt: z.string().datetime().optional(),
});

// Get post schema
export const getPostSchema = z.object({
  postId: z.string().cuid('Invalid post ID'),
});

// Get posts schema (for company posts)
export const getCompanyPostsSchema = z.object({
  companyId: z.string().cuid('Invalid company ID'),
  type: z.enum(['STORY', 'ANNOUNCEMENT', 'EVENT']).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// Feed posts schema (for public feed)
export const getFeedPostsSchema = z.object({
  type: z.enum(['STORY', 'ANNOUNCEMENT', 'EVENT']).optional(),
  companyId: z.string().cuid('Invalid company ID').optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// Like post schema
export const likePostSchema = z.object({
  postId: z.string().cuid('Invalid post ID'),
});

// Unlike post schema
export const unlikePostSchema = z.object({
  postId: z.string().cuid('Invalid post ID'),
});

// Publish post schema
export const publishPostSchema = z.object({
  postId: z.string().cuid('Invalid post ID'),
});

// Unpublish post schema
export const unpublishPostSchema = z.object({
  postId: z.string().cuid('Invalid post ID'),
});

// Types
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type GetPostInput = z.infer<typeof getPostSchema>;
export type GetCompanyPostsInput = z.infer<typeof getCompanyPostsSchema>;
export type GetFeedPostsInput = z.infer<typeof getFeedPostsSchema>;
export type LikePostInput = z.infer<typeof likePostSchema>;
export type UnlikePostInput = z.infer<typeof unlikePostSchema>;
export type PublishPostInput = z.infer<typeof publishPostSchema>;
export type UnpublishPostInput = z.infer<typeof unpublishPostSchema>;
