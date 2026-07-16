import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { paginationSchema } from '../users/users.schema';
import { productCreateSchema, productUpdateSchema, registerMerchantSchema } from './merchants.schema';
import { 
  getMerchantByUser, getMerchantProducts, getPublicMerchant, MerchantError, merchantDashboard, merchantOrders, 
  registerMerchant, getMerchantProfile, updateMerchantProfile, getMerchantSettings, updateMerchantSettings, 
  changeMerchantPassword, getMerchantNotificationPreferences, updateMerchantNotificationPreferences,
  getMerchantNotifications, markMerchantNotificationRead, getMerchantUnreadNotificationCount, markAllMerchantNotificationsRead,
  getMerchantPayoutRequests, createPayoutRequest, getMerchantWallet,
  getMerchantStaff, createMerchantStaff, updateMerchantStaff, updateMerchantStaffStatus, deleteMerchantStaff, resetMerchantStaffPassword,
  getMerchantCustomers, createMerchantCustomer, updateMerchantCustomer, updateMerchantCustomerStatus, deleteMerchantCustomer, resetMerchantCustomerPassword,
  merchantCreditClientWallet, merchantContributeToInstallment, setMerchantCategories
} from './merchants.service';
import { issueTokens } from '../auth/auth.service';
import { prisma } from '../../config/db';
import { suggestSellPrice } from '../products/products.service';
import { resolveImageUrl } from '../../services/storage-local.service';

export async function merchantPublicRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', { schema: registerMerchantSchema }, async (req, reply) => {
    try {
      const body = req.body as Parameters<typeof registerMerchant>[0] & { settings?: Record<string, unknown> };
      const { user, merchant } = await registerMerchant(body);
      const tokens = await issueTokens(app, { id: user.id, role: user.role, email: user.email });
      return reply.code(201).send({
        user: { id: user.id, email: user.email, role: user.role },
        merchant: { id: merchant.id, businessName: merchant.businessName, status: merchant.status },
        ...tokens,
      });
    } catch (e) {
      if (e instanceof MerchantError) return reply.code(e.statusCode).send({ error: 'MerchantError', message: e.message });
      throw e;
    }
  });

  app.get('/:id', async (req, reply) => {
    try { return await getPublicMerchant((req.params as { id: string }).id); }
    catch (e) { if (e instanceof MerchantError) return reply.code(e.statusCode).send({ error: 'MerchantError', message: e.message }); throw e; }
  });

  app.get('/:id/products', async (req) => {
    const items = await getMerchantProducts((req.params as { id: string }).id);
    return { items };
  });
}

export async function merchantSelfRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', authorize('MERCHANT'));

  app.get('/dashboard', async (req) => merchantDashboard(req.authUser!.id));

  app.get('/profile', async (req) => getMerchantProfile(req.authUser!.id));

  app.put('/profile', async (req) => {
    const body = req.body as { name?: string; owner?: string; email?: string; phone?: string; city?: string; category?: string };
    return updateMerchantProfile(req.authUser!.id, {
      name: body.name,
      owner: body.owner,
      email: body.email,
      phone: body.phone,
      city: body.city,
      category: body.category,
    });
  });

  app.get('/settings', async (req) => getMerchantSettings(req.authUser!.id));
  app.put('/settings', async (req) => updateMerchantSettings(req.authUser!.id, req.body as Record<string, unknown>));

  // Dedicated notification preferences endpoints (used by merchant settings)
  app.get('/notification-preferences', async (req) => getMerchantNotificationPreferences(req.authUser!.id));
  app.put('/notification-preferences', async (req) => updateMerchantNotificationPreferences(req.authUser!.id, req.body as Record<string, unknown>));

  app.post('/change-password', async (req) => {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    await changeMerchantPassword(req.authUser!.id, currentPassword, newPassword);
    return { success: true };
  });

  // Merchant Notifications Inbox
  app.get('/notifications', async (req) => getMerchantNotifications(req.authUser!.id));
  app.get('/notifications/unread-count', async (req) => getMerchantUnreadNotificationCount(req.authUser!.id));
  app.put('/notifications/:id/read', async (req) => {
    const { id } = req.params as { id: string };
    return markMerchantNotificationRead(req.authUser!.id, id);
  });
  app.post('/notifications/mark-all-read', async (req) => markAllMerchantNotificationsRead(req.authUser!.id));

  app.get('/orders', { schema: paginationSchema }, async (req) => {
    const { page = 1, limit = 20 } = req.query as { page?: number; limit?: number };
    return merchantOrders(req.authUser!.id, page, limit);
  });

  app.get('/products', async (req) => {
    const merchant = await getMerchantByUser(req.authUser!.id);
    const q = req.query as { page?: number; limit?: number };
    const page = Number(q.page) || 1;
    const limit = Number(q.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where: { merchantId: merchant.id },
        include: {
          category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
          merchant: { select: { category: true } },
          gallery: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { purchases: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where: { merchantId: merchant.id } }),
    ]);

    const itemsWithSold = items.map(p => ({
      ...p,
      sold: p._count?.purchases ?? 0,
      imageUrl: resolveImageUrl(p.imageUrl),
      gallery: p.gallery.map(g => ({ ...g, imageUrl: resolveImageUrl(g.imageUrl) })), 
    }));

    return { items: itemsWithSold, total, page, limit };
  });

  app.post('/products', { schema: productCreateSchema }, async (req, reply) => {
    const merchant = await getMerchantByUser(req.authUser!.id);
    if (merchant.status !== 'ACTIVE') return reply.code(403).send({ error: 'Forbidden', message: 'Merchant not active' });
    const body = req.body as { name: string; description?: string; price?: number; costPrice?: number; stock?: number; imageUrl?: string; gallery?: string[]; bnplEligible?: boolean; categoryId?: string };

    let finalPrice = body.price;
    if ((!finalPrice || finalPrice <= 0) && body.costPrice && body.costPrice > 0) {
      finalPrice = await suggestSellPrice(body.costPrice, body.categoryId);
    }
    if (!finalPrice || finalPrice < 100) {
      return reply.code(400).send({ error: 'BadRequest', message: 'price or costPrice+category is required to compute a valid selling price (>=100)' });
    }

    const product = await prisma.product.create({
      data: {
        name: body.name,
        description: body.description,
        price: finalPrice,
        costPrice: body.costPrice || null,
        stock: body.stock ?? 0,
        imageUrl: body.imageUrl,
        bnplEligible: body.bnplEligible ?? true,
        categoryId: body.categoryId,
        merchantId: merchant.id,
        gallery: body.gallery?.length ? { create: body.gallery.map((imageUrl, sortOrder) => ({ imageUrl, sortOrder })) } : undefined,
      },
      include: {
        category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
        gallery: { orderBy: { sortOrder: 'asc' } },
      },
    });
    await prisma.auditLog.create({ data: { userId: req.authUser!.id, action: 'PRODUCT_CREATED', entityType: 'Product', entityId: product.id } });
    return reply.code(201).send(product);
  });

  app.put('/products/:id', { schema: productUpdateSchema }, async (req, reply) => {
    const merchant = await getMerchantByUser(req.authUser!.id);
    const { id } = req.params as { id: string };
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || existing.merchantId !== merchant.id) return reply.code(404).send({ error: 'NotFound' });
    // Merchants are not allowed to change price or costPrice after creation (admin-only)
    const body = req.body as { price?: number; costPrice?: number; name?: string; description?: string; stock?: number; imageUrl?: string; gallery?: string[]; bnplEligible?: boolean; categoryId?: string };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { price, costPrice, gallery, ...safeUpdate } = body;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...safeUpdate,
        ...(gallery !== undefined ? { gallery: { deleteMany: {}, create: gallery.map((imageUrl, sortOrder) => ({ imageUrl, sortOrder })) } } : {}),
      },
      include: {
        category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
        gallery: { orderBy: { sortOrder: 'asc' } },
      },
    });
    await prisma.auditLog.create({ data: { userId: req.authUser!.id, action: 'PRODUCT_UPDATED', entityType: 'Product', entityId: id } });
    return updated;
  });

  app.delete('/products/:id', async (req, reply) => {
    const merchant = await getMerchantByUser(req.authUser!.id);
    const { id } = req.params as { id: string };
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || existing.merchantId !== merchant.id) return reply.code(404).send({ error: 'NotFound' });
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    await prisma.auditLog.create({ data: { userId: req.authUser!.id, action: 'PRODUCT_DELETED', entityType: 'Product', entityId: id } });
    return reply.code(204).send();
  });

  // ===== Merchant Wallet =====
  // ===== Merchant Categories =====
  app.get('/categories', async (req) => {
    const merchant = await getMerchantByUser(req.authUser!.id);
    const entries = await prisma.merchantCategory.findMany({
      where: { merchantId: merchant.id },
      include: { category: { select: { id: true, name: true, slug: true, color: true, icon: true } } },
    });
    return { categories: entries.map(e => e.category) };
  });

  app.put('/categories', async (req, reply) => {
    try {
      const merchant = await getMerchantByUser(req.authUser!.id);
      const { categoryIds, allCategories } = req.body as { categoryIds?: string[]; allCategories?: boolean };
      const entries = await setMerchantCategories(merchant.id, categoryIds ?? [], allCategories ?? false);
      return { categories: entries.map(e => e.category) };
    } catch (err: unknown) {
      if (err instanceof MerchantError) return reply.code(err.statusCode).send({ error: 'MerchantError', message: err.message });
      throw err;
    }
  });

  app.get('/wallet', async (req) => getMerchantWallet(req.authUser!.id));

  // ===== Merchant Payout Requests =====
  app.get('/payouts', async (req) => {
    return getMerchantPayoutRequests(req.authUser!.id);
  });

  app.post('/payouts/request', async (req, reply) => {
    const { amount, provider } = req.body as { amount: number; provider: string };
    try {
      const request = await createPayoutRequest(req.authUser!.id, amount, provider);
      return reply.code(201).send(request);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      return reply.code(400).send({ error: msg });
    }
  });

  // ===== Merchant Staff/Users Management =====
  app.get('/users', async (req) => {
    const staff = await getMerchantStaff(req.authUser!.id);
    return { users: staff };
  });

  app.post('/users', async (req, reply) => {
    try {
      const body = req.body as { fullName: string; email: string; phone?: string; password: string; pin?: string };
      const user = await createMerchantStaff(req.authUser!.id, body);
      return reply.code(201).send(user);
    } catch (err: unknown) {
      if (err instanceof MerchantError) return reply.code(err.statusCode).send({ error: 'MerchantError', message: err.message });
      throw err;
    }
  });

  app.put('/users/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as { fullName?: string; email?: string; phone?: string };
      const updated = await updateMerchantStaff(req.authUser!.id, id, body);
      return updated;
    } catch (err: unknown) {
      if (err instanceof MerchantError) return reply.code(err.statusCode).send({ error: 'MerchantError', message: err.message });
      throw err;
    }
  });

  app.put('/users/:id/status', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { status } = req.body as { status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' };
      const updated = await updateMerchantStaffStatus(req.authUser!.id, id, status);
      return updated;
    } catch (err: unknown) {
      if (err instanceof MerchantError) return reply.code(err.statusCode).send({ error: 'MerchantError', message: err.message });
      throw err;
    }
  });

  app.delete('/users/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await deleteMerchantStaff(req.authUser!.id, id);
      return reply.code(204).send();
    } catch (err: unknown) {
      if (err instanceof MerchantError) return reply.code(err.statusCode).send({ error: 'MerchantError', message: err.message });
      throw err;
    }
  });

  app.post('/users/:id/reset-password', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { password } = req.body as { password?: string };
      const result = await resetMerchantStaffPassword(req.authUser!.id, id, password);
      return result;
    } catch (err: unknown) {
      if (err instanceof MerchantError) return reply.code(err.statusCode).send({ error: 'MerchantError', message: err.message });
      throw err;
    }
  });

  // ===== Merchant Customers (with CRUD) =====
  app.get('/customers', { schema: paginationSchema }, async (req) => {
    const { page = 1, limit = 20 } = req.query as { page?: number; limit?: number };
    const search = (req.query as { page?: number; limit?: number; search?: string }).search;
    return getMerchantCustomers(req.authUser!.id, { page, limit, search });
  });

  app.post('/customers', async (req, reply) => {
    try {
      const body = req.body as { fullName: string; email: string; phone: string; password: string; pin?: string; creditLimit?: number };
      const customer = await createMerchantCustomer(req.authUser!.id, body);
      return reply.code(201).send(customer);
    } catch (err: unknown) {
      if (err instanceof MerchantError) return reply.code(err.statusCode).send({ error: 'MerchantError', message: err.message });
      throw err;
    }
  });

  app.put('/customers/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as { fullName?: string; email?: string; phone?: string; creditLimit?: number };
      const updated = await updateMerchantCustomer(req.authUser!.id, id, body);
      return updated;
    } catch (err: unknown) {
      if (err instanceof MerchantError) return reply.code(err.statusCode).send({ error: 'MerchantError', message: err.message });
      throw err;
    }
  });

  app.put('/customers/:id/status', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { status } = req.body as { status: 'active' | 'suspended' };
      const updated = await updateMerchantCustomerStatus(req.authUser!.id, id, status);
      return updated;
    } catch (err: unknown) {
      if (err instanceof MerchantError) return reply.code(err.statusCode).send({ error: 'MerchantError', message: err.message });
      throw err;
    }
  });

  app.delete('/customers/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await deleteMerchantCustomer(req.authUser!.id, id);
      return reply.code(204).send();
    } catch (err: unknown) {
      if (err instanceof MerchantError) return reply.code(err.statusCode).send({ error: 'MerchantError', message: err.message });
      throw err;
    }
  });

  app.post('/customers/:id/reset-password', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { password } = req.body as { password?: string };
      const result = await resetMerchantCustomerPassword(req.authUser!.id, id, password);
      return result;
    } catch (err: unknown) {
      if (err instanceof MerchantError) return reply.code(err.statusCode).send({ error: 'MerchantError', message: err.message });
      throw err;
    }
  });

  // ===== Merchant Client Wallet Credit =====
  app.post('/customers/:customerId/wallet/credit', async (req, reply) => {
    try {
      const { customerId } = req.params as { customerId: string };
      const { amount, note } = req.body as { amount: number; note?: string };
      const result = await merchantCreditClientWallet(req.authUser!.id, customerId, amount, note);
      return result;
    } catch (err: unknown) {
      if (err instanceof MerchantError) return reply.code(err.statusCode).send({ error: 'MerchantError', message: err.message });
      throw err;
    }
  });

  // ===== Merchant Installment Contribution =====
  app.post('/installments/:instalmentId/contribute', async (req, reply) => {
    try {
      const { instalmentId } = req.params as { instalmentId: string };
      const { amount, note } = req.body as { amount: number; note?: string };
      const result = await merchantContributeToInstallment(req.authUser!.id, instalmentId, amount, note);
      return result;
    } catch (err: unknown) {
      if (err instanceof MerchantError) return reply.code(err.statusCode).send({ error: 'MerchantError', message: err.message });
      throw err;
    }
  });
}
