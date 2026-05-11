import { useState } from 'react';
import AdminSidebar from '@/components/feature/AdminSidebar';
import AdminHeader from '@/components/feature/AdminHeader';
import KpiCard from './components/KpiCard';
import TransactionChart from './components/TransactionChart';
import CategoryChart from './components/CategoryChart';
import UsersTable from './components/UsersTable';
import TopProductsCard from './components/TopProductsCard';
import AlertsPanel from './components/AlertsPanel';
import { kpiData } from '@/mocks/dashboard';

export default function AdminDashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: '#050B16' }}>
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />
      <AdminHeader
        sidebarCollapsed={sidebarCollapsed}
        breadcrumb={['WATSIM', 'Dashboard']}
      />

      {/* Main Content */}
      <main
        className="transition-all duration-300 pt-16"
        style={{ marginLeft: sidebarCollapsed ? '72px' : '260px' }}
      >
        <div className="p-6 space-y-6">
          {/* Page Title */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Tableau de Bord
              </h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                Bienvenue, Super Admin — Lundi 27 Avril 2026
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.7)',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                <i className="ri-calendar-line text-sm" />
                Avril 2026
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
                style={{
                  background: 'linear-gradient(135deg, #D4AF37, #F5D76E)',
                  color: '#0A1628',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                <i className="ri-download-2-line text-sm" />
                Exporter
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {kpiData.map((kpi) => (
              <KpiCard key={kpi.id} {...kpi} />
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <TransactionChart />
            </div>
            <div>
              <CategoryChart />
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Crédits BNPL Actifs', value: '3 241', icon: 'ri-bank-card-line', color: '#D4AF37' },
              { label: 'Taux de Défaut', value: '2.3%', icon: 'ri-error-warning-line', color: '#EF4444' },
              { label: 'Nouveaux Utilisateurs (30j)', value: '+1 847', icon: 'ri-user-add-line', color: '#22C55E' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl p-5 flex items-center gap-4"
                style={{
                  background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
                  border: '1px solid rgba(212,175,55,0.15)',
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${stat.color}20` }}
                >
                  <i className={`${stat.icon} text-xl`} style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Users Table + Alerts */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <UsersTable />
            </div>
            <div className="space-y-4">
              <TopProductsCard />
              <AlertsPanel />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
