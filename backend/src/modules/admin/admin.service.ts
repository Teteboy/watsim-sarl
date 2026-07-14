import { prisma } from '../../config/db';
import type { KycStatus, MerchantStatus, Prisma, UserRole } from '@prisma/client';
import type { Category as PrismaCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { deliverNotificationToUser } from '../../services/notification.service';
import { suggestSellPrice } from '../products/products.service';
import { resolveImageUrl } from '../../services/storage-local.service';

export async function listAllConversations(params: { page?: number; limit?: number; search?: string }) {
  const page = params.page || 1;
  const limit = params.limit || 20;

  const where: Prisma.ConversationWhereInput = {};
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      {
        participants: {
          some: {
            user: {
              OR: [
                { fullName: { contains: params.search, mode: 'insensitive' } },
                { email: { contains: params.search, mode: 'insensitive' } },
              ],
            },
          },
        },
      },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        participants: { include: { user: { select: { id: true, fullName: true, role: true } } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { fullName: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.conversation.count({ where }),
  ]);

  const formatted = items.map((conv) => {
    const participantNames = conv.participants.map((p) => p.user.fullName).filter(Boolean);
    const lastMsg = conv.messages[0];
    const isSupport = conv.title === 'Watsim Support' || conv.title?.toLowerCase().includes('support');

    return {
      id: conv.id,
      title: conv.title || participantNames.join(', ') || 'Conversation',
      participantNames,
      isSupport,
      lastMessage: lastMsg?.text || undefined,
      lastMessageAt: lastMsg?.createdAt.toISOString() || undefined,
      unreadCount: 0,
      userId: conv.participants.find((p) => p.user.role === 'CUSTOMER')?.user.id,
    };
  });

  return { items: formatted, total, page, limit };
}

export async function getAllConversationMessages(conversationId: string, params: { limit?: number; before?: string }) {
  const limit = params.limit || 50;

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(params.before ? { createdAt: { lt: new Date(params.before) } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: { sender: { select: { id: true, fullName: true } } },
  });

  return {
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderName: m.sender?.fullName,
      text: m.text,
      attachmentUrl: m.attachmentUrl,
      attachmentType: m.attachmentType,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function adminSendMessage(conversationId: string, adminId: string, data: { text?: string; attachmentUrl?: string; attachmentType?: string }) {
  const userId = adminId;

  const msg = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      text: data.text || null,
      attachmentUrl: data.attachmentUrl || null,
      attachmentType: data.attachmentType || null,
    },
    include: { sender: { select: { fullName: true } } },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    senderName: msg.sender?.fullName,
    text: msg.text,
    attachmentUrl: msg.attachmentUrl,
    attachmentType: msg.attachmentType,
    createdAt: msg.createdAt.toISOString(),
  };
}

export async function listUsers(params: { page: number; limit: number; role?: UserRole; kycStatus?: KycStatus; search?: string }) {
  const where: Prisma.UserWhereInput = {};
  if (params.role) where.role = params.role;
  if (params.kycStatus) where.kycStatus = params.kycStatus;
  if (params.search) {
    where.OR = [
      { email: { contains: params.search, mode: 'insensitive' } },
      { fullName: { contains: params.search, mode: 'insensitive' } },
      { phone: { contains: params.search } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, email: true, phone: true, fullName: true, role: true, kycStatus: true, creditScore: true, creditLimit: true, isActive: true, createdAt: true, imageUrl: true },
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.limit, take: params.limit,
    }),
    prisma.user.count({ where }),
  ]);
  const itemsWithImages = items.map((u) => ({
    ...u,
    imageUrl: resolveImageUrl(u.imageUrl),
  }));
  return { items: itemsWithImages, total, page: params.page, limit: params.limit };
}

export async function setKycDecision(adminId: string, userId: string, status: 'VERIFIED' | 'REJECTED', note?: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: userId }, data: { kycStatus: status } });
    await tx.kycDocument.updateMany({
      where: { userId, status: 'PENDING' },
      data: { status, reviewedAt: new Date(), reviewNote: note },
    });
    await tx.auditLog.create({ data: { userId: adminId, action: `KYC_${status}`, entityType: 'User', entityId: userId, metadata: { note } as never } });
    return user;
  });
}

export async function setCreditLimit(adminId: string, userId: string, creditLimit: number) {
  const user = await prisma.user.update({ where: { id: userId }, data: { creditLimit } });
  await prisma.auditLog.create({ data: { userId: adminId, action: 'CREDIT_LIMIT_SET', entityType: 'User', entityId: userId, metadata: { creditLimit } as never } });
  return user;
}

export async function setUserActive(adminId: string, userId: string, isActive: boolean) {
  const user = await prisma.user.update({ where: { id: userId }, data: { isActive } });
  await prisma.auditLog.create({ data: { userId: adminId, action: isActive ? 'USER_REACTIVATED' : 'USER_SUSPENDED', entityType: 'User', entityId: userId } });
  return user;
}

export async function listMerchants(params: { page: number; limit: number; status?: MerchantStatus; search?: string }) {
  const where: Prisma.MerchantWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.search) where.businessName = { contains: params.search, mode: 'insensitive' };
  const [items, total] = await Promise.all([
    prisma.merchant.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, phone: true, fullName: true } },
        categories: { include: { category: { select: { id: true, name: true, slug: true, color: true, icon: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.limit, take: params.limit,
    }),
    prisma.merchant.count({ where }),
  ]);
  return { items, total, page: params.page, limit: params.limit };
}

export async function setMerchantStatus(adminId: string, merchantId: string, status: MerchantStatus) {
  const merchant = await prisma.merchant.update({ where: { id: merchantId }, data: { status } });
  await prisma.auditLog.create({ data: { userId: adminId, action: `MERCHANT_${status}`, entityType: 'Merchant', entityId: merchantId } });
  return merchant;
}

export async function listBnplPurchases(params: { page: number; limit: number; status?: string }) {
  const where: Prisma.BnplPurchaseWhereInput = {};
  if (params.status) where.status = params.status;
  const [items, total] = await Promise.all([
    prisma.bnplPurchase.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        merchant: { select: { id: true, businessName: true, city: true, category: true } },
        product: { select: { id: true, name: true, category: true } },
        instalments: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.limit, take: params.limit,
    }),
    prisma.bnplPurchase.count({ where }),
  ]);
  return { items, total, page: params.page, limit: params.limit };
}

export async function listTransactions(params: { page: number; limit: number; status?: string }) {
  const where: Prisma.TransactionWhereInput = {};
  if (params.status) where.status = params.status as Prisma.EnumTransactionStatusFilter;
  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { user: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.limit, take: params.limit,
    }),
    prisma.transaction.count({ where }),
  ]);
  return { items, total, page: params.page, limit: params.limit };
}

export async function createTransaction(adminId: string, data: { userId: string; type: string; amount: number; description?: string; merchantId?: string; provider?: string }) {
  const transaction = await prisma.transaction.create({
    data: {
      userId: data.userId,
      type: data.type as import('@prisma/client').TransactionType,
      amount: data.amount,
      status: 'COMPLETED',
      provider: data.provider || 'ADMIN',
      providerRef: `ADMIN-${Date.now()}`,
      metadata: { description: data.description, createdBy: adminId } as never,
    },
    include: { user: { select: { id: true, email: true, fullName: true } } },
  });

  // Create audit log entry
  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'TRANSACTION_CREATED',
      entityType: 'Transaction',
      entityId: transaction.id,
      metadata: { amount: data.amount, type: data.type, userId: data.userId } as never,
    },
  });

  return transaction;
}

export async function reportsSummary() {
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  // Basic metrics
  const [disbursed, repayments, activeUsers, totalUsers, totalTransactions, activePurchases, totalInst, paidInst, monthRevenue, withdrawals, payouts, storageFeesAgg, deliveryFeesAgg, priceAgg, costAgg] = await Promise.all([
    prisma.bnplPurchase.aggregate({ _sum: { totalAmount: true } }),
    prisma.transaction.aggregate({ where: { type: 'REPAYMENT', status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.user.count({ where: { role: 'CUSTOMER', isActive: true } }),
    prisma.user.count(),
    prisma.transaction.count(),
    prisma.bnplPurchase.count({ where: { status: 'ACTIVE' } }),
    prisma.instalment.count(),
    prisma.instalment.count({ where: { status: 'PAID' } }),
    prisma.transaction.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'WITHDRAWAL', status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.payoutRequest.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    prisma.product.aggregate({ _sum: { storageFee: true } }),
    prisma.product.aggregate({ _sum: { deliveryFee: true } }),
    prisma.product.aggregate({ _avg: { price: true } }),
    prisma.product.aggregate({ _avg: { costPrice: true } }),
  ]);

  const repaymentRate = totalInst > 0 ? Math.round((paidInst / totalInst) * 10000) / 100 : 0;
  const totalCompleted = (monthRevenue._sum.amount ?? 0) + (disbursed._sum.totalAmount ?? 0);
  const transferPct = totalCompleted > 0 ? Math.round(((payouts._sum.amount ?? 0) / totalCompleted) * 10000) / 100 : 0;
  const withdrawalPct = (monthRevenue._sum.amount ?? 0) > 0 ? Math.round(((withdrawals._sum.amount ?? 0) / (monthRevenue._sum.amount ?? 0)) * 10000) / 100 : 0;
  
  // Account opening fees: 5000 FCFA per customer account
  const accountOpeningFee = activeUsers * 5000;

  // Calculate average margin from price and cost price
  const avgPrice = priceAgg._avg.price ?? 0;
  const avgCost = costAgg._avg.costPrice ?? 0;
  const avgMargin = avgPrice > 0 && avgCost > 0 ? Math.round(((avgPrice - avgCost) / avgPrice) * 10000) / 100 : 22.5;

  return {
    totalDisbursed: disbursed._sum.totalAmount ?? 0,
    totalRepayments: repayments._sum.amount ?? 0,
    repaymentRate,
    activeUsers,
    totalUsers,
    totalTransactions,
    activePurchases,
    revenueThisMonth: monthRevenue._sum.amount ?? 0,
    transferPercentage: transferPct,
    withdrawalPercentage: withdrawalPct,
    // Operational cost metrics from products
    totalStorageFees: storageFeesAgg._sum.storageFee ?? 0,
    totalDeliveryFees: deliveryFeesAgg._sum.deliveryFee ?? 0,
    accountOpeningFees: accountOpeningFee,
    avgMargin,
  };
}

// ===== Platform Categories & BNPL Settings (admin) =====

function toPlatformCategory(c: PrismaCategory, merchantCountMap: Record<string, number>, productCountMap: Record<string, number>) {
  return {
    id: c.slug,
    name: c.name,
    description: c.description || '',
    icon: c.icon || 'ri-price-tag-3-line',
    color: c.color || '#4DB049',
    sortOrder: c.sortOrder,
    active: c.active,
    featured: c.featured,
    markupPercentage: Number(c.markupPercentage ?? 20),
    markupMargin: Number(c.markupMargin ?? 0.20),
    productsCount: productCountMap[c.id] || 0,
    merchantsCount: merchantCountMap[c.name] || 0,
    createdAt: c.createdAt.toISOString().split('T')[0],
  };
}

function toBnplConfig(c: PrismaCategory) {
  return {
    id: c.slug,
    name: c.name,
    enabled: c.bnplEnabled,
    maxCredit: c.maxCredit,
    minScore: c.minScore,
    merchantCommission: Number(c.merchantCommission),
  };
}

export async function listCategories() {
  const [cats, merchantGroups, productGroups] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.merchant.groupBy({ by: ['category'], _count: { _all: true } }),
    prisma.product.groupBy({ by: ['categoryId'], _count: { _all: true } }),
  ]);
  const merchantCountMap: Record<string, number> = {};
  for (const g of merchantGroups) merchantCountMap[g.category] = g._count._all;
  const productCountMap: Record<string, number> = {};
  for (const g of productGroups) {
    if (g.categoryId) productCountMap[g.categoryId] = g._count._all;
  }
  return cats.map(c => toPlatformCategory(c, merchantCountMap, productCountMap));
}

export async function createCategory(input: { name: string; description?: string; icon?: string; color?: string; featured?: boolean; slug?: string; markupPercentage?: number | string }) {
  const slug = input.slug || input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const maxSort = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;
  const markupPct = input.markupPercentage != null ? Number(input.markupPercentage) : 20;
  const cat = await prisma.category.create({
    data: {
      name: input.name.trim(),
      slug,
      description: input.description,
      icon: input.icon,
      color: input.color,
      featured: !!input.featured,
      sortOrder,
      markupPercentage: markupPct,
      markupMargin: markupPct / 100,
    },
  });
  return toPlatformCategory(cat, {}, {});
}

export async function updateCategory(idOrSlug: string, input: Partial<{ name: string; description: string; icon: string; color: string; active: boolean; featured: boolean; sortOrder: number; bnplEnabled: boolean; maxCredit: number; minScore: number; merchantCommission: number }>) {
  // support lookup by slug or uuid
  const existing = await prisma.category.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });
  if (!existing) throw new Error('Category not found');
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.color !== undefined) data.color = input.color;
  if (input.active !== undefined) data.active = input.active;
  if (input.featured !== undefined) data.featured = input.featured;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.bnplEnabled !== undefined) data.bnplEnabled = input.bnplEnabled;
  if (input.maxCredit !== undefined) data.maxCredit = input.maxCredit;
  if (input.minScore !== undefined) data.minScore = input.minScore;
  if (input.merchantCommission !== undefined) data.merchantCommission = input.merchantCommission;
  if ((input as Record<string, unknown>).markupPercentage !== undefined) {
    const pct = Number((input as Record<string, unknown>).markupPercentage);
    data.markupPercentage = pct;
    data.markupMargin = pct / 100;
  }
  const updated = await prisma.category.update({ where: { id: existing.id }, data });
  const [merchantGroups, productGroups] = await Promise.all([
    prisma.merchant.groupBy({ by: ['category'], _count: { _all: true } }),
    prisma.product.groupBy({ by: ['categoryId'], _count: { _all: true } }),
  ]);
  const merchantCountMap: Record<string, number> = {};
  for (const g of merchantGroups) merchantCountMap[g.category] = g._count._all;
  const productCountMap: Record<string, number> = {};
  for (const g of productGroups) if (g.categoryId) productCountMap[g.categoryId] = g._count._all;
  return toPlatformCategory(updated, merchantCountMap, productCountMap);
}

export async function deleteCategory(idOrSlug: string) {
  const existing = await prisma.category.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } });
  if (!existing) throw new Error('Category not found');
  await prisma.category.delete({ where: { id: existing.id } });
  return { success: true };
}

export async function listBnplCategorySettings() {
  const cats = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  return cats.map(toBnplConfig);
}

// ===== System Settings (key-value for admin Settings tabs) =====
export async function getSystemSettings() {
  const rows = await prisma.systemSetting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function setSystemSetting(key: string, value: string) {
  return prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function updateUser(adminId: string, userId: string, data: { fullName?: string; email?: string; phone?: string; creditLimit?: number }) {
  const updateData: { fullName?: string; email?: string; phone?: string; creditLimit?: number } = {};
  if (data.fullName !== undefined) updateData.fullName = data.fullName;
  if (data.email !== undefined) updateData.email = data.email.toLowerCase();
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.creditLimit !== undefined) updateData.creditLimit = data.creditLimit;
  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: { id: true, email: true, phone: true, fullName: true, role: true, isActive: true, creditLimit: true },
  });
  await prisma.auditLog.create({ data: { userId: adminId, action: 'USER_UPDATED', entityType: 'User', entityId: userId, metadata: data as never } });
  return user;
}

export async function createAdminUser(data: { email: string; phone: string; fullName: string; password?: string; pin?: string; role?: string; creditLimit?: number }) {
  const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : await bcrypt.hash(Math.random().toString(36), 12);
  const pinHash = data.pin ? await bcrypt.hash(data.pin, 12) : undefined;
  const userRole = (data.role as UserRole) || 'ADMIN';
  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      phone: data.phone,
      fullName: data.fullName,
      passwordHash,
      pinHash,
      role: userRole,
      kycStatus: userRole === 'ADMIN' ? 'VERIFIED' : 'PENDING',
      isActive: true,
      creditLimit: data.creditLimit ?? (userRole === 'CUSTOMER' ? 100000 : undefined),
    },
    select: { id: true, email: true, phone: true, fullName: true, role: true, isActive: true, createdAt: true, creditLimit: true },
  });
  return user;
}

export async function resetUserPassword(id: string, newPassword?: string) {
  try {
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
      return { error: 'Invalid ID format' };
    }

    let targetUserId = id;

    // Check if the provided ID is already a valid User
    const userExists = await prisma.user.findUnique({ where: { id }, select: { id: true } });

    if (!userExists) {
      // Try to treat the ID as a Merchant ID and resolve its user
      const merchant = await prisma.merchant.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (merchant?.userId && uuidRegex.test(merchant.userId)) {
        targetUserId = merchant.userId;
      } else {
        return { error: 'No linked user account found for this merchant' };
      }
    }

    if (!uuidRegex.test(targetUserId)) {
      return { error: 'Resolved user ID is invalid' };
    }

    // Final safety check: does the resolved ID actually exist as a User?
    const finalUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!finalUser) {
      return { error: 'Linked user account no longer exists' };
    }

    const tempPassword = newPassword || ('Temp' + Math.random().toString(36).slice(2, 10) + '!');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash },
      select: { id: true, email: true, fullName: true },
    });

    return {
      user: updated,
      temporaryPassword: tempPassword,
    };
  } catch (err: unknown) {
    console.error('resetUserPassword error:', err);
    return { error: 'Failed to reset password' };
  }
}

export async function repairMerchantUserLink(merchantId: string) {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) return { error: 'Merchant not found' };

  // Check if current userId is valid and points to a real MERCHANT user
  if (merchant.userId) {
    const existing = await prisma.user.findUnique({
      where: { id: merchant.userId },
      select: { id: true, role: true },
    });
    if (existing?.role === 'MERCHANT') {
      return { success: true, message: 'Already correctly linked', userId: merchant.userId };
    }
  }

  // Create a new MERCHANT user for this merchant
  const base = merchant.businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const email = `${base}-${merchant.id.slice(0, 8)}@merchant.local`;
  const tempPassword = 'Repair' + Math.random().toString(36).slice(2, 10) + '!';
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const newUser = await prisma.user.create({
    data: {
      email,
      fullName: merchant.businessName,
      phone: '+237000000000',
      passwordHash,
      role: 'MERCHANT',
      kycStatus: 'PENDING',
      isActive: true,
    },
    select: { id: true, email: true, fullName: true },
  });

  await prisma.merchant.update({
    where: { id: merchantId },
    data: { userId: newUser.id },
  });

  return {
    success: true,
    message: 'Repaired — new user created and linked',
    userId: newUser.id,
    email: newUser.email,
    temporaryPassword: tempPassword,
  };
}

// ===== Admin Notifications =====

export async function listNotifications(params: {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  search?: string;
}) {
  const page = params.page || 1;
  const limit = params.limit || 20;

  const where: Prisma.NotificationWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.type) where.type = params.type;
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { body: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function createNotification(adminId: string, data: {
  title: string;
  body: string;
  type: string;
  target: string;
  priority?: string;
  scheduledAt?: string;
}) {
  const notification = await prisma.notification.create({
    data: {
      title: data.title,
      body: data.body,
      type: data.type,
      target: data.target,
      priority: data.priority || 'normal',
      status: data.scheduledAt ? 'scheduled' : 'draft',
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      createdById: adminId,
      audienceCount: 0, // will be calculated on send
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'NOTIFICATION_CREATED',
      entityType: 'Notification',
      entityId: notification.id,
    },
  });

  return notification;
}

export async function updateNotificationStatus(adminId: string, id: string, status: 'sent' | 'paused' | 'draft' | 'deleted') {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw new Error('Notification not found');

  if (status === 'deleted') {
    await prisma.notification.delete({ where: { id } });
    await prisma.auditLog.create({
      data: { userId: adminId, action: 'NOTIFICATION_DELETED', entityType: 'Notification', entityId: id },
    });
    return { success: true };
  }

  let audienceCount = notification.audienceCount;
  let sentCount = notification.sentCount;

  if (status === 'sent' && notification.status !== 'sent') {
    // Calculate real audience based on target
    let where: Prisma.UserWhereInput = {};

    if (notification.target === 'users') {
      where = { role: 'CUSTOMER' };
    } else if (notification.target === 'merchants') {
      where = { role: 'MERCHANT' };
    } else if (notification.target === 'premium') {
      where = { role: 'CUSTOMER', creditScore: { gte: 700 } };
    }
    // 'all' → no filter

    audienceCount = await prisma.user.count({ where });

    // Create UserNotification inbox entries
    const users = await prisma.user.findMany({
      where,
      select: { id: true },
    });

    const userNotifs = users.map(u => ({
      userId: u.id,
      notificationId: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
    }));

    if (userNotifs.length > 0) {
      await prisma.userNotification.createMany({ data: userNotifs, skipDuplicates: true });
    }

    // Deliver via SMS + Email (if configured)
    for (const u of users) {
      try {
        await deliverNotificationToUser(u.id, notification.title, notification.body, notification.type);
      } catch {
        // continue even if one delivery fails
      }
    }

    sentCount = users.length;
  }

  const updateData: Record<string, unknown> = { status };

  if (status === 'sent') {
    updateData.sentAt = new Date();
    updateData.audienceCount = audienceCount;
    updateData.sentCount = sentCount;
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: updateData,
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: `NOTIFICATION_${status.toUpperCase()}`,
      entityType: 'Notification',
      entityId: id,
    },
  });

  return updated;
}

// ===== Admin Product Management (for global catalogue control) =====

export async function listAdminProducts(params: { page: number; limit: number; search?: string }) {
  const where: Prisma.ProductWhereInput = {};
  if (params.search) where.name = { contains: params.search, mode: 'insensitive' };
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        merchant: { select: { id: true, businessName: true, city: true, category: true } },
        category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
        gallery: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { purchases: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.product.count({ where }),
  ]);
  const itemsWithSold = items.map(p => ({
    ...p,
    sold: p._count?.purchases ?? 0,
    imageUrl: resolveImageUrl(p.imageUrl),
  }));
  return { items: itemsWithSold, total, page: params.page, limit: params.limit };
}

export async function updateAdminProduct(productId: string, data: Partial<{
  name: string; description: string; price: number; costPrice: number;
  stock: number; imageUrl: string; bnplEligible: boolean; categoryId: string;
  isActive: boolean; deliveryFee: number; storageFee: number;
}>) {
  const product = await prisma.product.update({
    where: { id: productId },
    data,
    include: {
      merchant: { select: { id: true, businessName: true, city: true, category: true } },
      category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
      gallery: { orderBy: { sortOrder: 'asc' } },
    },
  });
  return product;
}

export async function deleteAdminProduct(adminId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error('Product not found');
  await prisma.product.update({ where: { id: productId }, data: { isActive: false } });
  await prisma.auditLog.create({
    data: { userId: adminId, action: 'PRODUCT_DELETED_BY_ADMIN', entityType: 'Product', entityId: productId },
  });
  return { success: true };
}

export async function createAdminProduct(adminId: string, data: {
  merchantId: string;
  name: string;
  description?: string;
  costPrice?: number;
  price?: number;
  stock?: number;
  imageUrl?: string;
  bnplEligible?: boolean;
  categoryId?: string;
  deliveryFee?: number;
  storageFee?: number;
}) {
  const merchant = await prisma.merchant.findUnique({ where: { id: data.merchantId } });
  if (!merchant) throw new Error('Target merchant not found');
  // Allow merchants with PENDING, ACTIVE, or SUSPENDED status to have products created
  if (merchant.status !== 'ACTIVE') throw new Error('Target merchant is not active');

  let finalPrice = data.price;
  if ((!finalPrice || finalPrice <= 0) && data.costPrice && data.costPrice > 0) {
    finalPrice = await suggestSellPrice(data.costPrice, data.categoryId);
  }
  if (!finalPrice || finalPrice < 100) {
    throw new Error('A valid selling price (>=100) is required (provide price or costPrice + category)');
  }

  const product = await prisma.product.create({
    data: {
      name: data.name,
      description: data.description,
      price: finalPrice,
      costPrice: data.costPrice ?? null,
      stock: data.stock ?? 0,
      imageUrl: data.imageUrl,
      bnplEligible: data.bnplEligible ?? true,
      categoryId: data.categoryId,
      merchantId: data.merchantId,
      deliveryFee: data.deliveryFee ?? null,
      storageFee: data.storageFee ?? null,
    },
    include: {
      merchant: { select: { id: true, businessName: true, city: true, category: true } },
      category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'PRODUCT_CREATED_BY_ADMIN',
      entityType: 'Product',
      entityId: product.id,
      metadata: { merchantId: data.merchantId } as never,
    },
  });

  return product;
}

export async function getDefaultFees() {
  const [storageFeeRow, deliveryFeeRow] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: 'default_storage_fee' } }),
    prisma.systemSetting.findUnique({ where: { key: 'default_delivery_fee' } }),
  ]);
  return {
    defaultStorageFee: Number(storageFeeRow?.value ?? 0),
    defaultDeliveryFee: Number(deliveryFeeRow?.value ?? 0),
  };
}

// ===== BNPL Fee Settings Management =====

export async function getBnplFeeSettings() {
  const [
    stockingFeeRow,
    accountCreationFeeRow,
    deliveryFeeRow,
    collectionFeeRow
  ] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: 'bnpl_stocking_fee' } }),
    prisma.systemSetting.findUnique({ where: { key: 'bnpl_account_creation_fee' } }),
    prisma.systemSetting.findUnique({ where: { key: 'bnpl_delivery_fee' } }),
    prisma.systemSetting.findUnique({ where: { key: 'bnpl_collection_fee' } }),
  ]);

  return {
    stockingFee: Number(stockingFeeRow?.value ?? 3000), // 3000 per month per product
    accountCreationFee: Number(accountCreationFeeRow?.value ?? 500), // 500 once for first BNPL
    deliveryFee: Number(deliveryFeeRow?.value ?? 0), // 0 by default
    collectionFee: Number(collectionFeeRow?.value ?? 1000), // 1000 once
  };
}

export async function updateBnplFeeSettings(adminId: string, settings: {
  stockingFee?: number;
  accountCreationFee?: number;
  deliveryFee?: number;
  collectionFee?: number;
}) {
  const updates = [];
  
  if (settings.stockingFee !== undefined) {
    updates.push(
      prisma.systemSetting.upsert({
        where: { key: 'bnpl_stocking_fee' },
        create: { key: 'bnpl_stocking_fee', value: String(settings.stockingFee) },
        update: { value: String(settings.stockingFee) },
      })
    );
  }
  
  if (settings.accountCreationFee !== undefined) {
    updates.push(
      prisma.systemSetting.upsert({
        where: { key: 'bnpl_account_creation_fee' },
        create: { key: 'bnpl_account_creation_fee', value: String(settings.accountCreationFee) },
        update: { value: String(settings.accountCreationFee) },
      })
    );
  }
  
  if (settings.deliveryFee !== undefined) {
    updates.push(
      prisma.systemSetting.upsert({
        where: { key: 'bnpl_delivery_fee' },
        create: { key: 'bnpl_delivery_fee', value: String(settings.deliveryFee) },
        update: { value: String(settings.deliveryFee) },
      })
    );
  }
  
  if (settings.collectionFee !== undefined) {
    updates.push(
      prisma.systemSetting.upsert({
        where: { key: 'bnpl_collection_fee' },
        create: { key: 'bnpl_collection_fee', value: String(settings.collectionFee) },
        update: { value: String(settings.collectionFee) },
      })
    );
  }

  await prisma.$transaction(updates);

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'BNPL_FEE_SETTINGS_UPDATED',
      entityType: 'SystemSetting',
      metadata: settings as never,
    },
  });

  return await getBnplFeeSettings();
}

// ===== Category Margin Management =====

export async function updateCategoryMargin(adminId: string, categoryId: string, marginPercentage: number) {
  // Validate margin percentage
  if (marginPercentage < 0 || marginPercentage > 100) {
    throw new Error('Margin percentage must be between 0 and 100');
  }

  const marginDecimal = marginPercentage / 100;

  const result = await prisma.$transaction(async (tx) => {
    // Update the category margin
    const updatedCategory = await tx.category.update({
      where: { id: categoryId },
      data: {
        markupPercentage: marginPercentage,
        markupMargin: marginDecimal,
      },
    });

    // Get all products in this category that have a costPrice
    const products = await tx.product.findMany({
      where: { 
        categoryId,
        costPrice: { not: null },
        isActive: true,
      },
      select: { id: true, costPrice: true, price: true },
    });

    // Update all product prices based on new margin
    const updatePromises = products.map((product) => {
      const newPrice = Math.round(product.costPrice! * (1 + marginDecimal));
      return tx.product.update({
        where: { id: product.id },
        data: { price: newPrice },
      });
    });

    await Promise.all(updatePromises);

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'CATEGORY_MARGIN_UPDATED',
        entityType: 'Category',
        entityId: categoryId,
        metadata: { 
          categoryId, 
          marginPercentage, 
          productsUpdated: products.length,
          oldMargin: updatedCategory.markupPercentage,
        } as never,
      },
    });

    return {
      category: updatedCategory,
      productsUpdated: products.length,
    };
  });

  return result;
}

export async function updateAllCategoryMargins(adminId: string, marginPercentage: number) {
  // Validate margin percentage
  if (marginPercentage < 0 || marginPercentage > 100) {
    throw new Error('Margin percentage must be between 0 and 100');
  }

  const marginDecimal = marginPercentage / 100;

  const result = await prisma.$transaction(async (tx) => {
    // Update all categories
    const categories = await tx.category.findMany({
      where: { active: true },
      select: { id: true, name: true, markupPercentage: true },
    });

    const categoryUpdates = categories.map((category) =>
      tx.category.update({
        where: { id: category.id },
        data: {
          markupPercentage: marginPercentage,
          markupMargin: marginDecimal,
        },
      })
    );

    await Promise.all(categoryUpdates);

    // Get all active products that have a costPrice
    const products = await tx.product.findMany({
      where: { 
        costPrice: { not: null },
        isActive: true,
      },
      select: { id: true, costPrice: true, price: true, categoryId: true },
    });

    // Update all product prices based on new margin
    const updatePromises = products.map((product) => {
      const newPrice = Math.round(product.costPrice! * (1 + marginDecimal));
      return tx.product.update({
        where: { id: product.id },
        data: { price: newPrice },
      });
    });

    await Promise.all(updatePromises);

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'ALL_CATEGORY_MARGINS_UPDATED',
        entityType: 'Category',
        metadata: { 
          marginPercentage, 
          categoriesUpdated: categories.length,
          productsUpdated: products.length,
        } as never,
      },
    });

    return {
      categoriesUpdated: categories.length,
      productsUpdated: products.length,
    };
  });

  return result;
}

// ===== Admin Wallet Management =====

export async function listMerchantWallets(params: { page: number; limit: number; search?: string }) {
  const page = params.page || 1;
  const limit = params.limit || 20;

  const where: Prisma.MerchantWhereInput = {};
  if (params.search) {
    where.businessName = { contains: params.search, mode: 'insensitive' };
  }

  const [merchants, total] = await Promise.all([
    prisma.merchant.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, fullName: true, phone: true, wallet: true },
        },
        _count: { select: { orders: true, products: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.merchant.count({ where }),
  ]);

  const items = merchants.map((m) => ({
    merchantId: m.id,
    businessName: m.businessName,
    ownerName: m.user?.fullName || '',
    email: m.user?.email || '',
    phone: m.user?.phone || '',
    status: m.status,
    walletBalance: m.user?.wallet?.balance ?? 0,
    currency: m.user?.wallet?.currency ?? 'XAF',
    totalOrders: m._count.orders,
    totalProducts: m._count.products,
  }));

  return { items, total, page, limit };
}

export async function getMerchantWalletById(merchantId: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: {
      user: {
        select: { id: true, email: true, fullName: true, phone: true, wallet: true },
      },
    },
  });
  if (!merchant) throw new Error('Merchant not found');

  const wallet = merchant.user?.wallet;
  const transactions = await prisma.transaction.findMany({
    where: { userId: merchant.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const payouts = await prisma.payoutRequest.findMany({
    where: { merchantId },
    orderBy: { requestedAt: 'desc' },
    take: 20,
  });

  return {
    merchantId: merchant.id,
    businessName: merchant.businessName,
    ownerName: merchant.user?.fullName || '',
    walletBalance: wallet?.balance ?? 0,
    currency: wallet?.currency ?? 'XAF',
    transactions,
    payouts,
  };
}

export async function adminCreditMerchantWallet(adminId: string, merchantId: string, amount: number, note?: string) {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw new Error('Merchant not found');

  // Ensure wallet exists
  const wallet = await prisma.wallet.upsert({
    where: { userId: merchant.userId },
    create: { userId: merchant.userId, balance: 0 },
    update: {},
  });

  const newBalance = wallet.balance + amount;
  const updatedWallet = await prisma.wallet.update({
    where: { userId: merchant.userId },
    data: { balance: newBalance },
  });

  // Create transaction record
  await prisma.transaction.create({
    data: {
      userId: merchant.userId,
      type: amount >= 0 ? 'DEPOSIT' : 'WITHDRAWAL',
      amount: Math.abs(amount),
      status: 'COMPLETED',
      metadata: { note, adminId, source: 'admin_credit' } as never,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: amount >= 0 ? 'WALLET_CREDITED' : 'WALLET_DEBITED',
      entityType: 'Wallet',
      entityId: wallet.id,
      metadata: { merchantId, amount, note } as never,
    },
  });

  return { walletBalance: updatedWallet.balance, currency: updatedWallet.currency };
}

export async function adminCreditClientWallet(adminId: string, userId: string, amount: number, note?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  // Ensure wallet exists
  const wallet = await prisma.wallet.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: {},
  });

  const newBalance = wallet.balance + amount;
  const updatedWallet = await prisma.wallet.update({
    where: { userId },
    data: { balance: newBalance },
  });

  // Create transaction record
  await prisma.transaction.create({
    data: {
      userId,
      type: amount >= 0 ? 'DEPOSIT' : 'WITHDRAWAL',
      amount: Math.abs(amount),
      status: 'COMPLETED',
      metadata: { note, adminId, source: 'admin_client_credit' } as never,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: amount >= 0 ? 'CLIENT_WALLET_CREDITED' : 'CLIENT_WALLET_DEBITED',
      entityType: 'Wallet',
      entityId: wallet.id,
      metadata: { userId, amount, note } as never,
    },
  });

  return { walletBalance: updatedWallet.balance, currency: updatedWallet.currency };
}

export async function adminContributeToInstallment(adminId: string, instalmentId: string, amount: number, note?: string) {
  const instalment = await prisma.instalment.findUnique({
    where: { id: instalmentId },
    include: { purchase: true },
  });
  if (!instalment) throw new Error('Instalment not found');
  if (instalment.status === 'PAID' || instalment.status === 'WAIVED') throw new Error('Instalment already paid or waived');

  const paymentAmount = Math.min(amount, instalment.amount - instalment.paidAmount);
  if (paymentAmount <= 0) throw new Error('Invalid payment amount');

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
      provider: 'ADMIN_CONTRIBUTION',
      metadata: { instalmentId, adminId, note, source: 'admin_contribution' } as never,
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
      userId: adminId,
      action: 'INSTALLMENT_CONTRIBUTION',
      entityType: 'Instalment',
      entityId: instalmentId,
      metadata: { purchaseId: instalment.purchaseId, amount: paymentAmount, note } as never,
    },
  });

  return {
    instalmentId: updatedInstalment.id,
    paidAmount: updatedInstalment.paidAmount,
    remainingAmount: updatedInstalment.amount - updatedInstalment.paidAmount,
    status: updatedInstalment.status,
  };
}

export async function applyDefaultFeesToProducts(adminId: string) {
  const { defaultStorageFee, defaultDeliveryFee } = await getDefaultFees();
  
  const result = await prisma.$transaction(async (tx) => {
    const [updatedStorage, updatedDelivery] = await Promise.all([
      tx.product.updateMany({
        where: { storageFee: null },
        data: { storageFee: defaultStorageFee > 0 ? defaultStorageFee : 0 },
      }),
      tx.product.updateMany({
        where: { deliveryFee: null },
        data: { deliveryFee: defaultDeliveryFee > 0 ? defaultDeliveryFee : 0 },
      }),
    ]);
    
    const totalUpdated = (updatedStorage.count ?? 0) + (updatedDelivery.count ?? 0);
    
    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'DEFAULT_FEES_APPLIED',
        entityType: 'Product',
        metadata: { defaultStorageFee, defaultDeliveryFee, count: totalUpdated } as never,
      },
    });
    
    return { updatedStorage: updatedStorage.count, updatedDelivery: updatedDelivery.count, total: totalUpdated };
  });
  
  return result;
}

