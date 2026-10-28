import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../config/db';

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing access token' });
    throw new Error('Unauthorized');
  }

  const payload = req.user as { sub: string; role: 'ADMIN' | 'MERCHANT' | 'CUSTOMER'; email: string };
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      isActive: true,
      adminRole: true,
      securitySettings: { select: { accountFrozen: true } },
    },
  });

  // Enforce isActive for ALL roles (not just ADMIN): suspended/deactivated
  // accounts must not be able to use existing access tokens.
  if (!user || !user.isActive) {
    reply.code(403).send({ error: 'AccountSuspended', message: 'This account is suspended or deactivated' });
    throw new Error('AccountSuspended');
  }

  if (payload.role === 'ADMIN' && !user.adminRole) {
    reply.code(403).send({ error: 'Forbidden', message: 'Admin access required' });
    throw new Error('Forbidden');
  }

  // Enforce the self-service account freeze (see services/security.service.ts).
  // The unfreeze endpoint itself stays reachable so the user can re-authenticate
  // with a fresh credential (PIN/password) to lift the freeze.
  const isUnfreezeRequest = req.url.endsWith('/me/security/unfreeze');
  if (user.securitySettings?.accountFrozen && !isUnfreezeRequest) {
    reply.code(403).send({ error: 'AccountFrozen', message: 'This account is frozen. Contact support to unfreeze.' });
    throw new Error('AccountFrozen');
  }

  req.authUser = { id: payload.sub, role: payload.role, email: payload.email, adminRole: user.adminRole };
}
