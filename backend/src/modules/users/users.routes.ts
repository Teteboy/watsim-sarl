import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { getProfile, listUserPurchases, listUserTransactions, updateProfile } from './users.service';
import { paginationSchema, updateProfileSchema } from './users.schema';
import { getUserStatistics } from '../../services/statistics.service';
import { prisma } from '../../config/db';
import { uploadProfilePicture, resolveImageUrl } from '../../services/storage-local.service';
import { recomputeScore, getScoreHistory, getScoreTips } from '../../services/credit-scoring.service';
import { ensureUserReferralCode, getReferralStats, updateReferralCode } from '../../services/referral.service';
import { getUserBadges, checkAndAwardBadges } from '../../services/badge.service';
import { processWithdrawal, checkWithdrawalStatus, WithdrawalProvider } from '../../services/withdrawal.service';
import { processTransfer, getTransferHistory } from '../../services/transfer.service';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/me', async (req, reply) => {
    // Build base URL from request for correct image URLs on mobile
    const protocol = (req.headers['x-forwarded-proto'] as string) || 'http';
    const host = req.headers['host'] || `localhost:${process.env.PORT || 3001}`;
    const requestBaseUrl = `${protocol}://${host}`;
    
    const profile = await getProfile(req.authUser!.id, requestBaseUrl);
    if (!profile) return reply.code(404).send({ error: 'NotFound' });
    return profile;
  });

  app.put('/me', { schema: updateProfileSchema }, async (req) => {
    const body = req.body as { fullName?: string; phone?: string };
    const user = await updateProfile(req.authUser!.id, body);
    return { id: user.id, fullName: user.fullName, phone: user.phone };
  });

  app.get('/me/transactions', { schema: paginationSchema }, async (req) => {
    const { page = 1, limit = 20 } = req.query as { page?: number; limit?: number };
    return listUserTransactions(req.authUser!.id, page, limit);
  });

  app.get('/me/purchases', async (req) => {
    const purchases = await listUserPurchases(req.authUser!.id);
    return { items: purchases };
  });

  // ── Statistics ──────────────────────────────────────────────────────────
  app.get('/me/statistics', async (req, reply) => {
    try {
      const stats = await getUserStatistics(req.authUser!.id);
      return stats;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      req.log.error(e, 'Failed to fetch user statistics');
      return reply.code(500).send({ error: 'StatisticsFetchFailed', message: msg });
    }
  });

  // ── Wallet ──────────────────────────────────────────────────────────────
  app.get('/me/wallet', async (req) => {
    const wallet = await prisma.wallet.upsert({
      where: { userId: req.authUser!.id },
      create: { userId: req.authUser!.id, balance: 0 },
      update: {},
    });
    return { balance: wallet.balance, currency: wallet.currency };
  });

  // ── Create a DEPOSIT transaction (used before calling /payments/initiate) ─
  app.post('/me/transactions/deposit', async (req, reply) => {
    const { amount, provider } = req.body as { amount: number; provider: string };
    if (!amount || amount < 1) {
      return reply.code(400).send({ error: 'BadRequest', message: 'amount must be >= 1' });
    }
    const tx = await prisma.transaction.create({
      data: {
        userId: req.authUser!.id,
        type: 'DEPOSIT',
        amount,
        status: 'PENDING',
        provider,
      },
    });
    return { transactionId: tx.id };
  });

  // ── Create a WITHDRAWAL transaction (used before calling /payments/initiate) ─
  app.post('/me/transactions/withdrawal', async (req, reply) => {
    const { amount, provider } = req.body as { amount: number; provider: string };
    if (!amount || amount < 1) {
      return reply.code(400).send({ error: 'BadRequest', message: 'amount must be >= 1' });
    }
    const tx = await prisma.transaction.create({
      data: {
        userId: req.authUser!.id,
        type: 'WITHDRAWAL',
        amount,
        status: 'PENDING',
        provider,
      },
    });
    return { transactionId: tx.id };
  });

  // ── Process a wallet withdrawal to mobile money or cash ───────────────────
  app.post('/me/withdraw', async (req, reply) => {
    const userId = req.authUser!.id;
    const { amount, phoneNumber, provider } = req.body as {
      amount: number;
      phoneNumber: string;
      provider: 'ORANGE_MONEY' | 'MTN_MOMO' | 'CASH';
    };

    if (!amount || amount < 1) {
      return reply.code(400).send({ error: 'BadRequest', message: 'amount must be >= 1' });
    }
    if (!phoneNumber || phoneNumber.trim().length < 8) {
      return reply.code(400).send({ error: 'BadRequest', message: 'phoneNumber is required' });
    }
    if (!provider || !['ORANGE_MONEY', 'MTN_MOMO', 'CASH'].includes(provider)) {
      return reply.code(400).send({ error: 'BadRequest', message: 'provider must be ORANGE_MONEY, MTN_MOMO or CASH' });
    }

    const withdrawalProvider = provider === 'ORANGE_MONEY'
      ? 'ORANGE'
      : provider === 'MTN_MOMO'
        ? 'MTN'
        : 'CASH';

    const result = await processWithdrawal({
      userId,
      amount,
      phoneNumber: phoneNumber.trim(),
      provider: withdrawalProvider,
      reference: `WD_${Date.now()}_${userId.slice(0, 8)}`,
      metadata: { source: 'WALLET_WITHDRAW', requestedVia: 'mobile_app' },
    });

    if (!result.success) {
      return reply.code(400).send({ error: 'WithdrawalFailed', message: result.message });
    }

    return {
      success: true,
      transactionId: result.withdrawalId,
      providerRef: result.providerRef,
      status: result.status,
      message: result.message,
      ussdCode: result.ussdCode,
    };
  });

  // ── Check status of any user transaction (withdrawals, transfers, deposits) ─
  app.get('/me/transactions/:transactionId/status', async (req, reply) => {
    const { transactionId } = req.params as { transactionId: string };
    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx || tx.userId !== req.authUser!.id) {
      return reply.code(404).send({ error: 'NotFound', message: 'Transaction not found' });
    }

    if (tx.type === 'WITHDRAWAL' && tx.status === 'PENDING') {
      const statusResult = await checkWithdrawalStatus(transactionId);
      return { transactionId, status: statusResult.status, message: statusResult.message, amount: tx.amount };
    }

    return { transactionId, status: tx.status, amount: tx.amount };
  });

  // ── Create a TRANSFER transaction (used before calling /payments/initiate) ─
  app.post('/me/transactions/transfer', async (req, reply) => {
    const { amount, provider, recipientName } = req.body as { amount: number; provider: string; recipientName: string };
    if (!amount || amount < 1) {
      return reply.code(400).send({ error: 'BadRequest', message: 'amount must be >= 1' });
    }
    if (!recipientName || recipientName.trim().length === 0) {
      return reply.code(400).send({ error: 'BadRequest', message: 'recipientName is required' });
    }
    const tx = await prisma.transaction.create({
      data: {
        userId: req.authUser!.id,
        type: 'TRANSFER_OUT',
        amount,
        status: 'PENDING',
        provider,
        metadata: {
          recipientName: recipientName.trim()
        }
      },
    });
    return { transactionId: tx.id };
  });

  // ── Notifications inbox ─────────────────────────────────────────────────
  app.get('/me/notifications', async (req) => {
    const { page = 1, limit = 20 } = req.query as { page?: number; limit?: number };
    const [items, total] = await Promise.all([
      prisma.userNotification.findMany({
        where: { userId: req.authUser!.id },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.userNotification.count({ where: { userId: req.authUser!.id } }),
    ]);
    return { items, total };
  });

  app.get('/me/notifications/unread-count', async (req) => {
    const count = await prisma.userNotification.count({
      where: { userId: req.authUser!.id, isRead: false },
    });
    return { count };
  });

  app.put('/me/notifications/:id/read', async (req) => {
    const { id } = req.params as { id: string };
    await prisma.userNotification.updateMany({
      where: { id, userId: req.authUser!.id },
      data: { isRead: true },
    });
    return { success: true };
  });

  app.put('/me/notifications/mark-all-read', async (req) => {
    await prisma.userNotification.updateMany({
      where: { userId: req.authUser!.id, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  });

  // ── Delete a notification ───────────────────────────────────────────────
  app.delete('/me/notifications/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = await prisma.userNotification.deleteMany({
      where: { id, userId: req.authUser!.id },
    });
    if (deleted.count === 0) {
      return reply.code(404).send({ error: 'NotFound', message: 'Notification not found' });
    }
    return { success: true };
  });

  // ── Profile Picture Upload ───────────────────────────────────────────────
  app.post('/me/profile-picture', async (req, reply) => {
    const parts = req.parts();
    let fileBuffer: Buffer | null = null;
    let contentType = 'image/jpeg';

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'image') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        fileBuffer = Buffer.concat(chunks);
        contentType = part.mimetype;
      }
    }

    if (!fileBuffer) {
      return reply.code(400).send({ error: 'BadRequest', message: 'Image file required' });
    }

    // Validate file size (max 5MB)
    if (fileBuffer.length > 5 * 1024 * 1024) {
      return reply.code(400).send({ error: 'BadRequest', message: 'File too large (max 5MB)' });
    }

    // Validate content type
    if (!contentType.startsWith('image/')) {
      return reply.code(400).send({ error: 'BadRequest', message: 'Only image files allowed' });
    }

    // Build base URL from request for correct image URLs on mobile
    const protocol = (req.headers['x-forwarded-proto'] as string) || 'http';
    const host = req.headers['host'] || `localhost:${process.env.PORT || 3001}`;
    const requestBaseUrl = `${protocol}://${host}`;

    try {
      const filename = await uploadProfilePicture(req.authUser!.id, fileBuffer, contentType);
      const storedPath = `/uploads/${filename}`;
      const fullUrl = resolveImageUrl(storedPath, requestBaseUrl) ?? storedPath;

      // Update user with full URL so it loads from the backend in production
      await prisma.user.update({
        where: { id: req.authUser!.id },
        data: { imageUrl: fullUrl },
      });

      return { success: true, imageUrl: fullUrl, fullUrl };
    } catch {
      return reply.code(500).send({ error: 'UploadFailed', message: 'Failed to upload image' });
    }
  });

  // ── Credit Score ───────────────────────────────────────────────────────────
  app.get('/me/credit-score', async (req, reply) => {
    try {
      const result = await recomputeScore(req.authUser!.id);
      return result;
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      req.log.error(e, 'Credit score computation failed');
      return reply.code(500).send({
        error: 'ScoreComputationFailed',
        message: `Failed to compute credit score: ${errorMessage}`,
      });
    }
  });

  app.get('/me/credit-score/history', async (req, reply) => {
    try {
      const { limit = 10 } = req.query as { limit?: number };
      const history = await getScoreHistory(req.authUser!.id, Number(limit));
      return history;
    } catch {
      return reply.code(500).send({ error: 'HistoryFetchFailed', message: 'Failed to fetch score history' });
    }
  });

  app.get('/me/credit-score/tips', async (req, reply) => {
    try {
      const tips = await getScoreTips(req.authUser!.id);
      return { tips };
    } catch {
      return reply.code(500).send({ error: 'TipsFetchFailed', message: 'Failed to fetch score tips' });
    }
  });

  // ── Referral ───────────────────────────────────────────────────────────
  app.get('/me/referral', async (req) => {
    const userId = req.authUser!.id;
    const code = await ensureUserReferralCode(userId);
    const stats = await getReferralStats(userId);
    return { code, ...stats };
  });

  app.patch('/me/referral', async (req, reply) => {
    const userId = req.authUser!.id;
    const { code } = req.body as { code?: string };
    if (!code) {
      return reply.code(400).send({ error: 'MissingCode', message: 'Referral code is required' });
    }
    try {
      const updatedCode = await updateReferralCode(userId, code);
      return { code: updatedCode };
    } catch (e: any) {
      return reply.code(400).send({ error: 'InvalidReferralCode', message: e.message });
    }
  });

  // ── Rewards & Cashback ───────────────────────────────────────────────────
  // GET /users/me/rewards - Fetch rewards summary with history
  app.get('/me/rewards', async (req) => {
    const userId = req.authUser!.id;
    
    // Get wallet to check referral reward balance (transactions with provider 'REFERRAL')
    await prisma.wallet.findUnique({
      where: { userId },
    });

    // Get all referral-related transactions for history
    const referralTransactions = await prisma.transaction.findMany({
      where: { 
        userId,
        provider: 'REFERRAL',
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Calculate available (completed) vs pending
    const completedReferrals = await prisma.referral.findMany({
      where: { 
        referrerId: userId,
        firstRewardPaid: true,
      },
    });

    const pendingReferrals = await prisma.referral.findMany({
      where: { 
        referrerId: userId,
        firstRewardPaid: false,
        status: 'PENDING',
      },
    });

    const totalFirstRewards = completedReferrals.reduce((sum, r) => sum + r.firstRewardAmount, 0);
    const totalSecondRewards = completedReferrals.reduce((sum, r) => sum + r.secondRewardAmount, 0);
    const pendingAmount = pendingReferrals.reduce((sum, r) => sum + r.firstRewardAmount, 0);

    // Map transactions to history format
    const history = referralTransactions.map(t => {
      const meta = t.metadata as Record<string, unknown> || {};
      return {
        id: t.id,
        title: meta.rewardType === 'FIRST' 
          ? `Referral Bonus - ${meta.referredUserId ? 'Friend' : 'New User'}`
          : `BNPL Cashback - Purchase`,
        amount: t.amount,
        type: meta.rewardType === 'FIRST' ? 'REFERRAL_FIRST' : 'REFERRAL_SECOND',
        percentage: meta.rewardType === 'FIRST' ? '500 FCFA' : '0.6%',
        createdAt: t.createdAt,
      };
    });

    return {
      availableBalance: totalFirstRewards + totalSecondRewards,
      pendingBalance: pendingAmount,
      totalFirstRewards,
      totalSecondRewards,
      completedReferrals: completedReferrals.length,
      pendingReferrals: pendingReferrals.length,
      history,
    };
  });

  // POST /users/me/rewards/withdraw - Withdraw rewards to mobile money
  app.post('/me/rewards/withdraw', async (req, reply) => {
    const userId = req.authUser!.id;
    const { amount, phoneNumber, method } = req.body as {
      amount: number;
      phoneNumber: string;
      method: 'mtn' | 'orange' | 'wave';
    };

    // Validate inputs
    if (!amount || amount < 500) {
      return reply.code(400).send({ error: 'InvalidAmount', message: 'Minimum withdrawal is 500 FCFA' });
    }
    if (!phoneNumber || phoneNumber.length < 9) {
      return reply.code(400).send({ error: 'InvalidPhone', message: 'Valid phone number required' });
    }
    if (!['mtn', 'orange', 'wave'].includes(method)) {
      return reply.code(400).send({ error: 'InvalidMethod', message: 'Method must be mtn, orange, or wave' });
    }

    // Check actual wallet balance — rewards are deposited into the main wallet on conversion
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < amount) {
      return reply.code(400).send({
        error: 'InsufficientBalance',
        message: `Insufficient wallet balance. Available: ${wallet?.balance ?? 0} FCFA`,
      });
    }

    // processWithdrawal handles wallet deduction + transaction record atomically
    const withdrawalResult = await processWithdrawal({
      userId,
      amount,
      phoneNumber,
      provider: method.toUpperCase() as WithdrawalProvider,
      reference: `REWARDS_WD_${Date.now()}`,
      metadata: {
        source: 'REWARDS',
        phoneNumber,
        method,
        requestedAt: new Date().toISOString(),
      },
    });

    if (!withdrawalResult.success) {
      return reply.code(400).send({
        error: 'WithdrawalFailed',
        message: withdrawalResult.message || 'Withdrawal could not be processed',
      });
    }

    // Award badges if withdrawal successful
    await checkAndAwardBadges(userId);

    return {
      success: true,
      withdrawalId: withdrawalResult.withdrawalId,
      method,
      phoneNumber,
      status: withdrawalResult.status,
      message: 'Withdrawal request submitted and is being processed',
    };
  });

  // POST /users/me/rewards/convert - Convert rewards to wallet balance
  app.post('/me/rewards/convert', async (req, reply) => {
    const userId = req.authUser!.id;
    const { amount } = req.body as { amount: number };

    if (!amount || amount <= 0) {
      return reply.code(400).send({ error: 'InvalidAmount', message: 'Amount must be greater than 0' });
    }

    // Check available balance
    const completedReferrals = await prisma.referral.findMany({
      where: { 
        referrerId: userId,
        firstRewardPaid: true,
      },
    });
    const totalRewards = completedReferrals.reduce((sum, r) => sum + r.firstRewardAmount + r.secondRewardAmount, 0);

    if (amount > totalRewards) {
      return reply.code(400).send({ error: 'InsufficientBalance', message: 'Insufficient rewards balance' });
    }

    // Get or create wallet
    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { userId, balance: 0, currency: 'XAF' },
      });
    }

    // Update wallet balance
    await prisma.wallet.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });

    // Create deposit transaction record
    await prisma.transaction.create({
      data: {
        userId,
        type: 'DEPOSIT',
        amount,
        status: 'COMPLETED',
        provider: 'WALLET',
        providerRef: `REWARDS_CONVERT_${Date.now()}`,
        metadata: { 
          source: 'REWARDS_CONVERSION',
          convertedAt: new Date().toISOString(),
          previousBalance: wallet.balance,
          newBalance: wallet.balance + amount,
        },
      },
    });

    return {
      success: true,
      amount,
      convertedToWallet: true,
      newWalletBalance: wallet.balance + amount,
    };
  });

  // ── Badges ────────────────────────────────────────────────────────────────
  // GET /users/me/badges - Fetch all badges with earned status
  app.get('/me/badges', async (req) => {
    const userId = req.authUser!.id;
    const badges = await getUserBadges(userId);
    return { badges };
  });

  // POST /users/me/badges/check - Check and award new badges
  app.post('/me/badges/check', async (req) => {
    const userId = req.authUser!.id;
    const awarded = await checkAndAwardBadges(userId);
    return { awarded, count: awarded.length };
  });

  // ===== Wallet Transfers =====
  // POST /users/me/wallet/transfer - Transfer money to another user
  app.post('/me/wallet/transfer', async (req, reply) => {
    const userId = req.authUser!.id;
    const { recipientIdentifier, amount, note } = req.body as {
      recipientIdentifier: string;
      amount: number;
      note?: string;
    };

    // Validate inputs
    if (!recipientIdentifier || recipientIdentifier.trim().length < 3) {
      return reply.code(400).send({
        error: 'InvalidRecipient',
        message: 'Valid recipient phone number, email, or user ID required',
      });
    }

    if (!amount || amount < 100) {
      return reply.code(400).send({
        error: 'InvalidAmount',
        message: 'Minimum transfer amount is 100 FCFA',
      });
    }

    // Process the transfer
    const result = await processTransfer({
      senderId: userId,
      recipientIdentifier: recipientIdentifier.trim(),
      amount,
      note: note?.trim(),
    });

    if (!result.success) {
      return reply.code(400).send({
        error: 'TransferFailed',
        message: result.message,
      });
    }

    return {
      success: true,
      transferId: result.transferId,
      message: result.message,
      senderBalance: result.senderBalance,
      recipientName: result.recipientName,
    };
  });

  // GET /users/me/wallet/transfers - Get transfer history
  app.get('/me/wallet/transfers', async (req) => {
    const userId = req.authUser!.id;
    const q = req.query as { limit?: string };
    const limit = parseInt(q.limit || '20', 10);

    const transfers = await getTransferHistory(userId, limit);

    return {
      transfers,
      count: transfers.length,
    };
  });
}
