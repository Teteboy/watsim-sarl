import { useState, useEffect } from 'react';
import { merchantApi } from '@/lib/api';


interface MerchantHeaderProps {
  sidebarCollapsed: boolean;
  breadcrumb: string[];
  onLogout?: () => void;
  merchantProfile?: any;
}

export default function MerchantHeader({ sidebarCollapsed, breadcrumb, onLogout, merchantProfile: profileProp }: MerchantHeaderProps) {
  const merchantProfile = profileProp || { owner: '', name: '' };
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        merchantApi.getMerchantNotifications().catch(() => []),
        merchantApi.getMerchantUnreadNotificationCount().catch(() => 0),
      ]);
      const list = listRes?.data || listRes || [];
      setNotifications(list.slice(0, 5));
      setUnreadCount(typeof countRes === 'number' ? countRes : (countRes?.data ?? 0));
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 45000); // poll every 45 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className="fixed top-0 right-0 z-30 h-16 flex items-center px-6 transition-all duration-300"
      style={{
        left: sidebarCollapsed ? '72px' : '260px',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E8F2F1',
      }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-1">
        {breadcrumb.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <i className="ri-arrow-right-s-line text-[#9CA3AF] text-sm" />}
            <span
              className={`text-sm ${i === breadcrumb.length - 1 ? 'text-[#014945] font-medium' : 'text-[#9CA3AF]'}`}
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Store status badge */}
        <div
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: 'rgba(77,176,89,0.12)', border: '1px solid rgba(77,176,89,0.25)', color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Boutique active
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer transition-colors relative"
            style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}
          >
            <i className="ri-notification-3-line text-[#6B7280] text-base" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-xs flex items-center justify-center font-bold"
                style={{ background: '#E53935', color: '#fff', fontSize: '10px' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-12 w-80 rounded-2xl overflow-hidden z-50"
              style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #E8F2F1' }}>
                <span className="text-sm font-semibold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Notifications</span>
                <a href="/merchant/notifications" className="text-xs cursor-pointer" style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>
                  Voir tout
                </a>
              </div>
              <div className="divide-y divide-[#F0F7F0] max-h-80 overflow-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[#9CA3AF] text-xs">Aucune nouvelle notification</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => window.location.href = '/merchant/notifications'}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(77,176,89,0.15)' }}>
                        <i className="ri-notification-3-line text-sm" style={{ color: '#4DB049' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#1A2B1F] text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{n.title}</p>
                        <p className="text-[#9CA3AF] text-xs mt-0.5" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          {new Date(n.createdAt).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile + Logout */}
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden"
            style={{ background: '#4DB049', color: '#FFFFFF' }}
          >
            {merchantProfile.imageUrl ? (
              <img 
                src={merchantProfile.imageUrl} 
                alt="Profile" 
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              (merchantProfile.owner || '').split(' ').map((n: string) => n[0] || '').join('').slice(0, 2) || 'M'
            )}
          </div>
          <div className="hidden md:block">
            <p className="text-[#014945] text-xs font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{merchantProfile.owner}</p>
            <p className="text-[#9CA3AF] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>{merchantProfile.name}</p>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="ml-1 w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
              style={{ background: 'rgba(229,57,53,0.08)', border: '1px solid rgba(229,57,53,0.15)', color: 'rgba(229,57,53,0.7)' }}
              title="Se déconnecter"
              onMouseEnter={(e) => { e.currentTarget.style.color = '#E53935'; e.currentTarget.style.background = 'rgba(229,57,53,0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(229,57,53,0.7)'; e.currentTarget.style.background = 'rgba(229,57,53,0.08)'; }}
            >
              <i className="ri-logout-box-r-line text-sm" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

