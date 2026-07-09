import { prisma } from '../../config/db';
import type { Prisma } from '@prisma/client';

export async function listAllReferrals(params: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}) {
  const where: Prisma.ReferralWhereInput = {};

  if (params.status) {
    where.status = params.status;
  }

  if (params.search) {
    where.OR = [
      {
        referrer: {
          OR: [
            { fullName: { contains: params.search, mode: 'insensitive' } },
            { phone: { contains: params.search, mode: 'insensitive' } },
            { email: { contains: params.search, mode: 'insensitive' } },
          ],
        },
      },
      {
        referred: {
          OR: [
            { fullName: { contains: params.search, mode: 'insensitive' } },
            { phone: { contains: params.search, mode: 'insensitive' } },
            { email: { contains: params.search, mode: 'insensitive' } },
          ],
        },
      },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.referral.findMany({
      where,
      include: {
        referrer: {
          select: { id: true, fullName: true, phone: true, email: true },
        },
        referred: {
          select: { id: true, fullName: true, phone: true, email: true },
        },
        purchase: {
          select: { id: true, totalAmount: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.referral.count({ where }),
  ]);

  return {
    items: items.map((r) => ({
      id: r.id,
      referrer: r.referrer,
      referred: r.referred,
      status: r.status,
      firstRewardAmount: r.firstRewardAmount,
      firstRewardPaid: r.firstRewardPaid,
      firstRewardPaidAt: r.firstRewardPaidAt,
      secondRewardAmount: r.secondRewardAmount,
      secondRewardPaid: r.secondRewardPaid,
      secondRewardPaidAt: r.secondRewardPaidAt,
      purchase: r.purchase,
      createdAt: r.createdAt,
    })),
    total,
    page: params.page,
    limit: params.limit,
  };
}

export async function getReferralStats() {
  const [
    totalReferrals,
    totalFirstRewardsPaid,
    totalSecondRewardsPaid,
    totalFirstRewardsAmount,
    totalSecondRewardsAmount,
    statusBreakdown,
  ] = await Promise.all([
    prisma.referral.count(),
    prisma.referral.count({ where: { firstRewardPaid: true } }),
    prisma.referral.count({ where: { secondRewardPaid: true } }),
    prisma.referral.aggregate({
      where: { firstRewardPaid: true },
      _sum: { firstRewardAmount: true },
    }),
    prisma.referral.aggregate({
      where: { secondRewardPaid: true },
      _sum: { secondRewardAmount: true },
    }),
    prisma.referral.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
  ]);

  // Get top referrers
  const topReferrers = await prisma.referral.groupBy({
    by: ['referrerId'],
    _count: { referrerId: true },
    _sum: {
      firstRewardAmount: true,
      secondRewardAmount: true,
    },
    orderBy: { _count: { referrerId: 'desc' } },
    take: 10,
  });

  const referrerIds = topReferrers.map((r) => r.referrerId);
  const referrers = await prisma.user.findMany({
    where: { id: { in: referrerIds } },
    select: { id: true, fullName: true, phone: true },
  });

  const referrerMap = new Map(referrers.map((r) => [r.id, r]));

  return {
    overview: {
      totalReferrals,
      totalFirstRewardsPaid,
      totalSecondRewardsPaid,
      totalFirstRewardsAmount: totalFirstRewardsAmount._sum.firstRewardAmount ?? 0,
      totalSecondRewardsAmount: totalSecondRewardsAmount._sum.secondRewardAmount ?? 0,
      totalRewardsAmount:
        (totalFirstRewardsAmount._sum.firstRewardAmount ?? 0) +
        (totalSecondRewardsAmount._sum.secondRewardAmount ?? 0),
    },
    statusBreakdown: statusBreakdown.map((s) => ({
      status: s.status,
      count: s._count.status,
    })),
    topReferrers: topReferrers.map((r) => ({
      referrer: referrerMap.get(r.referrerId),
      referralCount: r._count.referrerId,
      totalFirstRewards: r._sum.firstRewardAmount ?? 0,
      totalSecondRewards: r._sum.secondRewardAmount ?? 0,
      totalRewards: (r._sum.firstRewardAmount ?? 0) + (r._sum.secondRewardAmount ?? 0),
    })),
  };
}
