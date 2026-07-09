import { useState, useEffect } from 'react';
import MerchantLayout from '@/components/feature/MerchantLayout';
import Toast, { useToast } from '@/components/base/Toast';
import { merchantApi } from '@/lib/api';

const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

// maxRevenue and maxOrders are computed below from live data

export default function MerchantAnalyticsPage() {
  const [period, setPeriod] = useState('12m');
  const [chartType, setChartType] = useState<'revenue' | 'orders'>('revenue');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  const [revenueChart, setRevenueChart] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>({});

  useEffect(() => {
    merchantApi.dashboard().then((d: any) => {
      if (Array.isArray(d?.revenueChart)) setRevenueChart(d.revenueChart);
    }).catch(() => {});
    merchantApi.products({ page: 1, limit: 100 }).then((res: any) => {
      const items = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      setProducts(items);
    }).catch(() => setProducts([]));
    merchantApi.orders({ page: 1, limit: 100 }).then((res: any) => {
      const items = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      setOrders(items);
    }).catch(() => setOrders([]));
    // profile via layout or direct, but for completeness
    // (profile is also loaded in MerchantLayout)
  }, []);

  const periodData = period === '3m' ? revenueChart.slice(-3) : period === '6m' ? revenueChart.slice(-6) : revenueChart;

  const maxRevenue = periodData.length > 0 ? Math.max(...periodData.map((d: any) => d.revenue || 0)) : 1;
  const maxOrders = periodData.length > 0 ? Math.max(...periodData.map((d: any) => d.orders || 0)) : 1;

  const totalRevenue = periodData.reduce((s, d) => s + (d.revenue || 0), 0);
  const totalOrders = periodData.reduce((s, d) => s + (d.orders || 0), 0);
  const totalBnpl = periodData.reduce((s, d) => s + (d.bnpl || 0), 0);
  const avgOrder = totalOrders > 0 && isFinite(totalRevenue) ? totalRevenue / totalOrders : 0;

  // Top products by sold
  const topProducts = [...products].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 5);
  const maxSoldRaw = topProducts.length > 0 ? Math.max(...topProducts.map(p => p.sold || 0)) : 0;
  const maxSold = maxSoldRaw > 0 ? maxSoldRaw : 1;

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  products.forEach(p => {
    const cat = p.category || 'Autre';
    categoryMap[cat] = (categoryMap[cat] || 0) + (p.sold || 0) * (p.price || 0);
  });
  const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
  const totalCatRevenueRaw = categories.reduce((s, [, v]) => s + v, 0);
  const totalCatRevenue = totalCatRevenueRaw > 0 ? totalCatRevenueRaw : 1;
  const catColors = ['#D4AF37', '#4A9EFF', '#A855F7', '#22C55E', '#F97316', '#EF4444'];

  // City breakdown
  const cityMap: Record<string, number> = {};
  orders.filter((o: any) => o.status === 'completed').forEach((o: any) => {
    const city = o.city || o.user?.city || 'Inconnu';
    cityMap[city] = (cityMap[city] || 0) + (o.amount || o.totalAmount || 0);
  });
  const cities = Object.entries(cityMap).sort((a, b) => b[1] - a[1]);

  const exportReport = () => {
    addToast('success', 'Rapport exporté', 'Le rapport analytique a été téléchargé.');
  };

  return (
    <MerchantLayout breadcrumb={['Merchant', 'Analytiques']}>
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Analytiques</h2>
          <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Performance de votre boutique</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
            {['3m', '6m', '12m'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-all"
                style={{
                  background: period === p ? 'rgba(77,176,73,0.15)' : 'transparent',
                  color: period === p ? '#4DB049' : '#6B7280',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105"
            style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}
          >
            <i className="ri-download-2-line" />
            Exporter
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Revenus totaux', value: `${fmt(totalRevenue || 0)} FCFA`, delta: '+17.8%', icon: 'ri-money-dollar-circle-line', color: '#4DB049' },
          { label: 'Commandes', value: totalOrders || 0, delta: '+13.5%', icon: 'ri-file-list-3-line', color: '#4A9EFF' },
          { label: 'Revenus BNPL', value: `${fmt(totalBnpl || 0)} FCFA`, delta: '+22.1%', icon: 'ri-bank-card-line', color: '#A855F7' },
          { label: 'Panier moyen', value: `${fmt(Math.round(avgOrder || 0))} FCFA`, delta: '+3.8%', icon: 'ri-shopping-cart-2-line', color: '#22C55E' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', borderRadius: '16px' }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                <i className={`${kpi.icon} text-lg`} style={{ color: kpi.color }} />
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', fontFamily: 'Poppins, sans-serif' }}>
                {kpi.delta}
              </span>
            </div>
            <p className="text-xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{kpi.value}</p>
            <p className="text-xs mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Main chart */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', borderRadius: '16px' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
              {chartType === 'revenue' ? 'Évolution des revenus' : 'Évolution des commandes'}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
              Période : {period === '3m' ? '3 derniers mois' : period === '6m' ? '6 derniers mois' : '12 derniers mois'}
            </p>
          </div>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
            {[{ key: 'revenue', label: 'Revenus' }, { key: 'orders', label: 'Commandes' }].map(t => (
              <button
                key={t.key}
                onClick={() => setChartType(t.key as 'revenue' | 'orders')}
                className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-all"
                style={{
                  background: chartType === t.key ? 'rgba(77,176,73,0.15)' : 'transparent',
                  color: chartType === t.key ? '#4DB049' : '#6B7280',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-2 h-48">
          {periodData.map((d, i) => {
            const val = chartType === 'revenue' ? d.revenue : d.orders;
            const max = chartType === 'revenue' ? maxRevenue : maxOrders;
            const h = (val / max) * 160;
            return (
              <div
                key={d.month}
                className="flex-1 flex flex-col items-center gap-1 cursor-pointer"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <div className="w-full relative flex flex-col items-center">
                  {hoverIdx === i && (
                    <div
                      className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-xs whitespace-nowrap z-10"
                      style={{ background: '#014945', border: '1px solid rgba(77,176,73,0.3)', color: '#fff', fontFamily: 'Poppins, sans-serif' }}
                    >
                      {chartType === 'revenue' ? `${fmt(val)} FCFA` : `${val} cmd`}
                    </div>
                  )}
                  <div
                    className="w-full rounded-t-sm transition-all duration-300"
                    style={{
                      height: `${h}px`,
                      background: hoverIdx === i
                        ? 'linear-gradient(180deg, #22C55E, #4DB049)'
                        : 'rgba(77,176,73,0.35)',
                    }}
                  />
                </div>
                <span className="text-xs" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif', fontSize: '10px' }}>
                  {d.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top products */}
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', borderRadius: '16px' }}>
          <h3 className="font-semibold mb-4" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Top produits</h3>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-xs font-bold w-5 text-center" style={{ color: i === 0 ? '#4DB049' : '#9CA3AF', fontFamily: 'Montserrat, sans-serif' }}>
                  #{i + 1}
                </span>
                <img src={p.image} alt={p.name} className="w-9 h-9 rounded-lg object-cover object-top flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{p.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#F0F7F0' }}>
                       <div className="h-full rounded-full" style={{ width: `${((p.sold || 0) / maxSold) * 100}%`, background: catColors[i] || '#D4AF37' }} />
                     </div>
                     <span className="text-xs flex-shrink-0" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>{p.sold || 0} vendus</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                   <p className="text-sm font-semibold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                     {fmt((p.price || 0) * (p.sold || 0))} FCFA
                   </p>
                  <div className="flex items-center gap-1 justify-end">
                    <i className="ri-star-fill text-xs" style={{ color: '#F59E0B' }} />
                    <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{p.rating}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category + City breakdown */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', borderRadius: '16px' }}>
            <h3 className="font-semibold mb-4" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Par catégorie</h3>
            <div className="space-y-2.5">
              {categories.slice(0, 5).map(([cat, val], i) => (
                <div key={cat}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{cat}</span>
                   <span className="text-xs font-semibold" style={{ color: catColors[i], fontFamily: 'Montserrat, sans-serif' }}>
                       {totalCatRevenue > 0 ? ((val / totalCatRevenue) * 100).toFixed(0) : 0}%
                     </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#F0F7F0' }}>
                     <div className="h-full rounded-full" style={{ width: `${totalCatRevenue > 0 ? (val / totalCatRevenue) * 100 : 0}%`, background: catColors[i] }} />
                   </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', borderRadius: '16px' }}>
            <h3 className="font-semibold mb-4" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Par ville</h3>
            <div className="space-y-2.5">
              {cities.map(([city, val], i) => (
                <div key={city} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: catColors[i] || '#4DB049' }} />
                    <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{city}</span>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: '#374151', fontFamily: 'Montserrat, sans-serif' }}>
                     {fmt(val || 0)} FCFA
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Store rating */}
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', borderRadius: '16px' }}>
            <h3 className="font-semibold mb-3" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Note boutique</h3>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-4xl font-bold" style={{ color: '#F59E0B', fontFamily: 'Montserrat, sans-serif' }}>{profile.rating || 0}</span>
              <div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <i key={s} className={`${s <= Math.round(profile.rating || 0) ? 'ri-star-fill' : 'ri-star-line'} text-sm`} style={{ color: '#F59E0B' }} />
                  ))}
                </div>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>
                  {(profile.totalReviews || 0)} avis
                </p>
              </div>
            </div>
            {[5, 4, 3, 2, 1].map(star => {
              const pct = star === 5 ? 68 : star === 4 ? 22 : star === 3 ? 7 : star === 2 ? 2 : 1;
              return (
                <div key={star} className="flex items-center gap-2 mb-1">
                  <span className="text-xs w-3 text-right" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>{star}</span>
                  <i className="ri-star-fill text-xs" style={{ color: '#F59E0B' }} />
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#F0F7F0' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#F59E0B' }} />
                  </div>
                  <span className="text-xs w-6" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </MerchantLayout>
  );
}
