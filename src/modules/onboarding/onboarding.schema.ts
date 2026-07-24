import { z } from 'zod';

export const onboardingActivateSchema = z.object({
  token: z.string().min(20, 'Token không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

export const onboardingResendSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
});

export type OnboardingActivateInput = z.infer<typeof onboardingActivateSchema>;
export type OnboardingResendInput = z.infer<typeof onboardingResendSchema>;
