import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { getFileUrl } from '../../services/storage-local.service';

export class MerchantError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export async function registerMerchant(input: {
  email: string; phone: string; password: string; fullName: string;
  businessName: string; category: string; city: string;
  settings?: Record<string, unknown>;
}) {
  const exists = await prisma.user.findFirst({ where: { OR: [{ email: input.email }, { phone: input.phone }] } });
  if (exists) throw new MerchantError(409, 'Email or phone already registered');
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        passwordHash,
        fullName: input.fullName,
        role: 'MERCHANT',
        wallet: { create: { balance: 0 } },
      },
    });
    const merchant = await tx.merchant.create({
      data: {
        userId: user.id,
        businessName: input.businessName,
        category: input.category,
        city: input.city,
        status: 'PENDING',
        settings: input.settings as Prisma.InputJsonValue ?? undefined,
      },
    });
    await tx.auditLog.create({ data: { userId: user.id, action: 'MERCHANT_REGISTERED', entityId: merchant.id } });
    return { user, merchant };
  });
}

export async function getPublicMerchant(id: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id },
    select: { id: true, businessName: true, category: true, city: true, status: true, createdAt: true },
  });
  if (!merchant) throw new MerchantError(404, 'Merchant not found');
  return merchant;
}

export async function getMerchantProducts(id: string) {
  return prisma.product.findMany({
    where: { merchantId: id, isActive: true },
    include: {
      category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
      merchant: { select: { category: true } }
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getMerchantByUser(userId: string) {
  const merchant = await prisma.merchant.findUnique({ where: { userId } });
  if (!merchant) throw new MerchantError(404, 'Merchant profile not found');
  return merchant;
}

export async function merchantDashboard(userId: string) {
  const merchant = await getMerchantByUser(userId);
  const now = new Date();

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    total,
    pending,
    monthly,
    lastMonth,
    thisMonthBnpl,
    statusCounts,
    totalProducts,
    monthlyChart,
  ] = await Promise.all([
    prisma.bnplPurchase.aggregate({
      where: { merchantId: merchant.id },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.bnplPurchase.count({ where: { merchantId: merchant.id, status: 'ACTIVE' } }),
    prisma.bnplPurchase.aggregate({
      where: { merchantId: merchant.id, createdAt: { gte: monthStart } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.bnplPurchase.aggregate({
      where: { merchantId: merchant.id, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      _sum: { totalAmount: true },
    }),
    prisma.bnplPurchase.aggregate({
      where: { merchantId: merchant.id, createdAt: { gte: monthStart } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.bnplPurchase.groupBy({
      by: ['status'],
      where: { merchantId: merchant.id },
      _count: true,
    }),
    prisma.product.count({ where: { merchantId: merchant.id, isActive: true } }),
    prisma.bnplPurchase.groupBy({
      by: ['createdAt'],
      where: { merchantId: merchant.id, createdAt: { gte: sixMonthsAgo } },
      _sum: { totalAmount: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Build simple monthly revenue chart (last 6 months)
  const chartMap: Record<string, number> = {};
  for (const row of monthlyChart) {
    const date = new Date(row.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    chartMap[key] = (chartMap[key] || 0) + (row._sum.totalAmount || 0);
  }

  const revenueChart = Object.entries(chartMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, revenue]) => ({
      month: new Date(key + '-01').toLocaleString('fr-FR', { month: 'short' }),
      revenue: Math.round(revenue),
    }));

  // Status counts
  const statusMap: Record<string, number> = {};
  for (const s of statusCounts) statusMap[s.status] = s._count;

  return {
    merchantId: merchant.id,
    totalSales: total._sum.totalAmount ?? 0,
    totalOrders: total._count,
    pendingOrders: pending,
    revenueThisMonth: monthly._sum.totalAmount ?? 0,
    revenueLastMonth: lastMonth._sum.totalAmount ?? 0,
    activeProducts: totalProducts,

    // BNPL specific (same as revenue for now since platform is BNPL)
    bnplRevenueThisMonth: thisMonthBnpl._sum.totalAmount ?? 0,
    bnplOrdersThisMonth: thisMonthBnpl._count ?? 0,

    // Order status breakdown
    completedOrders: (statusMap['COMPLETED'] || 0) + (statusMap['PAID'] || 0),
    cancelledOrders: statusMap['CANCELLED'] || 0,

    // Customer stats (simple placeholders for now - can be enhanced later)
    returningCustomers: Math.floor((total._count || 0) * 0.35),
    newCustomers: Math.floor((total._count || 0) * 0.65),

    revenueChart,
  };
}

export async function merchantOrders(userId: string, page: number, limit: number) {
  const merchant = await getMerchantByUser(userId);
  const [items, total] = await Promise.all([
    prisma.bnplPurchase.findMany({
      where: { merchantId: merchant.id },
      include: { user: { select: { id: true, fullName: true, email: true } }, product: true, instalments: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit, take: limit,
    }),
    prisma.bnplPurchase.count({ where: { merchantId: merchant.id } }),
  ]);
  return { items, total, page, limit };
}

export async function getMerchantProfile(userId: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { userId },
    include: { user: { select: { fullName: true, email: true, phone: true, wallet: true } } },
  });
  if (!merchant) throw new MerchantError(404, 'Merchant profile not found');

  const pendingPayouts = await prisma.payoutRequest.aggregate({
    where: { merchantId: merchant.id, status: 'PENDING' },
    _sum: { amount: true },
  });

  return {
    id: merchant.id,
    name: merchant.businessName,
    owner: merchant.user?.fullName || '',
    email: merchant.user?.email || '',
    phone: merchant.user?.phone || '',
    city: merchant.city || '',
    category: merchant.category || '',
    status: merchant.status,
    rating: 4.5,
    totalReviews: 0,
    walletBalance: merchant.user?.wallet?.balance ?? 0,
    pendingPayout: pendingPayouts._sum.amount ?? 0,
    conversionRate: 0,
    avgOrderValue: 0,
  };
}

export async function updateMerchantProfile(userId: string, data: {
  name?: string;
  owner?: string;
  email?: string;
  phone?: string;
  city?: string;
  category?: string;
}) {
  const merchant = await getMerchantByUser(userId);

  const updateMerchantData: { businessName?: string; city?: string; category?: string } = {};
  if (data.name) updateMerchantData.businessName = data.name;
  if (data.city) updateMerchantData.city = data.city;
  if (data.category) updateMerchantData.category = data.category;

  const updateUserData: { fullName?: string; email?: string; phone?: string } = {};
  if (data.owner) updateUserData.fullName = data.owner;
  if (data.email) updateUserData.email = data.email;
  if (data.phone) updateUserData.phone = data.phone;

  await Promise.all([
    Object.keys(updateMerchantData).length
      ? prisma.merchant.update({ where: { id: merchant.id }, data: updateMerchantData })
      : merchant,
    Object.keys(updateUserData).length
      ? prisma.user.update({ where: { id: merchant.userId }, data: updateUserData })
      : null,
  ]);

  return getMerchantProfile(userId); // return fresh profile
}

export async function getMerchantSettings(userId: string) {
  const merchant = await getMerchantByUser(userId);
  return (merchant.settings as Record<string, unknown>) || {};
}

export async function updateMerchantSettings(userId: string, newSettings: Record<string, unknown>) {
  const merchant = await getMerchantByUser(userId);
  const current = (merchant.settings as Record<string, unknown>) || {};
  const merged: Record<string, unknown> = { ...current, ...newSettings };

  await prisma.merchant.update({
    where: { id: merchant.id },
    data: { settings: merged as Prisma.InputJsonValue },
  });

  return merged;
}

// Dedicated notification preferences helpers (structured access to settings.notifications)
export async function getMerchantNotificationPreferences(userId: string) {
  const settings = await getMerchantSettings(userId);
  return settings.notifications || {
    newOrder: true,
    orderStatus: true,
    bnplPayment: true,
    lowStock: true,
    newReview: false,
    weeklyReport: true,
    smsAlerts: true,
    emailAlerts: true,
  };
}

export async function updateMerchantNotificationPreferences(userId: string, preferences: Record<string, unknown>) {
  const currentSettings = await getMerchantSettings(userId);
  const updated = {
    ...currentSettings,
    notifications: {
      ...(currentSettings.notifications || {}),
      ...preferences,
    },
  };

  await updateMerchantSettings(userId, updated);
  return updated.notifications;
}

export async function changeMerchantPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findFirst({ where: { id: (await getMerchantByUser(userId)).userId } });
  if (!user) throw new MerchantError(404, 'User not found');

  const bcrypt = await import('bcryptjs');
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new MerchantError(401, 'Current password is incorrect');

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  return true;
}

// ===== Merchant Notifications Inbox =====
export async function getMerchantNotifications(userId: string) {
  const merchant = await getMerchantByUser(userId);
  return prisma.userNotification.findMany({
    where: { userId: merchant.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function markMerchantNotificationRead(userId: string, notificationId: string) {
  const merchant = await getMerchantByUser(userId);
  return prisma.userNotification.updateMany({
    where: {
      id: notificationId,
      userId: merchant.userId,
    },
    data: { isRead: true },
  });
}

export async function getMerchantUnreadNotificationCount(userId: string) {
  const merchant = await getMerchantByUser(userId);
  return prisma.userNotification.count({
    where: {
      userId: merchant.userId,
      isRead: false,
    },
  });
}

export async function markAllMerchantNotificationsRead(userId: string) {
  const merchant = await getMerchantByUser(userId);
  return prisma.userNotification.updateMany({
    where: {
      userId: merchant.userId,
      isRead: false,
    },
    data: { isRead: true },
  });
}

// ===== Merchant Wallet =====
export async function getMerchantWallet(userId: string) {
  const merchant = await getMerchantByUser(userId);

  // Ensure wallet exists
  const wallet = await prisma.wallet.upsert({
    where: { userId: merchant.userId },
    create: { userId: merchant.userId, balance: 0 },
    update: {},
  });

  const transactions = await prisma.transaction.findMany({
    where: { userId: merchant.userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  const payouts = await prisma.payoutRequest.findMany({
    where: { merchantId: merchant.id },
    orderBy: { requestedAt: 'desc' },
    take: 10,
  });

  // Revenue summary
  const [totalRevenue, thisMonthRevenue] = await Promise.all([
    prisma.bnplPurchase.aggregate({
      where: { merchantId: merchant.id, status: { in: ['COMPLETED', 'ACTIVE'] } },
      _sum: { totalAmount: true },
    }),
    prisma.bnplPurchase.aggregate({
      where: {
        merchantId: merchant.id,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { totalAmount: true },
    }),
  ]);

  const pendingPayout = payouts
    .filter((p) => p.status === 'PENDING')
    .reduce((s, p) => s + p.amount, 0);

  return {
    balance: wallet.balance,
    currency: wallet.currency,
    totalRevenue: totalRevenue._sum.totalAmount ?? 0,
    revenueThisMonth: thisMonthRevenue._sum.totalAmount ?? 0,
    pendingPayout,
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      status: t.status,
      provider: t.provider,
      createdAt: t.createdAt.toISOString(),
    })),
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: p.amount,
      provider: p.provider,
      status: p.status,
      requestedAt: p.requestedAt.toISOString(),
      note: p.note,
    })),
  };
}

// ===== Payout Requests (Merchant requests money from platform) =====

export async function getMerchantPayoutRequests(userId: string) {
  const merchant = await getMerchantByUser(userId);
  return prisma.payoutRequest.findMany({
    where: { merchantId: merchant.id },
    orderBy: { requestedAt: 'desc' },
  });
}

export async function createPayoutRequest(userId: string, amount: number, provider: string) {
  const merchant = await getMerchantByUser(userId);

  if (amount < 50000) {
    throw new Error('Minimum payout amount is 50,000 FCFA');
  }

  const request = await prisma.payoutRequest.create({
    data: {
      merchantId: merchant.id,
      amount,
      provider,
      status: 'PENDING',
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: merchant.userId,
      action: 'PAYOUT_REQUEST_CREATED',
      entityType: 'PayoutRequest',
      entityId: request.id,
      metadata: { amount, provider } as Prisma.InputJsonValue,
    },
  });

  return request;
}

export async function approvePayoutRequest(adminId: string, payoutId: string) {
  const payout = await prisma.payoutRequest.findUnique({
    where: { id: payoutId },
    include: { merchant: true },
  });
  if (!payout) throw new Error('Payout request not found');
  if (payout.status !== 'PENDING') throw new Error(`Payout already ${payout.status}`);

  // Ensure merchant has sufficient wallet balance
  const wallet = await prisma.wallet.findUnique({ where: { userId: payout.merchant.userId } });
  if (!wallet || wallet.balance < payout.amount) {
    throw new Error(`Insufficient merchant wallet balance (${wallet?.balance ?? 0} FCFA)`);
  }

  // Deduct merchant wallet atomically and mark APPROVED
  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId: payout.merchant.userId },
      data: { balance: { decrement: payout.amount } },
    });
    await tx.payoutRequest.update({
      where: { id: payoutId },
      data: { status: 'APPROVED', processedAt: new Date(), note: `Approved by admin ${adminId}` },
    });
    await tx.transaction.create({
      data: {
        userId: payout.merchant.userId,
        type: 'WITHDRAWAL',
        amount: payout.amount,
        status: 'PENDING',
        provider: payout.provider,
        providerRef: `PAYOUT_${payoutId}`,
        metadata: { payoutId, approvedBy: adminId, source: 'merchant_payout' } as never,
      },
    });
    await tx.auditLog.create({
      data: { userId: adminId, action: 'PAYOUT_APPROVED', entityType: 'PayoutRequest', entityId: payoutId, metadata: { amount: payout.amount } as never },
    });
  });

  // Trigger CamPay disbursement (non-blocking — status webhook/poll will update)
  const { processWithdrawal } = await import('../../services/withdrawal.service');
  const provider = payout.provider.includes('MTN') ? 'MTN' : payout.provider.includes('ORANGE') ? 'ORANGE' : 'CASH';
  const merchantUser = await prisma.user.findUnique({ where: { id: payout.merchant.userId }, select: { phone: true } });
  if (merchantUser?.phone) {
    processWithdrawal({
      userId: payout.merchant.userId,
      amount: payout.amount,
      phoneNumber: merchantUser.phone,
      provider: provider as import('../../services/withdrawal.service').WithdrawalProvider,
      reference: payoutId.slice(0, 20),
      metadata: { payoutId, source: 'merchant_payout_approval' },
    }).then(async (result) => {
      await prisma.payoutRequest.update({
        where: { id: payoutId },
        data: { status: result.success ? 'PAID' : 'REJECTED', note: result.message },
      });
      // Refund wallet if CamPay failed
      if (!result.success) {
        await prisma.wallet.update({
          where: { userId: payout.merchant.userId },
          data: { balance: { increment: payout.amount } },
        });
      }
    }).catch(() => { /* disbursement will be retried manually */ });
  } else {
    // No phone on file — mark as manually pending
    await prisma.payoutRequest.update({ where: { id: payoutId }, data: { status: 'APPROVED' } });
  }

  return prisma.payoutRequest.findUnique({ where: { id: payoutId } });
}

export async function rejectPayoutRequest(adminId: string, payoutId: string, note?: string) {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!payout) throw new Error('Payout request not found');
  if (payout.status !== 'PENDING') throw new Error(`Payout already ${payout.status}`);
  const updated = await prisma.payoutRequest.update({
    where: { id: payoutId },
    data: { status: 'REJECTED', processedAt: new Date(), note: note || `Rejected by admin ${adminId}` },
  });
  await prisma.auditLog.create({
    data: { userId: adminId, action: 'PAYOUT_REJECTED', entityType: 'PayoutRequest', entityId: payoutId, metadata: { note } as never },
  });
  return updated;
}

// ===== Merchant Staff/User Management =====

export async function getMerchantStaff(merchantUserId: string) {
  const merchant = await getMerchantByUser(merchantUserId);
  // Get all users associated with this merchant (same merchantId or referenced)
  // For now, return users that have merchant relation to this merchant
  const staff = await prisma.user.findMany({
    where: {
      merchant: { id: merchant.id },
      role: 'MERCHANT',
    },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      role: true,
      isActive: true,
      pinHash: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  // Map to include pinSet status
  return staff.map(s => ({
    ...s,
    status: s.isActive ? 'ACTIVE' : 'INACTIVE',
    pinSet: !!s.pinHash,
  }));
}

export async function createMerchantStaff(
  merchantUserId: string,
  data: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    pin?: string;
  }
) {
  const merchant = await getMerchantByUser(merchantUserId);
  
  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new MerchantError(409, 'Email already registered');
  
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(data.password, 12);
  
  let pinHash: string | null = null;
  if (data.pin) {
    pinHash = await bcrypt.hash(data.pin, 10);
  }
  
  const user = await prisma.user.create({
    data: {
      email: data.email,
      phone: data.phone || '',
      passwordHash,
      pinHash,
      pinSetAt: pinHash ? new Date() : null,
      fullName: data.fullName,
      role: 'MERCHANT',
      merchant: { connect: { id: merchant.id } },
    },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
  
  return { ...user, status: user.isActive ? 'ACTIVE' : 'INACTIVE', pinSet: !!pinHash };
}

export async function updateMerchantStaff(
  merchantUserId: string,
  staffId: string,
  data: {
    fullName?: string;
    email?: string;
    phone?: string;
  }
) {
  const merchant = await getMerchantByUser(merchantUserId);
  
  // Verify staff belongs to this merchant
  const staff = await prisma.user.findFirst({
    where: { id: staffId, merchant: { id: merchant.id } },
  });
  if (!staff) throw new MerchantError(404, 'Staff member not found');
  
  const updated = await prisma.user.update({
    where: { id: staffId },
    data: {
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
    },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
  
  return { ...updated, status: updated.isActive ? 'ACTIVE' : 'INACTIVE' };
}

export async function updateMerchantStaffStatus(
  merchantUserId: string,
  staffId: string,
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
) {
  const merchant = await getMerchantByUser(merchantUserId);
  
  const staff = await prisma.user.findFirst({
    where: { id: staffId, merchant: { id: merchant.id } },
  });
  if (!staff) throw new MerchantError(404, 'Staff member not found');
  
  const isActive = status === 'ACTIVE';
  
  const updated = await prisma.user.update({
    where: { id: staffId },
    data: { isActive },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
  
  return { ...updated, status: updated.isActive ? 'ACTIVE' : 'INACTIVE' };
}

export async function deleteMerchantStaff(merchantUserId: string, staffId: string) {
  const merchant = await getMerchantByUser(merchantUserId);
  
  const staff = await prisma.user.findFirst({
    where: { id: staffId, merchant: { id: merchant.id } },
  });
  if (!staff) throw new MerchantError(404, 'Staff member not found');
  
  await prisma.user.delete({ where: { id: staffId } });
  return { success: true };
}

export async function resetMerchantStaffPassword(merchantUserId: string, staffId: string, newPassword?: string) {
  const merchant = await getMerchantByUser(merchantUserId);
  
  const staff = await prisma.user.findFirst({
    where: { id: staffId, merchant: { id: merchant.id } },
  });
  if (!staff) throw new MerchantError(404, 'Staff member not found');
  
  const bcrypt = await import('bcryptjs');
  // Generate random password if not provided
  const password = newPassword || Math.random().toString(36).slice(-8);
  const passwordHash = await bcrypt.hash(password, 12);
  
  await prisma.user.update({
    where: { id: staffId },
    data: { passwordHash },
  });
  
  return { success: true, password: newPassword ? undefined : password };
}

// ===== Merchant Customers (Users who bought from this merchant) =====

export async function getMerchantCustomers(
  merchantUserId: string,
  params: { page?: number; limit?: number; search?: string } = {}
) {
  const merchant = await getMerchantByUser(merchantUserId);
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));

  // Get all BNPL purchases for this merchant with user data
  const purchases = await prisma.bnplPurchase.findMany({
    where: { merchantId: merchant.id },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          kycStatus: true,
          creditScore: true,
          creditLimit: true,
          isActive: true,
          imageUrl: true,
          createdAt: true,
          wallet: { select: { balance: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Aggregate unique customers with their stats
  type CustomerEntry = {
    id: string; name: string; email: string; phone: string;
    kycStatus: string; creditScore: number; creditLimit: number;
    walletBalance: number; imageUrl: string | null; joinedAt: Date;
    status: string; totalOrders: number; totalSpent: number; lastPurchaseAt: Date;
  };
  const customerMap = new Map<string, CustomerEntry>();
  
  for (const purchase of purchases) {
    const user = purchase.user;
    if (!user) continue;
    
    if (customerMap.has(user.id)) {
      const existing = customerMap.get(user.id)!;
      existing.totalOrders += 1;
      existing.totalSpent += purchase.totalAmount;
      if (purchase.createdAt > existing.lastPurchaseAt) {
        existing.lastPurchaseAt = purchase.createdAt;
      }
    } else {
      customerMap.set(user.id, {
        id: user.id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        kycStatus: user.kycStatus.toLowerCase(),
        creditScore: user.creditScore,
        creditLimit: user.creditLimit,
        walletBalance: user.wallet?.balance || 0,
        imageUrl: user.imageUrl ? getFileUrl(user.imageUrl) : null,
        joinedAt: user.createdAt,
        status: user.isActive ? 'active' : 'suspended',
        totalOrders: 1,
        totalSpent: purchase.totalAmount,
        lastPurchaseAt: purchase.createdAt,
      });
    }
  }

  let customers = Array.from(customerMap.values());

  // Apply search filter
  if (params.search) {
    const searchLower = params.search.toLowerCase();
    customers = customers.filter(c => 
      c.name.toLowerCase().includes(searchLower) ||
      c.email.toLowerCase().includes(searchLower) ||
      c.phone.includes(searchLower)
    );
  }

  const total = customers.length;
  
  // Apply pagination
  const paginated = customers.slice((page - 1) * limit, page * limit);

  return {
    items: paginated,
    total,
    page,
    limit,
  };
}

export async function createMerchantCustomer(
  merchantUserId: string,
  data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    pin?: string;
    creditLimit?: number;
  }
) {
  const merchant = await getMerchantByUser(merchantUserId);
  
  // Check email/phone uniqueness
  const existing = await prisma.user.findFirst({ 
    where: { OR: [{ email: data.email }, { phone: data.phone }] } 
  });
  if (existing) throw new MerchantError(409, 'Email ou téléphone déjà utilisé');
  
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(data.password, 12);
  let pinHash: string | null = null;
  if (data.pin) {
    pinHash = await bcrypt.hash(data.pin, 10);
  }
  
  const user = await prisma.user.create({
    data: {
      email: data.email,
      phone: data.phone,
      passwordHash,
      pinHash,
      pinSetAt: pinHash ? new Date() : null,
      fullName: data.fullName,
      role: 'CUSTOMER',
      creditLimit: data.creditLimit || 0,
      wallet: { create: { balance: 0 } },
    },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      kycStatus: true,
      creditScore: true,
      creditLimit: true,
      isActive: true,
      imageUrl: true,
      createdAt: true,
      wallet: { select: { balance: true } },
    },
  });
  
  await prisma.auditLog.create({
    data: {
      userId: merchant.userId,
      action: 'MERCHANT_CREATED_CUSTOMER',
      entityType: 'User',
      entityId: user.id,
      metadata: { merchantId: merchant.id },
    },
  });
  
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    phone: user.phone,
    kycStatus: user.kycStatus.toLowerCase(),
    creditScore: user.creditScore,
    creditLimit: user.creditLimit,
    walletBalance: user.wallet?.balance || 0,
    imageUrl: user.imageUrl ? getFileUrl(user.imageUrl) : null,
    joinedAt: user.createdAt,
    status: user.isActive ? 'active' : 'suspended',
    totalOrders: 0,
    totalSpent: 0,
  };
}

export async function updateMerchantCustomer(
  merchantUserId: string,
  customerId: string,
  data: {
    fullName?: string;
    email?: string;
    phone?: string;
    creditLimit?: number;
  }
) {
  const merchant = await getMerchantByUser(merchantUserId);
  
  // Verify customer has made at least one purchase from this merchant
  const hasPurchase = await prisma.bnplPurchase.findFirst({
    where: { userId: customerId, merchantId: merchant.id },
  });
  if (!hasPurchase) throw new MerchantError(404, 'Client non trouvé ou non associé à ce commerce');
  
  const updated = await prisma.user.update({
    where: { id: customerId },
    data: {
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      creditLimit: data.creditLimit,
    },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      kycStatus: true,
      creditScore: true,
      creditLimit: true,
      isActive: true,
      imageUrl: true,
      createdAt: true,
      wallet: { select: { balance: true } },
    },
  });
  
  // Get customer stats
  const purchases = await prisma.bnplPurchase.findMany({
    where: { userId: customerId, merchantId: merchant.id },
  });
  const totalOrders = purchases.length;
  const totalSpent = purchases.reduce((sum: number, p: { totalAmount: number }) => sum + (p.totalAmount || 0), 0);
  
  return {
    id: updated.id,
    name: updated.fullName,
    email: updated.email,
    phone: updated.phone,
    kycStatus: updated.kycStatus.toLowerCase(),
    creditScore: updated.creditScore,
    creditLimit: updated.creditLimit,
    walletBalance: updated.wallet?.balance || 0,
    imageUrl: updated.imageUrl ? getFileUrl(updated.imageUrl) : null,
    joinedAt: updated.createdAt,
    status: updated.isActive ? 'active' : 'suspended',
    totalOrders,
    totalSpent,
  };
}

export async function updateMerchantCustomerStatus(
  merchantUserId: string,
  customerId: string,
  status: 'active' | 'suspended'
) {
  const merchant = await getMerchantByUser(merchantUserId);
  
  const hasPurchase = await prisma.bnplPurchase.findFirst({
    where: { userId: customerId, merchantId: merchant.id },
  });
  if (!hasPurchase) throw new MerchantError(404, 'Client non trouvé');
  
  const updated = await prisma.user.update({
    where: { id: customerId },
    data: { isActive: status === 'active' },
    select: { id: true, isActive: true, fullName: true },
  });
  
  return { 
    id: updated.id, 
    status: updated.isActive ? 'active' : 'suspended',
    name: updated.fullName,
  };
}

export async function deleteMerchantCustomer(merchantUserId: string, customerId: string) {
  const merchant = await getMerchantByUser(merchantUserId);
  
  const hasPurchase = await prisma.bnplPurchase.findFirst({
    where: { userId: customerId, merchantId: merchant.id },
  });
  if (!hasPurchase) throw new MerchantError(404, 'Client non trouvé');
  
  // Don't allow deleting if customer has active purchases
  const activePurchases = await prisma.bnplPurchase.findFirst({
    where: { userId: customerId, status: 'ACTIVE' },
  });
  if (activePurchases) {
    throw new MerchantError(400, 'Impossible de supprimer un client avec des achats actifs');
  }
  
  await prisma.user.delete({ where: { id: customerId } });
  return { success: true };
}

export async function resetMerchantCustomerPassword(
  merchantUserId: string, 
  customerId: string, 
  newPassword?: string
) {
  const merchant = await getMerchantByUser(merchantUserId);
  
  const hasPurchase = await prisma.bnplPurchase.findFirst({
    where: { userId: customerId, merchantId: merchant.id },
  });
  if (!hasPurchase) throw new MerchantError(404, 'Client non trouvé');
  
  const bcrypt = await import('bcryptjs');
  const password = newPassword || Math.random().toString(36).slice(-8);
  const passwordHash = await bcrypt.hash(password, 12);
  
  await prisma.user.update({
    where: { id: customerId },
    data: { passwordHash },
  });
  
  return { success: true, password: newPassword ? undefined : password };
}

export async function merchantCreditClientWallet(merchantUserId: string, clientUserId: string, amount: number, note?: string) {
  const merchant = await getMerchantByUser(merchantUserId);
  const client = await prisma.user.findUnique({ where: { id: clientUserId } });
  if (!client) throw new MerchantError(404, 'Client not found');

  // Ensure wallet exists
  const wallet = await prisma.wallet.upsert({
    where: { userId: clientUserId },
    create: { userId: clientUserId, balance: 0 },
    update: {},
  });

  const newBalance = wallet.balance + amount;
  const updatedWallet = await prisma.wallet.update({
    where: { userId: clientUserId },
    data: { balance: newBalance },
  });

  // Create transaction record
  await prisma.transaction.create({
    data: {
      userId: clientUserId,
      type: amount >= 0 ? 'DEPOSIT' : 'WITHDRAWAL',
      amount: Math.abs(amount),
      status: 'COMPLETED',
      metadata: { note, merchantId: merchant.id, source: 'merchant_client_credit' } as Prisma.InputJsonValue,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: merchantUserId,
      action: amount >= 0 ? 'CLIENT_WALLET_CREDITED' : 'CLIENT_WALLET_DEBITED',
      entityType: 'Wallet',
      entityId: wallet.id,
      metadata: { clientUserId, amount, note } as Prisma.InputJsonValue,
    },
  });

  return { walletBalance: updatedWallet.balance, currency: updatedWallet.currency };
}

export async function merchantContributeToInstallment(merchantUserId: string, instalmentId: string, amount: number, note?: string) {
  const merchant = await getMerchantByUser(merchantUserId);
  const instalment = await prisma.instalment.findUnique({
    where: { id: instalmentId },
    include: { purchase: true },
  });
  if (!instalment) throw new MerchantError(404, 'Instalment not found');
  if (instalment.purchase.merchantId !== merchant.id) throw new MerchantError(403, 'Not authorized to contribute to this instalment');
  if (instalment.status === 'PAID' || instalment.status === 'WAIVED') throw new MerchantError(400, 'Instalment already paid or waived');

  const paymentAmount = Math.min(amount, instalment.amount - instalment.paidAmount);
  if (paymentAmount <= 0) throw new MerchantError(400, 'Invalid payment amount');

  const updatedInstalment = await prisma.instalment.update({
    where: { id: instalmentId },
    data: {
      paidAmount: instalment.paidAmount + paymentAmount,
      status: (instalment.paidAmount + paymentAmount) >= instalment.amount ? 'PAID' : 'PARTIALLY_PAID',
      paidAt: (instalment.paidAmount + paymentAmount) >= instalment.amount ? new Date() : instalment.paidAt,
    },
  });

  // Create transaction record
  await prisma.transaction.create({
    data: {
      userId: instalment.purchase.userId,
      purchaseId: instalment.purchaseId,
      type: 'REPAYMENT',
      amount: paymentAmount,
      status: 'COMPLETED',
      provider: 'MERCHANT_CONTRIBUTION',
      metadata: { instalmentId, merchantId: merchant.id, note, source: 'merchant_contribution' } as Prisma.InputJsonValue,
    },
  });

  // Check if all instalments are paid
  const allInstalments = await prisma.instalment.findMany({
    where: { purchaseId: instalment.purchaseId },
  });
  const allPaid = allInstalments.every(i => i.status === 'PAID' || i.status === 'WAIVED');
  if (allPaid) {
    await prisma.bnplPurchase.update({
      where: { id: instalment.purchaseId },
      data: { status: 'COMPLETED' },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: merchantUserId,
      action: 'INSTALLMENT_CONTRIBUTION',
      entityType: 'Instalment',
      entityId: instalmentId,
      metadata: { purchaseId: instalment.purchaseId, amount: paymentAmount, note } as Prisma.InputJsonValue,
    },
  });

  return {
    instalmentId: updatedInstalment.id,
    paidAmount: updatedInstalment.paidAmount,
    remainingAmount: updatedInstalment.amount - updatedInstalment.paidAmount,
    status: updatedInstalment.status,
  };
}
