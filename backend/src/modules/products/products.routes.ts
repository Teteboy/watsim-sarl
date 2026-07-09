import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { listProductsSchema, stockAdjustmentSchema } from './products.schema';
import { adjustProductStock, getProduct, listProducts, listPublicCategories, suggestSellPrice, listBestOffers } from './products.service';

function getRequestBaseUrl(req: any): string {
  const protocol = (req.headers['x-forwarded-proto'] as string) || 'http';
  const host = req.headers['host'] || `localhost:${process.env.PORT || 3001}`;
  return `${protocol}://${host}`;
}

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { schema: listProductsSchema }, async (req) => {
    const q = req.query as { page?: number; limit?: number; merchantId?: string; categoryId?: string; search?: string; minPrice?: number; maxPrice?: number };
    return listProducts({ page: q.page ?? 1, limit: q.limit ?? 20, merchantId: q.merchantId, categoryId: q.categoryId, search: q.search, minPrice: q.minPrice, maxPrice: q.maxPrice }, getRequestBaseUrl(req));
  });

  app.patch('/:id/stock', { schema: stockAdjustmentSchema, preHandler: [authenticate, authorize('ADMIN', 'MERCHANT')] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { delta } = req.body as { delta: number };
      const actor = req.authUser!;
      const product = await adjustProductStock(id, delta, actor.id, actor.role as 'ADMIN' | 'MERCHANT');
      return { productId: product?.id, stock: product?.stock };
    } catch (e: any) {
      if (e.statusCode) return reply.code(e.statusCode).send({ error: e.name || 'ProductError', message: e.message });
      throw e;
    }
  });

  app.get('/:id', async (req, reply) => {
    const product = await getProduct((req.params as { id: string }).id, getRequestBaseUrl(req));
    if (!product) return reply.code(404).send({ error: 'NotFound' });
    return product;
  });

  // Public list of active platform categories (for product assignment dropdowns)
  app.get('/categories', async (req) => listPublicCategories(getRequestBaseUrl(req)));

  // Backend-driven sell price suggestion (used by both admin and merchant forms)
  app.get('/suggest-price', async (req) => {
    const q = req.query as { costPrice?: string | number; categoryId?: string };
    const cost = Number(q.costPrice);
    const suggested = await suggestSellPrice(cost, q.categoryId);
    return { costPrice: cost, suggestedPrice: suggested, marginApplied: true };
  });

  // “Exclusive offers” (best offers): active products ordered by lowest price
  // Used by the mobile home page.
  app.get('/best-offers', async (req) => {
    const q = req.query as { limit?: number };
    const limit = Number(q.limit ?? 8);
    return listBestOffers({ limit }, getRequestBaseUrl(req));
  });
}

