import { Navigate, useLocation } from 'react-router-dom';
import { getAdminAuthState } from '@/hooks/useAdminAuth';
import { tokenStore } from '@/lib/api';

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const location = useLocation();
  const { isAuthenticated } = getAdminAuthState();
  const adminRole = tokenStore.getUser()?.adminRole as 'SUPER_ADMIN' | 'OPERATIONS' | 'FINANCE' | 'SUPPORT' | 'SECURITY' | undefined;
  const allowedPaths: Record<NonNullable<typeof adminRole>, string[]> = {
    SUPER_ADMIN: ['/admin'],
    OPERATIONS: ['/admin', '/admin/users', '/admin/merchants', '/admin/products', '/admin/publicities', '/admin/bnpl', '/admin/reports'],
    FINANCE: ['/admin', '/admin/transactions', '/admin/bnpl', '/admin/wallets', '/admin/deposits', '/admin/withdrawals', '/admin/accounting', '/admin/reports'],
    SUPPORT: ['/admin', '/admin/users', '/admin/messaging', '/admin/notifications'],
    SECURITY: ['/admin', '/admin/users', '/admin/disputes'],
  };

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }
  if (!adminRole || (adminRole !== 'SUPER_ADMIN' && !allowedPaths[adminRole].some(path => location.pathname === path || location.pathname.startsWith(`${path}/`)))) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
