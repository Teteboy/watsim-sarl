import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
// import helmet from '@fastify/helmet'; // Tempor arily disabled due to version mismatch
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import { resolve } from 'path';
import { env } from './config/env';
import { getBackendBaseUrl } from './services/storage-local.service';
import { registerRateLimit } from './middleware/rate-limit';
import { authenticate } from './middleware/authenticate';
import { authRoutes } from './modules/auth/auth.routes';
import { userRoutes } from './modules/users/users.routes';
import { bnplRoutes } from './modules/bnpl/bnpl.routes';
import { merchantPublicRoutes, merchantSelfRoutes } from './modules/merchants/merchants.routes';
import { productRoutes } from './modules/products/products.routes';
import { paymentRoutes } from './modules/payments/payments.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { accountingRoutes } from './modules/accounting/accounting.routes';
import { publicityRoutes } from './modules/publicities/publicities.routes';
import { messagingRoutes } from './modules/messaging/messaging.routes';
import { securityRoutes } from './modules/users/security.routes';
import { supportRoutes } from './modules/users/support.routes';
import { deliveryRoutes } from './modules/delivery/delivery.routes';
import { WebSocketService } from './services/websocket.service';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
          : undefined,
    },
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024,
  });

  // await app.register(helmet, { contentSecurityPolicy: false }); // Temporarily disabled due to version mismatch
  await app.register(cors, {
    origin: env.NODE_ENV === 'production' ? [env.FRONTEND_URL] : true,
    credentials: true,
  });
  await app.register(jwt, {
    secret: { private: env.JWT_ACCESS_SECRET, public: env.JWT_ACCESS_SECRET },
    sign: { expiresIn: env.JWT_ACCESS_EXPIRY },
  });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(websocket);
  await registerRateLimit(app);

  // Static file serving for uploads
  await app.register(staticFiles, {
    root: resolve(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  });

  // Initialize WebSocket service
  new WebSocketService(app);

  app.get('/health', async () => ({ status: 'ok', service: 'watsim-backend', timestamp: new Date().toISOString() }));

  // Diagnostic endpoint for network testing
  app.get('/network-test', async (req) => {
    return {
      status: 'ok',
      yourIp: req.ip,
      timestamp: new Date().toISOString(),
      message: 'If you see this, network connection is working!',
    };
  });

  // SMS balance check (dev/admin utility)
  app.get('/sms-balance', async (_req, reply) => {
    try {
      const { checkSmsBalance } = await import('./services/orange-sms.service');
      const data = await checkSmsBalance();
      return reply.send(data);
    } catch (e: any) {
      return reply.code(500).send({ error: e.message });
    }
  });

  const prefix = env.API_PREFIX;

  // Prevent any client or proxy from caching API responses (mobile must always get fresh data)
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url?.startsWith(prefix)) {
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
    }
    return payload;
  });

  await app.register(authRoutes, { prefix: `${prefix}/auth` });
  await app.register(userRoutes, { prefix: `${prefix}/users` });
  await app.register(securityRoutes, { prefix: `${prefix}/users` });
  await app.register(supportRoutes, { prefix: `${prefix}/users` });
  await app.register(bnplRoutes, { prefix: `${prefix}/bnpl` });
  await app.register(merchantPublicRoutes, { prefix: `${prefix}/merchants` });
  await app.register(merchantSelfRoutes, { prefix: `${prefix}/merchant` });
  await app.register(productRoutes, { prefix: `${prefix}/products` });
  await app.register(paymentRoutes, { prefix: `${prefix}/payments` });
  await app.register(adminRoutes, { prefix: `${prefix}/admin` });
  await app.register(accountingRoutes, { prefix: `${prefix}/admin/accounting` });
  await app.register(publicityRoutes, { prefix: `${prefix}/admin/publicities` });
  await app.register(deliveryRoutes, { prefix: `${prefix}/delivery` });
  
  // Public publicity routes (no auth required)
  app.get(`${prefix}/publicities/active`, async (req, reply) => {
    const { listPublicities } = await import('./modules/publicities/publicities.service');
    const activePublicities = await listPublicities({
      page: 1,
      limit: 10,
      status: 'ACTIVE'
    });
    return reply.send({ publicities: activePublicities.items });
  });

  // Image upload endpoint
  app.post(`${prefix}/upload/image`, { preHandler: [authenticate] }, async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }
    
    const { writeFile } = await import('fs/promises');
    const { randomUUID } = await import('crypto');
    const { mkdir } = await import('fs/promises');
    
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/avif': '.avif',
    };
    const ext = extensions[data.mimetype];
    if (!ext) {
      return reply.code(400).send({ error: 'BadRequest', message: 'Unsupported image format. Use JPEG, PNG, WebP, GIF, or AVIF.' });
    }
    const filename = `${randomUUID()}${ext}`;
    const uploadDir = resolve(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });
    const filepath = resolve(uploadDir, filename);

    const buffer = await data.toBuffer();
    await writeFile(filepath, buffer);

    const url = `/uploads/${filename}`;
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    const fullUrl = host ? `${protocol}://${host}${url}` : `${getBackendBaseUrl()}${url}`;
    return reply.send({ url, fullUrl, filename });
  });

  await app.register(messagingRoutes, { prefix: `${prefix}/messages` });

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    const status = err.statusCode ?? 500;
    // Never leak internal/database errors to clients
    const safeMessage = status >= 500
      ? 'Something went wrong. Please try again later.'
      : err.message;
    reply.code(status).send({
      error: err.name || 'InternalServerError',
      message: safeMessage,
    });
  });

  return app;
}
