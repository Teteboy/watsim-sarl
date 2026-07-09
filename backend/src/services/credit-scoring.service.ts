import { prisma } from '../config/db';

const TIERS: { min: number; limit: number }[] = [
  { min: 90, limit: 300000 },
  { min: 75, limit: 150000 },
  { min: 60, limit: 75000 },
  { min: 40, limit: 25000 },
  { min: 0, limit: 0 },
];

export function limitForScore(score: number): number {
  const tier = TIERS.find((t) => score >= t.min);
  return tier ? tier.limit : 0;
}

export async function recomputeScore(userId: string): Promise<{ score: number; limit: number; breakdown: ScoreBreakdown }> {
  try {
    const [
      user,
      completed,
      overdue,
      deposits,
      repayments,
      totalTransactions,
      accountAge,
      recentLogins,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.bnplPurchase.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.instalment.count({ where: { purchase: { userId }, status: 'OVERDUE' } }),
      prisma.transaction.count({ where: { userId, type: 'DEPOSIT', status: 'COMPLETED' } }),
      prisma.instalment.findMany({
        where: { purchase: { userId }, status: 'PAID' },
        orderBy: { paidAt: 'asc' },
        select: { paidAt: true, dueDate: true, amount: true },
      }),
      prisma.transaction.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
      prisma.userSession.count({
        where: { userId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      }).catch(() => 0), // Gracefully handle if UserSession table doesn't exist
    ]);

    if (!user) {
      // Return default score for missing user instead of throwing
      return {
        score: 50,
        limit: 0,
        breakdown: {
          base: 50,
          kycVerified: 0,
          completedPurchases: 0,
          overduePenalty: 0,
          depositHistory: 0,
          paymentStreak: 0,
          accountAgeBonus: 0,
          activityBonus: 0,
          totalVolumeBonus: 0,
        },
      };
    }

  const breakdown: ScoreBreakdown = {
    base: 50,
    kycVerified: user.kycStatus === 'VERIFIED' ? 20 : 0,
    completedPurchases: Math.min(completed * 3, 15),
    overduePenalty: -overdue * 10,
    depositHistory: Math.min(deposits * 1, 5),
    paymentStreak: 0,
    accountAgeBonus: 0,
    activityBonus: Math.round(Math.min(recentLogins * 0.5, 5)),
    totalVolumeBonus: 0,
  };

    // Payment streak calculation
    let streak = 0;
    for (const r of repayments) {
      if (r.paidAt && r.dueDate && r.paidAt <= r.dueDate) streak += 1;
      else break;
    }
    breakdown.paymentStreak = Math.min(streak * 2, 10);

    // Account age bonus (1 point per month, max 10)
    if (accountAge) {
      const monthsOld = Math.floor((Date.now() - accountAge.createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000));
      breakdown.accountAgeBonus = Math.min(monthsOld, 10);
    }

    // Transaction volume bonus
    if (totalTransactions > 50) breakdown.totalVolumeBonus = 5;
    else if (totalTransactions > 20) breakdown.totalVolumeBonus = 3;
    else if (totalTransactions > 10) breakdown.totalVolumeBonus = 1;

    let score = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
    score = Math.max(0, Math.min(100, score));
    const scoreInt = Math.round(score);

    const limit = limitForScore(scoreInt);
    await prisma.user.update({ where: { id: userId }, data: { creditScore: scoreInt, creditLimit: limit } });
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'SCORE_RECOMPUTED',
        metadata: { score, limit, breakdown } as never
      }
    });
    return { score, limit, breakdown };
  } catch (error) {
    throw new Error(`Credit score computation error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export interface ScoreBreakdown {
  base: number;
  kycVerified: number;
  completedPurchases: number;
  overduePenalty: number;
  depositHistory: number;
  paymentStreak: number;
  accountAgeBonus: number;
  activityBonus: number;
  totalVolumeBonus: number;
}

export async function getScoreHistory(userId: string, limit: number = 10) {
  return await prisma.auditLog.findMany({
    where: { userId, action: 'SCORE_RECOMPUTED' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      createdAt: true,
      metadata: true,
    },
  });
}

export async function getScoreTips(userId: string): Promise<string[]> {
  const [user, bnplCount, transactionCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { kycStatus: true, creditScore: true } }),
    prisma.bnplPurchase.count({ where: { userId, status: 'COMPLETED' } }),
    prisma.transaction.count({ where: { userId, status: 'COMPLETED' } }),
  ]);

  const tips: string[] = [];
  
  if (!user || user.kycStatus !== 'VERIFIED') {
    tips.push('Complete KYC verification to increase your score by 20 points');
  }
  
  if (bnplCount < 5) {
    tips.push('Complete more BNPL purchases on time to build your credit history');
  }
  
  if (user && user.creditScore < 70) {
    tips.push('Make regular deposits and maintain consistent payment habits');
  }
  
  tips.push('Log in regularly to show account activity');
  tips.push('Pay installments before due dates to build a positive payment streak');
  
  return tips;
}
