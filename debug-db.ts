import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Test simple query
    const userCount = await prisma.user.count();
    console.log(`✅ User count: ${userCount}`);
    
    // Test create user
    const newUser = await prisma.user.create({
      data: {
        email: 'test-debug@example.com',
        password: 'hashed_password',
        name: 'Debug User',
      },
    });
    console.log('✅ User created:', newUser.id);
    
    // Clean up
    await prisma.user.delete({
      where: { id: newUser.id },
    });
    console.log('✅ User deleted');
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
