import { useState, useEffect } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import { adminApi, getTransactionChartData, tokenStore } from '@/lib/api';

const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };

const reportCards = [
  { id: 'financial', title: 'Rapport Financier Mensuel', description: 'Revenus, dépenses, marges et flux de trésorerie', icon: 'ri-file-chart-2-line', color: '#4DB049' },
  { id: 'bnpl', title: 'Rapport BNPL & Crédit', description: 'Taux de remboursement, défauts, scoring moyen', icon: 'ri-bank-card-line', color: '#22C55E' },
  { id: 'users', title: 'Rapport Utilisateurs', description: 'Acquisition, rétention, KYC et activité', icon: 'ri-user-3-line', color: '#4A9EFF' },
  { id: 'merchants', title: 'Rapport Commerciaux', description: 'Performance, ventes et satisfaction partenaires', icon: 'ri-store-2-line', color: '#F97316' },
  { id: 'fraud', title: 'Rapport Fraude & Sécurité', description: 'Incidents détectés, résolutions et tendances', icon: 'ri-shield-cross-line', color: '#EF4444' },
  { id: 'transactions', title: 'Rapport Transactions', description: 'Volume, types, méthodes et géographie', icon: 'ri-exchange-line', color: '#A855F7' },
];

export default function AdminReportsPage() {
  const [period, setPeriod] = useState('month');
  const [generating, setGenerating] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [kpiData, setKpiData] = useState<any>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore?.access) return;
    getTransactionChartData().then(res => {
      if (res.data) setMonthlyData(res.data);
    }).catch(() => {});
    setKpiLoading(true);
    adminApi.summary?.().then(res => { setKpiData(res); setKpiLoading(false); }).catch(() => setKpiLoading(false));
  }, []);

  const fmt = (n: number | undefined, suffix = '') =>
    n !== undefined ? `${n.toLocaleString('fr-FR')}${suffix}` : '—';
  const fmtM = (n: number | undefined) =>
    n !== undefined ? `${(n / 1e6).toFixed(2)} M FCFA` : '—';

  const kpiSummary = [
    { label: 'Utilisateurs Totaux', value: fmt(kpiData?.totalUsers), icon: 'ri-user-3-line', color: '#4DB049' },
    { label: 'Transactions Totales', value: fmt(kpiData?.totalTransactions), icon: 'ri-exchange-line', color: '#22C55E' },
    { label: 'Utilisateurs Actifs', value: fmt(kpiData?.activeUsers), icon: 'ri-user-heart-line', color: '#4A9EFF' },
    { label: 'Revenus du Mois', value: fmtM(kpiData?.revenueThisMonth), icon: 'ri-money-dollar-circle-line', color: '#F97316' },
    { label: 'Remboursements', value: fmtM(kpiData?.totalRepayments), icon: 'ri-refund-2-line', color: '#A855F7' },
    { label: 'Taux de Remboursement', value: kpiData ? `${kpiData.repaymentRate ?? 0}%` : '—', icon: 'ri-percent-line', color: '#EF4444' },
  ];

  const handleGenerate = (id: string) => {
    setGenerating(id);
    setTimeout(() => setGenerating(null), 2000);
  };

  const maxTxn = monthlyData.length > 0 ? Math.max(...monthlyData.map(d => d.transactions)) : 1;

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Finance', 'Rapports']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Rapports & Analyses</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Tableaux de bord analytiques et exports</p>
          </div>
          <div className="flex items-center gap-2 p-1 rounded-lg" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
            {[{ value: 'week', label: '7j' }, { value: 'month', label: '30j' }, { value: 'quarter', label: '3 mois' }, { value: 'year', label: '12 mois' }].map((p) => (
              <button key={p.value} onClick={() => setPeriod(p.value)} className="px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap" style={{ background: period === p.value ? 'linear-gradient(135deg, #4DB049, #22C55E)' : 'transparent', color: period === p.value ? '#FFFFFF' : '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpiSummary.map((kpi) => (
            <div key={kpi.label} className="rounded-2xl p-4" style={cardStyle}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${kpi.color}18` }}>
                <i className={`${kpi.icon} text-sm`} style={{ color: kpi.color }} />
              </div>
              {kpiLoading ? (
                <div className="h-5 w-16 rounded animate-pulse mb-1" style={{ background: '#E8F2F1' }} />
              ) : (
                <p className="text-base font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{kpi.value}</p>
              )}
              <p className="text-xs mt-0.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-2xl p-5" style={cardStyle}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>Évolution des Transactions (12 mois)</h3>
            <div className="flex items-center gap-4 text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full inline-block" style={{ background: '#4DB049' }} />Transactions</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full inline-block" style={{ background: '#22C55E' }} />Revenus (M FCFA)</span>
            </div>
          </div>
          <div className="flex items-end gap-2 h-40">
            {monthlyData.map((d) => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5 h-32">
                  <div className="flex-1 rounded-t-sm transition-all" style={{ height: `${(d.transactions / maxTxn) * 100}%`, background: 'linear-gradient(180deg, #4DB049, rgba(77,176,89,0.3))' }} />
                  <div className="flex-1 rounded-t-sm transition-all" style={{ height: `${(d.revenue / 150) * 100}%`, background: 'linear-gradient(180deg, #22C55E, rgba(34,197,94,0.3))' }} />
                </div>
                <p className="text-xs" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>{d.month}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Fee Structure Breakdown */}
        <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(77,176,89,0.12)' }}>
              <i className="ri-money-dollar-circle-line text-sm" style={{ color: '#4DB049' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: '#014945', fontFamily: 'Poppins, sans-serif' }}>Structure des Frais Plateforme</h3>
              <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Récapitulatif des frais appliqués aux achats BNPL</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                icon: 'ri-archive-2-line',
                color: '#4A9EFF',
                label: 'Frais de Stockage',
                amount: '3 000 FCFA / mois',
                detail: 'Appliqués mensuellement par produit',
                badge: 'Mensuel',
                badgeColor: '#4A9EFF',
              },
              {
                icon: 'ri-user-add-line',
                color: '#A855F7',
                label: 'Frais de Création de Compte',
                amount: 'Variable',
                detail: 'Facturés une seule fois lors du premier achat BNPL',
                badge: 'Unique',
                badgeColor: '#A855F7',
              },
              {
                icon: 'ri-truck-line',
                color: '#F97316',
                label: 'Frais de Livraison',
                amount: '0 FCFA (défaut)',
                detail: 'Appliqués par défaut à chaque achat — configurable par marchand',
                badge: 'Par achat',
                badgeColor: '#F97316',
              },
              {
                icon: 'ri-hand-coin-line',
                color: '#22C55E',
                label: 'Frais de Collecte',
                amount: '1 000 FCFA',
                detail: 'Frais uniques de service par achat BNPL',
                badge: 'Par achat',
                badgeColor: '#22C55E',
              },
            ].map((fee) => (
              <div key={fee.label} className="rounded-xl p-4 space-y-2" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${fee.color}18` }}>
                    <i className={`${fee.icon} text-sm`} style={{ color: fee.color }} />
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${fee.badgeColor}18`, color: fee.badgeColor, fontFamily: 'Poppins, sans-serif' }}>{fee.badge}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{fee.label}</p>
                  <p className="text-base font-bold mt-0.5" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{fee.amount}</p>
                  <p className="text-[11px] mt-1 leading-snug" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{fee.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Report Cards */}
        <div>
          <h2 className="text-lg font-bold mb-4" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Rapports Disponibles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {reportCards.map((report) => (
              <div key={report.id} className="rounded-2xl p-5" style={cardStyle}>
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${report.color}20` }}>
                    <i className={`${report.icon} text-xl`} style={{ color: report.color }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{report.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{report.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleGenerate(report.id)} className="flex-1 py-2 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-all" style={{ background: generating === report.id ? 'rgba(77,176,89,0.1)' : 'linear-gradient(135deg, #4DB049, #22C55E)', color: generating === report.id ? '#4DB049' : '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                    {generating === report.id ? <><i className="ri-loader-4-line animate-spin mr-1" />Génération...</> : <><i className="ri-refresh-line mr-1" />Générer</>}
                  </button>
                  <button className="flex-1 py-2 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
                    <i className="ri-download-2-line mr-1" />Télécharger
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
