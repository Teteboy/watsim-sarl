import { prisma } from '../config/db';
import { notifyUser } from '../services/notification.service';
import { logger } from '../config/logger';

export async function processRepaymentJob(): Promise<{ overdueMarked: number; autoRetried: number }> {
  const now = new Date();

  const dueOverdue = await prisma.instalment.findMany({
    where: { status: 'DUE', dueDate: { lte: now } },
    include: { purchase: { include: { user: { include: { wallet: true } } } } },
  });

  let overdueMarked = 0;
  let autoRetried = 0;

  for (const inst of dueOverdue) {
    await prisma.instalment.update({ where: { id: inst.id }, data: { status: 'OVERDUE' } });
    overdueMarked += 1;
    await notifyUser(inst.purchase.userId, `Échéance en retard: ${inst.amount} XAF dû le ${inst.dueDate.toISOString().slice(0, 10)}`);

    const wallet = inst.purchase.user.wallet;
    if (wallet && wallet.balance >= inst.amount) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.wallet.update({ where: { userId: inst.purchase.userId }, data: { balance: { decrement: inst.amount } } });
          await tx.instalment.update({ where: { id: inst.id }, data: { status: 'PAID', paidAt: new Date() } });
          await tx.transaction.create({
            data: {
              userId: inst.purchase.userId, purchaseId: inst.purchaseId, type: 'REPAYMENT',
              amount: inst.amount, status: 'COMPLETED', provider: 'WALLET',
              providerRef: `WALLET_AUTO_${inst.id}`, metadata: { instalmentId: inst.id, auto: true } as never,
            },
          });
          const remaining = await tx.instalment.count({ where: { purchaseId: inst.purchaseId, status: { not: 'PAID' } } });
          if (remaining === 0) await tx.bnplPurchase.update({ where: { id: inst.purchaseId }, data: { status: 'COMPLETED' } });
        });
        autoRetried += 1;
      } catch (e) {
        logger.warn({ err: e, instalmentId: inst.id }, 'Auto-retry failed');
      }
    }
  }

  logger.info({ overdueMarked, autoRetried }, 'Repayment scan complete');
  return { overdueMarked, autoRetried };
}
