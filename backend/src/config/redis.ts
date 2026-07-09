import IORedis, { Redis } from 'ioredis';
import { env } from './env';

let connection: Redis | null = null;

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

export function getRedis(): Redis | MockRedis {
  if (connection) return connection;

  const redisUrl = env.REDIS_URL;

  // Use real Redis if a proper remote URL is configured
  if (redisUrl && !redisUrl.includes('localhost') && !redisUrl.includes('127.0.0.1')) {
    const isTls = redisUrl.startsWith('rediss://');
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times: number) => (times > 5 ? null : Math.min(times * 500, 3000)),
      ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
    });

    connection.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    connection.on('connect', () => {
      console.log('✅ Connected to Redis');
    });

    return connection;
  }

  // Fallback to in-memory mock (good for local dev without Redis)
  return createMockRedis();
}

export async function closeRedis(): Promise<void> {
  if (connection) {
    await connection.quit().catch(() => {});
    connection = null;
  }
}
