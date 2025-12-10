import { z } from 'zod';
import { config as loadEnv } from 'dotenv';

// Load environment variables from .env file
loadEnv();

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // JWT Secrets
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  REFRESH_SECRET: z.string().min(32, 'REFRESH_SECRET must be at least 32 characters'),
  
  // Server
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  
  // Frontend
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:3000'),
  
  // API
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),

  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  AWS_REGION: z.string().default('ap-southeast-1'),
  AWS_S3_BUCKET: z.string().min(1, 'AWS_S3_BUCKET is required'),
  
  // Email (AWS SES via SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(), // SMTP username (can be IAM access key or SMTP username)
  SMTP_PASS: z.string().optional(), // SMTP password (can be IAM secret key or SMTP password)
  EMAIL_SENDER: z.string().email().optional(),
  EMAIL_FROM: z.string().email().optional(), // Fallback to EMAIL_SENDER
  FROM_NAME: z.string().optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // OAuth - Google
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // OAuth - Facebook
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),
});

export const config = envSchema.parse(process.env);

export type Config = z.infer<typeof envSchema>;
