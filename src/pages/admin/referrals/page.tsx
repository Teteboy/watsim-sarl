import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api';

import AdminLayout from '@/components/feature/AdminLayout';
import { cardStyle, inputStyle, primaryButtonStyle, tableHeaderStyle, tableRowStyle } from '@/styles/admin-theme';

interface Referral {
  id: string;
  referrer: { id: string; fullName: string; phone: string; email: string };
  referred: { id: string; fullName: string; phone: string; email: string };
  status: string;
  firstRewardAmount: number;
  firstRewardPaid: boolean;
  firstRewardPaidAt: string | null;
  secondRewardAmount: number;
  secondRewardPaid: boolean;
  secondRewardPaidAt: string | null;
  purchase: { id: string; totalAmount: number; status: string } | null;
  createdAt: string;
}

interface ReferralStats {
  overview: {
    totalReferrals: number;
    totalFirstRewardsPaid: number;
    totalSecondRewardsPaid: number;
    totalFirstRewardsAmount: number;
    totalSecondRewardsAmount: number;
    totalRewardsAmount: number;
  };
  statusBreakdown: { status: string; count: number }[];
  topReferrers: {
    referrer: { id: string; fullName: string; phone: string };
    referralCount: number;
    totalRewards: number;
  }[];
}

export default function AdminReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const limit = 20;

  useEffect(() => {
    loadReferrals();
    loadStats();
  }, [page, search, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadReferrals = async () => {
    try {
      setLoading(true);
      const result = await adminApi.referrals({ page, limit, search, status });
      setReferrals(result.items || []);
      setTotal(result.total || 0);
    } catch (err) {
      console.error('Failed to load referrals:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const result = await adminApi.referralStats();
      setStats(result);
    } catch (err) {
      console.error('Failed to load referral stats:', err);
    }
  };

  const formatAmount = (amount: number) => `${amount.toLocaleString()} XAF`;

  const totalPages = Math.ceil(total / limit);

  const statusBadgeStyle = (s: string) => {
    if (s === 'COMPLETED') return { background: 'rgba(34,197,94,0.12)', color: '#16A34A' };
    if (s === 'FIRST_REWARDED') return { background: 'rgba(59,130,246,0.12)', color: '#2563EB' };
    return { background: 'rgba(249,115,22,0.12)', color: '#EA580C' };
  };

  const kpiCards = stats ? [
    { label: 'Total parrainages', value: stats.overview.totalReferrals, icon: 'ri-team-line', color: '#4A9EFF' },
    { label: '1ères récompenses', value: stats.overview.totalFirstRewardsPaid, sub: formatAmount(stats.overview.totalFirstRewardsAmount), icon: 'ri-gift-line', color: '#22C55E' },
    { label: '2èmes récompenses', value: stats.overview.totalSecondRewardsPaid, sub: formatAmount(stats.overview.totalSecondRewardsAmount), icon: 'ri-line-chart-line', color: '#A855F7' },
    { label: 'Total récompenses', value: formatAmount(stats.overview.totalRewardsAmount), icon: 'ri-coin-line', color: '#F97316' },
  ] : [];

  return (
    <AdminLayout breadcrumb={['Admin', 'Parrainages']}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1a2e', fontFamily: 'Montserrat, sans-serif' }}>Programme de Parrainage</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{total} parrainages au total</p>
        </div>

        {/* KPI Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map(k => (
              <div key={k.label} className="rounded-2xl p-4" style={cardStyle}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${k.color}15` }}>
                    <i className={`${k.icon} text-lg`} style={{ color: k.color }} />
                  </div>
                  <div>
                    <p className="font-bold text-lg" style={{ color: '#1a1a2e', fontFamily: 'Montserrat, sans-serif' }}>{k.value}</p>
                    {k.sub && <p className="text-xs" style={{ color: k.color, fontFamily: 'Poppins, sans-serif' }}>{k.sub}</p>}
                    <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{k.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Breakdown & Top Referrers */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h3 className="font-semibold mb-4" style={{ color: '#1a1a2e', fontFamily: 'Montserrat, sans-serif' }}>Répartition par statut</h3>
              <div className="space-y-2">
                {stats.statusBreakdown.map((item) => (
                  <div key={item.status} className="flex justify-between items-center">
                    <span className="px-2 py-1 rounded-full text-xs font-medium" style={statusBadgeStyle(item.status)}>{item.status}</span>
                    <span className="font-semibold text-sm" style={{ color: '#1a1a2e', fontFamily: 'Montserrat, sans-serif' }}>{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h3 className="font-semibold mb-4" style={{ color: '#1a1a2e', fontFamily: 'Montserrat, sans-serif' }}>Top Parrains</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {stats.topReferrers.map((item, idx) => (
                  <div key={item.referrer.id} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#1a1a2e', fontFamily: 'Poppins, sans-serif' }}>{idx + 1}. {item.referrer.fullName || item.referrer.phone}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{item.referralCount} filleuls</p>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: '#22C55E', fontFamily: 'Montserrat, sans-serif' }}>{formatAmount(item.totalRewards)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px] relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#9CA3AF' }} />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
            style={inputStyle}
          >
            <option value="">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="FIRST_REWARDED">1ère récompense payée</option>
            <option value="COMPLETED">Complété</option>
          </select>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={tableHeaderStyle}>
                  {['Parrain', 'Filleul', 'Statut', '1ère Récompense', '2ème Récompense', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                    <i className="ri-loader-4-line animate-spin text-xl mr-2" style={{ color: '#4A9EFF' }} />Chargement...
                  </td></tr>
                ) : referrals.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>Aucun parrainage trouvé</td></tr>
                ) : (
                  referrals.map((ref, idx) => (
                    <tr key={ref.id} className="transition-colors hover:bg-gray-50" style={idx < referrals.length - 1 ? { borderBottom: '1px solid #F3F4F6' } : {}}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium" style={{ color: '#1a1a2e', fontFamily: 'Poppins, sans-serif' }}>{ref.referrer.fullName || 'N/A'}</p>
                        <p className="text-xs" style={{ color: '#6B7280' }}>{ref.referrer.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium" style={{ color: '#1a1a2e', fontFamily: 'Poppins, sans-serif' }}>{ref.referred.fullName || 'N/A'}</p>
                        <p className="text-xs" style={{ color: '#6B7280' }}>{ref.referred.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium" style={statusBadgeStyle(ref.status)}>{ref.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium" style={{ color: '#1a1a2e', fontFamily: 'Poppins, sans-serif' }}>{formatAmount(ref.firstRewardAmount)}</p>
                        {ref.firstRewardPaid && <p className="text-xs" style={{ color: '#22C55E' }}>Payé</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium" style={{ color: '#1a1a2e', fontFamily: 'Poppins, sans-serif' }}>{formatAmount(ref.secondRewardAmount)}</p>
                        {ref.secondRewardPaid ? (
                          <p className="text-xs" style={{ color: '#22C55E' }}>Payé</p>
                        ) : ref.purchase ? (
                          <p className="text-xs" style={{ color: '#6B7280' }}>Achat: {formatAmount(ref.purchase.totalAmount)}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                        {new Date(ref.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F3F4F6' }}>
              <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} sur {total}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40 cursor-pointer" style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }}>
                  <i className="ri-arrow-left-s-line" />
                </button>
                <span className="px-3 py-1.5 text-xs" style={{ color: '#6B7280' }}>{page} / {totalPages}</span>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40 cursor-pointer" style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }}>
                  <i className="ri-arrow-right-s-line" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
