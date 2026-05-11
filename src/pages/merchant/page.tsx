import { useState } from 'react';
import { Link } from 'react-router-dom';
import MerchantLayout from '@/components/feature/MerchantLayout';
import { merchantProfile, merchantStats, merchantRevenueChart, merchantOrders, merchantBnplPayments } from '@/mocks/merchantData';

const fmt = (n: number) =>
  n >= 1000000
    ? `${(n / 1000000).toFixed(1)}M`
    : n >= 1000
    ? `${(n / 1000).toFixed(0)}K`
    : `${n}`;

const statusConfig: Record<string, { label: string; color: string }> = {
  completed: { label: 'Livré', color: '#22C55E' },
  processing: { label: 'En cours', color: '#D4AF37' },
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

const maxRevenue = Math.max(...merchantRevenueChart.map(d => d.revenue));

export default function MerchantDashboard() {
  const [chartHover, setChartHover] = useState<number | null>(null);

  const kpis = [
    {
      label: 'Revenus ce mois',
      value: `${fmt(merchantStats.revenueThisMonth)} FCFA`,
      sub: `+${(((merchantStats.revenueThisMonth - merchantStats.revenueLastMonth) / merchantStats.revenueLastMonth) * 100).toFixed(1)}% vs mois dernier`,
      icon: 'ri-money-dollar-circle-line',
      color: '#D4AF37',
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
      value: `${fmt(merchantStats.bnplRevenueThisMonth)} FCFA`,
      sub: `${merchantStats.bnplOrdersThisMonth} commandes BNPL`,
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

  const recentOrders = merchantOrders.slice(0, 5);
  const activeBnpl = merchantBnplPayments.filter(b => b.status === 'active' || b.status === 'overdue').slice(0, 4);

  return (
    <MerchantLayout breadcrumb={['Merchant', 'Vue d\'ensemble']}>
      {/* Welcome banner */}
      <div
        className="rounded-2xl p-6 mb-6 flex items-center justify-between overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.15)' }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{ background: 'radial-gradient(ellipse at 80% 50%, #D4AF37 0%, transparent 60%)' }}
        />
        <div className="relative z-10">
          <p className="text-white/50 text-sm mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Bonjour, {merchantProfile.owner.split(' ')[0]} 👋
          </p>
          <h1 className="text-white text-2xl font-bold mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            {merchantProfile.name}
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <i className="ri-star-fill text-sm" style={{ color: '#D4AF37' }} />
              <span className="text-white/70 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {merchantProfile.rating} ({merchantProfile.totalReviews} avis)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <i className="ri-map-pin-line text-sm text-white/40" />
              <span className="text-white/50 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>{merchantProfile.city}</span>
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
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
          >
            <i className="ri-add-line" />
            Ajouter produit
          </Link>
          <Link
            to="/merchant/orders"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}
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
            style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${kpi.color}20` }}
              >
                <i className={`${kpi.icon} text-lg`} style={{ color: kpi.color }} />
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', fontFamily: 'Poppins, sans-serif' }}
              >
                ↑
              </span>
            </div>
            <p className="text-white text-2xl font-bold mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {kpi.value}
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
              {kpi.label}
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
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
          style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>Revenus & Commandes</h3>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Évolution sur 12 mois</p>
            </div>
            <div className="flex items-center gap-4 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
              <span className="flex items-center gap-1.5 text-white/50">
                <span className="w-3 h-1 rounded-full inline-block" style={{ background: '#D4AF37' }} />
                Revenus
              </span>
              <span className="flex items-center gap-1.5 text-white/50">
                <span className="w-3 h-1 rounded-full inline-block" style={{ background: '#A855F7' }} />
                BNPL
              </span>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-40">
            {merchantRevenueChart.map((d, i) => (
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
                      style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.3)', color: '#fff', fontFamily: 'Poppins, sans-serif' }}
                    >
                      {fmt(d.revenue)} FCFA
                    </div>
                  )}
                  <div
                    className="w-full rounded-t-sm transition-all duration-200"
                    style={{
                      height: `${(d.bnpl / maxRevenue) * 120}px`,
                      background: chartHover === i ? '#A855F7' : 'rgba(168,85,247,0.4)',
                    }}
                  />
                  <div
                    className="w-full rounded-t-sm transition-all duration-200"
                    style={{
                      height: `${((d.revenue - d.bnpl) / maxRevenue) * 120}px`,
                      background: chartHover === i ? '#D4AF37' : 'rgba(212,175,55,0.5)',
                    }}
                  />
                </div>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif', fontSize: '10px' }}>
                  {d.month}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        <div
          className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}
        >
          <h3 className="text-white font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>Statistiques rapides</h3>

          {[
            { label: 'Taux de conversion', value: `${merchantProfile.conversionRate}%`, color: '#22C55E', icon: 'ri-percent-line' },
            { label: 'Panier moyen', value: `${fmt(merchantProfile.avgOrderValue)} FCFA`, color: '#D4AF37', icon: 'ri-shopping-cart-2-line' },
            { label: 'Clients fidèles', value: `${merchantStats.returningCustomers}`, color: '#4A9EFF', icon: 'ri-user-heart-line' },
            { label: 'Nouveaux clients', value: `${merchantStats.newCustomers}`, color: '#A855F7', icon: 'ri-user-add-line' },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${stat.color}15` }}
              >
                <i className={`${stat.icon} text-base`} style={{ color: stat.color }} />
              </div>
              <div className="flex-1">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{stat.label}</p>
                <p className="text-white font-semibold text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>{stat.value}</p>
              </div>
            </div>
          ))}

          <div className="mt-auto pt-3 border-t border-white/10">
            <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Répartition commandes</p>
            <div className="flex gap-1 h-2 rounded-full overflow-hidden">
              <div style={{ width: `${(merchantStats.completedOrders / merchantStats.ordersThisMonth) * 100}%`, background: '#22C55E' }} />
              <div style={{ width: `${(merchantStats.pendingOrders / merchantStats.ordersThisMonth) * 100}%`, background: '#F97316' }} />
              <div style={{ width: `${(merchantStats.cancelledOrders / merchantStats.ordersThisMonth) * 100}%`, background: '#EF4444' }} />
            </div>
            <div className="flex gap-3 mt-2 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
              <span style={{ color: '#22C55E' }}>● {merchantStats.completedOrders} livrées</span>
              <span style={{ color: '#F97316' }}>● {merchantStats.pendingOrders} en attente</span>
              <span style={{ color: '#EF4444' }}>● {merchantStats.cancelledOrders} annulées</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent orders + BNPL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent orders */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 className="text-white font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>Commandes récentes</h3>
            <Link
              to="/merchant/orders"
              className="text-xs cursor-pointer transition-colors"
              style={{ color: '#D4AF37', fontFamily: 'Poppins, sans-serif' }}
            >
              Voir tout →
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {recentOrders.map(order => {
              const sc = statusConfig[order.status];
              return (
                <div key={order.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(212,175,55,0.1)' }}
                  >
                    <i className="ri-shopping-bag-3-line text-sm" style={{ color: '#D4AF37' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {order.customer}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                      {order.product}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white text-sm font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
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
          style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 className="text-white font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>Paiements BNPL actifs</h3>
            <Link
              to="/merchant/bnpl"
              className="text-xs cursor-pointer transition-colors"
              style={{ color: '#D4AF37', fontFamily: 'Poppins, sans-serif' }}
            >
              Voir tout →
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {activeBnpl.map(bnpl => {
              const sc = bnplStatusConfig[bnpl.status];
              const progress = (bnpl.paidAmount / bnpl.totalAmount) * 100;
              return (
                <div key={bnpl.id} className="px-5 py-3 hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-white text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {bnpl.customer}
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                        {bnpl.product}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-sm font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
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
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress}%`, background: bnpl.status === 'overdue' ? '#EF4444' : '#D4AF37' }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                      {bnpl.paidInstallments}/{bnpl.installments} versements
                    </span>
                    {bnpl.nextDueDate && (
                      <span className="text-xs" style={{ color: bnpl.status === 'overdue' ? '#EF4444' : 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
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
