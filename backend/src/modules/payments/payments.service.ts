import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { orangeMoneyAdapter } from './providers/orange-money.adapter';
import { mtnMomoAdapter } from './providers/mtn-momo.adapter';
import { campayMtnAdapter, campayOrangeAdapter } from './providers/campay.adapter';
import type { PaymentAdapter, Provider } from './providers/types';
import { enqueueScoreUpdate } from '../../jobs/queue';
import { notifyUser, sendTransactionAlert } from '../../services/notification.service';
import {
  recordInstalmentPayment,
  recordWalletDeposit,
  recordWalletSettlement,
} from '../accounting/accounting.hooks';
import { logger } from '../../config/logger';
import { processFirstReward, processSecondReward } from '../../services/referral.service';

export class PaymentError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export function getAdapter(provider: Provider): PaymentAdapter {
  if (env.USE_CAMPAY) {
    if (provider === 'ORANGE_MONEY') return campayOrangeAdapter;
    if (provider === 'MTN_MOMO') return campayMtnAdapter;
  }
  if (provider === 'ORANGE_MONEY') return orangeMoneyAdapter;
  if (provider === 'MTN_MOMO') return mtnMomoAdapter;
  throw new PaymentError(400, 'Unsupported provider');
}

export async function initiatePayment(input: {
  transactionId: string;
  amount: number;
  provider: Provider;
  phone: string;
  userId: string;
}) {
  if (input.provider === 'WALLET') {
    return processWalletPayment(input.userId, input.transactionId, input.amount);
  }
  const adapter = getAdapter(input.provider);
  const result = await adapter.initiatePayment({
    amount: input.amount,
    currency: 'XAF',
    phone: input.phone,
    reference: input.transactionId,
    callbackUrl: `${env.FRONTEND_URL}/payment/callback`,
  });
  await prisma.transaction.update({
    where: { id: input.transactionId },
    data: { providerRef: result.providerRef, provider: input.provider },
  });
  return { providerRef: result.providerRef, redirectUrl: result.redirectUrl, ussdCode: result.ussdCode };
}

export async function initiateCashDepositPayment(input: {
  transactionId: string;
  amount: number;
  provider: Exclude<Provider, 'WALLET'>;
  phone: string;
}) {
  const adapter = getAdapter(input.provider);
  const result = await adapter.initiatePayment({
    amount: input.amount,
    currency: 'XAF',
    phone: input.phone,
    reference: input.transactionId,
    callbackUrl: `${env.FRONTEND_URL}/payment/callback`,
  });
  const transaction = await prisma.transaction.findUnique({ where: { id: input.transactionId } });
  if (!transaction) throw new PaymentError(404, 'Transaction not found');
  await prisma.transaction.update({
    where: { id: input.transactionId },
    data: {
      providerRef: result.providerRef,
      metadata: {
        ...(transaction.metadata as Record<string, unknown> || {}),
        campayProvider: input.provider,
        campayPhone: input.phone,
        campayInitiatedAt: new Date().toISOString(),
      },
    },
  });
  return { providerRef: result.providerRef, redirectUrl: result.redirectUrl, ussdCode: result.ussdCode };
}

async function processWalletPayment(userId: string, transactionId: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < amount) throw new PaymentError(400, 'Insufficient wallet balance');
    await tx.wallet.update({ where: { userId }, data: { balance: { decrement: amount } } });
    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: 'COMPLETED', provider: 'WALLET', providerRef: `WALLET_${transactionId}` },
    });
    await applyTransactionEffects(tx, transactionId);
    return { providerRef: `WALLET_${transactionId}`, status: 'COMPLETED' as const };
  });
}

export async function getStatus(transactionId: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new PaymentError(404, 'Transaction not found');
  const metadata = tx.metadata as { campayProvider?: Provider } | null;
  const paymentProvider = tx.provider === 'CASH' ? metadata?.campayProvider : tx.provider as Provider | null;
  if (tx.status !== 'PENDING' || !tx.providerRef || !paymentProvider) {
    return { transactionId, status: tx.status, amount: tx.amount };
  }
  const adapter = getAdapter(paymentProvider);
  const verify = await adapter.verifyPayment(tx.providerRef);
  if (verify.status === 'COMPLETED' || verify.status === 'FAILED') {
    await handleProviderResult(tx.id, verify.status);
  }
  return { transactionId: tx.id, status: verify.status, amount: tx.amount };
}

export async function handleProviderResult(transactionId: string, status: 'COMPLETED' | 'FAILED'): Promise<void> {
  let completed = false;
  await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.findUnique({ where: { id: transactionId } });
    if (!t || t.status !== 'PENDING') return;
    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: status === 'COMPLETED' ? 'COMPLETED' : 'FAILED' },
    });
    if (status === 'COMPLETED') {
      await applyTransactionEffects(tx, transactionId);
      completed = true;
    }
  });
  if (!completed) return;

  const t = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!t) return;
  await enqueueScoreUpdate(t.userId);
  await notifyUser(t.userId, `Paiement de ${t.amount} XAF confirmé.`);
  if (t.type === 'PURCHASE' && t.purchaseId) {
    const purchase = await prisma.bnplPurchase.findUnique({
      where: { id: t.purchaseId },
      select: { isFirstPurchase: true },
    });
    if (purchase?.isFirstPurchase) {
      processFirstReward(t.userId).catch((err) => {
        logger.warn({ err, purchaseId: t.purchaseId, userId: t.userId }, 'Failed to process first referral reward');
      });
    }
  }
}

async function applyTransactionEffects(tx: import('@prisma/client').Prisma.TransactionClient, transactionId: string) {
  const t = await tx.transaction.findUnique({ where: { id: transactionId } });
  if (!t) return;
  const isWallet = t.provider === 'WALLET';
  if (t.type === 'REPAYMENT' && t.metadata && typeof t.metadata === 'object') {
    const meta = t.metadata as { instalmentId?: string; partialPayment?: boolean };
    if (meta.instalmentId) {
      // Get current installment state
      const currentInst = await tx.instalment.findUnique({
        where: { id: meta.instalmentId },
      });
      if (!currentInst) return;

      // Calculate new paid amount
      const newPaidAmount = currentInst.paidAmount + t.amount;
      const isFullyPaid = newPaidAmount >= currentInst.amount;

      // Update installment with partial payment tracking
      const inst = await tx.instalment.update({
        where: { id: meta.instalmentId },
        data: {
          paidAmount: newPaidAmount,
          status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
          paidAt: isFullyPaid ? new Date() : null,
          // Reset storage fee when payment is made
          storageFee: isFullyPaid ? 0 : currentInst.storageFee,
        },
      });

      const remaining = await tx.instalment.count({
        where: { purchaseId: inst.purchaseId, status: { not: 'PAID' } },
      });
      if (remaining === 0) {
        await tx.bnplPurchase.update({ where: { id: inst.purchaseId }, data: { status: 'COMPLETED' } });
        // Trigger second referral reward when purchase is fully paid
        processSecondReward(inst.purchaseId).catch((err) => {
          logger.warn({ err, purchaseId: inst.purchaseId }, 'Failed to process second referral reward');
        });
      }
      try {
        if (isWallet) {
          await recordWalletSettlement({ transactionId: t.id, amount: t.amount, userId: t.userId }, tx);
        } else {
          await recordInstalmentPayment(
            { transactionId: t.id, amount: t.amount, provider: t.provider ?? 'WALLET', userId: t.userId, instalmentId: meta.instalmentId },
            tx,
          );
        }
      } catch (e) {
        logger.warn({ err: e, transactionId: t.id }, 'Accounting hook failed (repayment)');
      }
    }
  } else if (t.type === 'PURCHASE' && t.purchaseId) {
    const first = await tx.instalment.findFirst({ where: { purchaseId: t.purchaseId, status: 'DUE' }, orderBy: { dueDate: 'asc' } });
    if (first) await tx.instalment.update({ where: { id: first.id }, data: { status: 'PAID', paidAt: new Date() } });
    try {
      if (isWallet) {
        await recordWalletSettlement({ transactionId: t.id, amount: t.amount, userId: t.userId }, tx);
      } else {
        await recordInstalmentPayment(
          { transactionId: t.id, amount: t.amount, provider: t.provider ?? 'WALLET', userId: t.userId, instalmentId: first?.id ?? t.purchaseId },
          tx,
        );
      }
    } catch (e) {
      logger.warn({ err: e, transactionId: t.id }, 'Accounting hook failed (purchase down-payment)');
    }
  } else if (t.type === 'DEPOSIT') {
    await tx.wallet.update({ where: { userId: t.userId }, data: { balance: { increment: t.amount } } });
    try {
      await recordWalletDeposit({ transactionId: t.id, amount: t.amount, provider: t.provider ?? 'WALLET', userId: t.userId }, tx);
    } catch (e) {
      logger.warn({ err: e, transactionId: t.id }, 'Accounting hook failed (deposit)');
    }
    // Send deposit alert (outside transaction to avoid blocking)
    sendTransactionAlert(t.userId, 'Deposit', t.amount, t.provider ?? 'WALLET').catch(() => {});
  }

  // Send transaction alert for purchases (non-blocking)
  if (t.type === 'PURCHASE') {
    sendTransactionAlert(t.userId, 'Purchase', t.amount, 'BNPL Store').catch(() => {});
  }

  await tx.auditLog.create({ data: { userId: t.userId, action: 'PAYMENT_COMPLETED', entityType: 'Transaction', entityId: t.id } });
}
