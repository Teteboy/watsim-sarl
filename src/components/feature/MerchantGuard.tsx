import { Navigate, useLocation } from 'react-router-dom';
import { getMerchantAuthState } from '@/hooks/useMerchantAuth';

interface MerchantGuardProps {
  children: React.ReactNode;
}

export default function MerchantGuard({ children }: MerchantGuardProps) {
  const location = useLocation();
  const { isAuthenticated } = getMerchantAuthState();

  if (!isAuthenticated) {
    return <Navigate to="/merchant/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
