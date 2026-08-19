import { prisma } from '../../config/db';
import { AuthError } from '../auth/auth.service';

export interface ConversationWithMeta {
  id: string;
  title: string | null;
  participants: Array<{ id: string; fullName: string; role: string }>;
  lastMessage: { text: string | null; createdAt: string; senderName?: string } | null;
  unreadCount: number;
  updatedAt: string;
}

export async function getUserConversations(userId: string): Promise<ConversationWithMeta[]> {
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: { select: { id: true, fullName: true, role: true } } },
          },
          // We need all message timestamps to compute unread.
          // For v1 performance, we cap to the latest 200 messages per conversation.
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 200,
            include: { sender: { select: { fullName: true } } },
          },
        },
      },
    },
    orderBy: { conversation: { updatedAt: 'desc' } },
  });

  return participations.map((p) => {
    const conv = p.conversation;
    const lastMsg = conv.messages[0];
    const otherParticipants = conv.participants
      .filter((pp) => pp.userId !== userId)
      .map((pp) => ({
        id: pp.user.id,
        fullName: pp.user.fullName,
        role: pp.user.role,
      }));

    // Compute unread: messages after participant's lastReadAt.
    // If never read, count all messages from other senders.
    const lastReadAt = p.lastReadAt;
    const unreadCount = conv.messages.filter((m) => {
      if (m.senderId === userId) return false;
      if (lastReadAt) {
        return m.createdAt > lastReadAt;
      }
      return true;
    }).length;

    return {
      id: conv.id,
      title: conv.title || otherParticipants.map((op) => op.fullName).join(', ') || 'Conversation',
      participants: otherParticipants,
      lastMessage: lastMsg
        ? {
            text: lastMsg.text,
            createdAt: lastMsg.createdAt.toISOString(),
            senderName: lastMsg.sender?.fullName,
          }
        : null,
      unreadCount,
      updatedAt: conv.updatedAt.toISOString(),
    };
  });
}

export async function getOrCreateConversation(
  userId: string,
  participantIds: string[],
  title?: string,
  isSupport = false
): Promise<string> {
  // Find existing 1:1 or small group if exact match
  if (participantIds.length === 1) {
    const existing = await prisma.conversation.findFirst({
      where: {
        participants: {
          every: {
            userId: { in: [userId, participantIds[0]] },
          },
        },
        // For exact 1:1 we can add count filter in real impl
      },
      include: { participants: true },
    });

    if (existing && existing.participants.length === 2) {
      return existing.id;
    }
  }

  // Verify all provided participant IDs refer to real users
  const validUsers = await prisma.user.findMany({
    where: { id: { in: participantIds } },
    select: { id: true },
  });
  const validIds = validUsers.map((u) => u.id);
  if (validIds.length === 0) {
    throw new AuthError(400, 'One or more participantIds are not valid users');
  }

  // Create new
  const conv = await prisma.conversation.create({
    data: {
      title: title || (isSupport ? 'Watsim Support' : undefined),
      participants: {
        create: [
          { userId },
          ...validIds.map((pid) => ({ userId: pid })),
        ],
      },
    },
  });

  return conv.id;
}

export async function getConversationMessages(
  conversationId: string,
  userId: string,
  limit = 50,
  before?: string
) {
  // Verify membership
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!membership) throw new AuthError(403, 'Not a participant');

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      sender: { select: { id: true, fullName: true } },
    },
  });

  return messages.reverse().map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    senderName: m.sender?.fullName,
    text: m.text,
    attachmentUrl: m.attachmentUrl,
    attachmentType: m.attachmentType,
    createdAt: m.createdAt.toISOString(),
    isMe: m.senderId === userId,
  }));
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text?: string,
  attachmentUrl?: string,
  attachmentType?: string
) {
  // Verify membership
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: senderId } },
  });
  if (!membership) throw new AuthError(403, 'Not a participant in this conversation');

  const msg = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      text: text || null,
      attachmentUrl: attachmentUrl || null,
      attachmentType: attachmentType || null,
    },
    include: { sender: { select: { fullName: true } } },
  });

  // Update conversation updatedAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Update lastRead for sender
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: senderId } },
    data: { lastReadAt: new Date() },
  });

  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    senderName: msg.sender?.fullName,
    text: msg.text,
    attachmentUrl: msg.attachmentUrl,
    attachmentType: msg.attachmentType,
    createdAt: msg.createdAt.toISOString(),
    isMe: true,
  };
}

export async function markConversationRead(conversationId: string, userId: string) {
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!membership) return;

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });
}

function normalizePhone(phone: string): string {
  // minimal normalization: trim spaces; backend stores raw-ish phone in User.phone
  return phone.trim();
}

export async function resolveUserIdsByPhones(phones: string[]): Promise<string[]> {
  const cleaned = Array.from(new Set(phones.map(normalizePhone).filter(Boolean)));
  if (cleaned.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { phone: { in: cleaned } },
    select: { id: true },
    take: cleaned.length,
  });

  return users.map((u) => u.id);
}

async function getSupportAdminUserId(): Promise<string> {
  // Choose any ADMIN user as the support sender.
  // This keeps schema changes minimal (no separate Support table).
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });
  if (!admin) throw new AuthError(500, 'No admin user available for support');
  return admin.id;
}

// Convenience for support chat (creates a dedicated support conversation for the user)
export async function getOrCreateSupportConversation(userId: string): Promise<string> {
  // Look for existing support conv for this user
  const existing = await prisma.conversation.findFirst({
    where: {
      title: 'Watsim Support',
      participants: { some: { userId } },
    },
    include: { participants: true },
  });
  if (existing) return existing.id;

  const supportAdminUserId = await getSupportAdminUserId();

  // Create one with both the customer user and the support/admin participant.
  const conv = await prisma.conversation.create({
    data: {
      title: 'Watsim Support',
      participants: {
        create: [{ userId }, { userId: supportAdminUserId }],
      },
    },
  });
  return conv.id;
}

