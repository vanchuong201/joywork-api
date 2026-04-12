import { FastifyRequest, FastifyReply } from 'fastify';
import { UserProfileService } from './user-profile.service';
import { getUserProfileBySlugSchema, publicProfileQuerySchema, updateProfileSchema } from './users.schema';
import type { AuthenticatedRequest } from '@/modules/auth/auth.middleware';

export class UserProfileController {
  constructor(private userProfileService: UserProfileService) {}

  // Get public profile by slug
  async getPublicProfileBySlug(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = getUserProfileBySlugSchema.parse(request.params);
    const viewerUserId = (request as AuthenticatedRequest).user?.userId ?? null;
    const query = publicProfileQuerySchema.parse(request.query ?? {});

    const profile = await this.userProfileService.getPublicProfileBySlug(slug, viewerUserId, {
      companyId: query.companyId ?? null,
    });
    
    if (!profile) {
      return reply.status(404).send({
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Profile not found or is private',
        },
      });
    }

    return reply.send({
      data: { profile },
    });
  }

  // Get own profile (with full data)
  async getOwnProfile(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    
    const profile = await this.userProfileService.getOwnProfile(userId);
    
    if (!profile) {
      return reply.status(404).send({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    return reply.send({
      data: { profile },
    });
  }

  // Update own profile
  async updateOwnProfile(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = updateProfileSchema.parse(request.body);
    
    const profile = await this.userProfileService.updateProfile(userId, data);
    
    return reply.send({
      data: { profile },
    });
  }
}

