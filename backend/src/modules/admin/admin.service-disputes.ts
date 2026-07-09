// ===== Disputes =====
import { prisma } from '../../config/db';

export async function listDisputes(params: { page?: number; limit?: number; status?: string }) {
  const page = params.page || 1;
  const limit = params.limit || 20;

  const where: any = {};
  if (params.status) where.status = params.status;

  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, fullName: true } },
        merchant: { select: { id: true, businessName: true } },
        purchase: { select: { id: true, totalAmount: true } },
      },
    }),
    prisma.dispute.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function getDisputeById(id: string) {
  return prisma.dispute.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      merchant: { select: { id: true, businessName: true } },
      purchase: { select: { id: true, totalAmount: true, status: true } },
      resolver: { select: { id: true, fullName: true } },
    },
  });
}

export async function resolveDispute(adminId: string, id: string, resolution: string) {
  const updated = await prisma.dispute.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      resolution,
      resolvedAt: new Date(),
      resolvedBy: adminId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'DISPUTE_RESOLVED',
      entityType: 'Dispute',
      entityId: id,
    },
  });

  return updated;
}

// ===== Fraud Alerts =====
export async function listFraudAlerts(params: { page?: number; limit?: number; status?: string; severity?: string }) {
  const page = params.page || 1;
  const limit = params.limit || 20;

  const where: any = {};
  if (params.status) where.status = params.status;
  if (params.severity) where.severity = params.severity;

  const [items, total] = await Promise.all([
    prisma.fraudAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.fraudAlert.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function getFraudAlertById(id: string) {
  return prisma.fraudAlert.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      resolver: { select: { id: true, fullName: true } },
    },
  });
}

export async function resolveFraudAlert(adminId: string, id: string) {
  const updated = await prisma.fraudAlert.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedBy: adminId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'FRAUD_ALERT_RESOLVED',
      entityType: 'FraudAlert',
      entityId: id,
    },
  });

  return updated;
}
