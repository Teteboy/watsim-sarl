import { useState, useEffect } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import { adminApi } from '@/lib/api';

const fmtFcfa = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M FCFA`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(0)}K FCFA`
    : `${n} FCFA`;

const statusColors: Record<string, string> = { ACTIVE: '#22C55E', PENDING: '#F97316', SUSPENDED: '#EF4444' };
const statusLabels: Record<string, string> = { ACTIVE: 'Actif', PENDING: 'En attente', SUSPENDED: 'Suspendu' };

export default function AdminWalletsPage() {
  const [wallets, setWallets] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState<any>(null);
  const [walletDetail, setWalletDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState<any>(null);
  const [creditForm, setCreditForm] = useState({ amount: '', note: '' });
  const [creditLoading, setCreditLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadWallets = async (p: number = 1) => {
    setLoading(true);
    try {
      const res = await adminApi.wallets({ page: p, limit, search: search || undefined });
      setWallets(res.items || []);
      setTotal(res.total || 0);
      setPage(p);
    } catch {
      setWallets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallets(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (w: any) => {
    setSelectedWallet(w);
    setWalletDetail(null);
    setDetailLoading(true);
    try {
      const detail = await adminApi.merchantWallet(w.merchantId);
      setWalletDetail(detail);
    } catch {
      setWalletDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCredit = async () => {
    if (!showCreditModal) return;
    const amount = Number(creditForm.amount);
    if (!amount || amount === 0) {
      addToast('error', 'Montant invalide', 'Veuillez saisir un montant.');
      return;
    }
    setCreditLoading(true);
    try {
      await adminApi.creditMerchantWallet(showCreditModal.merchantId, amount, creditForm.note || undefined);
      addToast('success', amount > 0 ? 'Wallet crédité' : 'Wallet débité', `${fmtFcfa(Math.abs(amount))} ${amount > 0 ? 'ajoutés' : 'retirés'} du wallet de ${showCreditModal.businessName}.`);
      setShowCreditModal(null);
      setCreditForm({ amount: '', note: '' });
      await loadWallets(page);
      if (selectedWallet?.merchantId === showCreditModal.merchantId) {
        openDetail(showCreditModal);
      }
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Opération échouée.');
    } finally {
      setCreditLoading(false);
    }
  };

  const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };
  const inputStyle = { background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' };

  const totalBalance = wallets.reduce((s, w) => s + (w.walletBalance || 0), 0);

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Finance', 'Wallets Commerciaux']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
              Wallets Commerciaux
            </h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
              Gestion des soldes et virements des partenaires commerciaux
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total commerciaux', value: total, icon: 'ri-store-2-line', color: '#4DB049' },
            { label: 'Solde total plateforme', value: fmtFcfa(totalBalance), icon: 'ri-wallet-3-line', color: '#22C55E' },
            { label: 'Solde moyen', value: fmtFcfa(wallets.length ? Math.round(totalBalance / wallets.length) : 0), icon: 'ri-bar-chart-line', color: '#4A9EFF' },
            { label: 'Wallets actifs', value: wallets.filter(w => w.status === 'ACTIVE').length, icon: 'ri-checkbox-circle-line', color: '#A855F7' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3" style={cardStyle}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}20` }}>
                <i className={`${s.icon} text-lg`} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{s.value}</p>
                <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3" style={{ ...cardStyle, padding: '12px 16px', borderRadius: '16px' }}>
          <div className="flex items-center gap-2 flex-1" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', borderRadius: '8px', padding: '8px 12px' }}>
            <i className="ri-search-line text-sm" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <input
              type="text"
              placeholder="Rechercher par nom commercial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadWallets(1)}
              className="bg-transparent text-sm outline-none flex-1 placeholder:text-[#9CA3AF]"
              style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
            />
          </div>
          <button
            onClick={() => loadWallets(1)}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
            style={{ background: 'rgba(77,176,89,0.15)', color: '#4DB049', border: '1px solid rgba(77,176,89,0.3)', fontFamily: 'Poppins, sans-serif' }}
          >
            <i className="ri-search-line mr-1" /> Rechercher
          </button>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #E8F2F1' }}>
                  {['Commercial', 'Propriétaire', 'Contact', 'Statut', 'Solde Wallet', 'Commandes', 'Produits', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#4DB049' }} />
                    </td>
                  </tr>
                ) : wallets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>Aucun résultat</p>
                    </td>
                  </tr>
                ) : (
                  wallets.map((w, idx) => (
                    <tr
                      key={w.merchantId}
                      className="transition-colors hover:bg-gray-50"
                      style={{ borderBottom: idx < wallets.length - 1 ? '1px solid #F0F7F0' : 'none' }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: 'rgba(77,176,89,0.15)', color: '#4DB049' }}>
                            {w.businessName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium whitespace-nowrap" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{w.businessName}</p>
                            <p className="text-[10px] font-mono" style={{ color: '#9CA3AF' }}>{w.merchantId.slice(0, 8)}…</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>{w.ownerName || '—'}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs whitespace-nowrap" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{w.email}</p>
                        <p className="text-xs" style={{ color: '#9CA3AF' }}>{w.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: `${statusColors[w.status] ?? '#6B7280'}20`, color: statusColors[w.status] ?? '#6B7280' }}>
                          {statusLabels[w.status] ?? w.status}
                        </span>
                      </td>
                        <td className="px-4 py-3">
                        <p className="text-sm font-semibold whitespace-nowrap" style={{ color: '#4DB049', fontFamily: 'Montserrat, sans-serif' }}>
                          {fmtFcfa(w.walletBalance)}
                        </p>
                        <p className="text-[10px]" style={{ color: '#9CA3AF' }}>{w.currency}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-center" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>{w.totalOrders}</td>
                      <td className="px-4 py-3 text-sm text-center" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>{w.totalProducts}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openDetail(w)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                            title="Voir détails"
                          >
                            <i className="ri-eye-line text-sm" style={{ color: '#4DB049' }} />
                          </button>
                          <button
                            onClick={() => { setShowCreditModal(w); setCreditForm({ amount: '', note: '' }); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                            title="Créditer / Débiter"
                          >
                            <i className="ri-wallet-line text-sm" style={{ color: '#4A9EFF' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                Page {page} / {totalPages} — {total} commerciaux
              </p>
              <div className="flex gap-1">
                <button onClick={() => loadWallets(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 rounded text-sm disabled:opacity-40" style={{ background: '#F5FAF5', color: '#4DB049' }}>
                  Précédent
                </button>
                <button onClick={() => loadWallets(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1 rounded text-sm disabled:opacity-40" style={{ background: '#F5FAF5', color: '#4DB049' }}>
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Wallet Detail Side Panel */}
      {selectedWallet && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }} onClick={() => setSelectedWallet(null)}>
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: '#014945', border: '1px solid rgba(77,176,89,0.25)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid #E8F2F1' }}>
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                Wallet — {selectedWallet.businessName}
              </h2>
              <button onClick={() => setSelectedWallet(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {/* Balance */}
              <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(77,176,89,0.1)', border: '1px solid rgba(77,176,89,0.2)' }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Solde actuel</p>
                <p className="text-3xl font-bold" style={{ color: '#4DB049', fontFamily: 'Montserrat, sans-serif' }}>
                  {fmtFcfa(walletDetail?.walletBalance ?? selectedWallet.walletBalance)}
                </p>
                <button
                  onClick={() => { setShowCreditModal(selectedWallet); setCreditForm({ amount: '', note: '' }); }}
                  className="mt-3 px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                  style={{ background: 'rgba(77,176,89,0.2)', color: '#4DB049', border: '1px solid rgba(77,176,89,0.3)', fontFamily: 'Poppins, sans-serif' }}
                >
                  <i className="ri-wallet-line mr-1" /> Créditer / Débiter
                </button>
              </div>

              {detailLoading ? (
                <div className="text-center py-8">
                  <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#4DB049' }} />
                </div>
              ) : walletDetail ? (
                <>
                  {/* Recent transactions */}
                  <div>
                    <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                      Transactions récentes
                    </p>
                    {!walletDetail.transactions?.length ? (
                      <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Aucune transaction</p>
                    ) : (
                      <div className="space-y-2">
                        {walletDetail.transactions.slice(0, 8).map((tx: any) => (
                          <div key={tx.id} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div>
                              <p className="text-xs font-medium text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{tx.type}</p>
                              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <span
                              className="text-xs font-medium"
                              style={{ color: tx.type === 'DEPOSIT' ? '#22C55E' : '#F97316', fontFamily: 'Montserrat, sans-serif' }}
                            >
                              {tx.type === 'DEPOSIT' ? '+' : '-'}{fmtFcfa(tx.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Payout requests */}
                  <div>
                    <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                      Demandes de virement
                    </p>
                    {!walletDetail.payouts?.length ? (
                      <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Aucune demande</p>
                    ) : (
                      <div className="space-y-2">
                        {walletDetail.payouts.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div>
                              <p className="text-xs font-medium text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{fmtFcfa(p.amount)}</p>
                              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                {p.provider?.replace(/_/g, ' ')} · {new Date(p.requestedAt).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{ background: `${payoutStatusMap[p.status] ?? '#6B7280'}18`, color: payoutStatusMap[p.status] ?? '#6B7280' }}
                            >
                              {p.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Credit / Debit Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={() => setShowCreditModal(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: '#014945', border: '1px solid rgba(77,176,89,0.25)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                Ajuster le Wallet
              </h2>
              <button onClick={() => setShowCreditModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #E8F2F1' }}>
              <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{showCreditModal.businessName}</p>
              <p className="text-lg font-bold text-white mt-0.5" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Solde : {fmtFcfa(walletDetail?.walletBalance ?? showCreditModal.walletBalance)}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  Montant (FCFA) — positif pour créditer, négatif pour débiter
                </label>
                <input
                  type="number"
                  value={creditForm.amount}
                  onChange={(e) => setCreditForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Ex: 50000 ou -10000"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  Note (optionnel)
                </label>
                <input
                  type="text"
                  value={creditForm.note}
                  onChange={(e) => setCreditForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Raison de l'ajustement"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreditModal(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
                style={{ background: '#F5FAF5', color: '#374151', border: '1px solid #D1E8D1', fontFamily: 'Poppins, sans-serif' }}
              >
                Annuler
              </button>
              <button
                onClick={handleCredit}
                disabled={creditLoading}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-60"
                style={{ background: '#014945', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
              >
                {creditLoading ? <><i className="ri-loader-4-line animate-spin mr-1" />Traitement…</> : <><i className="ri-check-line mr-1" />Confirmer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </AdminLayout>
  );
}

const payoutStatusMap: Record<string, string> = {
  PENDING: '#F97316',
  APPROVED: '#4A9EFF',
  PAID: '#22C55E',
  REJECTED: '#EF4444',
};
