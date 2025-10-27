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
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export const config = envSchema.parse(process.env);

export type Config = z.infer<typeof envSchema>;
