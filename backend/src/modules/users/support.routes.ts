import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
  createTicket,
  getUserTickets,
  getTicketById,
  addMessageToTicket,
  closeTicket,
  FAQ_DATA,
} from '../../services/support.service';
import { TicketCategory, TicketPriority } from '@prisma/client';

export async function supportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  // GET /users/me/support/faq - Get FAQ data
  app.get('/me/support/faq', async () => {
    return {
      faqs: FAQ_DATA.map((f, index) => ({
        id: index,
        question: f.question,
        answer: f.answer,
      })),
    };
  });

  // GET /users/me/support/tickets - Get all user tickets
  app.get('/me/support/tickets', async (req) => {
    const userId = req.authUser!.id;
    const tickets = await getUserTickets(userId);
    return { tickets };
  });

  // GET /users/me/support/tickets/:id - Get specific ticket
  app.get('/me/support/tickets/:id', async (req, reply) => {
    const userId = req.authUser!.id;
    const { id } = req.params as { id: string };
    
    const ticket = await getTicketById(id, userId);
    if (!ticket) {
      return reply.code(404).send({ error: 'Ticket not found' });
    }
    
    return { ticket };
  });

  // POST /users/me/support/tickets - Create new ticket
  app.post('/me/support/tickets', async (req, reply) => {
    const userId = req.authUser!.id;
    const body = req.body as {
      category: string;
      subject: string;
      description: string;
      priority?: string;
    };

    // Validate required fields
    if (!body.subject || !body.description || !body.category) {
      return reply.code(400).send({
        error: 'BadRequest',
        message: 'Subject, description, and category are required',
      });
    }

    // Validate category
    const category = Object.values(TicketCategory).find(
      c => c === body.category.toUpperCase()
    );
    if (!category) {
      return reply.code(400).send({
        error: 'BadRequest',
        message: `Invalid category. Must be one of: ${Object.values(TicketCategory).join(', ')}`,
      });
    }

    // Validate priority if provided
    let priority: TicketPriority | undefined;
    if (body.priority) {
      priority = Object.values(TicketPriority).find(
        p => p === body.priority?.toUpperCase()
      );
      if (!priority) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: `Invalid priority. Must be one of: ${Object.values(TicketPriority).join(', ')}`,
        });
      }
    }

    const ticket = await createTicket(userId, {
      category,
      subject: body.subject,
      description: body.description,
      priority,
    });

    return { success: true, ticket };
  });

  // POST /users/me/support/tickets/:id/messages - Add message to ticket
  app.post('/me/support/tickets/:id/messages', async (req, reply) => {
    const userId = req.authUser!.id;
    const { id } = req.params as { id: string };
    const { message } = req.body as { message: string };

    if (!message || message.trim().length === 0) {
      return reply.code(400).send({
        error: 'BadRequest',
        message: 'Message is required',
      });
    }

    const ticket = await addMessageToTicket(id, userId, message.trim());
    if (!ticket) {
      return reply.code(404).send({ error: 'Ticket not found' });
    }

    return { success: true, ticket };
  });

  // POST /users/me/support/tickets/:id/close - Close ticket
  app.post('/me/support/tickets/:id/close', async (req, reply) => {
    const userId = req.authUser!.id;
    const { id } = req.params as { id: string };

    const closed = await closeTicket(id, userId);
    if (!closed) {
      return reply.code(404).send({ error: 'Ticket not found' });
    }

    return { success: true, message: 'Ticket closed successfully' };
  });
}
