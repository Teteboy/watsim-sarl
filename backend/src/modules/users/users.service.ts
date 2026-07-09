import { prisma } from '../../config/db';
import { resolveImageUrl } from '../../services/storage-local.service';

export async function getProfile(userId: string, requestBaseUrl?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true, merchant: true },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    role: user.role,
    kycStatus: user.kycStatus,
    creditScore: user.creditScore,
    creditLimit: user.creditLimit,
    imageUrl: resolveImageUrl(user.imageUrl, requestBaseUrl),
    walletBalance: user.wallet?.balance ?? 0,
    currency: user.wallet?.currency ?? 'XAF',
    merchant: user.merchant ? { id: user.merchant.id, businessName: user.merchant.businessName, status: user.merchant.status } : null,
    referralCode: user.referralCode,
    createdAt: user.createdAt,
  };
}

export async function updateProfile(userId: string, data: { fullName?: string; phone?: string }) {
  return prisma.user.update({
    where: { id: userId },
    data: { fullName: data.fullName ?? undefined, phone: data.phone ?? undefined },
  });
}

export async function listUserTransactions(userId: string, page: number, limit: number) {
  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where: { userId } }),
  ]);
  return { items, total, page, limit };
}

export async function listUserPurchases(userId: string) {
  const purchases = await prisma.bnplPurchase.findMany({
    where: { userId },
    include: { instalments: { orderBy: { dueDate: 'asc' } }, product: true, merchant: true },
    orderBy: { createdAt: 'desc' },
  });

  return purchases.map((p) => {
    const paidInstalments = p.instalments.filter((i) => i.status === 'PAID').length;
    const totalPaid = p.instalments
      .filter((i) => i.status === 'PAID')
      .reduce((sum, i) => sum + i.amount, 0);
    const remaining = p.totalAmount - totalPaid;

    const nextDue = p.instalments.find((i) => i.status !== 'PAID');
    const nextDueDate = nextDue?.dueDate;
    const nextDueAmount = nextDue?.amount;

    const progress = p.instalmentCount > 0 ? Math.round((paidInstalments / p.instalmentCount) * 100) : 0;

    return {
      ...p,
      paidInstalments,
      totalPaid,
      remaining,
      nextDueDate,
      nextDueAmount,
      progressPercent: progress,
      status: p.status, // ACTIVE, COMPLETED, etc.
    };
  });
}
