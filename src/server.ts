import { createApp } from './app';
import { config } from '@/config/env';
import { prisma } from '@/shared/database/prisma';
import { initializeProvinceRegistry } from '@/shared/provinces';

async function start() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    await initializeProvinceRegistry();

    // Create Fastify app
    const app = await createApp();

    // Start server
    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    console.log(`🚀 Server running on http://${config.HOST}:${config.PORT}`);
    console.log(`📚 API Documentation: http://${config.HOST}:${config.PORT}/docs`);
    console.log(`🏥 Health Check: http://${config.HOST}:${config.PORT}/health`);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

start();
