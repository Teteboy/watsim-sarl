import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { listPublicitiesSchema, createPublicitySchema, updatePublicitySchema } from './publicities.schema';
import { listPublicities, createPublicity, updatePublicity, deletePublicity } from './publicities.service';

export async function publicityRoutes(app: FastifyInstance): Promise<void> {
  // Public endpoint for active publicity (no auth required) - must be before auth hooks
  app.get('/active', async (req, reply) => {
    const activePublicities = await listPublicities({
      page: 1,
      limit: 10,
      status: 'ACTIVE'
    });
    return reply.send({ publicities: activePublicities.items });
  });

  // Admin routes below - auth hooks apply only to routes after this point
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', authorize('ADMIN'));

  app.get('/', { schema: listPublicitiesSchema }, async (req) => {
    const q = req.query as any;
    return listPublicities({
      page: q.page ?? 1,
      limit: q.limit ?? 20,
      status: q.status,
      type: q.type,
      search: q.search,
    });
  });

  app.post('/', { schema: createPublicitySchema }, async (req) => {
    return createPublicity(req.body);
  });

  app.put('/:id', { schema: updatePublicitySchema }, async (req) => {
    const { id } = req.params as { id: string };
    return updatePublicity(id, req.body);
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await deletePublicity(id);
    reply.code(204).send();
  });
}
