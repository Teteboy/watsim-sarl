import { useState } from 'react';
import { merchantProfile } from '@/mocks/merchantData';

interface MerchantHeaderProps {
  sidebarCollapsed: boolean;
  breadcrumb: string[];
  onLogout?: () => void;
}

export default function MerchantHeader({ sidebarCollapsed, breadcrumb, onLogout }: MerchantHeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);

  const notifications = [
    { id: 1, icon: 'ri-shopping-bag-3-line', color: '#D4AF37', text: 'Nouvelle commande ORD-7841 reçue', time: 'Il y a 5 min' },
    { id: 2, icon: 'ri-bank-card-line', color: '#22C55E', text: 'Paiement BNPL reçu — 206 666 FCFA', time: 'Il y a 1h' },
    { id: 3, icon: 'ri-error-warning-line', color: '#F97316', text: 'Stock faible : iPad Air (0 unités)', time: 'Il y a 2h' },
    { id: 4, icon: 'ri-star-line', color: '#A855F7', text: 'Nouvel avis 5 étoiles sur iPhone 15 Pro', time: 'Il y a 3h' },
  ];

  return (
    <header
      className="fixed top-0 right-0 z-30 h-16 flex items-center px-6 transition-all duration-300"
      style={{
        left: sidebarCollapsed ? '72px' : '260px',
        background: 'rgba(5,11,22,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-1">
        {breadcrumb.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <i className="ri-arrow-right-s-line text-white/30 text-sm" />}
            <span
              className={`text-sm ${i === breadcrumb.length - 1 ? 'text-white font-medium' : 'text-white/40'}`}
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
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E', fontFamily: 'Poppins, sans-serif' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Boutique active
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer transition-colors relative"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <i className="ri-notification-3-line text-white/60 text-base" />
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
              style={{ background: '#EF4444', color: '#fff', fontSize: '10px' }}
            >
              4
            </span>
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-12 w-80 rounded-2xl overflow-hidden z-50"
              style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.2)' }}
            >
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-white text-sm font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>Notifications</span>
                <button className="text-xs cursor-pointer" style={{ color: '#D4AF37', fontFamily: 'Poppins, sans-serif' }}>Tout lire</button>
              </div>
              <div className="divide-y divide-white/5">
                {notifications.map(n => (
                  <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${n.color}20` }}>
                      <i className={`${n.icon} text-sm`} style={{ color: n.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{n.text}</p>
                      <p className="text-white/30 text-xs mt-0.5" style={{ fontFamily: 'Poppins, sans-serif' }}>{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile + Logout */}
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628' }}
          >
            {merchantProfile.owner.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="hidden md:block">
            <p className="text-white text-xs font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{merchantProfile.owner}</p>
            <p className="text-white/40 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>{merchantProfile.name}</p>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="ml-1 w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.7)' }}
              title="Se déconnecter"
              onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(239,68,68,0.7)'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
            >
              <i className="ri-logout-box-r-line text-sm" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
