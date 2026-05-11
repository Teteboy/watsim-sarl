import { Navigate, useLocation } from 'react-router-dom';
import { getAdminAuthState } from '@/hooks/useAdminAuth';

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const location = useLocation();
  const { isAuthenticated } = getAdminAuthState();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
