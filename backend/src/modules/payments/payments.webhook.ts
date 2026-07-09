import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { handleProviderResult } from './payments.service';
import { orangeMoneyAdapter } from './providers/orange-money.adapter';
import { mtnMomoAdapter } from './providers/mtn-momo.adapter';
import { campayMtnAdapter } from './providers/campay.adapter';
import type { PaymentAdapter } from './providers/types';

async function handle(adapter: PaymentAdapter, req: FastifyRequest, reply: FastifyReply) {
  const signature = (req.headers['x-signature'] || req.headers['x-webhook-signature'] || '') as string;
  const rawBody = JSON.stringify(req.body ?? {});
  if (!adapter.verifyWebhookSignature(rawBody, signature)) {
    return reply.code(401).send({ error: 'InvalidSignature' });
  }
  const body = req.body as { providerRef: string; status: 'COMPLETED' | 'FAILED'; amount?: number };
  const tx = await prisma.transaction.findFirst({ where: { providerRef: body.providerRef } });
  if (!tx) return reply.code(404).send({ error: 'TransactionNotFound' });
  await handleProviderResult(tx.id, body.status);
  return { received: true };
}

export const orangeWebhook = (req: FastifyRequest, reply: FastifyReply) => handle(orangeMoneyAdapter, req, reply);
export const mtnWebhook = (req: FastifyRequest, reply: FastifyReply) => handle(mtnMomoAdapter, req, reply);

export const campayWebhook = async (req: FastifyRequest, reply: FastifyReply) => {
  const signature = (req.headers['x-signature'] || req.headers['x-webhook-signature'] || '') as string;
  const rawBody = JSON.stringify(req.body ?? {});
  if (!campayMtnAdapter.verifyWebhookSignature(rawBody, signature)) {
    return reply.code(401).send({ error: 'InvalidSignature' });
  }
  const body = req.body as { reference?: string; external_reference?: string; status?: string; amount?: string };
  const status = (body.status || '').toUpperCase();
  let normalised: 'COMPLETED' | 'FAILED' | 'PENDING' = 'PENDING';
  if (status === 'SUCCESSFUL' || status === 'SUCCESS' || status === 'COMPLETED') normalised = 'COMPLETED';
  else if (status === 'FAILED' || status === 'CANCELLED' || status === 'CANCELED') normalised = 'FAILED';
  if (normalised === 'PENDING') return { received: true };
  const tx = body.reference
    ? await prisma.transaction.findFirst({ where: { providerRef: body.reference } })
    : body.external_reference
      ? await prisma.transaction.findUnique({ where: { id: body.external_reference } })
      : null;
  if (!tx) return reply.code(404).send({ error: 'TransactionNotFound' });
  await handleProviderResult(tx.id, normalised);
  return { received: true };
};
