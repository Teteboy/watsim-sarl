import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../config/db';
import { env } from '../../config/env';
import type { UserRole, User } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { generateReferralCode } from '../../services/referral.service';

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(plainPin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPin, hash);
}

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export async function registerCustomer(input: {
  email: string;
  phone: string;
  password: string;
  fullName: string;
  initialPin?: string;
}): Promise<User> {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { phone: input.phone }] },
  });
  if (existing) throw new AuthError(409, 'Email or phone already registered');

  const passwordHash = await bcrypt.hash(input.password, 12);
  let pinHash: string | undefined;
  let pinSetAt: Date | undefined;
  if (input.initialPin) {
    pinHash = await hashPin(input.initialPin);
    pinSetAt = new Date();
  }

  return prisma.user.create({
    data: {
      email: input.email,
      phone: input.phone,
      passwordHash,
      ...(pinHash ? { pinHash, pinSetAt } : {}),
      fullName: input.fullName,
      role: 'CUSTOMER',
      creditLimit: 50000, // Starter limit for BNPL before KYC delivery verification
      referralCode: generateReferralCode(),
      wallet: { create: { balance: 0 } },
    } as any,
  });
}

export async function verifyCredentials(email: string, password: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw new AuthError(401, 'Invalid credentials');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AuthError(401, 'Invalid credentials');
  return user;
}

export async function issueTokens(app: FastifyInstance, user: { id: string; role: UserRole; email: string }): Promise<AuthTokens> {
  const expiresIn = user.role === 'ADMIN' ? '24h' : env.JWT_ACCESS_EXPIRY;
  const accessToken = app.jwt.sign({ sub: user.id, role: user.role, email: user.email }, { expiresIn });
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await prisma.refreshToken.create({
    data: { userId: user.id, token: refreshToken, expiresAt },
  });

  return { accessToken, refreshToken, expiresIn };
}

export async function rotateRefreshToken(app: FastifyInstance, oldToken: string): Promise<AuthTokens> {
  const record = await prisma.refreshToken.findUnique({ where: { token: oldToken }, include: { user: true } });
  if (!record || record.expiresAt < new Date()) {
    if (record) await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => null);
    throw new AuthError(401, 'Invalid or expired refresh token');
  }
  await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => null);
  return issueTokens(app, { id: record.user.id, role: record.user.role, email: record.user.email });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export async function recordAudit(userId: string | null, action: string, metadata?: Record<string, unknown>, ip?: string): Promise<void> {
  await prisma.auditLog.create({
    data: { userId: userId ?? undefined, action, metadata: metadata as never, ipAddress: ip },
  });
}

export async function setPinForUser(userId: string, pin: string): Promise<void> {
  const hash = await hashPin(pin);
  await prisma.user.update({
    where: { id: userId },
    data: { pinHash: hash, pinSetAt: new Date() } as any,
  });
}

export async function verifyPinCredentials(phone: string, pin: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.isActive || !(user as any).pinHash) {
    throw new AuthError(401, 'Invalid credentials or PIN not set');
  }
  const ok = await verifyPin(pin, (user as any).pinHash);
  if (!ok) throw new AuthError(401, 'Invalid credentials');
  return user;
}
