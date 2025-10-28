import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from './auth.schema';

export class AuthController {
  constructor(private authService: AuthService) {}

  // Register
  async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = registerSchema.parse(request.body);
      
      const result = await this.authService.register(data);
      
      // Set refresh token as HTTP-only cookie
      reply.setCookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      return reply.status(201).send({
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
        },
      });
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  }

  // Login
  async login(request: FastifyRequest, reply: FastifyReply) {
    const data = loginSchema.parse(request.body);
    
    const result = await this.authService.login(data);
    
    // Set refresh token as HTTP-only cookie
    reply.setCookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return reply.send({
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    });
  }

  // Refresh token
  async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies['refreshToken'];
    
    if (!refreshToken) {
      return reply.status(401).send({
        error: {
          code: 'REFRESH_TOKEN_MISSING',
          message: 'Refresh token not found',
        },
      });
    }

    const data = refreshTokenSchema.parse({ refreshToken });
    const result = await this.authService.refreshToken(data);
    
    // Update refresh token cookie
    reply.setCookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return reply.send({
      data: {
        accessToken: result.tokens.accessToken,
      },
    });
  }

  // Logout
  async logout(_request: FastifyRequest, reply: FastifyReply) {
    // Clear refresh token cookie
    reply.clearCookie('refreshToken', {
      path: '/',
    });

    return reply.send({
      data: {
        message: 'Logged out successfully',
      },
    });
  }

  // Change password
  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = changePasswordSchema.parse(request.body);
    
    await this.authService.changePassword(userId, data);
    
    return reply.send({
      data: {
        message: 'Password changed successfully',
      },
    });
  }

  // Get current user
  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    
    const user = await this.authService.getUserById(userId);
    
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
}
