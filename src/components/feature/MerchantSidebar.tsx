import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { merchantProfile } from '@/mocks/merchantData';

interface NavItem {
  icon: string;
  label: string;
  path: string;
  badge?: number;
}

interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    groupLabel: 'Tableau de bord',
    items: [
      { icon: 'ri-dashboard-3-line', label: 'Vue d\'ensemble', path: '/merchant' },
    ],
  },
  {
    groupLabel: 'Boutique',
    items: [
      { icon: 'ri-shopping-bag-3-line', label: 'Produits', path: '/merchant/products' },
      { icon: 'ri-file-list-3-line', label: 'Commandes', path: '/merchant/orders', badge: 18 },
    ],
  },
  {
    groupLabel: 'Finance',
    items: [
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
}

export default function MerchantSidebar({ collapsed, onToggle, onLogout }: MerchantSidebarProps) {
  return (
    <aside
      className={`fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
      style={{ background: 'linear-gradient(180deg, #0A1628 0%, #050B16 100%)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)' }}
        >
          <i className="ri-store-2-line text-[#0A1628] text-xl" />
        </div>
        {!collapsed && (
          <div>
            <span
              className="text-white font-bold text-base tracking-wide block leading-tight"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              WATSIM
            </span>
            <div
              className="text-xs px-2 py-0.5 rounded-full mt-0.5 inline-block"
              style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}
            >
              Merchant
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="ml-auto text-white/40 hover:text-white/80 transition-colors cursor-pointer"
        >
          <i className={`${collapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'} text-lg`} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navGroups.map((group) => (
          <div key={group.groupLabel} className="mb-4">
            {!collapsed && (
              <p
                className="text-xs uppercase tracking-widest text-white/30 px-3 mb-2"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                {group.groupLabel}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/merchant'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'border-l-4 pl-2'
                      : 'hover:bg-white/5 border-l-4 border-transparent pl-2'
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? { background: 'rgba(212,175,55,0.12)', borderColor: '#D4AF37' }
                    : {}
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <i
                        className={`${item.icon} text-lg`}
                        style={{ color: isActive ? '#D4AF37' : 'rgba(255,255,255,0.5)' }}
                      />
                    </div>
                    {!collapsed && (
                      <span
                        className="text-sm whitespace-nowrap flex-1"
                        style={{
                          fontFamily: 'Poppins, sans-serif',
                          color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
                          fontWeight: isActive ? 500 : 400,
                        }}
                      >
                        {item.label}
                      </span>
                    )}
                    {!collapsed && item.badge && item.badge > 0 && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: 'rgba(249,115,22,0.2)', color: '#F97316' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Wallet Balance */}
      {!collapsed && (
        <div className="mx-3 mb-3 p-3 rounded-xl" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.15)' }}>
          <p className="text-xs text-white/40 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Solde disponible</p>
          <p className="text-white font-bold text-base" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            {(merchantProfile.walletBalance / 1000).toFixed(0)}K FCFA
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#F97316', fontFamily: 'Poppins, sans-serif' }}>
            +{(merchantProfile.pendingPayout / 1000).toFixed(0)}K en attente
          </p>
        </div>
      )}

      {/* User Footer */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628' }}
          >
            {merchantProfile.owner.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {merchantProfile.owner}
              </p>
              <p className="text-white/40 text-xs truncate">{merchantProfile.name}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onLogout}
              className="text-white/40 hover:text-red-400 transition-colors cursor-pointer w-5 h-5 flex items-center justify-center"
              title="Se déconnecter"
            >
              <i className="ri-logout-box-r-line text-base" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
