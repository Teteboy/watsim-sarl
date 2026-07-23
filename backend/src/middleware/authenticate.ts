import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../config/db';

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
    const payload = req.user as { sub: string; role: 'ADMIN' | 'MERCHANT' | 'CUSTOMER'; email: string };
    const admin = payload.role === 'ADMIN'
      ? await prisma.user.findUnique({ where: { id: payload.sub }, select: { adminRole: true, isActive: true } })
      : null;
    if (payload.role === 'ADMIN' && (!admin?.isActive || !admin.adminRole)) throw new Error('Unauthorized');
    req.authUser = { id: payload.sub, role: payload.role, email: payload.email, adminRole: admin?.adminRole };
  } catch {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing access token' });
    throw new Error('Unauthorized');
  }
}