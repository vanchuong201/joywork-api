import './instrument';

import cluster from 'node:cluster';
import { cpus } from 'node:os';
import * as Sentry from '@sentry/node';
import { createApp } from './app';
import { config } from '@/config/env';
import { prisma } from '@/shared/database/prisma';
import { initializeProvinceRegistry } from '@/shared/provinces';
import { initializeWardRegistry, isWardRegistryTableMissing } from '@/shared/wards';
import { initializeIndices } from '@/shared/elasticsearch/indices';

async function start() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    await initializeProvinceRegistry();
    await initializeWardRegistry();
    if (isWardRegistryTableMissing()) {
      console.warn(
        '⚠️  Bảng ward_registry chưa có trên DB. Chạy: npx prisma migrate deploy — sau đó npm run db:seed:wards nếu cần danh sách phường/xã.',
      );
    }

    // Initialize Elasticsearch indices (non-blocking — falls back to Prisma if unavailable)
    try {
      await initializeIndices();
    } catch (err) {
      console.warn('⚠️  Elasticsearch initialization failed — search will use Prisma fallback:', err);
    }

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
    Sentry.captureException(error);
    await Sentry.close(2000);
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

/**
 * Số worker: env CLUSTER_WORKERS, mặc định = số CPU (tối thiểu 1). Node là đơn luồng
 * cho JS — không cluster thì chỉ dùng 1 core. Cluster cho phép tận dụng hết core
 * cho các request đọc nặng serialize (vd danh sách jobs).
 */
const workerCount = Math.max(1, config.CLUSTER_WORKERS ?? cpus().length);

if (workerCount > 1 && cluster.isPrimary) {
  console.log(`🧩 Cluster primary ${process.pid}: fork ${workerCount} workers`);
  for (let i = 0; i < workerCount; i++) {
    cluster.fork();
  }
  // Tự hồi sinh worker chết để không mất capacity giữa campaign.
  cluster.on('exit', (worker, code, signal) => {
    console.warn(`⚠️  Worker ${worker.process.pid} thoát (code=${code} signal=${signal}) — fork lại`);
    cluster.fork();
  });
} else {
  start();
}
