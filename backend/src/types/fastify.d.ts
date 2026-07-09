import '@fastify/jwt';
import type { UserRole } from '@prisma/client';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: UserRole; email: string };
    user: { sub: string; role: UserRole; email: string };
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: { id: string; role: UserRole; email: string };
  }
}
