import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { prisma } from '@/shared/database/prisma';
import { config } from '@/config/env';
import { AppError } from '@/shared/errors/errorHandler';
import { emailService } from '@/shared/services/email.service';
import {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
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
  emailVerified?: boolean;
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
        emailVerified: false,
      },
    });

    // Generate verification token
    const verificationToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Token expires in 7 days

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt,
      },
    });

    // Send verification email
    const verificationUrl = `${config.FRONTEND_ORIGIN}/verify-email?token=${verificationToken}`;
    try {
      await emailService.sendVerificationEmail(email, name || null, verificationUrl);
    } catch (error) {
      // Log error but don't fail registration
      console.error('Failed to send verification email:', error);
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
        emailVerified: true,
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

  // Verify email
  async verifyEmail(token: string): Promise<void> {
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verificationToken) {
      throw new AppError('Mã xác thực không hợp lệ', 400, 'INVALID_TOKEN');
    }

    if (verificationToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      });
      throw new AppError('Mã xác thực đã hết hạn', 400, 'TOKEN_EXPIRED');
    }

    // Update user emailVerified status
    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    });

    // Delete used token
    await prisma.emailVerificationToken.delete({
      where: { id: verificationToken.id },
    });
  }

  // Resend verification email
  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
    }

    if (user.emailVerified) {
      throw new AppError('Email đã được xác thực', 400, 'ALREADY_VERIFIED');
    }

    // Delete old tokens for this user
    await prisma.emailVerificationToken.deleteMany({
      where: { userId },
    });

    // Generate new verification token
    const verificationToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt,
      },
    });

    // Send verification email
    const verificationUrl = `${config.FRONTEND_ORIGIN}/verify-email?token=${verificationToken}`;
    try {
      await emailService.sendVerificationEmail(user.email, user.name, verificationUrl);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new AppError('Không thể gửi email xác thực', 500, 'EMAIL_SEND_FAILED');
    }
  }

  // Forgot password - send reset email
  async forgotPassword(data: ForgotPasswordInput): Promise<void> {
    const { email } = data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Don't reveal if email exists or not (security best practice)
    if (!user) {
      // Still return success to prevent email enumeration
      return;
    }

    // Delete old reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Generate reset token
    const resetToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt,
      },
    });

    // Send reset email
    const resetUrl = `${config.FRONTEND_ORIGIN}/reset-password?token=${resetToken}`;
    try {
      await emailService.sendPasswordResetEmail(user.email, user.name, resetUrl);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      // Don't throw error to prevent email enumeration
    }
  }

  // Reset password with token
  async resetPassword(data: ResetPasswordInput): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const { token, newPassword } = data;

    // Find reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new AppError('Mã đặt lại mật khẩu không hợp lệ', 400, 'INVALID_TOKEN');
    }

    if (resetToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
      throw new AppError('Mã đặt lại mật khẩu đã hết hạn', 400, 'TOKEN_EXPIRED');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    // Delete used token
    await prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    });

    // Generate tokens for auto login
    const tokens = this.generateTokens(resetToken.userId);

    return {
      user: {
        id: resetToken.user.id,
        email: resetToken.user.email,
        name: resetToken.user.name,
        role: resetToken.user.role,
      },
      tokens,
    };
  }
}
