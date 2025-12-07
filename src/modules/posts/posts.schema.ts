import { z } from 'zod';

const postImageInputSchema = z.object({
  key: z.string().min(1, 'Image key is required'),
  url: z.string().url('Image URL must be valid'),
  width: z.number().int().min(1).max(10000).optional(),
  height: z.number().int().min(1).max(10000).optional(),
  order: z.number().int().min(0).max(99).optional(),
});

// Create post schema
export const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  content: z.string().min(1, 'Content is required').max(10000, 'Content must be less than 10000 characters'),
  excerpt: z.string().max(500, 'Excerpt must be less than 500 characters').optional(),
  type: z.enum(['STORY', 'ANNOUNCEMENT', 'EVENT']).default('STORY'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  publishedAt: z.string().datetime().optional(),
  publishNow: z.boolean().default(true),
  images: z.array(postImageInputSchema).max(8, 'Tối đa 8 ảnh cho mỗi bài viết').optional(),
  jobIds: z.array(z.string()).max(10).optional(),
  // Hashtags: tối đa 5 hashtag, user có thể gõ tự do, backend sẽ normalize
  hashtags: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Hashtag không được để trống')
        .max(50, 'Hashtag tối đa 50 ký tự')
    )
    .max(5, 'Tối đa 5 hashtag cho mỗi bài viết')
    .optional(),
});

// Update post schema
export const updatePostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters').optional(),
  content: z.string().min(1, 'Content is required').max(10000, 'Content must be less than 10000 characters').optional(),
  excerpt: z.string().max(500, 'Excerpt must be less than 500 characters').optional(),
  type: z.enum(['STORY', 'ANNOUNCEMENT', 'EVENT']).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  publishedAt: z.string().datetime().optional(),
  images: z.array(
    z.object({
      id: z.string().optional(),           // existing image id (if updating/reordering)
      key: z.string().optional(),          // storage key for new uploads
      url: z.string().url('Image URL must be valid'),
      width: z.number().int().min(1).max(10000).optional(),
      height: z.number().int().min(1).max(10000).optional(),
      order: z.number().int().min(0).max(99).optional(),
    })
  ).max(8, 'Tối đa 8 ảnh cho mỗi bài viết').optional(),
  jobIds: z.array(z.string()).max(10).optional(),
  hashtags: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Hashtag không được để trống')
        .max(50, 'Hashtag tối đa 50 ký tự')
    )
    .max(5, 'Tối đa 5 hashtag cho mỗi bài viết')
    .optional(),
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
  hashtag: z.string().optional(), // Filter by hashtag slug
  following: z.coerce.boolean().optional(),
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

// Save/Unsave favorite post schema
export const savePostSchema = z.object({
  postId: z.string().cuid('Invalid post ID'),
});

export const removeFavoritePostSchema = z.object({
  postId: z.string().cuid('Invalid post ID'),
});

// Get my saved posts schema
export const getMySavedPostsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
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
export type SavePostInput = z.infer<typeof savePostSchema>;
export type RemoveFavoritePostInput = z.infer<typeof removeFavoritePostSchema>;
export type GetMySavedPostsInput = z.infer<typeof getMySavedPostsSchema>;
export type PublishPostInput = z.infer<typeof publishPostSchema>;
export type UnpublishPostInput = z.infer<typeof unpublishPostSchema>;
export type PostImageInput = z.infer<typeof postImageInputSchema>;
