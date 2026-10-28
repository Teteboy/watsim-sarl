import { prisma } from '../config/db';
import { notifyUser } from '../services/notification.service';
import { logger } from '../config/logger';
import { processSecondReward } from '../services/referral.service';

export async function processRepaymentJob(): Promise<{ overdueMarked: number; autoRetried: number }> {
  const now = new Date();

  const dueOverdue = await prisma.instalment.findMany({
    where: { status: { in: ['DUE', 'PARTIALLY_PAID'] }, dueDate: { lte: now }, purchase: { status: 'ACTIVE' } },
    include: { purchase: { include: { user: { include: { wallet: true } } } } },
  });

  let overdueMarked = 0;
  let autoRetried = 0;

  for (const inst of dueOverdue) {
    await prisma.instalment.updateMany({ where: { id: inst.id, status: { in: ['DUE', 'PARTIALLY_PAID'] } }, data: { status: 'OVERDUE' } });
    overdueMarked += 1;
    await notifyUser(inst.purchase.userId, `Échéance en retard: ${inst.amount} XAF dû le ${inst.dueDate.toISOString().slice(0, 10)}`);

    const wallet = inst.purchase.user.wallet;
    if (wallet) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', inst.id);
          const current = await tx.instalment.findUniqueOrThrow({ where: { id: inst.id } });
          if (current.status === 'PAID' || current.status === 'WAIVED') throw new Error('Instalment already settled');
          const amount = current.amount - current.paidAmount;
          if (amount <= 0) throw new Error('No outstanding balance');
          const debit = await tx.wallet.updateMany({
            where: { userId: inst.purchase.userId, balance: { gte: amount } },
            data: { balance: { decrement: amount } },
          });
          if (debit.count !== 1) throw new Error('Insufficient wallet balance');
          await tx.instalment.update({ where: { id: inst.id }, data: { status: 'PAID', paidAmount: current.amount, paidAt: new Date() } });
          await tx.transaction.create({
            data: {
              userId: inst.purchase.userId, purchaseId: inst.purchaseId, type: 'REPAYMENT',
              amount, status: 'COMPLETED', provider: 'WALLET',
              providerRef: `WALLET_AUTO_${inst.id}`, metadata: { instalmentId: inst.id, auto: true } as never,
            },
          });
          const remaining = await tx.instalment.count({ where: { purchaseId: inst.purchaseId, status: { not: 'PAID' } } });
          if (remaining === 0) await tx.bnplPurchase.update({ where: { id: inst.purchaseId }, data: { status: 'COMPLETED' } });
        });
        autoRetried += 1;
        await processSecondReward(inst.purchaseId);
      } catch (e) {
        logger.warn({ err: e, instalmentId: inst.id }, 'Auto-retry failed');
      }
    }
  }

  logger.info({ overdueMarked, autoRetried }, 'Repayment scan complete');
  return { overdueMarked, autoRetried };
}
