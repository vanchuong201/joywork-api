import { FastifyRequest, FastifyReply } from 'fastify';
import { UsersService } from './users.service';
import {
  updateProfileSchema,
  getUserProfileSchema,
  searchUsersSchema,
} from './users.schema';

export class UsersController {
  constructor(private usersService: UsersService) {}

  // Get current user profile
  async getMyProfile(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    
    const user = await this.usersService.getUserProfile(userId);
    
    if (!user) {
      return reply.status(404).send({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    return reply.send({
      data: { user },
    });
  }

  // Update current user profile
  async updateMyProfile(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = updateProfileSchema.parse(request.body);
    
    const profile = await this.usersService.updateProfile(userId, data);
    
    return reply.send({
      data: { profile },
    });
  }

  // Get user profile by ID (public)
  async getUserProfile(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = getUserProfileSchema.parse(request.params);
    
    const user = await this.usersService.getPublicProfile(userId);
    
    if (!user) {
      return reply.status(404).send({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    return reply.send({
      data: { user },
    });
  }

  // Search users
  async searchUsers(request: FastifyRequest, reply: FastifyReply) {
    const data = searchUsersSchema.parse(request.query);
    
    const result = await this.usersService.searchUsers(data);
    
    return reply.send({
      data: result,
    });
  }

  // Get users list (for admin)
  async getUsers(request: FastifyRequest, reply: FastifyReply) {
    const data = searchUsersSchema.parse(request.query);
    
    const result = await this.usersService.searchUsers(data);
    
    return reply.send({
      data: result,
    });
  }
}
