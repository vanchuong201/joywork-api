import { FastifyRequest } from 'fastify';
import { AuthService } from '@/modules/auth/auth.service';

// Global auth service instance
let authService: AuthService | null = null;

export function setAuthService(service: AuthService) {
  authService = service;
}

export function getAuthService(): AuthService {
  if (!authService) {
    throw new Error('AuthService not initialized');
  }
  return authService;
}

// Helper to get user from request
export function getUserFromRequest(request: FastifyRequest): { userId: string } | null {
  return (request as any).user || null;
}

// Helper to check if user is authenticated
export function isAuthenticated(request: FastifyRequest): boolean {
  return !!(request as any).user;
}
