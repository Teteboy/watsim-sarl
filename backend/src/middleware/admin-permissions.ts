import { FastifyReply, FastifyRequest } from 'fastify';
import type { AdminRole } from '@prisma/client';

export type AdminPermission =
  | 'DASHBOARD'
  | 'USERS'
  | 'MERCHANTS'
  | 'PRODUCTS'
  | 'BNPL'
  | 'FINANCE'
  | 'ACCOUNTING'
  | 'REPORTS'
  | 'KYC'
  | 'DISPUTES'
  | 'MESSAGING'
  | 'NOTIFICATIONS'
  | 'PUBLICITIES'
  | 'SETTINGS'
  | 'ADMIN_USERS';

const permissions: Record<AdminRole, readonly AdminPermission[]> = {
  SUPER_ADMIN: ['DASHBOARD', 'USERS', 'MERCHANTS', 'PRODUCTS', 'BNPL', 'FINANCE', 'ACCOUNTING', 'REPORTS', 'KYC', 'DISPUTES', 'MESSAGING', 'NOTIFICATIONS', 'PUBLICITIES', 'SETTINGS', 'ADMIN_USERS'],
  OPERATIONS: ['DASHBOARD', 'USERS', 'MERCHANTS', 'PRODUCTS', 'BNPL', 'REPORTS', 'PUBLICITIES'],
  FINANCE: ['DASHBOARD', 'BNPL', 'FINANCE', 'ACCOUNTING', 'REPORTS'],
  SUPPORT: ['DASHBOARD', 'USERS', 'MESSAGING', 'NOTIFICATIONS'],
  SECURITY: ['DASHBOARD', 'USERS', 'KYC', 'DISPUTES'],
};

export function hasAdminPermission(role: AdminRole | null | undefined, permission: AdminPermission): boolean {
  return !!role && permissions[role].includes(permission);
}

export function requireAdminPermission(...required: AdminPermission[]) {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (req.authUser?.role !== 'ADMIN' || !required.some(permission => hasAdminPermission(req.authUser?.adminRole, permission))) {
      reply.code(403).send({ error: 'Forbidden', message: 'Your administrative role does not have access to this resource.' });
      throw new Error('Forbidden');
    }
  };
}

export function adminPermissionForRequest(method: string, pathname: string): AdminPermission {
  if (pathname.startsWith('/users/') && pathname.endsWith('/kyc')) return 'KYC';
  if (pathname.startsWith('/settings')) return 'SETTINGS';
  if (pathname.startsWith('/users') && method !== 'GET') return 'ADMIN_USERS';
  if (pathname.startsWith('/disputes') || pathname.startsWith('/fraud')) return 'DISPUTES';
  if (pathname.startsWith('/messaging')) return 'MESSAGING';
  if (pathname.startsWith('/notifications')) return 'NOTIFICATIONS';
  if (pathname.startsWith('/merchants')) return 'MERCHANTS';
  if (pathname.startsWith('/products') || pathname.startsWith('/categories')) return 'PRODUCTS';
  if (pathname.startsWith('/bnpl')) return 'BNPL';
  if (pathname.startsWith('/transactions') || pathname.startsWith('/wallets') || pathname.startsWith('/deposits') || pathname.startsWith('/withdrawals') || pathname.startsWith('/payouts') || pathname.startsWith('/installments')) return 'FINANCE';
  if (pathname === '/reports/summary') return 'DASHBOARD';
  if (pathname.startsWith('/reports') || pathname.startsWith('/referrals')) return 'REPORTS';
  if (pathname.startsWith('/users')) return 'USERS';
  return 'DASHBOARD';
}

export async function authorizeAdminRequest(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const adminIndex = pathname.indexOf('/admin');
  const resourcePath = adminIndex >= 0 ? pathname.slice(adminIndex + '/admin'.length) : pathname;
  const permission = adminPermissionForRequest(req.method, resourcePath);
  await requireAdminPermission(permission)(req, reply);
}
