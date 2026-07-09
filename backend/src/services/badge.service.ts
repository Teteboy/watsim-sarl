import { prisma } from '../config/db';
import { logger } from '../config/logger';

export type BadgeRequirement = 'purchase' | 'referral' | 'kyc' | 'spend' | 'streak' | 'vip';

export interface BadgeWithEarned {
  id: string;
  slug: string;
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  icon: string;
  color: string;
  requirement: BadgeRequirement;
  threshold: number;
  earned: boolean;
  earnedAt?: Date;
  progress: number;
}

// Default badge definitions to seed
export const DEFAULT_BADGES = [
  {
    slug: 'first_purchase',
    name: 'First Purchase',
    nameFr: 'Premier Achat',
    description: 'Completed your first BNPL purchase',
    descriptionFr: 'Achetez votre premier article avec BNPL',
    icon: 'star_rounded',
    color: '#F59E0B', // warning amber
    requirement: 'purchase' as const,
    threshold: 1,
  },
  {
    slug: 'active_referrer',
    name: 'Active Referrer',
    nameFr: 'Parrain Actif',
    description: 'Referred 3+ friends who joined',
    descriptionFr: 'Parrainez 3 amis qui rejoignent',
    icon: 'people_rounded',
    color: '#10B981', // primary green
    requirement: 'referral' as const,
    threshold: 3,
  },
  {
    slug: 'kyc_verified',
    name: 'Verified User',
    nameFr: 'Utilisateur Vérifié',
    description: 'Completed identity verification',
    descriptionFr: 'Vérification d\'identité complétée',
    icon: 'verified_rounded',
    color: '#0F766E', // deep teal
    requirement: 'kyc' as const,
    threshold: 1,
  },
  {
    slug: 'top_spender',
    name: 'Top Spender',
    nameFr: 'Gros Dépensier',
    description: 'Spent over 500,000 FCFA on the platform',
    descriptionFr: 'Dépensez plus de 500 000 FCFA',
    icon: 'military_tech_rounded',
    color: '#6B7280', // muted gray (locked)
    requirement: 'spend' as const,
    threshold: 500000,
  },
  {
    slug: 'super_active',
    name: 'Super Active',
    nameFr: 'Super Actif',
    description: 'Made 10+ purchases',
    descriptionFr: 'Effectuez 10 achats ou plus',
    icon: 'local_fire_department_rounded',
    color: '#6B7280', // muted gray (locked)
    requirement: 'purchase' as const,
    threshold: 10,
  },
  {
    slug: 'vip',
    name: 'VIP Member',
    nameFr: 'Membre VIP',
    description: 'Premium member with exclusive benefits',
    descriptionFr: 'Membre premium avec avantages exclusifs',
    icon: 'diamond_rounded',
    color: '#6B7280', // muted gray (locked)
    requirement: 'vip' as const,
    threshold: 1,
  },
];

/**
 * Seed default badges into the database
 */
export async function seedBadges(): Promise<void> {
  for (const badge of DEFAULT_BADGES) {
    await prisma.badgeDefinition.upsert({
      where: { slug: badge.slug },
      update: {},
      create: badge,
    });
  }
  logger.info('Badge definitions seeded');
}

/**
 * Get all badges for a user with their earned status
 */
export async function getUserBadges(userId: string): Promise<BadgeWithEarned[]> {
  // Get all badge definitions
  const definitions = await prisma.badgeDefinition.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  // Get user's earned badges
  const userBadges = await prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true },
  });

  const earnedMap = new Map(userBadges.map((ub: typeof userBadges[0]) => [ub.badgeId, ub]));

  // Get user's stats for progress calculation
  const stats = await calculateUserStats(userId);

  return definitions.map((def: typeof definitions[0]) => {
    const earned = earnedMap.get(def.id);
    const progress = calculateProgress(def.requirement as BadgeRequirement, def.threshold, stats);

    return {
      id: def.id,
      slug: def.slug,
      name: def.name,
      nameFr: def.nameFr,
      description: def.description,
      descriptionFr: def.descriptionFr,
      icon: def.icon,
      color: earned ? def.color : '#6B7280', // Gray if not earned
      requirement: def.requirement as BadgeRequirement,
      threshold: def.threshold,
      earned: !!earned,
      earnedAt: (earned as typeof userBadges[0] | undefined)?.earnedAt,
      progress: Math.min(progress, def.threshold),
    };
  });
}

/**
 * Check and award badges based on user activity
 */
export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  const awarded: string[] = [];
  const definitions = await prisma.badgeDefinition.findMany({
    where: { isActive: true },
  });

  // Get user's current badges
  const existingBadges = await prisma.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  });
  const existingIds = new Set(existingBadges.map((b: typeof existingBadges[0]) => b.badgeId));

  // Get user stats
  const stats = await calculateUserStats(userId);

  for (const def of definitions) {
    if (existingIds.has(def.id)) continue; // Already has this badge

    const progress = calculateProgress(def.requirement as BadgeRequirement, def.threshold, stats);

    if (progress >= def.threshold) {
      // Award the badge
      await prisma.userBadge.create({
        data: {
          userId,
          badgeId: def.id,
          progress: def.threshold,
          metadata: { awardedAutomatically: true, stats },
        },
      });
      awarded.push(def.slug);
      logger.info({ userId, badge: def.slug }, 'Badge awarded');
    }
  }

  return awarded;
}

interface UserStats {
  purchaseCount: number;
  referralCount: number;
  totalSpent: number;
  kycVerified: boolean;
  isVip: boolean;
}

async function calculateUserStats(userId: string): Promise<UserStats> {
  const [purchaseCount, referralCount, totalSpent, kycStatus] = await Promise.all([
    prisma.bnplPurchase.count({ where: { userId } }),
    prisma.referral.count({ where: { referrerId: userId } }),
    prisma.bnplPurchase.aggregate({
      where: { userId },
      _sum: { totalAmount: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true },
    }),
  ]);

  return {
    purchaseCount,
    referralCount,
    totalSpent: totalSpent._sum.totalAmount || 0,
    kycVerified: kycStatus?.kycStatus === 'VERIFIED',
    isVip: false, // VIP status would come from a subscription or admin flag
  };
}

function calculateProgress(
  requirement: BadgeRequirement,
  threshold: number,
  stats: UserStats
): number {
  switch (requirement) {
    case 'purchase':
      return stats.purchaseCount;
    case 'referral':
      return stats.referralCount;
    case 'spend':
      return stats.totalSpent;
    case 'kyc':
      return stats.kycVerified ? threshold : 0;
    case 'vip':
      return stats.isVip ? threshold : 0;
    case 'streak':
      // Streak would require additional tracking
      return 0;
    default:
      return 0;
  }
}
