import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { logger } from '../../config/logger';
import { OHADA_CHART, isDebitNormal } from './accounting.chart';

export class AccountingError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export interface JournalLineInput {
  accountCode: string;
  debit?: number;
  credit?: number;
  memo?: string;
}

export interface PostJournalInput {
  reference: string;
  description: string;
  sourceType?: string;
  sourceId?: string;
  postedBy?: string;
  lines: JournalLineInput[];
}

export async function ensureChartSeeded(): Promise<void> {
  const count = await prisma.ledgerAccount.count();
  if (count >= OHADA_CHART.length) return;
  await prisma.$transaction(
    OHADA_CHART.map((a) =>
      prisma.ledgerAccount.upsert({
        where: { code: a.code },
        update: { name: a.name, type: a.type, parent: a.parent ?? null },
        create: { code: a.code, name: a.name, type: a.type, parent: a.parent ?? null },
      }),
    ),
  );
  logger.info({ seeded: OHADA_CHART.length }, 'OHADA chart of accounts ensured');
}

export async function postJournal(
  input: PostJournalInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const totalDebit = input.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = input.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (totalDebit !== totalCredit) {
    throw new AccountingError(400, `Unbalanced journal: debit=${totalDebit} credit=${totalCredit}`);
  }
  if (totalDebit === 0) throw new AccountingError(400, 'Empty journal entry');
  for (const l of input.lines) {
    if ((l.debit ?? 0) > 0 && (l.credit ?? 0) > 0) {
      throw new AccountingError(400, 'Each line must be either debit or credit, not both');
    }
  }
  const existing = await tx.journalEntry.findUnique({ where: { reference: input.reference } });
  if (existing) return existing;
  return tx.journalEntry.create({
    data: {
      reference: input.reference,
      description: input.description,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      postedBy: input.postedBy,
      lines: {
        create: input.lines.map((l) => ({
          accountCode: l.accountCode,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          memo: l.memo,
        })),
      },
    },
    include: { lines: true },
  });
}

export async function getTrialBalance(period?: { from?: Date; to?: Date }) {
  const where: Prisma.JournalLineWhereInput = {};
  if (period?.from || period?.to) {
    where.entry = {};
    if (period.from) (where.entry as Prisma.JournalEntryWhereInput).postedAt = { gte: period.from };
    if (period.to) {
      (where.entry as Prisma.JournalEntryWhereInput).postedAt = {
        ...((where.entry as Prisma.JournalEntryWhereInput).postedAt as object | undefined),
        lte: period.to,
      };
    }
  }
  const grouped = await prisma.journalLine.groupBy({
    by: ['accountCode'],
    where,
    _sum: { debit: true, credit: true },
  });
  // Return all accounts from the chart, with sums from grouped results (or zeros)
  const accounts = await prisma.ledgerAccount.findMany({ orderBy: { code: 'asc' } });
  const groupedMap = new Map(grouped.map((g) => [g.accountCode, g]));
  return accounts.map((a) => {
    const g = groupedMap.get(a.code);
    const debit = g?._sum.debit ?? 0;
    const credit = g?._sum.credit ?? 0;
    const balance = isDebitNormal(a.type) ? debit - credit : credit - debit;
    return {
      code: a.code,
      name: a.name,
      type: a.type,
      debit,
      credit,
      balance,
    };
  });
}

export async function getGeneralLedger(accountCode: string, period?: { from?: Date; to?: Date }) {
  const where: Prisma.JournalLineWhereInput = { accountCode };
  if (period?.from || period?.to) {
    where.entry = {};
    if (period.from) (where.entry as Prisma.JournalEntryWhereInput).postedAt = { gte: period.from };
    if (period.to) {
      (where.entry as Prisma.JournalEntryWhereInput).postedAt = {
        ...((where.entry as Prisma.JournalEntryWhereInput).postedAt as object | undefined),
        lte: period.to,
      };
    }
  }
  const lines = await prisma.journalLine.findMany({
    where,
    include: { entry: true },
    orderBy: { entry: { postedAt: 'asc' } },
  });
  let running = 0;
  const account = await prisma.ledgerAccount.findUnique({ where: { code: accountCode } });
  return lines.map((l) => {
    const delta = isDebitNormal(account?.type ?? 'ASSET') ? l.debit - l.credit : l.credit - l.debit;
    running += delta;
    return {
      date: l.entry.postedAt,
      reference: l.entry.reference,
      description: l.entry.description,
      debit: l.debit,
      credit: l.credit,
      balance: running,
      memo: l.memo,
    };
  });
}

export async function listJournal(page = 1, limit = 50) {
  const [items, total] = await Promise.all([
    prisma.journalEntry.findMany({
      include: { lines: true },
      orderBy: { postedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.journalEntry.count(),
  ]);
  return { items, total, page, limit };
}
