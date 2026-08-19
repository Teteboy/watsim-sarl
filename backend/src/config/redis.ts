import IORedis, { Redis } from 'ioredis';
import { env } from './env';

let connection: Redis | null = null;
let mockInstance: MockRedis | null = null;
let initialized = false;

interface MockRedis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, exFlag?: string, ttl?: number): Promise<string>;
  del(key: string): Promise<number>;
  quit(): Promise<string>;
}

function createMockRedis(): MockRedis {
  const store = new Map<string, string>();

  return {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string, _exFlag?: string, ttl?: number) => {
      store.set(key, value);
      if (ttl) setTimeout(() => store.delete(key), ttl * 1000);
      return 'OK';
    },
    del: async (key: string) => {
      const existed = store.has(key);
      store.delete(key);
      return existed ? 1 : 0;
    },
    quit: async () => 'OK',
  };
}

/**
 * Initialize Redis connection. Call once at startup.
 * If Redis is unavailable, falls back to in-memory mock.
 */
export async function initRedis(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const redisUrl = env.REDIS_URL;
  if (!redisUrl) {
    console.warn('⚠️  No REDIS_URL configured, using in-memory mock');
    mockInstance = createMockRedis();
    return;
  }

  const isTls = redisUrl.startsWith('rediss://');
  const redis = new IORedis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    connectTimeout: 3000,
    retryStrategy: () => null, // No retries during init — we handle fallback ourselves
    ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
  });

  // Must attach error listener BEFORE connect to avoid unhandled error events
  redis.on('error', () => {});

  try {
    await redis.connect();
    await redis.ping();
    connection = redis;
    // Replace the no-op handler with a real one now that we're connected
    redis.removeAllListeners('error');
    redis.on('error', (err) => {
      console.error('Redis error:', err.message);
    });
    console.log('✅ Connected to Redis');
  } catch {
    redis.disconnect(false);
    console.warn('⚠️  Redis unavailable, using in-memory mock (OTP/tokens work but won\'t persist across restarts)');
    mockInstance = createMockRedis();
  }
}

export function getRedis(): Redis | MockRedis {
  if (connection) return connection;
  if (mockInstance) return mockInstance;
  // Fallback if getRedis() is called before initRedis() completes
  mockInstance = createMockRedis();
  return mockInstance;
}

export async function closeRedis(): Promise<void> {
  if (connection) {
    await connection.quit().catch(() => {});
    connection = null;
  }
}
