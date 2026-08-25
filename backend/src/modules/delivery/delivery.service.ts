import { prisma } from '../../config/db';
import { logger } from '../../config/logger';
import { notifyUser } from '../../services/notification.service';

export class DeliveryError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'DeliveryError';
    this.statusCode = statusCode;
  }
}

export interface CreateDeliveryInput {
  purchaseId: string;
  lastName: string;
  firstName: string;
  phone: string;
  residence: string;
  deliveryLocation: string;
  color?: string;
  shoeSize?: string;
  profession: string;
  cni: string;
  idFrontPhoto?: string;
  idBackPhoto?: string;
  deliveryTime?: string;
}

export async function createDeliveryRequest(userId: string, input: CreateDeliveryInput) {
  // Verify the purchase belongs to this user and is ACTIVE or COMPLETED
  const purchase = await prisma.bnplPurchase.findFirst({
    where: { id: input.purchaseId, userId },
    include: { product: true },
  });
  if (!purchase) {
    throw new DeliveryError(404, 'Purchase not found');
  }
  if (!['ACTIVE', 'COMPLETED'].includes(purchase.status)) {
    throw new DeliveryError(400, 'Purchase must be ACTIVE or COMPLETED to request delivery');
  }

  // Check if there's already a pending/processing delivery for this purchase
  const existing = await prisma.deliveryRequest.findFirst({
    where: { purchaseId: input.purchaseId, status: { in: ['PENDING', 'PROCESSING', 'SHIPPED'] } },
  });
  if (existing) {
    throw new DeliveryError(409, 'A delivery request already exists for this purchase');
  }

  const delivery = await prisma.deliveryRequest.create({
    data: {
      purchaseId: input.purchaseId,
      userId,
      lastName: input.lastName,
      firstName: input.firstName,
      phone: input.phone,
      residence: input.residence,
      deliveryLocation: input.deliveryLocation,
      color: input.color || null,
      shoeSize: input.shoeSize || null,
      profession: input.profession,
      cni: input.cni,
      idFrontPhoto: input.idFrontPhoto || null,
      idBackPhoto: input.idBackPhoto || null,
      deliveryTime: input.deliveryTime || null,
    },
  });

  logger.info({ deliveryId: delivery.id, purchaseId: input.purchaseId, userId }, 'Delivery request created');

  // Notify user
  await notifyUser(userId, `Votre demande de livraison pour "${purchase.product.name}" a été enregistrée. Nous vous contacterons bientôt.`);

  return delivery;
}

export async function getDeliveryRequests(userId: string) {
  return prisma.deliveryRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { purchase: { include: { product: true } } },
  });
}

export async function getDeliveryRequestById(id: string, userId?: string) {
  const where: any = { id };
  if (userId) where.userId = userId;
  return prisma.deliveryRequest.findFirst({
    where,
    include: { purchase: { include: { product: true, merchant: true } }, user: true },
  });
}

// Admin functions
export async function listAllDeliveryRequests(options: { page: number; limit: number; status?: string }) {
  const where: any = {};
  if (options.status) where.status = options.status;

  const [items, total] = await Promise.all([
    prisma.deliveryRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
      include: {
        purchase: { include: { product: true, merchant: true } },
        user: { select: { id: true, fullName: true, phone: true, email: true } },
      },
    }),
    prisma.deliveryRequest.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages: Math.ceil(total / options.limit),
    },
  };
}

export async function updateDeliveryStatus(id: string, status: string, notes?: string) {
  const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    throw new DeliveryError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const delivery = await prisma.deliveryRequest.findUnique({ where: { id } });
  if (!delivery) throw new DeliveryError(404, 'Delivery request not found');

  const updated = await prisma.deliveryRequest.update({
    where: { id },
    data: { status, notes: notes || delivery.notes },
  });

  // Notify user of status change
  const statusMessages: Record<string, string> = {
    PROCESSING: 'Votre livraison est en cours de préparation.',
    SHIPPED: 'Votre commande a été expédiée! Elle arrive bientôt.',
    DELIVERED: 'Votre commande a été livrée. Merci!',
    CANCELLED: 'Votre demande de livraison a été annulée.',
  };
  if (statusMessages[status]) {
    await notifyUser(delivery.userId, statusMessages[status]);
  }

  // If delivered, update purchase status
  if (status === 'DELIVERED') {
    await prisma.bnplPurchase.update({
      where: { id: delivery.purchaseId },
      data: { status: 'DELIVERED' },
    });
  }

  return updated;
}
