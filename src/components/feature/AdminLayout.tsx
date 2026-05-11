import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface AdminLayoutProps {
  children: React.ReactNode;
  breadcrumb: string[];
}

export default function AdminLayout({ children, breadcrumb }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    logout();
    navigate('/admin/login');
  }, [logout, navigate]);

  return (
    <div className="min-h-screen" style={{ background: '#050B16' }}>
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        onLogout={handleLogout}
      />
      <AdminHeader sidebarCollapsed={sidebarCollapsed} breadcrumb={breadcrumb} onLogout={handleLogout} />
      <main
        className="transition-all duration-300 pt-16"
        style={{ marginLeft: sidebarCollapsed ? '72px' : '260px' }}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
