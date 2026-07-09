import { prisma } from '../../config/db';
import { calculateInstalmentPlan, InstalmentCount, isValidCount, PaymentFrequency, validateFirstInstalment } from './bnpl.calculator';
import { initiatePayment } from '../payments/payments.service';
import { enqueueScoreUpdate } from '../../jobs/queue';
import { recordBnplPurchase } from '../accounting/accounting.hooks';
import { logger } from '../../config/logger';

export class BnplError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export async function simulate(productId: string, count: number, frequency: PaymentFrequency = 'monthly', downPayment: number = 0, userId?: string) {
  if (!isValidCount(count)) throw new BnplError(400, 'instalmentCount must be between 1 and 60');
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.isActive) throw new BnplError(404, 'Product not found');
  if (!product.bnplEligible) throw new BnplError(400, 'Product not BNPL-eligible');
  if (downPayment < 0) throw new BnplError(400, 'Down payment cannot be negative');
  if (downPayment >= product.price) throw new BnplError(400, 'Down payment must be less than product price');
  
  // Get BNPL fee settings
  const { getBnplFeeSettings } = await import('../admin/admin.service');
  const fees = await getBnplFeeSettings();
  
  // Check if this is the user's first BNPL purchase
  let isFirstPurchase = false;
  if (userId) {
    const existingPurchases = await prisma.bnplPurchase.count({ where: { userId } });
    isFirstPurchase = existingPurchases === 0;
  }
  
  return { 
    product: { id: product.id, name: product.name, price: product.price }, 
    plan: calculateInstalmentPlan(product.price, count, frequency, new Date(), downPayment, fees, isFirstPurchase), 
    downPayment,
    isFirstPurchase 
  };
}

export async function createPurchase(userId: string, input: {
  productId: string;
  instalmentCount: InstalmentCount;
  frequency?: PaymentFrequency;
  paymentProvider: 'ORANGE_MONEY' | 'MTN_MOMO' | 'WALLET';
  phone: string;
  downPayment?: number;
}) {
  const [user, product] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { wallet: true } }),
    prisma.product.findUnique({ where: { id: input.productId } }),
  ]);
  if (!user) throw new BnplError(404, 'User not found');
  if (!product || !product.isActive) throw new BnplError(404, 'Product not found');
  if (!product.bnplEligible) throw new BnplError(400, 'Product not BNPL-eligible');
  if (product.stock <= 0) throw new BnplError(400, 'Out of stock');
  // Note: KYC verification happens during first delivery, not before BNPL usage
  // Check if this is the user's first BNPL purchase
  const existingPurchases = await prisma.bnplPurchase.count({ where: { userId } });
  const isFirstPurchase = existingPurchases === 0;
  // Allow first purchase regardless of credit limit; enforce limit on subsequent purchases
  if (!isFirstPurchase && product.price > user.creditLimit) {
    throw new BnplError(403, `Amount exceeds credit limit (${user.creditLimit} XAF)`);
  }

  // Get BNPL fee settings
  const { getBnplFeeSettings } = await import('../admin/admin.service');
  const fees = await getBnplFeeSettings();

  const plan = calculateInstalmentPlan(product.price, input.instalmentCount, input.frequency || 'monthly', new Date(), input.downPayment, fees, isFirstPurchase);

  // Validate first installment minimum (500 FCFA for regular, 1000 FCFA for first purchase)
  // This validates the down payment which includes the first installment
  const validation = validateFirstInstalment(input.downPayment ?? 0, isFirstPurchase);
  if (!validation.valid) {
    throw new BnplError(400, validation.message!);
  }

  const result = await prisma.$transaction(async (tx) => {
    const purchase = await tx.bnplPurchase.create({
      data: {
        userId,
        merchantId: product.merchantId,
        productId: product.id,
        totalAmount: plan.total,
        downPayment: input.downPayment ?? 0,
        instalmentCount: input.instalmentCount,
        instalmentAmount: plan.monthly,
        interestRate: plan.rate,
        status: 'ACTIVE',
        // Store fees
        stockingFee: plan.fees.stockingFee,
        accountCreationFee: plan.fees.accountCreationFee,
        deliveryFee: plan.fees.deliveryFee,
        collectionFee: plan.fees.collectionFee,
        totalFees: plan.fees.totalFees,
        isFirstPurchase,
      },
    });
    await tx.instalment.createMany({
      data: plan.schedule.map((s, i) => ({
        purchaseId: purchase.id,
        amount: s.amount,
        dueDate: s.dueDate,
        status: i === 0 ? 'DUE' : 'UPCOMING',
      })),
    });
    await tx.product.update({ where: { id: product.id }, data: { stock: { decrement: 1 } } });

    // Only create a transaction for down payment (if any). Do NOT charge the first installment immediately —
    // installments are paid later via the repay endpoint.
    let transaction = null;
    if ((input.downPayment ?? 0) > 0) {
      transaction = await tx.transaction.create({
        data: {
          userId,
          purchaseId: purchase.id,
          type: 'DOWN_PAYMENT',
          amount: input.downPayment ?? 0,
          status: 'PENDING',
          provider: input.paymentProvider,
        },
      });
    }

    await tx.auditLog.create({
      data: { userId, action: 'BNPL_PURCHASE_CREATED', entityType: 'BnplPurchase', entityId: purchase.id, metadata: { plan } as never },
    });
    try {
      await recordBnplPurchase(
        { purchaseId: purchase.id, totalAmount: plan.total, principal: product.price, fees: Math.max(0, plan.total - product.price), userId },
        tx,
      );
    } catch (e) {
      logger.warn({ err: e, purchaseId: purchase.id }, 'BNPL accounting entry failed');
    }
    return { purchase, transaction };
  });

  // Only process payment if there's a down payment to charge
  let payment = null;
  if (result.transaction) {
    payment = await initiatePayment({
      transactionId: result.transaction.id,
      amount: input.downPayment ?? 0,
      provider: input.paymentProvider,
      phone: input.phone,
      userId,
    });
  }

  await enqueueScoreUpdate(userId);

  return { purchase: result.purchase, plan, payment };
}

export async function getPurchase(userId: string, purchaseId: string) {
  const purchase = await prisma.bnplPurchase.findUnique({
    where: { id: purchaseId },
    include: { instalments: { orderBy: { dueDate: 'asc' } }, product: true, merchant: true },
  });
  if (!purchase || purchase.userId !== userId) throw new BnplError(404, 'Purchase not found');
  return purchase;
}

export async function repayInstalment(userId: string, input: {
  instalmentId: string;
  paymentProvider: 'ORANGE_MONEY' | 'MTN_MOMO' | 'WALLET';
  phone: string;
  amount?: number; // Optional - for partial payments
}) {
  const inst = await prisma.instalment.findUnique({
    where: { id: input.instalmentId },
    include: { purchase: { include: { instalments: true } } },
  });
  if (!inst || inst.purchase.userId !== userId) throw new BnplError(404, 'Instalment not found');
  if (inst.status === 'PAID') throw new BnplError(400, 'Instalment already paid');

  // Calculate remaining amount due
  const remainingAmount = inst.amount - inst.paidAmount;
  const totalDue = remainingAmount + inst.storageFee;

  // Validate payment amount if provided (for partial payments)
  let paymentAmount = input.amount || totalDue;
  if (paymentAmount <= 0) {
    throw new BnplError(400, 'Invalid payment amount');
  }
  if (paymentAmount > totalDue) {
    // Cap at total due (user can't overpay)
    paymentAmount = totalDue;
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      purchaseId: inst.purchaseId,
      type: 'REPAYMENT',
      amount: paymentAmount,
      status: 'PENDING',
      provider: input.paymentProvider,
      metadata: { instalmentId: inst.id, partialPayment: paymentAmount < totalDue } as never,
    },
  });

  const payment = await initiatePayment({
    transactionId: transaction.id,
    amount: paymentAmount,
    provider: input.paymentProvider,
    phone: input.phone,
    userId,
  });

  return { transaction, payment };
}

/**
 * Calculate storage fee for an overdue installment
 * Fee is 3000 FCFA per product per month
 */
export async function calculateStorageFee(instalmentId: string): Promise<number> {
  const inst = await prisma.instalment.findUnique({
    where: { id: instalmentId },
    include: { purchase: true },
  });
  if (!inst) throw new BnplError(404, 'Instalment not found');

  // Only calculate for overdue installments
  if (inst.status !== 'OVERDUE') return 0;

  const now = new Date();
  const monthsOverdue = differenceInMonths(now, inst.dueDate);
  if (monthsOverdue <= 0) return 0;

  // Storage fee: 3000 per product per month
  const fee = monthsOverdue * 3000;
  return fee;
}

import { differenceInMonths } from 'date-fns';

/**
 * Apply storage fee to an overdue installment
 */
export async function applyStorageFee(instalmentId: string): Promise<void> {
  const fee = await calculateStorageFee(instalmentId);
  if (fee > 0) {
    await prisma.instalment.update({
      where: { id: instalmentId },
      data: { storageFee: fee },
    });
  }
}
