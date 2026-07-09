import { FastifyReply, FastifyRequest } from 'fastify';

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
    const payload = req.user as { sub: string; role: 'ADMIN' | 'MERCHANT' | 'CUSTOMER'; email: string };
    req.authUser = { id: payload.sub, role: payload.role, email: payload.email };
  } catch {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing access token' });
    throw new Error('Unauthorized');
  }
}