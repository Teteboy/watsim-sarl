import { FastifyInstance } from 'fastify';

import { authenticate } from '../../middleware/authenticate';

import {
  createConversationSchema,
  sendMessageSchema,
  markReadSchema,
} from './messaging.schema';
import {
  getUserConversations,
  getOrCreateConversation,
  getConversationMessages,
  sendMessage,
  markConversationRead,
  getOrCreateSupportConversation,
  resolveUserIdsByPhones,
} from './messaging.service';

import { AuthError } from '../auth/auth.service';


export async function messagingRoutes(app: FastifyInstance): Promise<void> {


  // All messaging requires auth
  app.addHook('preHandler', authenticate);

  // List my conversations
  app.get('/conversations', async (req, reply) => {
    if (!req.authUser) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = req.authUser.id;


    return { conversations: await getUserConversations(userId) };
  });



  // Create or find a conversation (1:1 or group)
  app.post('/conversations', { schema: createConversationSchema }, async (req, reply) => {

    if (!req.authUser) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = req.authUser.id;




    const body = req.body as {
      participantIds?: string[];
      participantPhones?: string[];
      title?: string;
      isSupport?: boolean;
    };




    try {
      let convId: string;
      if (body.isSupport) {
        convId = await getOrCreateSupportConversation(userId);
      } else {
        const othersFromIds = (body.participantIds || []).filter((id) => id !== userId);

        if (othersFromIds.length > 0) {
          convId = await getOrCreateConversation(userId, othersFromIds, body.title);
        } else if (body.participantPhones && body.participantPhones.length > 0) {
          // Resolve phones -> userIds
          const resolved = await resolveUserIdsByPhones(body.participantPhones);
          const others = resolved.filter((id) => id !== userId);

          if (others.length === 0) {
            return reply.code(400).send({
              error: 'BadRequest',
              message: 'No user found for provided participantPhones',
            });
          }

          convId = await getOrCreateConversation(userId, others, body.title, body.isSupport ?? false);

        } else {
          return reply.code(400).send({ error: 'BadRequest', message: 'participantIds or participantPhones required' });
        }
      }

      return { conversationId: convId };
    } catch (e) {
      if (e instanceof AuthError) return reply.code(e.statusCode).send({ error: 'AuthError', message: e.message });
      throw e;
    }
  });

  // Get messages for a conversation (paginated)
  app.get('/conversations/:id/messages', async (req, reply) => {
    if (!req.authUser) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = req.authUser.id;

    const { id } = req.params as { id: string };
    const { limit, before } = req.query as { limit?: string; before?: string };



    try {
      const messages = await getConversationMessages(
        id,
        userId,
        limit ? parseInt(limit) : 50,
        before
      );
      return { messages };
    } catch (e) {
      if (e instanceof AuthError) return reply.code(e.statusCode).send({ error: 'AuthError', message: e.message });
      throw e;
    }
  });

  // Send a message (text or attachment metadata)
  app.post('/conversations/:id/messages', { schema: sendMessageSchema }, async (req, reply) => {
    if (!req.authUser) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = req.authUser.id;


    const { id } = req.params as { id: string };

    const body = req.body as { text?: string; attachmentUrl?: string; attachmentType?: string };

    try {
      const message = await sendMessage(id, userId, body.text, body.attachmentUrl, body.attachmentType);
      return { message };
    } catch (e) {
      if (e instanceof AuthError) return reply.code(e.statusCode).send({ error: 'AuthError', message: e.message });
      throw e;
    }
  });

  // Mark conversation as read
  app.post('/conversations/:id/read', { schema: markReadSchema }, async (req, reply) => {
    if (!req.authUser) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = req.authUser.id;

    const { id } = req.params as { id: string };

    await markConversationRead(id, userId);
    return { success: true };
  });

  // Convenience: get or create the support chat for current user
  app.get('/support/conversation', async (req, reply) => {
    if (!req.authUser) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = req.authUser.id;



    const convId = await getOrCreateSupportConversation(userId);
    return { conversationId: convId };
  });

}
