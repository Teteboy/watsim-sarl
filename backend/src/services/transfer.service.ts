import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { sendTransactionAlert } from './notification.service';
import { recipientWhere } from '../utils/phone';

export interface TransferRequest {
  senderId: string;
  recipientIdentifier: string; // phone number, email, or user ID
  amount: number;
  note?: string;
}

export interface TransferResult {
  success: boolean;
  transferId?: string;
  message: string;
  senderBalance?: number;
  recipientName?: string;
}

/**
 * Transfer money from one user wallet to another
 */
export async function processTransfer(request: TransferRequest): Promise<TransferResult> {
  const { senderId, recipientIdentifier, amount, note } = request;

  // Validate minimum amount
  if (amount < 100) {
    return {
      success: false,
      message: 'Minimum transfer amount is 100 FCFA',
    };
  }

  // Find sender and their wallet
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    include: { wallet: true },
  });

  if (!sender) {
    return { success: false, message: 'Sender not found' };
  }

  if (!sender.wallet) {
    return { success: false, message: 'Sender wallet not found' };
  }

  // Check sender balance
  if (sender.wallet.balance < amount) {
    return {
      success: false,
      message: `Insufficient balance. Available: ${sender.wallet.balance} FCFA`,
    };
  }

  // Find recipient by phone, email, or user ID (phone is normalized to handle
  // local/international variants, e.g. 655000001 vs +237655000001)
  const recipient = await prisma.user.findFirst({
    where: recipientWhere(recipientIdentifier),
    include: { wallet: true },
  });

  if (!recipient) {
    return {
      success: false,
      message: 'Recipient not found. Please check the phone number or email.',
    };
  }

  // Prevent self-transfer
  if (recipient.id === senderId) {
    return {
      success: false,
      message: 'Cannot transfer to yourself',
    };
  }

  // Ensure recipient has a wallet
  if (!recipient.wallet) {
    // Create wallet for recipient if it doesn't exist
    recipient.wallet = await prisma.wallet.create({
      data: {
        userId: recipient.id,
        balance: 0,
        currency: 'XAF',
      },
    });
  }

  try {
    // Perform the transfer in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Debit sender
      const updatedSenderWallet = await tx.wallet.update({
        where: { userId: senderId },
        data: { balance: { decrement: amount } },
      });

      // Credit recipient
      await tx.wallet.update({
        where: { userId: recipient.id },
        data: { balance: { increment: amount } },
      });

      const transferRef = `TRANSFER_${Date.now()}_${senderId.slice(0, 8)}`;
      // Create sender's transaction record (debit/transfer out)
      const senderTx = await tx.transaction.create({
        data: {
          userId: senderId,
          type: 'TRANSFER_OUT',
          amount,
          status: 'COMPLETED',
          provider: 'WALLET',
          providerRef: `${transferRef}_OUT`,
          metadata: {
            recipientId: recipient.id,
            recipientName: recipient.fullName,
            recipientPhone: recipient.phone,
            note: note || '',
            transferType: 'P2P',
          },
        },
      });

      // Create recipient's transaction record (credit/transfer in)
      await tx.transaction.create({
        data: {
          userId: recipient.id,
          type: 'TRANSFER_IN',
          amount: amount,
          status: 'COMPLETED',
          provider: 'WALLET',
          providerRef: `${transferRef}_IN`,
          metadata: {
            senderId: senderId,
            senderName: sender.fullName,
            senderPhone: sender.phone,
            note: note || '',
            transferType: 'P2P',
          },
        },
      });

      return {
        senderBalance: updatedSenderWallet.balance,
        transferId: senderTx.id,
      };
    });

    logger.info(
      { senderId, recipientId: recipient.id, amount },
      'P2P transfer completed successfully'
    );

    // Send transaction alert to sender (non-blocking)
    sendTransactionAlert(senderId, 'Transfer Out', amount, recipient.fullName).catch(() => {});

    // Send transaction alert to recipient (non-blocking)
    sendTransactionAlert(recipient.id, 'Transfer In', amount, sender.fullName).catch(() => {});

    return {
      success: true,
      transferId: result.transferId,
      message: 'Transfer completed successfully',
      senderBalance: result.senderBalance,
      recipientName: recipient.fullName,
    };
  } catch (error) {
    logger.error({ error, senderId, recipientId: recipient.id, amount }, 'P2P transfer failed');
    return {
      success: false,
      message: 'Transfer failed. Please try again.',
    };
  }
}

/**
 * Get transfer history for a user
 */
export async function getTransferHistory(userId: string, limit = 20) {
  const transfers = await prisma.transaction.findMany({
    where: {
      userId,
      OR: [
        { type: 'TRANSFER_IN' },
        { type: 'TRANSFER_OUT' },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return transfers.map((t) => {
    const metadata = (t.metadata as Record<string, unknown>) || {};
    return {
      id: t.id,
      type: t.type,
      amount: Math.abs(t.amount),
      status: t.status,
      createdAt: t.createdAt,
      counterparty: t.type === 'TRANSFER_OUT' ? {
        id: metadata.recipientId as string,
        name: metadata.recipientName as string,
        phone: metadata.recipientPhone as string,
      } : {
        id: metadata.senderId as string,
        name: metadata.senderName as string,
        phone: metadata.senderPhone as string,
      },
      note: metadata.note as string,
    };
  });
}
