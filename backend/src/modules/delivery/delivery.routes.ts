import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import {
  createDeliveryRequest,
  DeliveryError,
  getDeliveryRequests,
  getDeliveryRequestById,
  CreateDeliveryInput,
} from './delivery.service';

export async function deliveryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', authorize('CUSTOMER'));

  // POST /delivery - Create a delivery request
  app.post('/', async (req, reply) => {
    try {
      const userId = req.authUser!.id;
      const body = req.body as CreateDeliveryInput;

      if (!body.purchaseId || !body.lastName || !body.firstName || !body.phone || !body.residence || !body.deliveryLocation || !body.profession || !body.cni) {
        return reply.code(400).send({ error: 'ValidationError', message: 'Missing required fields: purchaseId, lastName, firstName, phone, residence, deliveryLocation, profession, cni' });
      }

      const delivery = await createDeliveryRequest(userId, body);
      return reply.code(201).send(delivery);
    } catch (e) {
      if (e instanceof DeliveryError) return reply.code(e.statusCode).send({ error: 'DeliveryError', message: e.message });
      throw e;
    }
  });

  // GET /delivery - List user's delivery requests
  app.get('/', async (req) => {
    const userId = req.authUser!.id;
    return getDeliveryRequests(userId);
  });

  // GET /delivery/:id - Get specific delivery request
  app.get('/:id', async (req, reply) => {
    const userId = req.authUser!.id;
    const { id } = req.params as { id: string };
    const delivery = await getDeliveryRequestById(id, userId);
    if (!delivery) return reply.code(404).send({ error: 'NotFound', message: 'Delivery request not found' });
    return delivery;
  });
}
