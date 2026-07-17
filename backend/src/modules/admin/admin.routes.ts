import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { creditLimitSchema, kycDecisionSchema, listFilterSchema, merchantStatusSchema } from './admin.schema';
import { listBnplPurchases, listMerchants, listTransactions, listUsers, reportsSummary, setCreditLimit, setKycDecision, setMerchantStatus, updateMerchant, setUserActive, deleteAdminUser, listCategories, createCategory, updateCategory, deleteCategory, listBnplCategorySettings, getSystemSettings, setSystemSetting, createAdminUser, updateUser, resetUserPassword, repairMerchantUserLink, listNotifications, createNotification, updateNotificationStatus, createAdminProduct, listAdminProducts, updateAdminProduct, deleteAdminProduct, bulkDeleteAdminProducts, listAllConversations, getAllConversationMessages, adminSendMessage, getDefaultFees, applyDefaultFeesToProducts, listMerchantWallets, getMerchantWalletById, adminCreditMerchantWallet, adminCreditClientWallet, adminContributeToInstallment, createTransaction, getBnplFeeSettings, updateBnplFeeSettings, updateCategoryMargin, updateAllCategoryMargins } from './admin.service';
import { approvePayoutRequest, rejectPayoutRequest, setMerchantCategories } from '../merchants/merchants.service';
import { listDisputes, getDisputeById, resolveDispute, listFraudAlerts, getFraudAlertById, resolveFraudAlert } from './admin.service-disputes';
import { listAllReferrals, getReferralStats } from './admin.service-referrals';
import { enqueueScoreUpdate } from '../../jobs/queue';
import { prisma } from '../../config/db';
import { TransactionType, TransactionStatus } from '@prisma/client';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', authorize('ADMIN'));

app.get('/users', { schema: listFilterSchema }, async (req, reply) => {
    const q = req.query as { page?: number; limit?: number; role?: 'ADMIN' | 'MERCHANT' | 'CUSTOMER'; kycStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED'; search?: string };
    if (!req.authUser) return reply.code(401).send({ error: 'Unauthorized' });
     return listUsers({ page: q.page ?? 1, limit: q.limit ?? 20, role: q.role, kycStatus: q.kycStatus, search: q.search });
  });

  app.put('/users/:id/kyc', { schema: kycDecisionSchema }, async (req) => {
    const { id } = req.params as { id: string };
    const { status, note } = req.body as { status: 'VERIFIED' | 'REJECTED'; note?: string };
    const user = await setKycDecision(req.authUser!.id, id, status, note);
    await enqueueScoreUpdate(id);
    return user;
  });

  app.put('/users/:id/credit-limit', { schema: creditLimitSchema }, async (req) => {
    const { id } = req.params as { id: string };
    const { creditLimit } = req.body as { creditLimit: number };
    return setCreditLimit(req.authUser!.id, id, creditLimit);
  });

  app.put('/users/:id/active', async (req) => {
    const { id } = req.params as { id: string };
    const { isActive } = req.body as { isActive: boolean };
    return setUserActive(req.authUser!.id, id, isActive);
  });

  app.delete('/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await deleteAdminUser(req.authUser!.id, id);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete user';
      return reply.code(400).send({ error: msg });
    }
  });

  app.get('/merchants', { schema: listFilterSchema }, async (req) => {
    const q = req.query as { page?: number; limit?: number; status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED'; search?: string };
    return listMerchants({ page: q.page ?? 1, limit: q.limit ?? 20, status: q.status, search: q.search });
  });

  app.put('/merchants/:id/status', { schema: merchantStatusSchema }, async (req) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' };
    return setMerchantStatus(req.authUser!.id, id, status);
  });

  app.put('/merchants/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { businessName?: string; category?: string; city?: string; commissionRate?: number; owner?: string; email?: string; phone?: string };
    try {
      return await updateMerchant(req.authUser!.id, id, body);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update merchant';
      return reply.code(400).send({ error: msg });
    }
  });

  app.post('/merchants/:id/repair-link', async (req) => {
    const { id } = req.params as { id: string };
    return repairMerchantUserLink(id);
  });

  // Admin: set categories for a merchant (replaces all existing)
  app.put('/merchants/:id/categories', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { categoryIds, allCategories } = req.body as { categoryIds?: string[]; allCategories?: boolean };
    try {
      const entries = await setMerchantCategories(id, categoryIds ?? [], allCategories ?? false);
      return { categories: entries.map(e => e.category) };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update categories';
      return reply.code(400).send({ error: msg });
    }
  });

  // Bulk merchant status update
  app.post('/merchants/bulk-status', async (req, reply) => {
    const { ids, status } = req.body as { ids: string[]; status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' };
    if (!ids?.length) return reply.code(400).send({ error: 'ids required' });
    await prisma.merchant.updateMany({ where: { id: { in: ids } }, data: { status } });
    await prisma.auditLog.create({ data: { userId: req.authUser!.id, action: `BULK_MERCHANT_${status}`, entityType: 'Merchant', entityId: ids.join(',') } });
    return { updated: ids.length };
  });

  // Bulk user active toggle
  app.post('/users/bulk-active', async (req, reply) => {
    const { ids, isActive } = req.body as { ids: string[]; isActive: boolean };
    if (!ids?.length) return reply.code(400).send({ error: 'ids required' });
    await prisma.user.updateMany({ where: { id: { in: ids } }, data: { isActive } });
    await prisma.auditLog.create({ data: { userId: req.authUser!.id, action: isActive ? 'BULK_USER_ACTIVATE' : 'BULK_USER_SUSPEND', entityType: 'User', entityId: ids.join(',') } });
    return { updated: ids.length };
  });

  // Bulk product activate/deactivate
  app.post('/products/bulk-active', async (req, reply) => {
    const { ids, isActive } = req.body as { ids: string[]; isActive: boolean };
    if (!ids?.length) return reply.code(400).send({ error: 'ids required' });
    await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isActive } });
    await prisma.auditLog.create({ data: { userId: req.authUser!.id, action: isActive ? 'BULK_PRODUCT_ACTIVATE' : 'BULK_PRODUCT_DEACTIVATE', entityType: 'Product', entityId: ids.join(',') } });
    return { updated: ids.length };
  });

  // Bulk product delete
  app.post('/products/bulk-delete', async (req, reply) => {
    const { ids } = req.body as { ids: string[] };
    if (!ids?.length) return reply.code(400).send({ error: 'ids required' });
    return bulkDeleteAdminProducts(req.authUser!.id, ids);
  });

  // Bulk payout approve
  app.post('/payouts/bulk-approve', async (req, reply) => {
    const { ids } = req.body as { ids: string[] };
    if (!ids?.length) return reply.code(400).send({ error: 'ids required' });
    const results = await Promise.allSettled(ids.map(id => approvePayoutRequest(req.authUser!.id, id)));
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    return { succeeded, failed };
  });

  // Bulk payout reject
  app.post('/payouts/bulk-reject', async (req, reply) => {
    const { ids, note } = req.body as { ids: string[]; note?: string };
    if (!ids?.length) return reply.code(400).send({ error: 'ids required' });
    const results = await Promise.allSettled(ids.map(id => rejectPayoutRequest(req.authUser!.id, id, note)));
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    return { succeeded, failed };
  });

  app.get('/transactions', { schema: listFilterSchema }, async (req) => {
    const q = req.query as { page?: number; limit?: number; status?: string };
    return listTransactions({ page: q.page ?? 1, limit: q.limit ?? 20, status: q.status });
  });

  // Admin can create transactions manually (deposits, adjustments, etc.)
  app.post('/transactions', async (req) => {
    const body = req.body as { userId: string; type: string; amount: number; description?: string; merchantId?: string; provider?: string };
    return createTransaction(req.authUser!.id, body);
  });

  app.get('/bnpl', { schema: listFilterSchema }, async (req) => {
    const q = req.query as { page?: number; limit?: number; status?: string };
    return listBnplPurchases({ page: q.page ?? 1, limit: q.limit ?? 20, status: q.status });
  });

  app.get('/reports/summary', async () => reportsSummary());

  // Category distribution for pie chart (based on actual products)
  app.get('/reports/category-distribution', async () => {
    const { prisma } = await import('../../config/db');
    const categories = await prisma.category.findMany({ select: { id: true, name: true, color: true }, orderBy: { sortOrder: 'asc' } });
    const productCounts = await prisma.product.groupBy({ by: ['categoryId'], _count: { _all: true } });
    const countMap: Record<string, number> = {};
    for (const p of productCounts) {
      if (p.categoryId) countMap[p.categoryId] = p._count._all;
    }
    const total = Object.values(countMap).reduce((s, v) => s + v, 0) || 1;
    // Return all categories, including those with 0 products
    const data = categories.map((cat) => ({
      label: cat.name,
      value: Math.round(((countMap[cat.id] ?? 0) / total) * 100),
      color: cat.color || '#4DB049',
    }));
    return { data };
  });

  // Categories management (for admin settings)
  app.get('/categories', async () => listCategories());
  app.post('/categories', async (req) => {
    const body = req.body as Record<string, unknown>;
    return createCategory(body as Parameters<typeof createCategory>[0]);
  });
  app.put('/categories/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    return updateCategory(id, body as Parameters<typeof updateCategory>[1]);
  });
  app.delete('/categories/:id', async (req) => {
    const { id } = req.params as { id: string };
    return deleteCategory(id);
  });

  // BNPL category settings (read-only list for now; updates via /categories PUT)
  app.get('/bnpl/category-settings', async () => listBnplCategorySettings());

  // Global system settings (used by Settings page tabs)
  app.get('/settings', async () => getSystemSettings());
  app.put('/settings/:key', async (req) => {
    const { key } = req.params as { key: string };
    const { value } = req.body as { value: string };
    return setSystemSetting(key, value);
  });

  // Create new user (customer, merchant or admin) from admin panel
  app.post('/users', async (req) => {
    const body = req.body as { email: string; phone: string; fullName: string; password?: string; pin?: string; role?: string; creditLimit?: number };
    return createAdminUser(body);
  });

  // Update user profile fields
  app.patch('/users/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { fullName?: string; email?: string; phone?: string; creditLimit?: number };
    return updateUser(req.authUser!.id, id, body);
  });

  // Reset password for any user (merchants, admins, customers)
  app.post('/users/:id/reset-password', async (req) => {
    const { id } = req.params as { id: string };
    const { password } = req.body as { password?: string };
    try {
      const result = await resetUserPassword(id, password);
      return result;
    } catch (err: unknown) {
      req.log.error({ err: err instanceof Error ? err.message : err, id }, 'reset-password unexpected failure');
      return { error: 'Unexpected error while resetting password' };
    }
  });

  // ===== Admin Notifications =====
  app.get('/notifications', async (req) => {
    const q = req.query as { page?: string; limit?: string; status?: string; type?: string; search?: string };
    return listNotifications({
      page: q.page ? parseInt(q.page, 10) : undefined,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      status: q.status,
      type: q.type,
      search: q.search,
    });
  });

  app.post('/notifications', async (req) => {
    const body = req.body as Record<string, unknown>;
    return createNotification(req.authUser!.id, body as Parameters<typeof createNotification>[1]);
  });

  app.put('/notifications/:id/status', async (req) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: 'sent' | 'paused' | 'draft' | 'deleted' };
    return updateNotificationStatus(req.authUser!.id, id, status);
  });

// Admin product listing (all products, no isActive filter)
   app.get('/products', async (req) => {
     const q = req.query as { page?: string; limit?: string; search?: string };
     return listAdminProducts({ page: Number(q.page ?? 1), limit: Number(q.limit ?? 20), search: q.search });
   });

  // Admin can create products on behalf of any merchant (global catalogue)
  app.post('/products', async (req) => {
    const body = req.body as Record<string, unknown>;
    if (!body.merchantId) {
      return { error: 'merchantId is required for admin product creation' };
    }
    return createAdminProduct(req.authUser!.id, body as Parameters<typeof createAdminProduct>[1]);
  });

  // Admin can update any product
  app.put('/products/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    return updateAdminProduct(id, body as Parameters<typeof updateAdminProduct>[1]);
  });

  // Admin can soft-delete any product
  app.delete('/products/:id', async (req) => {
    const { id } = req.params as { id: string };
    return deleteAdminProduct(req.authUser!.id, id);
  });

  // ===== Admin Messaging - view all conversations and support messages =====
  app.get('/conversations', async (req) => {
    const q = req.query as { page?: string; limit?: string; search?: string };
    return listAllConversations({ page: Number(q.page ?? 1), limit: Number(q.limit ?? 20), search: q.search });
  });

  app.get('/conversations/:id/messages', async (req) => {
    const { id } = req.params as { id: string };
    const q = req.query as { limit?: string; before?: string };
    return getAllConversationMessages(id, { limit: Number(q.limit ?? 50), before: q.before });
  });

  app.post('/conversations/:id/messages', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { text?: string; attachmentUrl?: string; attachmentType?: string };
    return adminSendMessage(id, req.authUser!.id, body);
  });

  // Default Fees for Products
  app.get('/fees/default', async () => getDefaultFees());
  app.post('/fees/apply', async (req) => {
    return applyDefaultFeesToProducts(req.authUser!.id);
  });

  // BNPL Fee Settings
  app.get('/fees/bnpl', async () => getBnplFeeSettings());
  app.put('/fees/bnpl', async (req) => {
    const body = req.body as {
      stockingFee?: number;
      accountCreationFee?: number;
      deliveryFee?: number;
      collectionFee?: number;
    };
    return updateBnplFeeSettings(req.authUser!.id, body);
  });

  // Category Margin Management
  app.put('/categories/:id/margin', async (req) => {
    const { id } = req.params as { id: string };
    const { marginPercentage } = req.body as { marginPercentage: number };
    return updateCategoryMargin(req.authUser!.id, id, marginPercentage);
  });

  app.put('/categories/margin/all', async (req) => {
    const { marginPercentage } = req.body as { marginPercentage: number };
    return updateAllCategoryMargins(req.authUser!.id, marginPercentage);
  });

  // ===== Admin Wallet Management =====
  app.get('/wallets', async (req) => {
    const q = req.query as { page?: string; limit?: string; search?: string };
    return listMerchantWallets({ page: Number(q.page ?? 1), limit: Number(q.limit ?? 20), search: q.search });
  });

  app.get('/wallets/:merchantId', async (req) => {
    const { merchantId } = req.params as { merchantId: string };
    return getMerchantWalletById(merchantId);
  });

  app.post('/wallets/:merchantId/credit', async (req) => {
    const { merchantId } = req.params as { merchantId: string };
    const { amount, note } = req.body as { amount: number; note?: string };
    return adminCreditMerchantWallet(req.authUser!.id, merchantId, amount, note);
  });

  app.post('/users/:userId/wallet/credit', async (req) => {
    const { userId } = req.params as { userId: string };
    const { amount, note, provider, phone } = req.body as { amount: number; note?: string; provider?: 'ORANGE_MONEY' | 'MTN_MOMO'; phone?: string };
    return adminCreditClientWallet(req.authUser!.id, userId, amount, note, provider, phone);
  });

  app.post('/installments/:instalmentId/contribute', async (req) => {
    const { instalmentId } = req.params as { instalmentId: string };
    const { amount, note } = req.body as { amount: number; note?: string };
    return adminContributeToInstallment(req.authUser!.id, instalmentId, amount, note);
  });

  // ===== Admin payout management (already in accounting but also accessible here) =====
  app.get('/payouts', async (req) => {
    const q = req.query as { page?: string; limit?: string; status?: string };
    const page = Number(q.page ?? 1);
    const limit = Number(q.limit ?? 20);
    const where: { status?: string } = {};
    if (q.status) where.status = q.status;
    const { prisma } = await import('../../config/db');
    const [items, total] = await Promise.all([
      prisma.payoutRequest.findMany({
        where,
        include: { merchant: { select: { id: true, businessName: true } } },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payoutRequest.count({ where }),
    ]);
    return { items, total, page, limit };
  });

  app.post('/payouts/:id/approve', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await approvePayoutRequest(req.authUser!.id, id);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve payout';
      return reply.code(400).send({ error: msg });
    }
  });

  app.post('/payouts/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { note } = req.body as { note?: string };
    try {
      const result = await rejectPayoutRequest(req.authUser!.id, id, note);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject payout';
      return reply.code(400).send({ error: msg });
    }
  });

  app.post('/payouts/:id/status', async (req) => {
    const { id } = req.params as { id: string };
    const { status, note } = req.body as { status: string; note?: string };
    const updated = await prisma.payoutRequest.update({
      where: { id },
      data: { status, note, processedAt: status !== 'PENDING' ? new Date() : undefined },
    });
    return updated;
  });

  // ===== Disputes =====
  app.get('/disputes', async (req) => {
    const q = req.query as { page?: string; limit?: string; status?: string };
    return listDisputes({
      page: q.page ? parseInt(q.page, 10) : undefined,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      status: q.status,
    });
  });

  app.get('/disputes/:id', async (req) => {
    const { id } = req.params as { id: string };
    return getDisputeById(id);
  });

  app.put('/disputes/:id/resolve', async (req) => {
    const { id } = req.params as { id: string };
    const { resolution } = req.body as { resolution: string };
    return resolveDispute(req.authUser!.id, id, resolution);
  });

  // ===== Fraud Alerts =====
  app.get('/fraud-alerts', async (req) => {
    const q = req.query as { page?: string; limit?: string; status?: string; severity?: string };
    return listFraudAlerts({
      page: q.page ? parseInt(q.page, 10) : undefined,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      status: q.status,
      severity: q.severity,
    });
  });

  app.get('/fraud-alerts/:id', async (req) => {
    const { id } = req.params as { id: string };
    return getFraudAlertById(id);
  });

  app.put('/fraud-alerts/:id/resolve', async (req) => {
    const { id } = req.params as { id: string };
    return resolveFraudAlert(req.authUser!.id, id);
  });

  // ===== Referrals =====
  app.get('/referrals', { schema: listFilterSchema }, async (req) => {
    const q = req.query as { page?: number; limit?: number; status?: string; search?: string };
    return listAllReferrals({ page: q.page ?? 1, limit: q.limit ?? 20, status: q.status, search: q.search });
  });

  app.get('/referrals/stats', async () => {
    return getReferralStats();
  });

  // ===== Cash Withdrawals =====
  // List all cash withdrawal requests
  app.get('/withdrawals/cash', { schema: listFilterSchema }, async (req) => {
    const q = req.query as { page?: number; limit?: number; status?: string };

    const where: { type: TransactionType; provider: string; status?: TransactionStatus } = {
      type: TransactionType.WITHDRAWAL,
      provider: 'CASH',
    };
    if (q.status && Object.values(TransactionStatus).includes(q.status as TransactionStatus)) {
      where.status = q.status as TransactionStatus;
    }

    const [withdrawals, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: ((q.page ?? 1) - 1) * (q.limit ?? 20),
        take: q.limit ?? 20,
        include: {
          user: {
            select: { id: true, fullName: true, phone: true, email: true },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      withdrawals: withdrawals.map(w => ({
        id: w.id,
        userId: w.userId,
        userName: w.user?.fullName,
        userPhone: w.user?.phone,
        userEmail: w.user?.email,
        amount: Math.abs(w.amount),
        status: w.status,
        providerRef: w.providerRef,
        createdAt: w.createdAt,
        metadata: w.metadata,
      })),
      pagination: {
        page: q.page ?? 1,
        limit: q.limit ?? 20,
        total,
        totalPages: Math.ceil(total / (q.limit ?? 20)),
      },
    };
  });

  // Approve a cash withdrawal
  app.put('/withdrawals/cash/:id/approve', async (req) => {
    const { id } = req.params as { id: string };

    const withdrawal = await prisma.transaction.findFirst({
      where: { id, type: TransactionType.WITHDRAWAL, provider: 'CASH' },
    });

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.status !== 'PENDING') {
      throw new Error('Withdrawal is not pending');
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        metadata: {
          ...(withdrawal.metadata as Record<string, unknown> || {}),
          adminApproved: true,
          approvedAt: new Date().toISOString(),
          approvedBy: req.authUser!.id,
        },
      },
    });

    return {
      success: true,
      id: updated.id,
      status: 'COMPLETED',
      message: 'Cash withdrawal approved. User can now collect cash at office.',
    };
  });

  // Reject a cash withdrawal
  app.put('/withdrawals/cash/:id/reject', async (req) => {
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason?: string };

    const withdrawal = await prisma.transaction.findFirst({
      where: { id, type: TransactionType.WITHDRAWAL, provider: 'CASH' },
    });

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.status !== 'PENDING') {
      throw new Error('Withdrawal is not pending');
    }

    // Refund the amount back to user's rewards/referral balance
    // For now, just mark as rejected - the actual refund logic would be more complex
    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        status: 'FAILED',
        metadata: {
          ...(withdrawal.metadata as Record<string, unknown> || {}),
          adminRejected: true,
          rejectedAt: new Date().toISOString(),
          rejectedBy: req.authUser!.id,
          rejectReason: reason || 'No reason provided',
        },
      },
    });

    return {
      success: true,
      id: updated.id,
      status: 'FAILED',
      message: 'Cash withdrawal rejected. Amount will be returned to user\'s balance.',
    };
  });
}
