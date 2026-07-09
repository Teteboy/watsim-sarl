import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MerchantLayout from '@/components/feature/MerchantLayout';
import { merchantApi, ApiError } from '@/lib/api';
import { getMerchantAuthState } from '@/hooks/useMerchantAuth';
import { cardStyle, primaryButtonStyle, secondaryButtonStyle } from '@/styles/admin-theme';

const fmt = (n: number) =>
  n >= 1000000
    ? `${(n / 1000000).toFixed(1)}M`
    : n >= 1000
    ? `${(n / 1000).toFixed(0)}K`
    : `${n}`;

const statusConfig: Record<string, { label: string; color: string }> = {
  completed: { label: 'Livré', color: '#22C55E' },
  processing: { label: 'En cours', color: '#4DB049' },
  shipped: { label: 'Expédié', color: '#4A9EFF' },
  pending: { label: 'En attente', color: '#F97316' },
  cancelled: { label: 'Annulé', color: '#EF4444' },
};

const bnplStatusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: '#22C55E' },
  overdue: { label: 'En retard', color: '#EF4444' },
  completed: { label: 'Soldé', color: '#4A9EFF' },
  pending: { label: 'En attente', color: '#F97316' },
};

// maxRevenue removed - using live revenueChart state + currentMaxRevenue below

const defaultMerchantStats = {
  revenueThisMonth: 0,
  revenueLastMonth: 0,
  ordersThisMonth: 0,
  pendingOrders: 0,
  bnplRevenueThisMonth: 0,
  bnplOrdersThisMonth: 0,
  returningCustomers: 0,
  newCustomers: 0,
  completedOrders: 0,
  cancelledOrders: 0,
};

export default function MerchantDashboard() {
  const [chartHover, setChartHover] = useState<number | null>(null);
  const [merchantStats, setMerchantStats] = useState(defaultMerchantStats);
  const [revenueChart, setRevenueChart] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [activeBnpl, setActiveBnpl] = useState<any[]>([]);
  const currentMaxRevenue = revenueChart.length > 0 
    ? Math.max(...revenueChart.map((d: any) => d.revenue || 0)) 
    : 1;

  const [merchantProfile, setMerchantProfile] = useState({
    name: '',
    owner: '',
    city: '',
    rating: 0,
    totalReviews: 0,
    walletBalance: 0,
    pendingPayout: 0,
    conversionRate: 0,
    avgOrderValue: 0,
  });

  useEffect(() => {
    merchantApi.dashboard()
      .then((d) => {
        setMerchantStats({
          ...defaultMerchantStats,
          revenueThisMonth: d.revenueThisMonth ?? 0,
          revenueLastMonth: d.revenueLastMonth ?? 0,
          ordersThisMonth: d.totalOrders ?? 0,
          pendingOrders: d.pendingOrders ?? 0,
          bnplRevenueThisMonth: d.bnplRevenueThisMonth ?? 0,
          bnplOrdersThisMonth: d.bnplOrdersThisMonth ?? 0,
          completedOrders: d.completedOrders ?? 0,
          cancelledOrders: d.cancelledOrders ?? 0,
          returningCustomers: d.returningCustomers ?? 0,
          newCustomers: d.newCustomers ?? 0,
        });

        if (Array.isArray(d.revenueChart) && d.revenueChart.length > 0) {
          setRevenueChart(d.revenueChart);
        }
      })
      .catch(() => null);

    const { isAuthenticated } = getMerchantAuthState ? getMerchantAuthState() : { isAuthenticated: false };
    if (isAuthenticated) {
      merchantApi.profile()
        .then((p) => {
          if (p) setMerchantProfile(p);
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) {
            // force merchant logout on bad token
            // (the layout will also do it, but this catches the direct call)
          }
        });
    }

    // Fetch recent orders (BNPL purchases) and normalize for dashboard display
    merchantApi.orders({ page: 1, limit: 5 })
      .then((res: any) => {
        const rawItems = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
        const normalized = rawItems.map((item: any) => {
          const status = (item.status || '').toLowerCase();
          const userName = item.user?.fullName || item.customer || 'Client inconnu';
          const prodName = item.product?.name || item.product || 'Produit';
          const total = item.totalAmount || item.amount || 0;
          const paid = item.paidAmount || 0;
          return {
            id: item.id,
            customer: userName,
            product: prodName,
            amount: total,
            status,
            paidAmount: paid,
            totalAmount: total,
            remainingAmount: item.remainingAmount || (total - paid),
            paidInstallments: item.paidInstallments || 0,
            installments: item.instalments?.length || item.installments || 0,
            nextDueDate: item.nextDueDate || null,
          };
        });
        setRecentOrders(normalized);
        const active = normalized.filter(b => b.status === 'active' || b.status === 'overdue').slice(0, 4);
        setActiveBnpl(active);
      })
      .catch(() => {
        setRecentOrders([]);
        setActiveBnpl([]);
      });
  }, []);

  const kpis = [
    {
      label: 'Revenus ce mois',
      value: `${fmt(merchantStats.revenueThisMonth)} FCFA`,
      sub: `+${merchantStats.revenueLastMonth > 0 ? (((merchantStats.revenueThisMonth - merchantStats.revenueLastMonth) / merchantStats.revenueLastMonth) * 100).toFixed(1) : '0'}% vs mois dernier`,
      icon: 'ri-money-dollar-circle-line',
      color: '#4DB049',
      positive: true,
    },
    {
      label: 'Commandes ce mois',
      value: `${merchantStats.ordersThisMonth}`,
      sub: `${merchantStats.pendingOrders} en attente`,
      icon: 'ri-file-list-3-line',
      color: '#4A9EFF',
      positive: true,
    },
    {
      label: 'Revenus BNPL',
      value: `${fmt(merchantStats.bnplRevenueThisMonth || 0)} FCFA`,
      sub: `${merchantStats.bnplOrdersThisMonth || 0} commandes BNPL`,
      icon: 'ri-bank-card-line',
      color: '#A855F7',
      positive: true,
    },
    {
      label: 'Solde disponible',
      value: `${fmt(merchantProfile.walletBalance)} FCFA`,
      sub: `${fmt(merchantProfile.pendingPayout)} FCFA en attente`,
      icon: 'ri-wallet-3-line',
      color: '#22C55E',
      positive: true,
    },
  ];

  // recentOrders and activeBnpl now come from live state (populated in useEffect)

  return (
    <MerchantLayout breadcrumb={['Merchant', 'Vue d\'ensemble']}>
      {/* Welcome banner */}
      <div
        className="rounded-2xl p-6 mb-6 flex items-center justify-between overflow-hidden relative"
        style={cardStyle}
      >
        <div
          className="absolute inset-0 opacity-5"
          style={{ background: 'radial-gradient(ellipse at 80% 50%, #4DB049 0%, transparent 60%)' }}
        />
        <div className="relative z-10">
          <p className="text-gray-500 text-sm mb-1 font-poppins">
            Bonjour, {(merchantProfile.owner || '').split(' ')[0] || 'Merchant'} 👋
          </p>
          <h1 className="text-2xl font-bold mb-1 text-watsim-primaryDark font-montserrat">
            {merchantProfile.name}
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <i className="ri-star-fill text-sm text-watsim-primaryGreen" />
              <span className="text-gray-600 text-sm font-poppins">
                {merchantProfile.rating} ({merchantProfile.totalReviews} avis)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <i className="ri-map-pin-line text-sm text-gray-400" />
              <span className="text-gray-500 text-sm font-poppins">{merchantProfile.city}</span>
            </div>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}
            >
              <i className="ri-shield-check-line text-xs" />
              Vérifié
            </div>
          </div>
        </div>
        <div className="relative z-10 hidden md:flex items-center gap-3">
          <Link
            to="/merchant/products"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105 font-poppins"
            style={secondaryButtonStyle}
          >
            <i className="ri-add-line" />
            Ajouter produit
          </Link>
          <Link
            to="/merchant/orders"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105 font-poppins"
            style={{ ...primaryButtonStyle, background: 'linear-gradient(135deg, #4DB049, #22C55E)' }}
          >
            <i className="ri-file-list-3-line" />
            Voir commandes
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl p-5 transition-all hover:scale-[1.02]"
            style={cardStyle}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${kpi.color}15` }}
              >
                <i className={`${kpi.icon} text-lg`} style={{ color: kpi.color }} />
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-poppins"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}
              >
                ↑
              </span>
            </div>
            <p className="text-2xl font-bold mb-1 text-watsim-primaryDark font-montserrat">
              {kpi.value}
            </p>
            <p className="text-xs text-watsim-textMuted font-poppins">
              {kpi.label}
            </p>
            <p className="text-xs mt-1 text-gray-400 font-poppins">
              {kpi.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Revenue chart */}
        <div
          className="lg:col-span-2 rounded-2xl p-5"
          style={cardStyle}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-watsim-primaryDark font-montserrat">Revenus & Commandes</h3>
              <p className="text-xs mt-0.5 text-watsim-textMuted font-poppins">Évolution sur 12 mois</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-poppins">
              <span className="flex items-center gap-1.5 text-watsim-textMuted">
                <span className="w-3 h-1 rounded-full inline-block" style={{ background: '#4DB049' }} />
                Revenus
              </span>
              <span className="flex items-center gap-1.5 text-watsim-textMuted">
                <span className="w-3 h-1 rounded-full inline-block" style={{ background: '#A855F7' }} />
                BNPL
              </span>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-40">
            {revenueChart.map((d, i) => (
              <div
                key={d.month}
                className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
                onMouseEnter={() => setChartHover(i)}
                onMouseLeave={() => setChartHover(null)}
              >
                <div className="w-full flex flex-col items-center gap-0.5 relative">
                  {chartHover === i && (
                    <div
                      className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-xs whitespace-nowrap z-10"
                      style={{ background: '#FFFFFF', border: '1px solid #4DB049', color: '#014945', fontFamily: 'Poppins, sans-serif' }}
                    >
                      {fmt(d.revenue)} FCFA
                    </div>
                  )}

                  <div
                    className="w-full rounded-t-sm transition-all duration-200"
                    style={{
                      height: `${((d.revenue || 0) / (currentMaxRevenue || 1)) * 120}px`,
                      background: chartHover === i ? '#4DB049' : 'rgba(77,176,89,0.5)',
                    }}
                  />
                </div>
                <span className="text-xs" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif', fontSize: '10px' }}>
                  {d.month}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        <div
          className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}
        >
          <h3 className="font-semibold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Statistiques rapides</h3>

          {[
            { label: 'Taux de conversion', value: `${merchantProfile.conversionRate}%`, color: '#22C55E', icon: 'ri-percent-line' },
            { label: 'Panier moyen', value: `${fmt(merchantProfile.avgOrderValue)} FCFA`, color: '#4DB049', icon: 'ri-shopping-cart-2-line' },
            { label: 'Clients fidèles', value: `${merchantStats.returningCustomers || 0}`, color: '#4A9EFF', icon: 'ri-user-heart-line' },
            { label: 'Nouveaux clients', value: `${merchantStats.newCustomers || 0}`, color: '#A855F7', icon: 'ri-user-add-line' },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${stat.color}15` }}
              >
                <i className={`${stat.icon} text-base`} style={{ color: stat.color }} />
              </div>
              <div className="flex-1">
                <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{stat.label}</p>
                <p className="font-semibold text-sm" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{stat.value}</p>
              </div>
            </div>
          ))}

          <div className="mt-auto pt-3 border-t" style={{ borderColor: '#F0F7F0' }}>
            <p className="text-xs mb-2" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Répartition commandes</p>
            <div className="flex gap-1 h-2 rounded-full overflow-hidden">
              <div style={{ width: `${((merchantStats.completedOrders || 0) / (merchantStats.ordersThisMonth || 1)) * 100}%`, background: '#22C55E' }} />
              <div style={{ width: `${((merchantStats.pendingOrders || 0) / (merchantStats.ordersThisMonth || 1)) * 100}%`, background: '#F97316' }} />
              <div style={{ width: `${((merchantStats.cancelledOrders || 0) / (merchantStats.ordersThisMonth || 1)) * 100}%`, background: '#EF4444' }} />
            </div>
            <div className="flex gap-3 mt-2 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
              <span style={{ color: '#22C55E' }}>● {merchantStats.completedOrders || 0} livrées</span>
              <span style={{ color: '#F97316' }}>● {merchantStats.pendingOrders || 0} en attente</span>
              <span style={{ color: '#EF4444' }}>● {merchantStats.cancelledOrders || 0} annulées</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent orders + BNPL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent orders */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F0F7F0' }}>
            <h3 className="font-semibold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Commandes récentes</h3>
            <Link
              to="/merchant/orders"
              className="text-xs cursor-pointer transition-colors"
              style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}
            >
              Voir tout →
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: '#F0F7F0' }}>
            {recentOrders.map(order => {
              const statusKey = (order.status || '').toLowerCase();
              const sc = statusConfig[statusKey] || { label: order.status || 'Inconnu', color: '#6B7280' };
              return (
                <div key={order.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(77,176,89,0.1)' }}
                  >
                    <i className="ri-shopping-bag-3-line text-sm" style={{ color: '#4DB049' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                      {order.customer}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                      {order.product}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                      {fmt(order.amount)} FCFA
                    </p>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: `${sc.color}20`, color: sc.color, fontFamily: 'Poppins, sans-serif' }}
                    >
                      {sc.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active BNPL */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F0F7F0' }}>
            <h3 className="font-semibold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Paiements BNPL actifs</h3>
            <Link
              to="/merchant/bnpl"
              className="text-xs cursor-pointer transition-colors"
              style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}
            >
              Voir tout →
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: '#F0F7F0' }}>
            {activeBnpl.map(bnpl => {
              const statusKey = (bnpl.status || '').toLowerCase();
              const sc = bnplStatusConfig[statusKey] || { label: bnpl.status || 'Inconnu', color: '#6B7280' };
              const progress = ((bnpl.paidAmount || 0) / (bnpl.totalAmount || 1)) * 100;
              return (
                <div key={bnpl.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                        {bnpl.customer}
                      </p>
                      <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                        {bnpl.product}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                        {fmt(bnpl.remainingAmount)} FCFA
                      </p>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: `${sc.color}20`, color: sc.color, fontFamily: 'Poppins, sans-serif' }}
                      >
                        {sc.label}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#F5FAF5' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress}%`, background: bnpl.status === 'overdue' ? '#EF4444' : '#4DB049' }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>
                      {bnpl.paidInstallments}/{bnpl.installments} versements
                    </span>
                    {bnpl.nextDueDate && (
                      <span className="text-xs" style={{ color: bnpl.status === 'overdue' ? '#EF4444' : '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>
                        Échéance: {bnpl.nextDueDate}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </MerchantLayout>
  );
}
