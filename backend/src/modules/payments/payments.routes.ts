import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { initiatePaymentSchema, webhookSchema } from './payments.schema';
import { getStatus, initiatePayment, PaymentError } from './payments.service';
import { campayWebhook, mtnWebhook, orangeWebhook } from './payments.webhook';
import { prisma } from '../../config/db';

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  app.post('/initiate', { preHandler: authenticate, schema: initiatePaymentSchema }, async (req, reply) => {
    const body = req.body as { transactionId: string; provider: 'ORANGE_MONEY' | 'MTN_MOMO'; phone: string };
    const tx = await prisma.transaction.findUnique({ where: { id: body.transactionId } });
    if (!tx || tx.userId !== req.authUser!.id) return reply.code(404).send({ error: 'NotFound' });
    if (tx.status !== 'PENDING') return reply.code(400).send({ error: 'BadRequest', message: 'Transaction not pending' });
    try {
      return await initiatePayment({ transactionId: tx.id, amount: tx.amount, provider: body.provider, phone: body.phone, userId: tx.userId });
    } catch (e) {
      if (e instanceof PaymentError) return reply.code(e.statusCode).send({ error: 'PaymentError', message: e.message });
      throw e;
    }
  });

  app.post('/webhook/orange', { schema: webhookSchema }, orangeWebhook);
  app.post('/webhook/mtn', { schema: webhookSchema }, mtnWebhook);
  app.post('/webhook/campay', campayWebhook);

  app.get('/:transactionId/status', { preHandler: authenticate }, async (req, reply) => {
    const { transactionId } = req.params as { transactionId: string };
    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx || tx.userId !== req.authUser!.id) return reply.code(404).send({ error: 'NotFound' });
    try { return await getStatus(transactionId); }
    catch (e) { if (e instanceof PaymentError) return reply.code(e.statusCode).send({ error: 'PaymentError', message: e.message }); throw e; }
  });
}
