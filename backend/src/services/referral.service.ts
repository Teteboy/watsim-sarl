import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { notifyUser } from './notification.service';
import crypto from 'crypto';

const FIRST_REWARD_AMOUNT = 500;
const SECOND_REWARD_PERCENTAGE = 0.006; // 0.6%

export function generateReferralCode(): string {
  // Generate 8-character alphanumeric code
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export async function ensureUserReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.referralCode) return user.referralCode;
  
  let code = generateReferralCode();
  let attempts = 0;
  
  while (attempts < 5) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      });
      return code;
    } catch {
      // Code might be taken, generate new one
      code = generateReferralCode();
      attempts++;
    }
  }
  
  throw new Error('Failed to generate unique referral code');
}

export async function processReferralRegistration(referredUserId: string, referralCode: string): Promise<void> {
  if (!referralCode) return;
  
  const referrer = await prisma.user.findUnique({
    where: { referralCode },
  });
  
  if (!referrer) {
    logger.warn({ referralCode, referredUserId }, 'Invalid referral code used during registration');
    return;
  }
  
  if (referrer.id === referredUserId) {
    logger.warn({ userId: referredUserId }, 'User tried to use their own referral code');
    return;
  }
  
  // Check if referred user already has a referral record
  const existing = await prisma.referral.findUnique({
    where: { referredId: referredUserId },
  });
  
  if (existing) {
    logger.warn({ referredUserId }, 'User already has a referral record');
    return;
  }
  
  await prisma.referral.create({
    data: {
      referrerId: referrer.id,
      referredId: referredUserId,
      firstRewardAmount: FIRST_REWARD_AMOUNT,
      secondRewardAmount: 0,
      status: 'PENDING',
    },
  });
  
  logger.info({ referrerId: referrer.id, referredId: referredUserId }, 'Referral relationship created');
}

export async function processFirstReward(userId: string): Promise<void> {
  const referral = await prisma.referral.findUnique({
    where: { referredId: userId },
    include: { referrer: true, referred: true },
  });
  
  if (!referral) return;
  if (referral.firstRewardPaid) return;
  
  await prisma.$transaction(async (tx) => {
    // Mark reward as paid
    await tx.referral.update({
      where: { id: referral.id },
      data: {
        firstRewardPaid: true,
        firstRewardPaidAt: new Date(),
        status: 'FIRST_REWARDED',
      },
    });
    
    // Credit referrer's wallet
    const wallet = await tx.wallet.findUnique({
      where: { userId: referral.referrerId },
    });
    
    if (wallet) {
      await tx.wallet.update({
        where: { userId: referral.referrerId },
        data: { balance: { increment: referral.firstRewardAmount } },
      });
    } else {
      // Create wallet with initial balance if it doesn't exist
      await tx.wallet.create({
        data: {
          userId: referral.referrerId,
          balance: referral.firstRewardAmount,
          currency: 'XAF',
        },
      });
    }
    
    // Create transaction record for the reward
    await tx.transaction.create({
      data: {
        userId: referral.referrerId,
        type: 'DEPOSIT',
        amount: referral.firstRewardAmount,
        status: 'COMPLETED',
        provider: 'REFERRAL',
        providerRef: `REFERRAL_FIRST_${referral.id}`,
        metadata: { referralId: referral.id, referredUserId: userId, rewardType: 'FIRST' },
      },
    });
  });
  
  await notifyUser(
    referral.referrerId,
    `Félicitations! Vous avez gagné ${referral.firstRewardAmount} XAF grâce à votre filleul ${referral.referred.fullName || referral.referred.phone}.`
  );
  
  logger.info({ referralId: referral.id, amount: referral.firstRewardAmount }, 'First referral reward paid');
}

export async function processSecondReward(purchaseId: string): Promise<void> {
  const purchase = await prisma.bnplPurchase.findUnique({
    where: { id: purchaseId },
    include: { user: true },
  });
  
  if (!purchase) return;
  
  const referral = await prisma.referral.findUnique({
    where: { referredId: purchase.userId },
    include: { referrer: true, referred: true },
  });
  
  if (!referral) return;
  if (referral.secondRewardPaid) return;
  
  // Calculate 0.6% of total amount
  const rewardAmount = Math.round(purchase.totalAmount * SECOND_REWARD_PERCENTAGE);
  
  await prisma.$transaction(async (tx) => {
    // Update referral with purchase link and reward amount
    await tx.referral.update({
      where: { id: referral.id },
      data: {
        purchaseId: purchase.id,
        secondRewardAmount: rewardAmount,
        secondRewardPaid: true,
        secondRewardPaidAt: new Date(),
        status: 'COMPLETED',
      },
    });
    
    // Credit referrer's wallet
    const wallet = await tx.wallet.findUnique({
      where: { userId: referral.referrerId },
    });
    
    if (wallet) {
      await tx.wallet.update({
        where: { userId: referral.referrerId },
        data: { balance: { increment: rewardAmount } },
      });
    } else {
      await tx.wallet.create({
        data: {
          userId: referral.referrerId,
          balance: rewardAmount,
          currency: 'XAF',
        },
      });
    }
    
    // Create transaction record for the reward
    await tx.transaction.create({
      data: {
        userId: referral.referrerId,
        type: 'DEPOSIT',
        amount: rewardAmount,
        status: 'COMPLETED',
        provider: 'REFERRAL',
        providerRef: `REFERRAL_SECOND_${referral.id}`,
        metadata: { 
          referralId: referral.id, 
          referredUserId: purchase.userId, 
          purchaseId: purchase.id,
          rewardType: 'SECOND',
          percentage: SECOND_REWARD_PERCENTAGE,
        },
      },
    });
  });
  
  await notifyUser(
    referral.referrerId,
    `Excellent! Votre filleul ${referral.referred.fullName || referral.referred.phone} a finalisé son achat. Vous recevez ${rewardAmount} XAF (0.6%)!`
  );
  
  logger.info({ 
    referralId: referral.id, 
    amount: rewardAmount, 
    purchaseId: purchase.id,
    totalAmount: purchase.totalAmount 
  }, 'Second referral reward paid');
}

export async function getReferralStats(userId: string) {
  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    include: { referred: { select: { fullName: true, phone: true, createdAt: true } } },
    orderBy: { createdAt: 'desc' },
  });
  
  const stats = {
    totalReferrals: referrals.length,
    firstRewardsPaid: referrals.filter(r => r.firstRewardPaid).length,
    secondRewardsPaid: referrals.filter(r => r.secondRewardPaid).length,
    totalFirstRewards: referrals
      .filter(r => r.firstRewardPaid)
      .reduce((sum, r) => sum + r.firstRewardAmount, 0),
    totalSecondRewards: referrals
      .filter(r => r.secondRewardPaid)
      .reduce((sum, r) => sum + r.secondRewardAmount, 0),
    referrals: referrals.map(r => ({
      id: r.id,
      referredName: r.referred.fullName || r.referred.phone,
      status: r.status,
      firstRewardAmount: r.firstRewardAmount,
      firstRewardPaid: r.firstRewardPaid,
      secondRewardAmount: r.secondRewardAmount,
      secondRewardPaid: r.secondRewardPaid,
      createdAt: r.createdAt,
    })),
  };
  
  return stats;
}
