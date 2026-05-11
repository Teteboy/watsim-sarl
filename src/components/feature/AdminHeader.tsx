import { useState } from 'react';

interface AdminHeaderProps {
  sidebarCollapsed: boolean;
  breadcrumb: string[];
  onLogout: () => void;
}

export default function AdminHeader({ sidebarCollapsed, breadcrumb, onLogout }: AdminHeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, text: 'Fraude détectée — USR-089', time: '5 min', type: 'danger' },
    { id: 2, text: '3 remboursements en retard', time: '23 min', type: 'warning' },
    { id: 3, text: 'Nouveau commercial à valider', time: '1h', type: 'info' },
  ];

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 flex items-center px-6 transition-all duration-300 ${
        sidebarCollapsed ? 'left-[72px]' : 'left-[260px]'
      }`}
      style={{ background: 'rgba(10,22,40,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-1">
        {breadcrumb.map((crumb, idx) => (
          <span key={crumb} className="flex items-center gap-2">
            {idx > 0 && <i className="ri-arrow-right-s-line text-white/30 text-sm" />}
            <span
              className={`text-sm ${idx === breadcrumb.length - 1 ? 'text-white font-medium' : 'text-white/40'}`}
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg mx-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.2)' }}>
        <i className="ri-search-line text-white/40 text-sm" />
        <input
          type="text"
          placeholder="Rechercher..."
          className="bg-transparent text-white text-sm outline-none w-48 placeholder-white/30"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <i className="ri-notification-3-line text-white/60 text-lg" />
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: '#EF4444' }}
            />
          </button>
          {showNotifications && (
            <div
              className="absolute right-0 top-12 w-80 rounded-xl overflow-hidden z-50"
              style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.2)' }}
            >
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-white font-medium text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Notifications
                </p>
              </div>
              {notifications.map((n) => (
                <div key={n.id} className="px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: n.type === 'danger' ? '#EF4444' : n.type === 'warning' ? '#F97316' : '#4A9EFF' }}
                    />
                    <div>
                      <p className="text-white/80 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>{n.text}</p>
                      <p className="text-white/30 text-xs mt-0.5">Il y a {n.time}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="px-4 py-2 text-center">
                <button className="text-xs cursor-pointer" style={{ color: '#D4AF37', fontFamily: 'Poppins, sans-serif' }}>
                  Voir toutes les notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
          <i className="ri-settings-4-line text-white/60 text-lg" />
        </button>

        {/* Avatar + logout */}
        <div className="relative group">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Montserrat, sans-serif' }}
          >
            SA
          </div>
          <div
            className="absolute right-0 top-11 w-40 rounded-xl overflow-hidden z-50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity"
            style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.2)' }}
          >
            <div className="px-4 py-2.5 border-b border-white/10">
              <p className="text-white/60 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>Super Admin</p>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <i className="ri-logout-box-r-line text-sm" style={{ color: '#EF4444' }} />
              <span className="text-sm" style={{ color: '#EF4444', fontFamily: 'Poppins, sans-serif' }}>Déconnexion</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
