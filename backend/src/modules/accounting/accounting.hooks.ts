import type { Prisma } from '@prisma/client';
import { postJournal } from './accounting.service';
import { prisma } from '../../config/db';

type TxClient = Prisma.TransactionClient | typeof prisma;

// Map a provider string to the OHADA cash account code we use for the inflow/outflow.
function cashAccountFor(provider: string | null | undefined): string {
  switch (provider) {
    case 'MTN_MOMO': return '521';
    case 'ORANGE_MONEY': return '522';
    case 'CAMPAY': return '523';
    case 'WALLET': return '590';
    default: return '512';
  }
}

// Customer purchases on BNPL: WATSIM books a receivable, owes merchant the principal,
// and records the BNPL fee as service revenue.
export async function recordBnplPurchase(
  args: { purchaseId: string; totalAmount: number; principal: number; fees: number; userId: string },
  tx: TxClient = prisma,
) {
  return postJournal({
    reference: `BNPL-PURCHASE-${args.purchaseId}`,
    description: `BNPL purchase ${args.purchaseId}`,
    sourceType: 'BnplPurchase',
    sourceId: args.purchaseId,
    lines: [
      { accountCode: '411', debit: args.totalAmount, memo: `Customer ${args.userId}` },
      { accountCode: '401', credit: args.principal, memo: 'Owed to merchant' },
      ...(args.fees > 0 ? [{ accountCode: '706', credit: args.fees, memo: 'BNPL service fee' }] : []),
    ],
  }, tx);
}

// Customer pays an instalment via mobile money: cash in, receivable down.
export async function recordInstalmentPayment(
  args: { transactionId: string; amount: number; provider: string; userId: string; instalmentId: string },
  tx: TxClient = prisma,
) {
  return postJournal({
    reference: `BNPL-REPAY-${args.transactionId}`,
    description: `Instalment payment ${args.instalmentId}`,
    sourceType: 'Transaction',
    sourceId: args.transactionId,
    lines: [
      { accountCode: cashAccountFor(args.provider), debit: args.amount, memo: `Customer ${args.userId}` },
      { accountCode: '411', credit: args.amount, memo: 'Receivable settlement' },
    ],
  }, tx);
}

// Customer tops up their wallet: cash in, wallet liability up.
export async function recordWalletDeposit(
  args: { transactionId: string; amount: number; provider: string; userId: string },
  tx: TxClient = prisma,
) {
  return postJournal({
    reference: `DEPOSIT-${args.transactionId}`,
    description: `Wallet top-up`,
    sourceType: 'Transaction',
    sourceId: args.transactionId,
    lines: [
      { accountCode: cashAccountFor(args.provider), debit: args.amount, memo: `Customer ${args.userId}` },
      { accountCode: '590', credit: args.amount, memo: 'Wallet liability' },
    ],
  }, tx);
}

// Customer pays a purchase using their wallet balance: wallet liability down, receivable down.
export async function recordWalletSettlement(
  args: { transactionId: string; amount: number; userId: string },
  tx: TxClient = prisma,
) {
  return postJournal({
    reference: `WALLET-SETTLE-${args.transactionId}`,
    description: `Wallet settlement`,
    sourceType: 'Transaction',
    sourceId: args.transactionId,
    lines: [
      { accountCode: '590', debit: args.amount, memo: `Customer ${args.userId}` },
      { accountCode: '411', credit: args.amount, memo: 'Receivable settlement' },
    ],
  }, tx);
}

// Merchant payout: merchant payable down, cash (mobile money) down.
export async function recordMerchantPayout(
  args: { payoutId: string; amount: number; provider: string; merchantId: string },
  tx: TxClient = prisma,
) {
  return postJournal({
    reference: `PAYOUT-${args.payoutId}`,
    description: `Merchant payout`,
    sourceType: 'Payout',
    sourceId: args.payoutId,
    lines: [
      { accountCode: '401', debit: args.amount, memo: `Merchant ${args.merchantId}` },
      { accountCode: cashAccountFor(args.provider), credit: args.amount, memo: 'Disbursed' },
    ],
  }, tx);
}

// Late penalty fee assessed against a customer: receivable up, penalty income up.
export async function recordLatePenalty(
  args: { purchaseId: string; amount: number; userId: string },
  tx: TxClient = prisma,
) {
  return postJournal({
    reference: `PENALTY-${args.purchaseId}-${Date.now()}`,
    description: `Late payment penalty`,
    sourceType: 'BnplPurchase',
    sourceId: args.purchaseId,
    lines: [
      { accountCode: '411', debit: args.amount, memo: `Customer ${args.userId}` },
      { accountCode: '758', credit: args.amount, memo: 'Late fee' },
    ],
  }, tx);
}
