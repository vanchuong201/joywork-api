import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/shared/database/prisma';
import { config } from '@/config/env';
import { AppError } from '@/shared/errors/errorHandler';
import {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  ChangePasswordInput,
} from './auth.schema';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export class AuthService {
  // Register new user
  async register(data: RegisterInput): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const { email, password, name, phone } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError('Email này đã được sử dụng', 409, 'USER_EXISTS');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        phone: phone || null,
      },
    });

    // Generate tokens
    const tokens = this.generateTokens(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tokens,
    };
  }

  // Login user
  async login(data: LoginInput): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const { email, password } = data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const tokens = this.generateTokens(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tokens,
    };
  }

  // Refresh access token
  async refreshToken(data: RefreshTokenInput): Promise<{ tokens: AuthTokens }> {
    const { refreshToken } = data;

    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, config.REFRESH_SECRET) as { userId: string };

      // Check if user still exists
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user.id);

      return { tokens };
    } catch (error) {
      throw new AppError('Phiên đăng nhập đã hết hạn', 401, 'INVALID_REFRESH_TOKEN');
    }
  }

  // Change password
  async changePassword(userId: string, data: ChangePasswordInput): Promise<void> {
    const { currentPassword, newPassword } = data;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new AppError('Mật khẩu hiện tại không đúng', 400, 'INVALID_CURRENT_PASSWORD');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });
  }

  // Get user by ID
  async getUserById(userId: string): Promise<AuthUser | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return user;
  }

  // Generate JWT tokens
  private generateTokens(userId: string): AuthTokens {
    const accessToken = jwt.sign(
      { userId },
      config.JWT_SECRET,
      { expiresIn: '15d' }
    );

    const refreshToken = jwt.sign(
      { userId },
      config.REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  // Verify access token
  async verifyAccessToken(token: string): Promise<{ userId: string }> {
    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as { userId: string };
      return payload;
    } catch (error) {
      throw new AppError('Phiên đăng nhập không hợp lệ', 401, 'INVALID_ACCESS_TOKEN');
    }
  }
}
