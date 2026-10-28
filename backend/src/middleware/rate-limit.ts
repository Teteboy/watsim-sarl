import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      const u = (req as { authUser?: { id: string } }).authUser;
      return u ? `user:${u.id}` : `ip:${req.ip}`;
    },
    errorResponseBuilder: () => ({
      error: 'TooManyRequests',
      message: 'Rate limit exceeded. Please retry later.',
    }),
  });
}

export const publicRateLimit = { max: 100, timeWindow: '15 minutes' };
export const authedRateLimit = { max: 500, timeWindow: '15 minutes' };
