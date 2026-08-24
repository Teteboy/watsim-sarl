import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { simulateSchema, purchaseSchema, repaySchema } from './bnpl.schema';
import { BnplError, createPurchase, getPurchase, repayInstalment, simulate } from './bnpl.service';
import { BnplContributionError, transferContribution, withdrawContribution } from './bnpl-contributions.service';

export async function bnplRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', authorize('CUSTOMER'));

  app.post('/simulate', { schema: simulateSchema }, async (req, reply) => {
    const { productId, instalmentCount, frequency, downPayment } = req.body as { productId: string; instalmentCount: number; frequency?: any; downPayment?: number };
    try {
      const result = await simulate(productId, instalmentCount, frequency, downPayment ?? 0, req.authUser!.id);
      // Flatten fees to top level for backward compatibility with mobile app
      return {
        ...result,
        fees: result.plan.fees,
      };
    } catch (e) {
      if (e instanceof BnplError) return reply.code(e.statusCode).send({ error: 'BnplError', message: e.message });
      throw e;
    }
  });

  app.post('/purchase', { schema: purchaseSchema }, async (req, reply) => {
    try {
      const body = req.body as Parameters<typeof createPurchase>[1];
      return await createPurchase(req.authUser!.id, body);
    } catch (e) {
      if (e instanceof BnplError) return reply.code(e.statusCode).send({ error: 'BnplError', message: e.message });
      throw e;
    }
  });

  app.get('/purchases/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      return await getPurchase(req.authUser!.id, id);
    } catch (e) {
      if (e instanceof BnplError) return reply.code(e.statusCode).send({ error: 'BnplError', message: e.message });
      throw e;
    }
  });

  app.post('/purchases/:id/repay', { schema: repaySchema }, async (req, reply) => {
    try {
      const body = req.body as Parameters<typeof repayInstalment>[1];
      return await repayInstalment(req.authUser!.id, body);
    } catch (e) {
      if (e instanceof BnplError) return reply.code(e.statusCode).send({ error: 'BnplError', message: e.message });
      throw e;
    }
  });

  app.post('/purchases/:id/withdraw', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return await withdrawContribution(req.authUser!.id, id);
    } catch (e) {
      if (e instanceof BnplContributionError) return reply.code(e.statusCode).send({ error: 'BnplContributionError', message: e.message });
      throw e;
    }
  });

  app.post('/purchases/:id/transfer', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { recipientIdentifier } = req.body as { recipientIdentifier: string };
      return await transferContribution(req.authUser!.id, id, recipientIdentifier);
    } catch (e) {
      if (e instanceof BnplContributionError) return reply.code(e.statusCode).send({ error: 'BnplContributionError', message: e.message });
      throw e;
    }
  });
}
