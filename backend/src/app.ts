import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
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
    trustProxy: process.env.TRUST_PROXY !== 'false',
    bodyLimit: 10 * 1024 * 1024,
  });

  // Capture the raw request body for webhook signature verification while
  // keeping normal JSON parsing behaviour for all routes.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const raw = (body as string) || '';
      (req as { rawBody?: string }).rawBody = raw;
      done(null, raw.length ? JSON.parse(raw) : {});
    } catch (err) {
      (err as { statusCode?: number }).statusCode = 400;
      done(err as Error, undefined);
    }
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: env.NODE_ENV === 'production' ? [env.FRONTEND_URL] : true,
    credentials: true,
  });
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_EXPIRY },
  });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(websocket);
  await registerRateLimit(app);

  // KYC documents must never be publicly served. New files are written to
  // uploads-private/ (outside the static root); block any legacy kyc_* files
  // that may still live under uploads/ as well.
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/uploads/kyc_')) {
      return reply.code(404).send({ error: 'NotFound', message: 'Not found' });
    }
  });

  // Static file serving for uploads (public assets only: product, profile,
  // publicity images). KYC documents are served via the authenticated
  // /auth/kyc/file/:filename route instead.
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

  // SMS balance check (admin utility — requires authenticated admin)
  app.get('/sms-balance', { preHandler: [authenticate] }, async (req, reply) => {
    if (req.authUser?.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }
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

    const buffer = await data.toBuffer();

    // Per-image size sanity limit (consistent with multipart/body limits).
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    if (buffer.length > MAX_IMAGE_BYTES) {
      return reply.code(400).send({ error: 'BadRequest', message: 'Image too large (max 5MB)' });
    }

    // Verify magic bytes — never trust the client-supplied filename/mimetype.
    // Extension is derived from the detected content type, not the upload.
    function detectImageType(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
      if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
      if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
        && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return 'png';
      if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
      return null;
    }

    const detected = detectImageType(buffer);
    if (!detected) {
      return reply.code(400).send({ error: 'BadRequest', message: 'Unsupported or invalid image. Use JPEG, PNG, or WebP.' });
    }
    const filename = `${randomUUID()}.${detected}`;
    const uploadDir = resolve(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });
    const filepath = resolve(uploadDir, filename);

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
