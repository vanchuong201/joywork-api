import { AuthService } from './src/modules/auth/auth.service';

async function testAuthService() {
  try {
    console.log('Testing AuthService...');
    
    const authService = new AuthService();
    
    // Test register
    const result = await authService.register({
      email: 'test-auth@example.com',
      password: 'password123',
      name: 'Test Auth User',
    });
    
    console.log('✅ Register successful:', result.user.email);
    
    // Test login
    const loginResult = await authService.login({
      email: 'test-auth@example.com',
      password: 'password123',
    });
    
    console.log('✅ Login successful:', loginResult.user.email);
    
    // Clean up
    const { prisma } = await import('./src/shared/database/prisma');
    await prisma.user.delete({
      where: { email: 'test-auth@example.com' },
    });
    console.log('✅ User cleaned up');
    
  } catch (error) {
    console.error('❌ AuthService error:', error);
  }
}

testAuthService();
