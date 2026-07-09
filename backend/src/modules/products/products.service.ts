import { prisma } from '../../config/db';
import type { Prisma } from '@prisma/client';
import { resolveImageUrl } from '../../services/storage-local.service';

export class ProductError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

function resolveProductImage(product: any, requestBaseUrl?: string) {
  if (!product) return product;
  return {
    ...product,
    imageUrl: resolveImageUrl(product.imageUrl, requestBaseUrl),
    gallery: product.gallery?.map((g: any) => ({
      ...g,
      imageUrl: resolveImageUrl(g.imageUrl, requestBaseUrl),
    })) || [],
  };
}

export async function listProducts(params: {
  page: number; limit: number;
  merchantId?: string; categoryId?: string; search?: string;
  minPrice?: number; maxPrice?: number;
}, requestBaseUrl?: string) {
  const where: Prisma.ProductWhereInput = { isActive: true };
  if (params.merchantId) where.merchantId = params.merchantId;
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.search) where.name = { contains: params.search, mode: 'insensitive' };
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    where.price = {};
    if (params.minPrice !== undefined) (where.price as Prisma.IntFilter).gte = params.minPrice;
    if (params.maxPrice !== undefined) (where.price as Prisma.IntFilter).lte = params.maxPrice;
  }
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        merchant: { select: { id: true, businessName: true, city: true, category: true } },
        category: { select: { id: true, name: true, slug: true, color: true, icon: true, imageUrl: true } },
        gallery: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.product.count({ where }),
  ]);
  return { items: items.map(p => resolveProductImage(p, requestBaseUrl)), total, page: params.page, limit: params.limit };
}

export async function getProduct(id: string, requestBaseUrl?: string) {
  const product = await prisma.product.findFirst({
    where: { id, isActive: true },
    include: {
      merchant: { select: { id: true, businessName: true, city: true, category: true } },
      category: { select: { id: true, name: true, slug: true, color: true, icon: true, imageUrl: true } },
      gallery: { orderBy: { sortOrder: 'asc' } },
    },
  });
  return resolveProductImage(product, requestBaseUrl);
}

export async function listBestOffers(params: { limit: number }, requestBaseUrl?: string) {
  // "Best offers" = active products with lowest prices
  // If you later define a more complex rule based on categories, we can extend it here.
  const take = Math.max(1, Math.min(params.limit ?? 10, 50));

  const where: Prisma.ProductWhereInput = { isActive: true };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        merchant: { select: { id: true, businessName: true, city: true, category: true } },
        category: { select: { id: true, name: true, slug: true, color: true, icon: true, imageUrl: true } },
        gallery: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { price: 'asc' },
      take,
    }),
    prisma.product.count({ where }),
  ]);

  return { items: items.map(p => resolveProductImage(p, requestBaseUrl)), total, limit: take };
}

export async function adjustProductStock(
  productId: string,
  delta: number,
  actorId?: string,
  actorRole?: 'ADMIN' | 'MERCHANT',
) {
  if (!Number.isInteger(delta)) throw new ProductError(400, 'Stock delta must be an integer');
  if (actorRole === 'MERCHANT' && !actorId) throw new ProductError(401, 'Unauthorized');

  const where: Prisma.ProductWhereInput = { id: productId };
  if (actorRole === 'MERCHANT') {
    where.merchant = { userId: actorId };
  }

  const updated = await prisma.product.updateMany({
    where,
    data: { stock: { increment: delta } },
  });

  if (updated.count === 0) {
    const productExists = await prisma.product.count({ where: { id: productId } });
    if (!productExists) throw new ProductError(404, 'Product not found');
    if (actorRole === 'MERCHANT') throw new ProductError(403, 'Forbidden');
    throw new ProductError(409, 'Insufficient stock');
  }

  return prisma.product.findUnique({ where: { id: productId } });
}

export async function listPublicCategories(requestBaseUrl?: string) {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, slug: true, name: true, description: true, icon: true, color: true, imageUrl: true },
  });
  return categories.map(c => ({
    ...c,
    imageUrl: resolveImageUrl(c.imageUrl, requestBaseUrl),
  }));
}

const DEFAULT_MARKUP_MARGIN = 0.20;

export async function suggestSellPrice(costPrice: number, categoryId?: string): Promise<number> {
  if (!costPrice || costPrice <= 0) return 0;

  let margin = DEFAULT_MARKUP_MARGIN;
  if (categoryId) {
    const cat = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { markupMargin: true },
    });
    if (cat?.markupMargin != null) {
      margin = Number(cat.markupMargin);
    }
  }
  return Math.round(costPrice * (1 + margin));
}
