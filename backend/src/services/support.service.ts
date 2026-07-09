import { prisma } from '../config/db';
import { TicketStatus, TicketPriority, TicketCategory } from '@prisma/client';

export interface CreateTicketInput {
  category: TicketCategory;
  subject: string;
  description: string;
  priority?: TicketPriority;
}

export interface TicketResponse {
  id: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  messages: TicketMessageResponse[];
}

export interface TicketMessageResponse {
  id: string;
  message: string;
  senderId: string | null;
  isInternal: boolean;
  createdAt: Date;
  isFromUser: boolean;
}

export async function createTicket(
  userId: string,
  input: CreateTicketInput
): Promise<TicketResponse> {
  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      category: input.category,
      subject: input.subject,
      description: input.description,
      priority: input.priority || TicketPriority.MEDIUM,
      status: TicketStatus.OPEN,
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  // Create initial message from the description
  await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: userId,
      message: input.description,
      isInternal: false,
    },
  });

  // Log ticket creation
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'SUPPORT_TICKET_CREATED',
      entityType: 'SupportTicket',
      entityId: ticket.id,
      metadata: { category: input.category, subject: input.subject } as never,
    },
  });

  return mapTicketToResponse(ticket, userId);
}

export async function getUserTickets(userId: string): Promise<TicketResponse[]> {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return tickets.map(t => mapTicketToResponse(t, userId));
}

export async function getTicketById(
  ticketId: string,
  userId: string
): Promise<TicketResponse | null> {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!ticket) return null;

  return mapTicketToResponse(ticket, userId);
}

export async function addMessageToTicket(
  ticketId: string,
  userId: string,
  message: string
): Promise<TicketResponse | null> {
  // Verify ticket belongs to user
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
  });

  if (!ticket) return null;

  // Add message
  await prisma.ticketMessage.create({
    data: {
      ticketId,
      senderId: userId,
      message,
      isInternal: false,
    },
  });

  // Update ticket status to OPEN if it was CLOSED or RESOLVED
  if (ticket.status === TicketStatus.CLOSED || ticket.status === TicketStatus.RESOLVED) {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.OPEN, updatedAt: new Date() },
    });
  } else {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });
  }

  // Return updated ticket
  return getTicketById(ticketId, userId);
}

export async function closeTicket(
  ticketId: string,
  userId: string
): Promise<boolean> {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
  });

  if (!ticket) return false;

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: TicketStatus.CLOSED, updatedAt: new Date() },
  });

  return true;
}

function mapTicketToResponse(
  ticket: any,
  currentUserId: string
): TicketResponse {
  return {
    id: ticket.id,
    category: ticket.category,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    messages: ticket.messages.map((m: any) => ({
      id: m.id,
      message: m.message,
      senderId: m.senderId,
      isInternal: m.isInternal,
      createdAt: m.createdAt,
      isFromUser: m.senderId === currentUserId,
    })),
  };
}

// FAQ Data for the help center
export const FAQ_DATA = [
  {
    question: 'How do I complete my KYC verification?',
    answer: 'Go to Profile > Verification and upload a clear photo of your ID card (front and back) and a selfie. Our team will review and approve within 24 hours.',
  },
  {
    question: 'What is BNPL and how does it work?',
    answer: 'Buy Now Pay Later (BNPL) allows you to purchase products and pay in installments. Choose your product, select BNPL at checkout, pick your installment plan, and pay the first installment to receive your item.',
  },
  {
    question: 'How do I make a payment?',
    answer: 'Go to Wallet > Deposit to add funds via Mobile Money (Orange Money or MTN Mobile Money). For BNPL installments, go to My Purchases and tap Pay on the due installment.',
  },
  {
    question: 'What happens if I miss a payment?',
    answer: 'Late payments incur a penalty fee and may affect your credit score. If you\'re having trouble, contact support before the due date to discuss options.',
  },
  {
    question: 'How can I increase my credit limit?',
    answer: 'Complete KYC verification (+20 points), make timely payments, complete more BNPL purchases, and maintain regular account activity to improve your credit score.',
  },
];
