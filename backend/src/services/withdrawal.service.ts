import crypto from 'crypto';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { getRedis } from '../config/redis';

export type WithdrawalProvider = 'MTN' | 'ORANGE' | 'CASH';

export interface WithdrawalRequest {
  userId: string;
  amount: number;
  phoneNumber: string;
  provider: WithdrawalProvider;
  reference: string;
  metadata?: Record<string, unknown>;
}

export interface WithdrawalResult {
  success: boolean;
  withdrawalId: string;
  providerRef: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  message: string;
  ussdCode?: string;
  externalReference?: string;
}

// Provider adapter interfaces
interface PayoutAdapter {
  name: WithdrawalProvider;
  initiatePayout(params: {
    amount: number;
    phone: string;
    reference: string;
    description: string;
  }): Promise<{
    providerRef: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    message?: string;
    ussdCode?: string;
  }>;
  checkStatus(providerRef: string): Promise<{
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    message?: string;
  }>;
}

// CamPay payout adapter (works for MTN and Orange)
class CamPayPayoutAdapter implements PayoutAdapter {
  name: WithdrawalProvider;
  private baseUrl: string;
  private username: string;
  private password: string;
  private permanentToken?: string;

  constructor(provider: WithdrawalProvider) {
    this.name = provider;
    this.baseUrl = env.CAMPAY_BASE_URL || 'https://demo.campay.net';
    this.username = env.CAMPAY_USERNAME || '';
    this.password = env.CAMPAY_PASSWORD || '';
    this.permanentToken = env.CAMPAY_PERMENENT_ACCESS_TOKEN;
  }

  private async fetchToken(): Promise<string> {
    if (this.permanentToken) {
      return this.permanentToken;
    }

    const redis = getRedis();
    const cacheKey = `campay:token:withdrawal`;
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    const res = await fetch(`${this.baseUrl}/api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password }),
    });

    if (!res.ok) {
      throw new Error(`CamPay auth failed: ${res.status}`);
    }

    const data = (await res.json()) as { token: string };
    await redis.set(cacheKey, data.token, 'EX', 3000); // 50 min cache
    return data.token;
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('237')) return digits;
    if (digits.startsWith('6') && digits.length === 9) return `237${digits}`;
    return digits;
  }

  async initiatePayout(params: {
    amount: number;
    phone: string;
    reference: string;
    description: string;
  }): Promise<{
    providerRef: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    message?: string;
    ussdCode?: string;
  }> {
    const token = await this.fetchToken();
    const phone = this.normalizePhone(params.phone);

    const body = {
      amount: String(params.amount),
      currency: 'XAF',
      to: phone,
      description: params.description.slice(0, 100),
      external_reference: params.reference.slice(0, 20),
    };

    logger.info(
      { campayPayout: { ...body, phonePrefix: phone.slice(0, 6) } },
      'CamPay payout request'
    );

    const res = await fetch(`${this.baseUrl}/api/withdraw/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await res.text();
    logger.info({ status: res.status, body: responseText }, 'CamPay payout response');

    if (!res.ok) {
      let message = 'Payout failed. Please try again.';
      try {
        const err = JSON.parse(responseText) as { message?: string; error_code?: string };
        if (err.error_code === 'INSUFFICIENT_BALANCE') {
          message = 'Service temporarily unavailable. Please try again later.';
        } else if (err.message) {
          message = err.message;
        }
      } catch (_) {}

      return {
        providerRef: `FAILED_${Date.now()}`,
        status: 'FAILED',
        message,
      };
    }

    const data = (await JSON.parse(responseText)) as {
      reference: string;
      status: string;
      ussd_code?: string;
    };

    return {
      providerRef: data.reference,
      status: this.mapStatus(data.status),
      ussdCode: data.ussd_code,
    };
  }

  async checkStatus(providerRef: string): Promise<{
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    message?: string;
  }> {
    const token = await this.fetchToken();

    const res = await fetch(
      `${this.baseUrl}/api/transaction/${providerRef}/`,
      {
        headers: { Authorization: `Token ${token}` },
      }
    );

    if (!res.ok) {
      return { status: 'PENDING' };
    }

    const data = (await res.json()) as { status: string; message?: string };
    return {
      status: this.mapStatus(data.status),
      message: data.message,
    };
  }

  private mapStatus(s: string): 'PENDING' | 'COMPLETED' | 'FAILED' {
    const status = s.toUpperCase();
    if (status === 'SUCCESSFUL' || status === 'SUCCESS' || status === 'COMPLETED') {
      return 'COMPLETED';
    }
    if (status === 'FAILED' || status === 'CANCELLED' || status === 'CANCELED' || status === 'REJECTED') {
      return 'FAILED';
    }
    return 'PENDING';
  }
}

// Cash adapter - requires admin approval
// This creates a pending withdrawal that must be approved by an admin
// before the user can collect cash at a physical location or office
class CashPayoutAdapter implements PayoutAdapter {
  name: WithdrawalProvider = 'CASH';

  async initiatePayout(params: {
    amount: number;
    phone: string;
    reference: string;
    description: string;
  }): Promise<{
    providerRef: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    message?: string;
    ussdCode?: string;
  }> {
    logger.info({ cashPayout: params }, 'Cash withdrawal initiated - pending admin approval');

    // Generate a unique reference for tracking
    const providerRef = `CASH_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Create admin notification/alert for new cash withdrawal request
    try {
      await prisma.notification.create({
        data: {
          title: 'New Cash Withdrawal Request',
          body: `Amount: ${params.amount} FCFA | Phone: ${params.phone} | Ref: ${providerRef}`,
          target: 'admin',
          priority: 'high',
          status: 'sent',
          sentAt: new Date(),
          type: 'WITHDRAWAL_REQUEST',
        },
      });
    } catch (err) {
      // Don't fail the withdrawal if notification fails
      logger.error({ err }, 'Failed to create admin notification for cash withdrawal');
    }

    return {
      providerRef,
      status: 'PENDING',
      message: 'Cash withdrawal request submitted. Pending admin approval. Visit our office with ID and reference number to collect.',
    };
  }

  async checkStatus(providerRef: string): Promise<{
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    message?: string;
  }> {
    // Check if admin has approved this cash withdrawal
    const transaction = await prisma.transaction.findFirst({
      where: { providerRef },
    });

    if (!transaction) {
      return { status: 'FAILED', message: 'Transaction not found' };
    }

    // Status is stored in the transaction record
    // Admin approval updates this from PENDING to COMPLETED
    const metadata = transaction.metadata as Record<string, unknown> | null;
    const adminApproved = metadata?.adminApproved === true;
    const adminRejected = metadata?.adminRejected === true;

    if (adminRejected) {
      return { status: 'FAILED', message: 'Withdrawal rejected by admin' };
    }

    if (adminApproved) {
      return { status: 'COMPLETED', message: 'Cash withdrawal approved - ready for collection' };
    }

    return { status: 'PENDING', message: 'Awaiting admin approval' };
  }
}

// Factory to get the right adapter
function getPayoutAdapter(provider: WithdrawalProvider): PayoutAdapter {
  switch (provider) {
    case 'MTN':
    case 'ORANGE':
      return new CamPayPayoutAdapter(provider);
    case 'CASH':
      return new CashPayoutAdapter();
    default:
      throw new Error(`Unsupported withdrawal provider: ${provider}`);
  }
}

/**
 * Process a withdrawal request to mobile money
 */
export async function processWithdrawal(
  request: WithdrawalRequest
): Promise<WithdrawalResult> {
  const { userId, amount, phoneNumber, provider, reference, metadata } = request;

  // Validate minimum amount
  if (amount < 500) {
    return {
      success: false,
      withdrawalId: '',
      providerRef: '',
      status: 'FAILED',
      message: 'Minimum withdrawal amount is 500 FCFA',
    };
  }

  try {
    // Get the appropriate adapter
    const adapter = getPayoutAdapter(provider);

    // Initiate the payout
    const payoutResult = await adapter.initiatePayout({
      amount,
      phone: phoneNumber,
      reference,
      description: `WATSIM Rewards Withdrawal`,
    });

    // Create or update transaction record
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: 'WITHDRAWAL',
        amount: -amount,
        status: payoutResult.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
        provider: provider,
        providerRef: payoutResult.providerRef,
        metadata: {
          ...metadata,
          phoneNumber,
          payoutStatus: payoutResult.status,
          payoutMessage: payoutResult.message,
          initiatedAt: new Date().toISOString(),
        },
      },
    });

    // If completed immediately (rare but possible), update wallet
    if (payoutResult.status === 'COMPLETED') {
      // The wallet was already deducted when creating the pending transaction
      // But we should verify the transaction completed
      logger.info({ transactionId: transaction.id, amount }, 'Withdrawal completed immediately');
    }

    return {
      success: payoutResult.status !== 'FAILED',
      withdrawalId: transaction.id,
      providerRef: payoutResult.providerRef,
      status: payoutResult.status,
      message: payoutResult.message || `Withdrawal initiated via ${provider}`,
      ussdCode: payoutResult.ussdCode,
    };
  } catch (error) {
    logger.error({ error, userId, amount, provider }, 'Withdrawal processing failed');

    // Create failed transaction record
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: 'WITHDRAWAL',
        amount: -amount,
        status: 'FAILED',
        provider: provider,
        providerRef: `FAILED_${Date.now()}`,
        metadata: {
          ...metadata,
          phoneNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date().toISOString(),
        },
      },
    });

    return {
      success: false,
      withdrawalId: transaction.id,
      providerRef: transaction.providerRef!,
      status: 'FAILED',
      message: error instanceof Error ? error.message : 'Withdrawal processing failed',
    };
  }
}

/**
 * Check the status of a pending withdrawal
 */
export async function checkWithdrawalStatus(
  transactionId: string
): Promise<{
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  message?: string;
}> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) {
    return { status: 'FAILED', message: 'Transaction not found' };
  }

  if (!transaction.providerRef || transaction.status !== 'PENDING') {
    return { status: transaction.status as 'PENDING' | 'COMPLETED' | 'FAILED' };
  }

  const provider = transaction.provider as WithdrawalProvider;
  const adapter = getPayoutAdapter(provider);

  const result = await adapter.checkStatus(transaction.providerRef);

  // Update transaction status if changed
  if (result.status !== transaction.status) {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: result.status,
        metadata: {
          ...(transaction.metadata as Record<string, unknown>),
          statusCheckedAt: new Date().toISOString(),
          finalStatus: result.status,
        },
      },
    });

    // If failed, we might want to refund the wallet
    if (result.status === 'FAILED') {
      // Wallet refund logic would go here if needed
      logger.info({ transactionId }, 'Withdrawal failed, consider wallet refund');
    }
  }

  return result;
}

/**
 * Process pending withdrawals in background
 * Call this periodically to check and update statuses
 */
export async function processPendingWithdrawals(): Promise<void> {
  const pendingWithdrawals = await prisma.transaction.findMany({
    where: {
      type: 'WITHDRAWAL',
      status: 'PENDING',
      provider: { in: ['MTN', 'ORANGE', 'WAVE'] },
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    },
    take: 50,
  });

  logger.info({ count: pendingWithdrawals.length }, 'Processing pending withdrawals');

  for (const tx of pendingWithdrawals) {
    try {
      await checkWithdrawalStatus(tx.id);
    } catch (error) {
      logger.error({ error, transactionId: tx.id }, 'Failed to check withdrawal status');
    }
  }
}
