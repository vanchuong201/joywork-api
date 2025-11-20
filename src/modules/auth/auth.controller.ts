import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
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
          message: 'Không tìm thấy refresh token',
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
        message: 'Đăng xuất thành công',
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
        message: 'Đổi mật khẩu thành công',
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
          message: 'Không tìm thấy người dùng',
        },
      });
    }

    return reply.send({
      data: { user },
    });
  }

  // Verify email
  async verifyEmail(request: FastifyRequest, reply: FastifyReply) {
    const { token } = request.query as { token: string };
    
    if (!token) {
      return reply.status(400).send({
        error: {
          code: 'TOKEN_REQUIRED',
          message: 'Mã xác thực là bắt buộc',
        },
      });
    }

    await this.authService.verifyEmail(token);

    return reply.send({
      data: {
        message: 'Email đã được xác thực thành công',
      },
    });
  }

  // Resend verification email
  async resendVerificationEmail(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    
    await this.authService.resendVerificationEmail(userId);

    return reply.send({
      data: {
        message: 'Email xác thực đã được gửi lại',
      },
    });
  }

  // Forgot password
  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const data = forgotPasswordSchema.parse(request.body);
    
    await this.authService.forgotPassword(data);

    // Always return success to prevent email enumeration
    return reply.send({
      data: {
        message: 'Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu đến email của bạn.',
      },
    });
  }

  // Reset password
  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const data = resetPasswordSchema.parse(request.body);
    
    const result = await this.authService.resetPassword(data);
    
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
        message: 'Mật khẩu đã được đặt lại thành công',
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    });
  }
}
