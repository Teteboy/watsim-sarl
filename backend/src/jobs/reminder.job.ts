import { prisma } from '../config/db';
import { notifyUser } from '../services/notification.service';
import { logger } from '../config/logger';

/**
 * Sends payment reminders to users whose instalments are due within the next 24 hours.
 * Runs daily via BullMQ cron, typically at 8am local time.
 */
export async function processReminderJob(): Promise<{ reminded: number }> {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find instalments that are DUE or UPCOMING and due within the next 24h
  const upcoming = await prisma.instalment.findMany({
    where: {
      status: { in: ['DUE', 'UPCOMING'] },
      dueDate: { gte: now, lte: tomorrow },
    },
    include: {
      purchase: {
        include: {
          product: true,
          user: true,
        },
      },
    },
  });

  let reminded = 0;

  for (const inst of upcoming) {
    const dueDate = inst.dueDate.toISOString().slice(0, 10);
    const productName = inst.purchase.product.name;
    const amount = inst.amount - inst.paidAmount;

    if (amount <= 0) continue; // Already fully paid

    const message = `Rappel: Votre échéance de ${amount} FCFA pour "${productName}" est due le ${dueDate}. Pensez à effectuer votre paiement.`;

    try {
      await notifyUser(inst.purchase.userId, message);
      reminded += 1;
    } catch (e) {
      logger.warn({ err: e, instalmentId: inst.id }, 'Failed to send reminder');
    }
  }

  logger.info({ reminded }, 'Payment reminder scan complete');
  return { reminded };
}
