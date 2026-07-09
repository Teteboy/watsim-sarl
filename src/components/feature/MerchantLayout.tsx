import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MerchantSidebar from './MerchantSidebar';
import MerchantHeader from './MerchantHeader';
import MerchantGuard from './MerchantGuard';
import { useMerchantAuth, getMerchantAuthState } from '@/hooks/useMerchantAuth';
import { merchantApi, ApiError } from '@/lib/api';

interface MerchantLayoutProps {
  children: React.ReactNode;
  breadcrumb: string[];
}

function MerchantLayoutInner({ children, breadcrumb }: MerchantLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { logout } = useMerchantAuth();
  const navigate = useNavigate();
  const [merchantProfile, setMerchantProfile] = useState<any>(null);

  useEffect(() => {
    const { isAuthenticated } = getMerchantAuthState();
    if (!isAuthenticated) return;
    merchantApi.profile()
      .then((p) => setMerchantProfile(p))
      .catch((err) => {
        if (err instanceof ApiError) {
          logout();
          navigate('/merchant/login', { replace: true });
        }
        setMerchantProfile(null);
      });
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/merchant/login');
  };

  return (
    <div className="min-h-screen" style={{ background: '#FAFEF9' }}>
      <MerchantSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        onLogout={handleLogout}
        merchantProfile={merchantProfile}
      />
      <MerchantHeader sidebarCollapsed={sidebarCollapsed} breadcrumb={breadcrumb} onLogout={handleLogout} merchantProfile={merchantProfile} />
      <main
        className="transition-all duration-300 pt-16"
        style={{ marginLeft: sidebarCollapsed ? '72px' : '260px' }}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

export default function MerchantLayout({ children, breadcrumb }: MerchantLayoutProps) {
  return (
    <MerchantGuard>
      <MerchantLayoutInner breadcrumb={breadcrumb}>{children}</MerchantLayoutInner>
    </MerchantGuard>
  );
}
