import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocket } from '@fastify/websocket';
import { prisma } from '../config/db';
interface WSMessage {
  type: 'message' | 'typing' | 'read' | 'online_status' | 'subscribe' | 'unsubscribe' | 'conversation_list' | 'error';
  data: Record<string, unknown>;
  conversationId?: string;
  userId?: string;
  timestamp: string;
}

interface ConnectedClient {
  socket: WebSocket;
  userId: string;
  conversationSubscriptions: Set<string>;
  messageCount: number;
  windowStart: number;
}

const ALLOWED_TYPES = new Set(['message', 'typing', 'read', 'subscribe', 'unsubscribe']);
const MAX_FRAME_BYTES = 64 * 1024;
const MAX_MESSAGES_PER_WINDOW = 30;
const RATE_WINDOW_MS = 1000;
const MAX_CONTENT_LENGTH = 5000;

class WebSocketService {
  private clients = new Map<string, Set<ConnectedClient>>();
  private server: FastifyInstance;

  constructor(server: FastifyInstance) {
    this.server = server;
    this.setupRoutes();
  }

  private setupRoutes() {
    // WebSocket route for real-time messaging
    this.server.register(async (fastify) => {
      fastify.get('/ws', { websocket: true }, this.handleConnection.bind(this));
    });
  }

  private async handleConnection(connection: any, request: FastifyRequest) {
    let socket: any;
    let client: ConnectedClient | null = null;
    try {
      // Some fastify-websocket versions pass the raw socket; others wrap it in { socket }.
      socket = (connection as any).socket || (connection as any);

      // Authenticate via the Authorization header only — query-param tokens
      // leak into proxy/access logs.
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        socket.close(1008, 'No token provided');
        return;
      }

      // Verify token and get user (JWT uses 'sub' for user ID)
      const payload = this.server.jwt.verify(token) as { sub: string };
      const userId = payload?.sub;
      if (!userId) {
        socket?.close?.(1008, 'Invalid token payload');
        return;
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isActive: true },
      });
      const security = await prisma.userSecuritySettings.findUnique({
        where: { userId },
        select: { accountFrozen: true },
      });

      if (!user || !user.isActive || security?.accountFrozen) {
        socket.close(1008, 'Account unavailable');
        return;
      }

      client = {
        socket: socket,
        userId: user.id,
        conversationSubscriptions: new Set(),
        messageCount: 0,
        windowStart: Date.now(),
      };

      const userClients = this.clients.get(user.id) ?? new Set<ConnectedClient>();
      userClients.add(client);
      this.clients.set(user.id, userClients);

      // Handle incoming messages
      socket.on('message', async (data: Buffer) => {
        try {
          if (data.length > MAX_FRAME_BYTES) return;
          // Per-client rate limit: drop frames beyond the window budget.
          const now = Date.now();
          if (now - client!.windowStart > RATE_WINDOW_MS) {
            client!.windowStart = now;
            client!.messageCount = 0;
          }
          if (++client!.messageCount > MAX_MESSAGES_PER_WINDOW) return;

          const message: WSMessage = JSON.parse(data.toString());
          if (!message || typeof message !== 'object' || !ALLOWED_TYPES.has(message.type)) return;
          if (message.conversationId !== undefined && typeof message.conversationId !== 'string') return;
          await this.handleMessage(client!, message);
        } catch (error) {
          this.server.log.error(error, 'WebSocket message error');
        }
      });

      // Handle disconnection
      socket.on('close', () => {
        const set = this.clients.get(user.id);
        if (set) {
          set.delete(client!);
          if (set.size === 0) {
            this.clients.delete(user.id);
            this.broadcastUserStatus(user.id, false);
          }
        }
      });

      // Notify others that user is online (only on first connection)
      if (userClients.size === 1) {
        this.broadcastUserStatus(user.id, true);
      }

      // Send initial conversation list
      await this.sendConversationList(client);

      // Keep the connection alive until the client closes it
      await new Promise<void>((resolve) => socket.once('close', resolve));

    } catch (error) {
      this.server.log.error(error, 'WebSocket connection error');
      socket?.close?.(1008, 'Authentication failed');
    }
  }

  private async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    if (!conversationId) return false;
    const membership = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    return !!membership;
  }

  private async handleMessage(client: ConnectedClient, message: WSMessage) {
    switch (message.type) {
      case 'message':
        await this.handleNewMessage(client, message.data ?? {});
        break;
      case 'typing': {
        const conversationId = message.conversationId;
        if (!conversationId || !(await this.isParticipant(conversationId, client.userId))) return;
        this.broadcastToConversation(conversationId, {
          type: 'typing',
          data: { userId: client.userId, isTyping: message.data?.isTyping === true },
          timestamp: new Date().toISOString(),
        }, client.userId);
        break;
      }
      case 'read':
        await this.handleReadReceipt(client, message.data ?? {});
        break;
      case 'subscribe': {
        if (message.conversationId && await this.isParticipant(message.conversationId, client.userId)) {
          client.conversationSubscriptions.add(message.conversationId);
        }
        break;
      }
      case 'unsubscribe': {
        if (message.conversationId) {
          client.conversationSubscriptions.delete(message.conversationId);
        }
        break;
      }
    }
  }

  private async handleNewMessage(client: ConnectedClient, data: Record<string, unknown>) {
    try {
      const conversationId = data.conversationId as string;
      const content = (data.content ?? data.text) as string | undefined;
      if (!conversationId || typeof conversationId !== 'string') return;
      if (content !== undefined && (typeof content !== 'string' || content.length > MAX_CONTENT_LENGTH)) {
        client.socket.send(JSON.stringify({
          type: 'error',
          data: { message: 'Message too long' },
          timestamp: new Date().toISOString(),
        }));
        return;
      }

      // Verify the sender is a participant of this conversation
      if (!(await this.isParticipant(conversationId, client.userId))) {
        client.socket.send(JSON.stringify({
          type: 'error',
          data: { message: 'Not a participant in this conversation' },
          timestamp: new Date().toISOString(),
        }));
        return;
      }

      // Reject dangerous attachment URLs (stored XSS in clients)
      const attachmentUrl = data.attachmentUrl as string | undefined;
      if (attachmentUrl !== undefined) {
        const ok = attachmentUrl.startsWith('/uploads/') || /^https:\/\//i.test(attachmentUrl);
        if (!ok || attachmentUrl.length > 2048) {
          client.socket.send(JSON.stringify({
            type: 'error',
            data: { message: 'Invalid attachment URL' },
            timestamp: new Date().toISOString(),
          }));
          return;
        }
      }

      // Create message in database
      const newMessage = await prisma.message.create({
        data: {
          conversationId,
          senderId: client.userId,
          text: content,
          attachmentUrl,
          attachmentType: data.attachmentType as string | undefined,
        },
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              imageUrl: true,
            },
          },
        },
      });

      // Touch conversation updatedAt
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // Broadcast to all clients in conversation
      const broadcastMessage: WSMessage = {
        type: 'message',
        data: {
          id: newMessage.id,
          conversationId: newMessage.conversationId,
          text: newMessage.text,
          attachmentUrl: newMessage.attachmentUrl,
          attachmentType: newMessage.attachmentType,
          createdAt: newMessage.createdAt,
          sender: newMessage.sender,
        },
        conversationId,
        userId: client.userId,
        timestamp: newMessage.createdAt.toISOString(),
      };

      this.broadcastToConversation(conversationId, broadcastMessage, client.userId);

    } catch (error) {
      this.server.log.error(error, 'Error handling new message');
      // Send error back to sender
      client.socket.send(JSON.stringify({
        type: 'error',
        data: { message: 'Failed to send message' },
        timestamp: new Date().toISOString(),
      }));
    }
  }

  private async handleReadReceipt(client: ConnectedClient, data: Record<string, unknown>) {
    try {
      const conversationId = data.conversationId as string;
      if (!conversationId || !(await this.isParticipant(conversationId, client.userId))) return;

      // Mark conversation as read via participant lastReadAt
      await prisma.conversationParticipant.updateMany({
        where: {
          conversationId,
          userId: client.userId,
        },
        data: { lastReadAt: new Date() },
      });

      // Broadcast read status
      this.broadcastToConversation(conversationId, {
        type: 'read',
        data: {
          conversationId,
          userId: client.userId,
          readAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.server.log.error(error, 'Error handling read receipt');
    }
  }

  private async sendConversationList(client: ConnectedClient) {
    try {
      const conversations = await prisma.conversation.findMany({
        where: {
          participants: {
            some: {
              userId: client.userId,
            },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  imageUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      client.socket.send(JSON.stringify({
        type: 'conversation_list',
        data: conversations,
        timestamp: new Date().toISOString(),
      }));

    } catch (error) {
      this.server.log.error(error, 'Error sending conversation list');
    }
  }

  private broadcastToConversation(conversationId: string, message: WSMessage, excludeUserId?: string) {
    // Get all participants in the conversation
    prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    }).then(participants => {
      participants.forEach(participant => {
        if (participant.userId !== excludeUserId) {
          this.sendToUser(participant.userId, message);
        }
      });
    }).catch(error => {
      this.server.log.error(error, 'Error broadcasting to conversation');
    });
  }

  private broadcastUserStatus(userId: string, isOnline: boolean) {
    const message: WSMessage = {
      type: 'online_status',
      data: { userId, isOnline },
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all connected clients
    this.clients.forEach((_, clientUserId) => {
      if (clientUserId !== userId) {
        this.sendToUser(clientUserId, message);
      }
    });
  }

  // Public method to send notifications to specific user
  public sendToUser(userId: string, message: WSMessage) {
    const payload = JSON.stringify(message);
    this.clients.get(userId)?.forEach(client => {
      try {
        client.socket.send(payload);
      } catch (error) {
        this.server.log.error(error, 'WebSocket send error');
      }
    });
  }

  // Public method to broadcast to all users
  public broadcast(message: WSMessage) {
    const payload = JSON.stringify(message);
    this.clients.forEach(userClients => {
      userClients.forEach(client => {
        try {
          client.socket.send(payload);
        } catch (error) {
          this.server.log.error(error, 'WebSocket broadcast error');
        }
      });
    });
  }
}

export { WebSocketService, WSMessage };
