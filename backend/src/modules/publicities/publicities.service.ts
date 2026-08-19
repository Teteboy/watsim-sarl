import { prisma } from '../../config/db';
import { resolveImageUrl } from '../../services/storage-local.service';

export async function listPublicities(params: {
  page: number; limit: number;
  status?: string; type?: string; search?: string;
}) {
  try {
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;
    if (params.search) where.name = { contains: params.search, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      prisma.publicity.findMany({
        where,
        include: { merchant: { select: { id: true, businessName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.publicity.count({ where }),
    ]);

    // Convert stored imageUrl paths to full URLs
    const itemsWithUrls = items.map((item: any) => ({
      ...item,
      imageUrl: resolveImageUrl(item.imageUrl),
    }));

    return { items: itemsWithUrls, total, page: params.page, limit: params.limit };
  } catch {
    return { items: [], total: 0, page: params.page, limit: params.limit };
  }
}

export async function createPublicity(data: any) {
  return prisma.publicity.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      aim: data.aim ?? null,
      location: data.location ?? null,
      phoneNumber: data.phoneNumber ?? null,
      merchantId: data.merchantId || null,
      type: data.type,
      position: data.position,
      budget: data.budget || 0,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      imageUrl: data.imageUrl || null,
      status: 'PENDING',
    } as any,
  });
}

export async function updatePublicity(id: string, data: any) {
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description ?? null;
  if (data.aim !== undefined) updateData.aim = data.aim ?? null;
  if (data.location !== undefined) updateData.location = data.location ?? null;
  if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber ?? null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.budget !== undefined) updateData.budget = data.budget;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
  if (data.merchantId !== undefined) updateData.merchantId = data.merchantId;

  return prisma.publicity.update({
    where: { id },
    data: updateData,
  });
}

export async function deletePublicity(id: string) {
  return prisma.publicity.delete({ where: { id } });
}
