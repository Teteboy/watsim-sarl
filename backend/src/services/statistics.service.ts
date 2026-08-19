import { prisma } from '../config/db';

export async function getUserStatistics(userId: string) {
  const completedStatuses = ['COMPLETED'] as const;

  const [
    wallet,
    completedTransactions,
    allTransactions,
    purchases,
  ] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId, status: { in: completedStatuses as unknown as string[] } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
    prisma.bnplPurchase.findMany({
      where: { userId },
      include: { instalments: true },
    }),
  ]);

  const sumByType = (type: string) =>
    completedTransactions
      .filter((t) => t.type === type)
      .reduce((sum, t) => sum + t.amount, 0);

  const totalDeposited = sumByType('DEPOSIT');
  const totalWithdrawn = sumByType('WITHDRAWAL');
  const totalTransferredIn = sumByType('TRANSFER_IN');
  const totalTransferredOut = sumByType('TRANSFER_OUT');
  const totalSpent = sumByType('PURCHASE');
  const totalRepaid = sumByType('REPAYMENT');
  const totalRefunded = sumByType('REFUND');

  const totalOrders = purchases.length;
  const completedOrders = purchases.filter((p) => p.status === 'COMPLETED').length;
  const activeOrders = purchases.filter((p) => p.status === 'ACTIVE').length;

  const totalOrderValue = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalPaidOnOrders = purchases.reduce((sum, p) => {
    const paid = p.instalments
      .filter((i) => i.status === 'PAID')
      .reduce((s, i) => s + i.amount, 0);
    return sum + paid;
  }, 0);
  const remainingOnOrders = totalOrderValue - totalPaidOnOrders;

  // Monthly grouped totals for charts
  const monthlyActivity: Record<string, { deposits: number; withdrawals: number; transfersOut: number; spent: number }> = {};
  for (const t of completedTransactions) {
    const key = t.createdAt.toISOString().slice(0, 7); // YYYY-MM
    if (!monthlyActivity[key]) {
      monthlyActivity[key] = { deposits: 0, withdrawals: 0, transfersOut: 0, spent: 0 };
    }
    if (t.type === 'DEPOSIT') monthlyActivity[key].deposits += t.amount;
    if (t.type === 'WITHDRAWAL') monthlyActivity[key].withdrawals += t.amount;
    if (t.type === 'TRANSFER_OUT') monthlyActivity[key].transfersOut += t.amount;
    if (t.type === 'PURCHASE' || t.type === 'REPAYMENT') monthlyActivity[key].spent += t.amount;
  }

  return {
    wallet: {
      balance: wallet?.balance ?? 0,
      currency: wallet?.currency ?? 'XAF',
    },
    transactions: {
      totalDeposited,
      totalWithdrawn,
      totalTransferredIn,
      totalTransferredOut,
      totalSpent,
      totalRepaid,
      totalRefunded,
      completedCount: completedTransactions.length,
      pendingCount: allTransactions.filter((t) => t.status === 'PENDING').length,
      failedCount: allTransactions.filter((t) => t.status === 'FAILED').length,
    },
    orders: {
      totalOrders,
      completedOrders,
      activeOrders,
      totalOrderValue,
      totalPaidOnOrders,
      remainingOnOrders,
    },
    monthlyActivity: Object.entries(monthlyActivity)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}
