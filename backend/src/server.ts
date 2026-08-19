import { buildApp } from './app';
import { env } from './config/env';
import { startWorkers, stopWorkers } from './jobs/queue';
import { closeRedis, initRedis } from './config/redis';
import { prisma } from './config/db';
import { ensureChartSeeded } from './modules/accounting/accounting.service';
import { networkInterfaces } from 'os';

async function main(): Promise<void> {
  await initRedis();
  const app = await buildApp();
  await ensureChartSeeded().catch((e) => app.log.warn({ err: e }, 'OHADA chart seed skipped'));
  await startWorkers();

  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  // Log all network interfaces for debugging
  const nets = networkInterfaces();
  app.log.info('=== Network Interfaces ===');
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        app.log.info(`  ${name}: ${net.address}`);
      }
    }
  }
  app.log.info(`WATSIM backend listening on http://0.0.0.0:${env.PORT}${env.API_PREFIX}`);
  app.log.info(`Test from phone: http://<IP_ABOVE>:${env.PORT}/health`);

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    try {
      await app.close();
      await stopWorkers();
      await closeRedis();
      await prisma.$disconnect();
      process.exit(0);
    } catch (e) {
      app.log.error(e);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
