import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/feature/AdminSidebar';
import AdminHeader from '@/components/feature/AdminHeader';
import KpiCard from './components/KpiCard';
import TransactionChart from './components/TransactionChart';
import CategoryChart from './components/CategoryChart';
import UsersTable from './components/UsersTable';
import TopProductsCard from './components/TopProductsCard';
import AlertsPanel from './components/AlertsPanel';
import { adminApi, tokenStore } from '@/lib/api';

const fmtFcfa = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M FCFA` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K FCFA` : `${n} FCFA`;

const defaultKpis = [
  { id: 'revenue', label: 'Revenus', value: '—', trend: '0%', trendUp: true, icon: 'ri-money-cny-circle-line', sparkline: [0, 0, 0, 0, 0] },
  { id: 'active-users', label: 'Utilisateurs Actifs', value: '—', trend: '0%', trendUp: true, icon: 'ri-user-line', sparkline: [0, 0, 0, 0, 0] },
  { id: 'active-purchases', label: 'Achats Actifs', value: '—', trend: '0%', trendUp: true, icon: 'ri-exchange-line', sparkline: [0, 0, 0, 0, 0] },
  { id: 'repayment-rate', label: 'Taux Remboursement', value: '—', trend: '0%', trendUp: true, icon: 'ri-shield-check-line', sparkline: [0, 0, 0, 0, 0] },
];

export default function AdminDashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [liveKpi, setLiveKpi] = useState<any | null>(null);
  const [liveStats, setLiveStats] = useState<{ active: number; rate: number; users: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const access = tokenStore.access;
        if (!access) return; // no token, skip summary
        const s = await adminApi.summary();
        if (!mounted) return;
        const newKpi = [
          { ...defaultKpis[0], value: fmtFcfa(s.revenueThisMonth ?? s.totalRevenueThisMonth ?? 0) },
          { ...defaultKpis[1], value: Number(s.activeUsers ?? 0).toLocaleString('fr-FR') },
          { ...defaultKpis[2], value: Number(s.activePurchases ?? 0).toLocaleString('fr-FR') },
          { ...defaultKpis[3], value: `${Number(s.repaymentRate ?? 0).toFixed(1)}%` },
        ];
        setLiveKpi((prev) => {
          try {
            if (prev && JSON.stringify(prev) === JSON.stringify(newKpi)) return prev;
          } catch (e) {
            return newKpi;
          }
          return newKpi;
        });
        const newStats = { active: s.activePurchases, rate: 100 - s.repaymentRate, users: s.activeUsers };
        setLiveStats((prev) => {
          try {
            if (prev && JSON.stringify(prev) === JSON.stringify(newStats)) return prev;
          } catch (e) {
            return newStats;
          }
          return newStats;
        });
      } catch {
        return null;
      }
    })();
    return () => { mounted = false; };
  }, []);

  const kpis = liveKpi ?? defaultKpis;

  const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };

  return (
    <div className="min-h-screen" style={{ background: '#FAFEF9' }}>
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        onLogout={() => {
          // fallback: clear local admin session and redirect
          tokenStore.setTokens(null as any, null as any);
          tokenStore.setUser(null);
          window.location.href = '/admin/login';
        }}
      />
      <AdminHeader
        sidebarCollapsed={sidebarCollapsed}
        breadcrumb={['WATSIM', 'Dashboard']}
        onLogout={() => {
          tokenStore.setTokens(null as any, null as any);
          tokenStore.setUser(null);
          window.location.href = '/admin/login';
        }}
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
              <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                Tableau de Bord
              </h1>
              <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                Bienvenue, Super Admin — Lundi 27 Avril 2026
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
                style={{
                  background: '#F5FAF5',
                  border: '1px solid #E8F2F1',
                  color: '#1A2B1F',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                <i className="ri-calendar-line text-sm" />
                Avril 2026
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
                style={{
                  background: 'linear-gradient(135deg, #4DB049, #22C55E)',
                  color: '#FFFFFF',
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
            {kpis.map((kpi) => (
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
              { label: 'Crédits BNPL Actifs', value: liveStats?.active ? liveStats.active.toLocaleString('fr-FR') : '—', icon: 'ri-bank-card-line', color: '#4DB049' },
              { label: 'Taux de Défaut', value: typeof liveStats?.rate === 'number' ? `${liveStats.rate.toFixed(1)}%` : '—', icon: 'ri-error-warning-line', color: '#EF4444' },
              { label: 'Utilisateurs Actifs', value: liveStats?.users ? liveStats.users.toLocaleString('fr-FR') : '—', icon: 'ri-user-add-line', color: '#22C55E' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl p-5 flex items-center gap-4"
                style={cardStyle}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${stat.color}20` }}
                >
                  <i className={`${stat.icon} text-xl`} style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
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
