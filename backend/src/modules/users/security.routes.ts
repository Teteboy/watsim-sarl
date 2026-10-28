import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { authenticate } from '../../middleware/authenticate';
import { prisma } from '../../config/db';
import { verifyPin } from '../auth/auth.service';
import {
  getSecuritySettings,
  updateSecuritySettings,
  freezeAccount,
  unfreezeAccount,
} from '../../services/security.service';

export async function securityRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  // GET /users/me/security - Get current security settings
  app.get('/me/security', async (req) => {
    const userId = req.authUser!.id;
    const settings = await getSecuritySettings(userId);
    return { settings };
  });

  // PUT /users/me/security - Update security settings
  app.put('/me/security', async (req, reply) => {
    const userId = req.authUser!.id;
    const body = req.body as {
      fingerprintEnabled?: boolean;
      faceIdEnabled?: boolean;
      irisEnabled?: boolean;
      loginAlertsEnabled?: boolean;
      transactionAlertsEnabled?: boolean;
      accountFrozen?: boolean;
    };

    // Prevent direct unfreezing via settings update
    const { accountFrozen, ...allowedUpdates } = body;

    const settings = await updateSecuritySettings(userId, allowedUpdates);
    return { settings };
  });

  // POST /users/me/security/freeze - Freeze account
  app.post('/me/security/freeze', async (req, reply) => {
    const userId = req.authUser!.id;
    const { reason } = req.body as { reason?: string };

    await freezeAccount(userId, reason);
    return { success: true, message: 'Account frozen successfully' };
  });

  // POST /users/me/security/unfreeze - Unfreeze requires a fresh credential
  // (current PIN or account password) — an access token alone is not enough.
  app.post('/me/security/unfreeze', async (req, reply) => {
    const userId = req.authUser!.id;
    const { pin, password } = (req.body ?? {}) as { pin?: string; password?: string };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ error: 'NotFound', message: 'User not found' });

    let verified = false;
    if (pin && user.pinHash) verified = await verifyPin(pin, user.pinHash);
    if (!verified && password && user.passwordHash) {
      verified = await bcrypt.compare(password, user.passwordHash);
    }
    if (!verified) {
      return reply.code(401).send({ error: 'AuthError', message: 'Valid PIN or password required to unfreeze' });
    }

    await unfreezeAccount(userId);
    return { success: true, message: 'Account unfrozen successfully' };
  });
}
