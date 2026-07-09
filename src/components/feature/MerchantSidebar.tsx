import { NavLink } from 'react-router-dom';

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    groupLabel: 'Principal',
    items: [
      { icon: 'ri-dashboard-3-line', label: 'Vue d\'ensemble', path: '/merchant' },
      { icon: 'ri-notification-3-line', label: 'Notifications', path: '/merchant/notifications' },
    ],
  },
  {
    groupLabel: 'Boutique',
    items: [
      { icon: 'ri-shopping-bag-3-line', label: 'Produits', path: '/merchant/products' },
      { icon: 'ri-file-list-3-line', label: 'Commandes', path: '/merchant/orders' },
      { icon: 'ri-group-line', label: 'Clients', path: '/merchant/users' },
    ],
  },
  {
    groupLabel: 'Finance',
    items: [
      { icon: 'ri-wallet-3-line', label: 'Wallet', path: '/merchant/wallet' },
      { icon: 'ri-bank-card-line', label: 'Paiements BNPL', path: '/merchant/bnpl' },
      { icon: 'ri-bar-chart-2-line', label: 'Analytiques', path: '/merchant/analytics' },
    ],
  },
  {
    groupLabel: 'Compte',
    items: [
      { icon: 'ri-settings-4-line', label: 'Paramètres', path: '/merchant/settings' },
    ],
  },
];

interface MerchantSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout?: () => void;
  merchantProfile?: { owner?: string; name?: string; walletBalance?: number; pendingPayout?: number };
}

export default function MerchantSidebar({ collapsed, onToggle, onLogout, merchantProfile: profileProp }: MerchantSidebarProps) {
  const merchantProfile = profileProp || { owner: '', name: '', walletBalance: 0, pendingPayout: 0 };

  const initials = (merchantProfile.owner || '')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'M';

  return (
    <aside
      className={`fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
      style={{ background: 'linear-gradient(180deg, #012E2B 0%, #011F1C 100%)', borderRight: '1px solid rgba(77,176,89,0.12)' }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-5"
        style={{ borderBottom: '1px solid rgba(77,176,89,0.12)' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)' }}
        >
          <i className="ri-store-2-line text-white text-xl" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <span
              className="text-white font-bold text-base tracking-wide block leading-tight"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              WATSIM
            </span>
            <div
              className="text-[10px] px-2 py-0.5 rounded-full mt-0.5 inline-block font-medium"
              style={{ background: 'rgba(77,176,89,0.2)', color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}
            >
              Merchant
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="transition-colors cursor-pointer flex-shrink-0"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
        >
          <i className={`${collapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'} text-lg`} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navGroups.map((group) => (
          <div key={group.groupLabel} className="mb-3">
            {!collapsed && (
              <p
                className="text-[10px] uppercase tracking-widest px-3 mb-1.5"
                style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'Poppins, sans-serif' }}
              >
                {group.groupLabel}
              </p>
            )}
            {collapsed && <div className="my-2 mx-3" style={{ borderTop: '1px solid rgba(77,176,89,0.1)' }} />}
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/merchant'}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer mb-0.5"
                style={({ isActive }) =>
                  isActive
                    ? {
                        background: 'rgba(77,176,89,0.15)',
                        borderLeft: '3px solid #4DB049',
                        paddingLeft: '9px',
                      }
                    : {
                        borderLeft: '3px solid transparent',
                        paddingLeft: '9px',
                      }
                }
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  if (!el.dataset.active) el.style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  if (!el.dataset.active) el.style.background = '';
                }}
              >
                {({ isActive }) => (
                  <>
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <i
                        className={`${item.icon} text-[18px]`}
                        style={{ color: isActive ? '#4DB049' : 'rgba(255,255,255,0.45)' }}
                      />
                    </div>
                    {!collapsed && (
                      <span
                        className="text-sm whitespace-nowrap flex-1"
                        style={{
                          fontFamily: 'Poppins, sans-serif',
                          color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
                          fontWeight: isActive ? 500 : 400,
                        }}
                      >
                        {item.label}
                      </span>
                    )}
                    {isActive && !collapsed && (
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: '#4DB049' }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Wallet Balance Card */}
      {!collapsed && (
        <div
          className="mx-3 mb-3 p-3 rounded-xl"
          style={{ background: 'rgba(77,176,89,0.08)', border: '1px solid rgba(77,176,89,0.18)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <i className="ri-wallet-3-line text-sm" style={{ color: '#4DB049' }} />
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
              Solde disponible
            </p>
          </div>
          <p className="text-white font-bold text-base" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            {((merchantProfile.walletBalance ?? 0)).toLocaleString('fr-FR')} FCFA
          </p>
          {(merchantProfile.pendingPayout ?? 0) > 0 && (
            <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: '#F97316', fontFamily: 'Poppins, sans-serif' }}>
              <i className="ri-time-line text-xs" />
              {(merchantProfile.pendingPayout ?? 0).toLocaleString('fr-FR')} FCFA en attente
            </p>
          )}
        </div>
      )}

      {/* User Footer */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(77,176,89,0.12)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF' }}
          >
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
                >
                  {merchantProfile.owner || 'Marchand'}
                </p>
                <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                  {merchantProfile.name || ''}
                </p>
              </div>
              <button
                onClick={onLogout}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer flex-shrink-0"
                style={{ color: 'rgba(255,255,255,0.35)' }}
                title="Se déconnecter"
                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
              >
                <i className="ri-logout-box-r-line text-base" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
