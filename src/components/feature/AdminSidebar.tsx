import { useState } from 'react';
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
    groupLabel: 'Dashboard',
    items: [
      { icon: 'ri-dashboard-3-line', label: 'Vue d\'ensemble', path: '/admin' },
    ],
  },
  {
    groupLabel: 'Gestion',
    items: [
      { icon: 'ri-user-3-line', label: 'Utilisateurs', path: '/admin/users' },
      { icon: 'ri-store-2-line', label: 'Commerciaux', path: '/admin/merchants' },
      { icon: 'ri-shopping-bag-3-line', label: 'Produits', path: '/admin/products' },
      { icon: 'ri-advertisement-line', label: 'Publicités', path: '/admin/publicities' },
    ],
  },
  {
    groupLabel: 'Finance',
    items: [
      { icon: 'ri-exchange-line', label: 'Transactions', path: '/admin/transactions' },
      { icon: 'ri-bank-card-line', label: 'Crédits BNPL', path: '/admin/bnpl' },
      { icon: 'ri-file-chart-2-line', label: 'Rapports', path: '/admin/reports' },
    ],
  },
  {
    groupLabel: 'Système',
    items: [
      { icon: 'ri-notification-3-line', label: 'Notifications', path: '/admin/notifications' },
      { icon: 'ri-error-warning-line', label: 'Litiges & Fraude', path: '/admin/disputes' },
      { icon: 'ri-settings-4-line', label: 'Paramètres', path: '/admin/settings' },
    ],
  },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

export default function AdminSidebar({ collapsed, onToggle, onLogout }: AdminSidebarProps) {
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
          <i className="ri-exchange-funds-line text-[#0A1628] text-xl font-bold" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-white font-bold text-lg tracking-wide" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              WATSIM
            </span>
            <div
              className="text-xs px-2 py-0.5 rounded-full mt-0.5 inline-block"
              style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}
            >
              Admin
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
              <p className="text-xs uppercase tracking-widest text-white/30 px-3 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {group.groupLabel}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer group ${
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
                        className="text-sm whitespace-nowrap"
                        style={{
                          fontFamily: 'Poppins, sans-serif',
                          color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
                          fontWeight: isActive ? 500 : 400,
                        }}
                      >
                        {item.label}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User Footer */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628' }}
          >
            SA
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Super Admin
              </p>
              <p className="text-white/40 text-xs truncate">admin@watsim.cm</p>
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
        {!collapsed && (
          <p className="text-white/20 text-xs mt-2 text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
            v1.0.0 — WATSIM Platform
          </p>
        )}
      </div>
    </aside>
  );
}
