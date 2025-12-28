import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { prisma } from '@/shared/database/prisma';
import { config } from '@/config/env';
import { AppError } from '@/shared/errors/errorHandler';
import { emailService } from '@/shared/services/email.service';
import { generateSlug, ensureUniqueSlug } from '../users/user-profile.service';
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
  avatar?: string | null;
  profile?: {
    avatar?: string | null;
  } | null;
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

    // Generate slug from name or email, fallback to a unique identifier
    let slug: string;
    if (name) {
      const baseSlug = generateSlug(name);
      slug = baseSlug ? await ensureUniqueSlug(baseSlug) : await ensureUniqueSlug(`user-${randomUUID().substring(0, 8)}`);
    } else {
      // Use email prefix or generate from email
      const emailPrefix = email.split('@')[0] || email;
      const baseSlug = generateSlug(emailPrefix);
      slug = baseSlug ? await ensureUniqueSlug(baseSlug) : await ensureUniqueSlug(`user-${randomUUID().substring(0, 8)}`);
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        phone: phone || null,
        slug,
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
        avatar: true, // Account avatar
        profile: {
          select: {
            avatar: true, // Profile avatar
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      avatar: user.avatar,
      profile: user.profile ? {
        avatar: user.profile.avatar,
      } : null,
    };
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

  /**
   * Login or register a user via social provider (Google, Facebook, ...)
   *
   * - Nếu đã có UserSocialAccount (provider + providerId) -> đăng nhập user đó
   * - Nếu chưa có:
   *   - Nếu emailFromProvider = true:
   *       * Nếu đã có user với email đó => tự động link social account vào user này
   *       * Nếu chưa có => tạo user mới với email đó
   *   - Nếu emailFromProvider = false (email do user tự nhập, ví dụ từ Facebook không trả email):
   *       * YÊU CẦU email chưa tồn tại trong hệ thống, nếu đã tồn tại -> báo lỗi
   */
  async loginOrRegisterSocialUser(params: {
    provider: 'google' | 'facebook';
    providerId: string;
    email: string;
    emailVerified: boolean;
    name?: string | null;
    emailFromProvider: boolean;
  }): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const { provider, providerId, email, emailVerified, name, emailFromProvider } = params;

    // 1. Tìm link social account nếu đã tồn tại
    const existingLink = await prisma.userSocialAccount.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId,
        },
      },
      include: { user: true },
    });

    let user = existingLink?.user ?? null;

    // 2. Nếu chưa có link, xử lý theo email
    if (!user) {
      const existingUserByEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUserByEmail) {
        if (!emailFromProvider) {
          // Email do user tự nhập (không phải từ provider) thì KHÔNG được phép gộp
          // để tránh chiếm quyền tài khoản đã tồn tại.
          throw new AppError(
            'Email này đã tồn tại trong hệ thống. Vui lòng dùng phương thức đăng nhập khác.',
            400,
            'SOCIAL_EMAIL_ALREADY_EXISTS',
          );
    }

        // Email được provider cung cấp -> cho phép tự động link
        user = existingUserByEmail;
      } else {
        // Tạo user mới
        const randomPassword = randomUUID();
        const hashedPassword = await bcrypt.hash(randomPassword, 12);

        user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            name: name || null,
            emailVerified: emailVerified,
          },
        });
      }

      // Tạo social account link
      try {
        await prisma.userSocialAccount.create({
          data: {
            userId: user.id,
            provider,
            providerId,
            email,
          },
        });
      } catch {
        // Fallback nếu migration chưa được áp dụng (cột email chưa tồn tại)
        await prisma.userSocialAccount.create({
          data: {
            userId: user.id,
            provider,
            providerId,
          },
        });
      }

      // Nếu provider xác nhận email đã verify, cập nhật cờ trong DB (nếu cần)
      if (emailVerified && !user.emailVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });
      }
    }

    const tokens = this.generateTokens(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      tokens,
    };
  }

  // Link social account
  async linkSocialAccount(userId: string, params: { provider: string; providerId: string; email?: string | null }) {
    const { provider, providerId, email } = params;

    // Check if already linked
    const existingLink = await prisma.userSocialAccount.findUnique({
      where: {
        provider_providerId: { provider, providerId },
      },
    });

    if (existingLink) {
      if (existingLink.userId === userId) {
        // Cập nhật email nếu chưa có hoặc khác (khi re-link để bổ sung email)
        if (email && existingLink.email !== email) {
          try {
            await prisma.userSocialAccount.update({
              where: { id: existingLink.id },
              data: { email },
            });
          } catch {
            // bỏ qua nếu cột email chưa tồn tại
          }
        }
        return;
      }
      throw new AppError('Tài khoản này đã được liên kết với người dùng khác', 400, 'SOCIAL_ALREADY_LINKED');
    }

    try {
      await prisma.userSocialAccount.create({
        data: { userId, provider, providerId, email: email ?? null },
      });
    } catch {
      // Fallback nếu migration chưa được áp dụng
      await prisma.userSocialAccount.create({
        data: { userId, provider, providerId },
      });
    }
  }

  // Get linked accounts
  async getLinkedSocialAccounts(userId: string) {
    try {
      const accounts = await prisma.userSocialAccount.findMany({
        where: { userId },
        select: { provider: true, createdAt: true, email: true },
      });
      return accounts;
    } catch {
      // Fallback nếu migration chưa được áp dụng
      const accounts = await prisma.userSocialAccount.findMany({
        where: { userId },
        select: { provider: true, createdAt: true },
    });
      // Map để thêm email = null cho đồng nhất API
      return accounts.map((a: any) => ({ ...a, email: null }));
    }
  }
}
