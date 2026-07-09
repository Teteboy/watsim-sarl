import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
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
      twoFAEnabled?: boolean;
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

  // POST /users/me/security/unfreeze - Request unfreeze (requires admin approval in real scenario)
  app.post('/me/security/unfreeze', async (req, reply) => {
    const userId = req.authUser!.id;
    
    // In production, this might require admin approval or verification
    await unfreezeAccount(userId);
    return { success: true, message: 'Account unfrozen successfully' };
  });
}
