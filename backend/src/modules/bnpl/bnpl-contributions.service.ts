import crypto from 'crypto';
import { prisma } from '../../config/db';
import { logger } from '../../config/logger';

export class BnplContributionError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

async function getTotalPaid(purchaseId: string): Promise<number> {
  const result = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      purchaseId,
      status: 'COMPLETED',
      type: { in: ['PURCHASE', 'REPAYMENT'] },
    },
  });
  return (result._sum?.amount as number | null) ?? 0;
}

export async function withdrawContribution(userId: string, purchaseId: string) {
  const purchase = await prisma.bnplPurchase.findUnique({
    where: { id: purchaseId },
    include: { user: true },
  });
  if (!purchase || purchase.userId !== userId) {
    throw new BnplContributionError(404, 'Purchase not found');
  }
  if (purchase.status === 'CANCELLED' || purchase.status === 'COMPLETED') {
    throw new BnplContributionError(400, 'Purchase cannot be withdrawn');
  }

  const gross = await getTotalPaid(purchaseId);
  if (gross <= 0) {
    throw new BnplContributionError(400, 'No funds to withdraw');
  }

  const chargeback = Math.round(gross * 0.3);
  const refund = gross - chargeback;
  const providerRef = `WD_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  await prisma.$transaction(async (tx) => {
    await tx.bnplPurchase.update({
      where: { id: purchaseId },
      data: { status: 'CANCELLED' },
    });
    await tx.instalment.updateMany({
      where: { purchaseId },
      data: { status: 'WAIVED' },
    });
    await tx.wallet.update({
      where: { userId },
      data: { balance: { increment: refund } },
    });
    await tx.transaction.create({
      data: {
        userId,
        purchaseId,
        type: 'REFUND',
        amount: refund,
        status: 'COMPLETED',
        provider: 'WALLET',
        providerRef,
        metadata: { gross, chargeback, source: 'bnpl_withdraw' } as never,
      },
    });
  });

  logger.info({ userId, purchaseId, gross, refund }, 'BNPL contribution withdrawn');
  return {
    gross,
    chargeback,
    refund,
    message: `Refunded ${refund} FCFA to wallet`,
  };
}

export async function transferContribution(
  userId: string,
  purchaseId: string,
  recipientIdentifier: string
) {
  const purchase = await prisma.bnplPurchase.findUnique({
    where: { id: purchaseId },
    include: { user: true },
  });
  if (!purchase || purchase.userId !== userId) {
    throw new BnplContributionError(404, 'Purchase not found');
  }
  if (purchase.status === 'CANCELLED' || purchase.status === 'COMPLETED') {
    throw new BnplContributionError(400, 'Purchase cannot be transferred');
  }

  const recipient = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: recipientIdentifier },
        { email: recipientIdentifier },
        { id: recipientIdentifier },
      ],
    },
    include: { wallet: true },
  });
  if (!recipient) {
    throw new BnplContributionError(404, 'Recipient not found');
  }
  if (recipient.id === userId) {
    throw new BnplContributionError(400, 'Cannot transfer to yourself');
  }
  if (!recipient.wallet) {
    await prisma.wallet.create({
      data: { userId: recipient.id, balance: 0, currency: 'XAF' },
    });
  }

  const gross = await getTotalPaid(purchaseId);
  if (gross <= 0) {
    throw new BnplContributionError(400, 'No funds to transfer');
  }

  const fee = Math.round(gross * 0.2);
  const net = gross - fee;
  const ref = `TX_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  await prisma.$transaction(async (tx) => {
    await tx.bnplPurchase.update({
      where: { id: purchaseId },
      data: { status: 'CANCELLED' },
    });
    await tx.instalment.updateMany({
      where: { purchaseId },
      data: { status: 'WAIVED' },
    });
    await tx.wallet.update({
      where: { userId },
      data: { balance: { increment: fee } },
    });
    await tx.wallet.update({
      where: { userId: recipient.id },
      data: { balance: { increment: net } },
    });
    await tx.transaction.create({
      data: {
        userId,
        purchaseId,
        type: 'TRANSFER_OUT',
        amount: gross,
        status: 'COMPLETED',
        provider: 'WALLET',
        providerRef: `${ref}_OUT`,
        metadata: {
          recipientId: recipient.id,
          recipientName: recipient.fullName,
          recipientPhone: recipient.phone,
          net,
          fee,
          source: 'bnpl_transfer',
        } as never,
      },
    });
    await tx.transaction.create({
      data: {
        userId: recipient.id,
        purchaseId,
        type: 'TRANSFER_IN',
        amount: net,
        status: 'COMPLETED',
        provider: 'WALLET',
        providerRef: `${ref}_IN`,
        metadata: {
          senderId: userId,
          senderName: purchase.user.fullName,
          senderPhone: purchase.user.phone,
          fee,
          source: 'bnpl_transfer',
        } as never,
      },
    });
  });

  logger.info({ userId, recipientId: recipient.id, purchaseId, gross, net }, 'BNPL contribution transferred');
  return {
    gross,
    fee,
    net,
    recipientName: recipient.fullName,
    message: `Transferred ${net} FCFA to ${recipient.fullName}`,
  };
}
