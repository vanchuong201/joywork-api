import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { AppError } from '@/shared/errors/errorHandler';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    userId: string;
  };
}

export class AuthMiddleware {
  constructor(private authService: AuthService) {}

  // Verify JWT token
  async verifyToken(request: AuthenticatedRequest, _reply: FastifyReply) {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('Access token required', 401, 'TOKEN_REQUIRED');
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const payload = await this.authService.verifyAccessToken(token);
      
      request.user = { userId: payload.userId };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }
  }

  // Optional auth - doesn't throw error if no token
  async optionalAuth(request: AuthenticatedRequest, _reply: FastifyReply) {
    try {
      const authHeader = request.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = await this.authService.verifyAccessToken(token);
        request.user = { userId: payload.userId };
      }
    } catch (error) {
      // Ignore errors for optional auth
    }
  }

  // Check if user is admin
  async requireAdmin(request: AuthenticatedRequest, _reply: FastifyReply) {
    if (!request.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const user = await this.authService.getUserById(request.user.userId);
    
    if (!user || user.role !== 'ADMIN') {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }
  }
}
