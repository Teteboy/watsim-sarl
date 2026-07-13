import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';

interface CashWithdrawal {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  userEmail?: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  providerRef: string | null;
  createdAt: string;
  metadata?: {
    phoneNumber?: string;
    adminApproved?: boolean;
    approvedAt?: string;
    approvedBy?: string;
    adminRejected?: boolean;
    rejectedAt?: string;
    rejectedBy?: string;
    rejectReason?: string;
    payoutResult?: {
      message?: string;
    };
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };
const inputStyle = { background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' };

export default function AdminCashWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<CashWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { toasts, addToast, removeToast } = useToast();
  const limit = 20;

  useEffect(() => {
    loadWithdrawals();
  }, [page, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      const result = await adminApi.cashWithdrawals({ page, limit, status });
      setWithdrawals(result.withdrawals || []);
      setPagination(result.pagination || null);
    } catch (err) {
      console.error('Failed to load cash withdrawals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setProcessing(id);
      await adminApi.approveCashWithdrawal(id);
      await loadWithdrawals();
      addToast('success', 'Retrait approuvé', 'Le retrait a été approuvé et traité.');
    } catch (err: any) {
      addToast('error', 'Échec', err?.message || 'Impossible d\'approuver ce retrait.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setProcessing(id);
      await adminApi.rejectCashWithdrawal(id, rejectReason);
      setShowRejectModal(null);
      setRejectReason('');
      await loadWithdrawals();
      addToast('success', 'Retrait rejeté', 'La demande de retrait a été rejetée.');
    } catch (err: any) {
      addToast('error', 'Échec', err?.message || 'Impossible de rejeter ce retrait.');
    } finally {
      setProcessing(null);
    }
  };

  const formatAmount = (amount: number) => `${amount.toLocaleString()} XAF`;
  const formatDate = (date: string) => new Date(date).toLocaleString();

  const getStatusStyle = (status: string): React.CSSProperties => {
    switch (status) {
      case 'PENDING': return { background: 'rgba(245,158,11,0.1)', color: '#D97706' };
      case 'COMPLETED': return { background: 'rgba(34,197,94,0.1)', color: '#16A34A' };
      case 'FAILED': return { background: 'rgba(239,68,68,0.1)', color: '#DC2626' };
      default: return { background: '#F5FAF5', color: '#6B7280' };
    }
  };

  const getStatusIcon = (s: string) => {
    if (s === 'PENDING') return 'ri-time-line';
    if (s === 'COMPLETED') return 'ri-checkbox-circle-line';
    if (s === 'FAILED') return 'ri-close-circle-line';
    return 'ri-question-line';
  };

  const getStatusLabel = (s: string) => {
    if (s === 'PENDING') return 'En attente';
    if (s === 'COMPLETED') return 'Approuvé';
    if (s === 'FAILED') return 'Rejeté';
    return s;
  };

  const filteredWithdrawals = search
    ? withdrawals.filter(w => 
        w.userName?.toLowerCase().includes(search.toLowerCase()) ||
        w.userPhone?.toLowerCase().includes(search.toLowerCase()) ||
        w.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
        w.providerRef?.toLowerCase().includes(search.toLowerCase())
      )
    : withdrawals;

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Finance', 'Retraits Cash']}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Demandes de Retrait Cash</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Gérer et approuver les demandes de retrait des utilisateurs</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'En attente', value: withdrawals.filter(w => w.status === 'PENDING').length, icon: 'ri-time-line', color: '#D97706', bg: 'rgba(245,158,11,0.1)' },
            { label: 'Approuvés', value: withdrawals.filter(w => w.status === 'COMPLETED').length, icon: 'ri-checkbox-circle-line', color: '#16A34A', bg: 'rgba(34,197,94,0.1)' },
            { label: 'Rejetés', value: withdrawals.filter(w => w.status === 'FAILED').length, icon: 'ri-close-circle-line', color: '#DC2626', bg: 'rgba(239,68,68,0.1)' },
            { label: 'Montant Total', value: formatAmount(withdrawals.reduce((s, w) => s + w.amount, 0)), icon: 'ri-money-dollar-circle-line', color: '#4DB049', bg: 'rgba(77,176,89,0.1)' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 flex items-center gap-4" style={cardStyle}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                <i className={`${s.icon} text-xl`} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{s.label}</p>
                <p className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-2xl p-4 flex flex-col sm:flex-row gap-3" style={cardStyle}>
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#9CA3AF' }} />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone, email ou référence..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="px-4 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
            style={inputStyle}
          >
            <option value="">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="COMPLETED">Approuvés</option>
            <option value="FAILED">Rejetés</option>
          </select>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #E8F2F1' }}>
                  {['Utilisateur', 'Montant', 'Statut', 'Référence', 'Date', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif', background: '#F5FAF5' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-16 text-center">
                    <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#4DB049' }} />
                    <p className="mt-2 text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Chargement...</p>
                  </td></tr>
                ) : filteredWithdrawals.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center">
                    <i className="ri-inbox-line text-3xl" style={{ color: '#9CA3AF' }} />
                    <p className="mt-2 text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Aucune demande trouvée</p>
                  </td></tr>
                ) : filteredWithdrawals.map(w => (
                  <tr key={w.id} style={{ borderBottom: '1px solid #F0F7F0' }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(77,176,89,0.1)' }}>
                          <i className="ri-user-line text-sm" style={{ color: '#4DB049' }} />
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{w.userName || 'Inconnu'}</p>
                          <p className="text-xs" style={{ color: '#6B7280' }}>{w.userPhone || w.userEmail || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{formatAmount(w.amount)}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{w.metadata?.phoneNumber ? `→ ${w.metadata.phoneNumber}` : 'Retrait cash'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={getStatusStyle(w.status)}>
                        <i className={`${getStatusIcon(w.status)} text-xs`} />
                        {getStatusLabel(w.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs font-mono" style={{ color: '#6B7280' }}>{w.providerRef || '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{formatDate(w.createdAt)}</p>
                    </td>
                    <td className="px-5 py-4">
                      {w.status === 'PENDING' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(w.id)}
                            disabled={processing === w.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
                          >
                            {processing === w.id ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-checkbox-circle-line" />}
                            Approuver
                          </button>
                          <button
                            onClick={() => setShowRejectModal(w.id)}
                            disabled={processing === w.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap disabled:opacity-50"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.2)', fontFamily: 'Poppins, sans-serif' }}
                          >
                            <i className="ri-close-circle-line" />Rejeter
                          </button>
                        </div>
                      )}
                      {w.status === 'COMPLETED' && (
                        <span className="text-xs" style={{ color: '#16A34A', fontFamily: 'Poppins, sans-serif' }}>
                          <i className="ri-checkbox-circle-line mr-1" />
                          {w.metadata?.approvedAt ? new Date(w.metadata.approvedAt).toLocaleDateString('fr-FR') : 'Approuvé'}
                        </span>
                      )}
                      {w.status === 'FAILED' && (
                        <span className="text-xs" style={{ color: '#DC2626', fontFamily: 'Poppins, sans-serif' }} title={w.metadata?.rejectReason}>
                          <i className="ri-close-circle-line mr-1" />Rejeté
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid #E8F2F1' }}>
              <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                {((page - 1) * limit) + 1}–{Math.min(page * limit, pagination.total)} sur {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-40 cursor-pointer" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                  <i className="ri-arrow-left-s-line text-sm" style={{ color: '#6B7280' }} />
                </button>
                <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Page {page} / {pagination.totalPages}</span>
                <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-40 cursor-pointer" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                  <i className="ri-arrow-right-s-line text-sm" style={{ color: '#6B7280' }} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => { setShowRejectModal(null); setRejectReason(''); }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={cardStyle} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Rejeter la demande</h2>
              <button onClick={() => { setShowRejectModal(null); setRejectReason(''); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Indiquez la raison du rejet. L'utilisateur sera notifié.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Raison du rejet..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={inputStyle}
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowRejectModal(null); setRejectReason(''); }} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button
                onClick={() => showRejectModal && handleReject(showRejectModal)}
                disabled={processing === showRejectModal}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
              >
                {processing === showRejectModal ? <i className="ri-loader-4-line animate-spin mr-1" /> : <i className="ri-close-circle-line mr-1" />}
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </AdminLayout>
  );
}
