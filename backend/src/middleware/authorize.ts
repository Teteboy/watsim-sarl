import { FastifyReply, FastifyRequest } from 'fastify';
import type { UserRole } from '@prisma/client';

export function authorize(...allowed: UserRole[]) {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
if (!req.authUser) {
      reply.code(401).send({ error: 'Unauthorized' });
      throw new Error('Unauthorized');
    }
    if (!allowed.includes(req.authUser.role)) {
      reply.code(403).send({ error: 'Forbidden', message: 'Insufficient role privileges' });
      throw new Error('Forbidden');
    }
  };
}
