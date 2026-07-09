import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { prisma } from '../../config/db';
import {
  AccountingError,
  ensureChartSeeded,
  getGeneralLedger,
  getTrialBalance,
  listJournal,
  postJournal,
} from './accounting.service';

function parsePeriod(q: { from?: string; to?: string }) {
  const period: { from?: Date; to?: Date } = {};
  if (q.from) period.from = new Date(q.from);
  if (q.to) period.to = new Date(q.to);
  return period;
}

export async function accountingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', authorize('ADMIN'));

  app.get('/chart', async () => {
    await ensureChartSeeded();
    return { items: await prisma.ledgerAccount.findMany({ orderBy: { code: 'asc' } }) };
  });

  app.get('/journal', async (req) => {
    await ensureChartSeeded();
    const q = req.query as { page?: string; limit?: string };
    return listJournal(Number(q.page ?? 1), Number(q.limit ?? 50));
  });


  app.post('/journal', async (req, reply) => {
    const body = req.body as {
      reference: string;
      description: string;
      lines: { accountCode: string; debit?: number; credit?: number; memo?: string }[];
    };
    try {
      const entry = await postJournal({ ...body, postedBy: req.authUser!.id });
      return reply.code(201).send(entry);
    } catch (e) {
      if (e instanceof AccountingError) return reply.code(e.statusCode).send({ error: 'AccountingError', message: e.message });
      throw e;
    }
  });

  app.get('/trial-balance', async (req) => {
    await ensureChartSeeded();
    const period = parsePeriod(req.query as { from?: string; to?: string });
    const rows = await getTrialBalance(period);
    const totals = rows.reduce(
      (acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }),
      { debit: 0, credit: 0 },
    );
    return { rows, totals, period };
  });

  app.get('/ledger/:code', async (req) => {

    const { code } = req.params as { code: string };
    const period = parsePeriod(req.query as { from?: string; to?: string });
    return { code, entries: await getGeneralLedger(code, period) };
  });

  app.get('/reports/income-statement', async (req) => {
    await ensureChartSeeded();
    const period = parsePeriod(req.query as { from?: string; to?: string });
    const rows = await getTrialBalance(period);
    const income = rows.filter((r) => r.type === 'INCOME');
    const expense = rows.filter((r) => r.type === 'EXPENSE');
    const totalIncome = income.reduce((s, r) => s + r.balance, 0);
    const totalExpense = expense.reduce((s, r) => s + r.balance, 0);
    return {
      period,
      income,
      expense,
      totals: { income: totalIncome, expense: totalExpense, netResult: totalIncome - totalExpense },
    };
  });


  app.get('/reports/balance-sheet', async (req) => {
    await ensureChartSeeded();
    const period = parsePeriod(req.query as { from?: string; to?: string });
    const rows = await getTrialBalance(period);
    const assets = rows.filter((r) => r.type === 'ASSET');
    const liabilities = rows.filter((r) => r.type === 'LIABILITY');
    const equity = rows.filter((r) => r.type === 'EQUITY');
    return {
      period,
      assets,
      liabilities,
      equity,
      totals: {
        assets: assets.reduce((s, r) => s + r.balance, 0),
        liabilities: liabilities.reduce((s, r) => s + r.balance, 0),
        equity: equity.reduce((s, r) => s + r.balance, 0),
      },
    };
  });

  // ===== Admin Payout Management =====
  app.get('/payouts', async (req) => {
    const q = req.query as { status?: string; page?: string; limit?: string };
    const where: any = {};
    if (q.status) where.status = q.status;

    const page = Number(q.page) || 1;
    const limit = Number(q.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.payoutRequest.findMany({
        where,
        include: { merchant: { select: { id: true, businessName: true } } },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payoutRequest.count({ where }),
    ]);

    return { items, total, page, limit };
  });

  app.post('/payouts/:id/status', async (req) => {
    const { id } = req.params as { id: string };
    const { status, note } = req.body as { status: string; note?: string };

    const updated = await prisma.payoutRequest.update({
      where: { id },
      data: {
        status,
        processedAt: ['PAID', 'REJECTED'].includes(status) ? new Date() : undefined,
        note: note || undefined,
      },
    });

    // When marking as PAID, record in accounting journal
    if (status === 'PAID') {
      try {
        const { recordMerchantPayout } = await import('./accounting.hooks');
        await recordMerchantPayout({
          payoutId: id,
          amount: updated.amount,
          provider: updated.provider,
          merchantId: updated.merchantId,
        });
      } catch (e) {
        req.log.error({ e }, 'Failed to record payout in journal');
      }
    }

    // Send notification to the merchant
    if (['PAID', 'REJECTED'].includes(status)) {
      try {
        const merchant = await prisma.merchant.findUnique({
          where: { id: updated.merchantId },
          select: { userId: true, businessName: true },
        });

        if (merchant?.userId) {
          const { deliverNotificationToUser } = await import('../../services/notification.service');

          const title = status === 'PAID' 
            ? 'Virement effectué' 
            : 'Demande de virement refusée';

          const body = status === 'PAID'
            ? `Votre demande de virement de ${updated.amount.toLocaleString()} FCFA a été payée.`
            : `Votre demande de virement de ${updated.amount.toLocaleString()} FCFA a été refusée.${note ? ' Raison : ' + note : ''}`;

          await deliverNotificationToUser(merchant.userId, title, body, 'system');
        }
      } catch (e) {
        req.log.error({ e }, 'Failed to send payout notification to merchant');
      }
    }

    return updated;
  });

}
