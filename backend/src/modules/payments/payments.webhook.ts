import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { handleProviderResult } from './payments.service';
import { orangeMoneyAdapter } from './providers/orange-money.adapter';
import { mtnMomoAdapter } from './providers/mtn-momo.adapter';
import { campayMtnAdapter } from './providers/campay.adapter';
import type { PaymentAdapter } from './providers/types';

/**
 * Provider signatures must be computed over the RAW request body — re-serialising
 * the parsed JSON changes whitespace/key order and breaks valid signatures.
 * The raw body is captured by the JSON content parser registered in app.ts.
 */
function getRawBody(req: FastifyRequest): string {
  const raw = (req as { rawBody?: string | Buffer }).rawBody;
  if (raw) return raw.toString();
  // Fallback only if the raw-body parser is not registered.
  return JSON.stringify(req.body ?? {});
}

/**
 * Idempotency: providers retry webhooks. handleProviderResult is itself guarded
 * (it only mutates PENDING rows), but we short-circuit here so late/duplicate
 * events never trigger the downstream side-effects again and so a FAILED →
 * PENDING re-poke cannot resurrect a finished transaction.
 */
async function handle(adapter: PaymentAdapter, req: FastifyRequest, reply: FastifyReply) {
  const signature = (req.headers['x-campay-signature'] || req.headers['x-signature'] || req.headers['x-webhook-signature'] || '') as string;
  const rawBody = getRawBody(req);
  if (!adapter.verifyWebhookSignature(rawBody, signature)) {
    return reply.code(401).send({ error: 'InvalidSignature' });
  }
  const body = req.body as { providerRef: string; status: 'COMPLETED' | 'FAILED'; amount?: number };
  const tx = await prisma.transaction.findFirst({ where: { providerRef: body.providerRef } });
  if (!tx) return reply.code(404).send({ error: 'TransactionNotFound' });
  if (tx.status !== 'PENDING') return { received: true }; // already processed — idempotent ack
  await handleProviderResult(tx.id, body.status, body.amount);
  return { received: true };
}

export const orangeWebhook = (req: FastifyRequest, reply: FastifyReply) => handle(orangeMoneyAdapter, req, reply);
export const mtnWebhook = (req: FastifyRequest, reply: FastifyReply) => handle(mtnMomoAdapter, req, reply);

export const campayWebhook = async (req: FastifyRequest, reply: FastifyReply) => {
  const signature = (req.headers['x-campay-signature'] || req.headers['x-signature'] || req.headers['x-webhook-signature'] || '') as string;
  const rawBody = getRawBody(req);
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
      // external_reference is the transaction UUID truncated to 20 chars
      // (see campay.adapter.ts: params.reference.slice(0, 20)), so match by prefix.
      ? await prisma.transaction.findFirst({ where: { id: { startsWith: body.external_reference } } })
      : null;
  if (!tx) return reply.code(404).send({ error: 'TransactionNotFound' });
  if (tx.status !== 'PENDING') return { received: true }; // already processed — idempotent ack
  const reportedAmount = body.amount !== undefined ? Number(body.amount) : undefined;
  await handleProviderResult(tx.id, normalised, Number.isFinite(reportedAmount) ? reportedAmount : undefined);
  return { received: true };
};
