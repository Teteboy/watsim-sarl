import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { merchantApi } from '@/lib/api';
import logoGreen from '@/assets/images/logo_green.png';

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

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

export default function AdminSidebar({ collapsed, onToggle, onLogout }: AdminSidebarProps) {
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
        { icon: 'ri-message-3-line', label: 'Messagerie', path: '/admin/messaging' },
      ],
    },
    {
      groupLabel: 'Finance',
      items: [
        { icon: 'ri-exchange-line', label: 'Transactions', path: '/admin/transactions' },
        { icon: 'ri-bank-card-line', label: 'Crédits BNPL', path: '/admin/bnpl' },
        { icon: 'ri-wallet-3-line', label: 'Wallets Commerciaux', path: '/admin/wallets' },
        { icon: 'ri-money-dollar-circle-line', label: 'Retraits Cash', path: '/admin/withdrawals' },
        { icon: 'ri-book-3-line', label: 'Comptabilité OHADA', path: '/admin/accounting' },
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

  return (
    <aside
      className={`fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
      style={{ background: '#FFFFFF', borderRight: '1px solid #E8F2F1' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: '#F0F7F0' }}>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
        >
          <img
            src={logoGreen}
            alt="WATSIM"
            className="w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        {!collapsed && (
          <div>
            <span className="font-bold text-lg tracking-wide" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
              WATSIM
            </span>
            <div
              className="text-xs px-2 py-0.5 rounded-full mt-0.5 inline-block"
              style={{ background: 'rgba(77,176,89,0.15)', color: '#4DB049' }}
            >
              Admin
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="ml-auto transition-colors cursor-pointer"
          style={{ color: '#9CA3AF' }}
        >
          <i className={`${collapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'} text-lg`} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navGroups.map((group) => (
          <div key={group.groupLabel} className="mb-4">
            {!collapsed && (
              <p className="text-xs uppercase tracking-widest px-3 mb-2" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>
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
                      : 'hover:bg-gray-50 border-l-4 border-transparent pl-2'
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? { background: 'rgba(77,176,89,0.08)', borderColor: '#4DB049' }
                    : {}
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <i
                        className={`${item.icon} text-lg`}
                        style={{ color: isActive ? '#4DB049' : '#9CA3AF' }}
                      />
                    </div>
                    {!collapsed && (
                      <span
                        className="text-sm whitespace-nowrap"
                        style={{
                          fontFamily: 'Poppins, sans-serif',
                          color: isActive ? '#014945' : '#6B7280',
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
      <div className="border-t p-3" style={{ borderColor: '#F0F7F0' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background: '#4DB049', color: '#FFFFFF' }}
          >
            SA
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#014945', fontFamily: 'Poppins, sans-serif' }}>
                Super Admin
              </p>
              <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>admin@watsim.cm</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onLogout}
              className="transition-colors cursor-pointer w-5 h-5 flex items-center justify-center"
              style={{ color: '#9CA3AF' }}
              title="Se déconnecter"
            >
              <i className="ri-logout-box-r-line text-base" />
            </button>
          )}
        </div>
        {!collapsed && (
          <p className="text-xs mt-2 text-center" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>
            v1.0.0 — WATSIM Platform
          </p>
        )}
      </div>
    </aside>
  );
}
