import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { useAdminAuth, getAdminTokenExpiry } from '@/hooks/useAdminAuth';
import { tokenStore } from '@/lib/api';

interface AdminLayoutProps {
  children: React.ReactNode;
  breadcrumb: string[];
}

export default function AdminLayout({ children, breadcrumb }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [adminProfile, setAdminProfile] = useState<{ fullName?: string; imageUrl?: string }>({});
  const { logout } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const user = tokenStore.getUser();
    if (user) {
      setAdminProfile({
        fullName: user.fullName || user.email,
        imageUrl: user.imageUrl,
      });
    }
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/admin/login');
  }, [logout, navigate]);

  useEffect(() => {
    const exp = getAdminTokenExpiry();
    if (!exp) return;
    const msUntilExpiry = exp - Date.now();
    if (msUntilExpiry <= 0) {
      handleLogout();
      return;
    }
    const timer = setTimeout(() => {
      handleLogout();
    }, msUntilExpiry);
    return () => clearTimeout(timer);
  }, [handleLogout]);

  return (
    <div className="min-h-screen" style={{ background: '#FAFEF9' }}>
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        onLogout={handleLogout}
      />
      <AdminHeader sidebarCollapsed={sidebarCollapsed} breadcrumb={breadcrumb} onLogout={handleLogout} adminProfile={adminProfile} />
      <main
        className="transition-all duration-300 pt-16"
        style={{ marginLeft: sidebarCollapsed ? '72px' : '260px' }}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
