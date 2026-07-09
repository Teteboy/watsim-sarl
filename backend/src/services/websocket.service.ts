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
}

class WebSocketService {
  private clients = new Map<string, ConnectedClient>();
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

  private async handleConnection(connection: { socket: WebSocket }, request: FastifyRequest) {
    try {
      // Authenticate WebSocket connection - accept token from header or query param
      const headerToken = request.headers.authorization?.replace('Bearer ', '');
      const queryToken = (request.query as Record<string, string>)?.token;
      const token = headerToken || queryToken;
      if (!token) {
        connection.socket.close(1008, 'No token provided');
        return;
      }

      // Verify token and get user (JWT uses 'sub' for user ID)
      const payload = this.server.jwt.verify(token) as { sub: string };
      const userId = payload?.sub;
      if (!userId) {
        connection.socket?.close?.(1008, 'Invalid token payload');
        return;
      }
      const user = await prisma.user.findUnique({ where: { id: userId } });
      
      if (!user) {
        connection.socket.close(1008, 'Invalid token');
        return;
      }

      const client: ConnectedClient = {
        socket: connection.socket,
        userId: user.id,
        conversationSubscriptions: new Set(),
      };

      this.clients.set(user.id, client);

      // Handle incoming messages
      connection.socket.on('message', async (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          await this.handleMessage(client, message);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      // Handle disconnection
      connection.socket.on('close', () => {
        this.clients.delete(user.id);
        this.broadcastUserStatus(user.id, false);
      });

      // Notify others that user is online
      this.broadcastUserStatus(user.id, true);

      // Send initial conversation list
      await this.sendConversationList(client);

    } catch (error) {
      console.error('WebSocket connection error:', error);
      connection.socket?.close?.(1008, 'Authentication failed');
    }
  }

  private async handleMessage(client: ConnectedClient, message: WSMessage) {
    switch (message.type) {
      case 'message':
        await this.handleNewMessage(client, message.data);
        break;
      case 'typing':
        this.broadcastToConversation(message.conversationId!, {
          type: 'typing',
          data: { userId: client.userId, isTyping: message.data.isTyping },
          timestamp: new Date().toISOString(),
        }, client.userId);
        break;
      case 'read':
        await this.handleReadReceipt(client, message.data);
        break;
      case 'subscribe':
        // Subscribe to conversation updates
        if (message.conversationId) {
          client.conversationSubscriptions.add(message.conversationId);
        }
        break;
      case 'unsubscribe':
        // Unsubscribe from conversation updates
        if (message.conversationId) {
          client.conversationSubscriptions.delete(message.conversationId);
        }
        break;
    }
  }

  private async handleNewMessage(client: ConnectedClient, data: Record<string, unknown>) {
    try {
      // Create message in database
      const newMessage = await prisma.message.create({
        data: {
          conversationId: data.conversationId as string,
          senderId: client.userId,
          text: (data.content ?? data.text) as string | undefined,
          attachmentUrl: data.attachmentUrl as string | undefined,
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
        where: { id: data.conversationId as string },
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
        conversationId: data.conversationId as string,
        userId: client.userId,
        timestamp: newMessage.createdAt.toISOString(),
      };

      this.broadcastToConversation(data.conversationId as string, broadcastMessage);

    } catch (error) {
      console.error('Error handling new message:', error);
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
      // Mark conversation as read via participant lastReadAt
      await prisma.conversationParticipant.updateMany({
        where: {
          conversationId: data.conversationId as string,
          userId: client.userId,
        },
        data: { lastReadAt: new Date() },
      });

      // Broadcast read status
      this.broadcastToConversation(data.conversationId as string, {
        type: 'read',
        data: {
          conversationId: data.conversationId,
          userId: client.userId,
          readAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error handling read receipt:', error);
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
      console.error('Error sending conversation list:', error);
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
          const client = this.clients.get(participant.userId);
          if (client) {
            client.socket.send(JSON.stringify(message));
          }
        }
      });
    }).catch(error => {
      console.error('Error broadcasting to conversation:', error);
    });
  }

  private broadcastUserStatus(userId: string, isOnline: boolean) {
    const message: WSMessage = {
      type: 'online_status',
      data: { userId, isOnline },
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all connected clients
    this.clients.forEach((client, clientUserId) => {
      if (clientUserId !== userId) {
        client.socket.send(JSON.stringify(message));
      }
    });
  }

  // Public method to send notifications to specific user
  public sendToUser(userId: string, message: WSMessage) {
    const client = this.clients.get(userId);
    if (client) {
      client.socket.send(JSON.stringify(message));
    }
  }

  // Public method to broadcast to all users
  public broadcast(message: WSMessage) {
    this.clients.forEach(client => {
      client.socket.send(JSON.stringify(message));
    });
  }
}

export { WebSocketService, WSMessage };
