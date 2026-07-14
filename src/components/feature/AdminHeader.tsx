import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/utils';

interface AdminHeaderProps {
  sidebarCollapsed: boolean;
  breadcrumb: string[];
  onLogout: () => void;
  adminProfile?: { fullName?: string; imageUrl?: string };
}

export default function AdminHeader({ sidebarCollapsed, breadcrumb, onLogout, adminProfile }: AdminHeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    adminApi.notifications({ limit: 5, status: 'sent' }).then((res: any) => {
      const items = res?.items ?? [];
      setNotifications(items.slice(0, 5).map((n: any) => ({
        id: n.id,
        text: n.title,
        time: new Date(n.sentAt || n.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        type: n.priority === 'urgent' ? 'danger' : n.priority === 'high' ? 'warning' : 'info',
      })));
    }).catch(() => setNotifications([]));
  }, []);

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 flex items-center px-6 transition-all duration-300 ${
        sidebarCollapsed ? 'left-[72px]' : 'left-[260px]'
      }`}
      style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E8F2F1' }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-1">
        {breadcrumb.map((crumb, idx) => (
          <span key={crumb} className="flex items-center gap-2">
            {idx > 0 && <i className="ri-arrow-right-s-line text-sm" style={{ color: '#9CA3AF' }} />}
            <span
              className={`text-sm ${idx === breadcrumb.length - 1 ? 'font-medium' : ''}`}
              style={{ fontFamily: 'Poppins, sans-serif', color: idx === breadcrumb.length - 1 ? '#014945' : '#9CA3AF' }}
            >
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg mx-4" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
        <i className="ri-search-line text-sm" style={{ color: '#9CA3AF' }} />
        <input
          type="text"
          placeholder="Rechercher..."
          className="bg-transparent text-sm outline-none w-48"
          style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <i className="ri-notification-3-line text-lg" style={{ color: '#6B7280' }} />
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: '#4DB049' }}
            />
          </button>
          {showNotifications && (
            <div
              className="absolute right-0 top-12 w-80 rounded-xl overflow-hidden z-50 shadow-lg"
              style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: '#F0F7F0' }}>
                <p className="font-medium text-sm" style={{ color: '#014945', fontFamily: 'Poppins, sans-serif' }}>
                  Notifications
                </p>
              </div>
              {notifications.map((n) => (
                <div key={n.id} className="px-4 py-3 hover:bg-gray-50 transition-colors border-b" style={{ borderColor: '#F0F7F0' }}>
                  <div className="flex items-start gap-3">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: n.type === 'danger' ? '#EF4444' : n.type === 'warning' ? '#FFA726' : '#4A9EFF' }}
                    />
                    <div>
                      <p className="text-xs" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{n.text}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Il y a {n.time}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="px-4 py-2 text-center">
                <button className="text-xs cursor-pointer" style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>
                  Voir toutes les notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
          <i className="ri-settings-4-line text-lg" style={{ color: '#6B7280' }} />
        </button>

        {/* Avatar + logout */}
        <div className="relative group">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold cursor-pointer overflow-hidden"
            style={{ background: '#4DB049', color: '#FFFFFF', fontFamily: 'Montserrat, sans-serif' }}
          >
            {adminProfile?.imageUrl ? (
              <img src={resolveUploadUrl(adminProfile.imageUrl) ?? ''} alt="Profile" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              (adminProfile?.fullName || 'SA').split(' ').map((n: string) => n[0] || '').join('').slice(0, 2) || 'SA'
            )}
          </div>
          <div
            className="absolute right-0 top-11 w-40 rounded-xl overflow-hidden z-50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity shadow-lg"
            style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}
          >
            <div className="px-4 py-2.5 border-b" style={{ borderColor: '#F0F7F0' }}>
              <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Super Admin</p>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <i className="ri-logout-box-r-line text-sm" style={{ color: '#E53935' }} />
              <span className="text-sm" style={{ color: '#E53935', fontFamily: 'Poppins, sans-serif' }}>Déconnexion</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
