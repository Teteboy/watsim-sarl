import { useState } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import { transactionChartData } from '@/mocks/dashboard';

const monthlyData = transactionChartData;

const reportCards = [
  { id: 'financial', title: 'Rapport Financier Mensuel', description: 'Revenus, dépenses, marges et flux de trésorerie', icon: 'ri-file-chart-2-line', color: '#D4AF37', lastGenerated: '27 Avr 2026', size: '2.4 MB' },
  { id: 'bnpl', title: 'Rapport BNPL & Crédit', description: 'Taux de remboursement, défauts, scoring moyen', icon: 'ri-bank-card-line', color: '#22C55E', lastGenerated: '27 Avr 2026', size: '1.8 MB' },
  { id: 'users', title: 'Rapport Utilisateurs', description: 'Acquisition, rétention, KYC et activité', icon: 'ri-user-3-line', color: '#4A9EFF', lastGenerated: '26 Avr 2026', size: '3.1 MB' },
  { id: 'merchants', title: 'Rapport Commerciaux', description: 'Performance, ventes et satisfaction partenaires', icon: 'ri-store-2-line', color: '#F97316', lastGenerated: '25 Avr 2026', size: '1.5 MB' },
  { id: 'fraud', title: 'Rapport Fraude & Sécurité', description: 'Incidents détectés, résolutions et tendances', icon: 'ri-shield-cross-line', color: '#EF4444', lastGenerated: '27 Avr 2026', size: '0.9 MB' },
  { id: 'transactions', title: 'Rapport Transactions', description: 'Volume, types, méthodes et géographie', icon: 'ri-exchange-line', color: '#A855F7', lastGenerated: '27 Avr 2026', size: '4.2 MB' },
];

const kpiSummary = [
  { label: 'Revenus Totaux (Avr)', value: '87,3 M FCFA', change: '+15.2%', up: true },
  { label: 'Transactions (Avr)', value: '11 400', change: '+12.8%', up: true },
  { label: 'Nouveaux Utilisateurs', value: '1 847', change: '+8.4%', up: true },
  { label: 'Taux de Défaut BNPL', value: '2.3%', change: '-0.4%', up: true },
  { label: 'Score Moyen Crédit', value: '74/100', change: '+2.1', up: true },
  { label: 'Litiges Ouverts', value: '4', change: '-2', up: true },
];

export default function AdminReportsPage() {
  const [period, setPeriod] = useState('month');
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = (id: string) => {
    setGenerating(id);
    setTimeout(() => setGenerating(null), 2000);
  };

  const maxTxn = Math.max(...monthlyData.map(d => d.transactions));

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Finance', 'Rapports']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Rapports & Analyses</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Tableaux de bord analytiques et exports</p>
          </div>
          <div className="flex items-center gap-2 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {[{ value: 'week', label: '7j' }, { value: 'month', label: '30j' }, { value: 'quarter', label: '3 mois' }, { value: 'year', label: '12 mois' }].map((p) => (
              <button key={p.value} onClick={() => setPeriod(p.value)} className="px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap" style={{ background: period === p.value ? 'linear-gradient(135deg, #D4AF37, #F5D76E)' : 'transparent', color: period === p.value ? '#0A1628' : 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpiSummary.map((kpi) => (
            <div key={kpi.label} className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }}>
              <p className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>{kpi.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{kpi.label}</p>
              <span className="text-xs font-medium mt-1 inline-block" style={{ color: kpi.up ? '#22C55E' : '#EF4444' }}>
                <i className={`${kpi.up ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} mr-0.5`} />{kpi.change}
              </span>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>Évolution des Transactions (12 mois)</h3>
            <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full inline-block" style={{ background: '#D4AF37' }} />Transactions</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full inline-block" style={{ background: '#22C55E' }} />Revenus (M FCFA)</span>
            </div>
          </div>
          <div className="flex items-end gap-2 h-40">
            {monthlyData.map((d) => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5 h-32">
                  <div className="flex-1 rounded-t-sm transition-all" style={{ height: `${(d.transactions / maxTxn) * 100}%`, background: 'linear-gradient(180deg, #D4AF37, rgba(212,175,55,0.3))' }} />
                  <div className="flex-1 rounded-t-sm transition-all" style={{ height: `${(d.revenue / 150) * 100}%`, background: 'linear-gradient(180deg, #22C55E, rgba(34,197,94,0.3))' }} />
                </div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>{d.month}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Report Cards */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>Rapports Disponibles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {reportCards.map((report) => (
              <div key={report.id} className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }}>
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${report.color}20` }}>
                    <i className={`${report.icon} text-xl`} style={{ color: report.color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>{report.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{report.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs mb-3" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                  <span><i className="ri-time-line mr-1" />Généré le {report.lastGenerated}</span>
                  <span>{report.size}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleGenerate(report.id)} className="flex-1 py-2 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-all" style={{ background: generating === report.id ? 'rgba(212,175,55,0.1)' : 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: generating === report.id ? '#D4AF37' : '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
                    {generating === report.id ? <><i className="ri-loader-4-line animate-spin mr-1" />Génération...</> : <><i className="ri-refresh-line mr-1" />Générer</>}
                  </button>
                  <button className="flex-1 py-2 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'Poppins, sans-serif' }}>
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
