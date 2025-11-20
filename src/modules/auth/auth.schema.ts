import { z } from 'zod';

// Register schema
export const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu cần ít nhất 6 ký tự'),
  name: z.string().min(2, 'Tên cần ít nhất 2 ký tự').optional(),
  phone: z
    .string()
    .regex(/^[0-9]*$/, 'Số điện thoại chỉ được chứa chữ số')
    .optional()
    .or(z.literal('')),
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

// Refresh token schema
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token là bắt buộc'),
});

// Change password schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(6, 'Mật khẩu mới cần ít nhất 6 ký tự'),
});

// Forgot password schema
export const forgotPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

// Reset password schema
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Mã xác thực là bắt buộc'),
  newPassword: z.string().min(6, 'Mật khẩu mới cần ít nhất 6 ký tự'),
});

// Types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
