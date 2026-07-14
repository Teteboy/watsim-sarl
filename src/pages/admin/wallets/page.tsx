import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import { adminApi } from '@/lib/api';

const fmtFcfa = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M FCFA`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(0)}K FCFA`
    : `${n} FCFA`;

const merchantStatusColors: Record<string, string> = { ACTIVE: '#22C55E', PENDING: '#F97316', SUSPENDED: '#EF4444' };
const merchantStatusLabels: Record<string, string> = { ACTIVE: 'Actif', PENDING: 'En attente', SUSPENDED: 'Suspendu' };

const txTypeLabels: Record<string, string> = {
  PURCHASE: 'Achat BNPL', REPAYMENT: 'Remboursement', DEPOSIT: 'Dépôt wallet',
  WITHDRAWAL: 'Retrait', REFUND: 'Remboursement client', TRANSFER_IN: 'Virement reçu', TRANSFER_OUT: 'Virement envoyé',
};
const txIsCredit = (type: string) => ['DEPOSIT', 'TRANSFER_IN', 'REPAYMENT'].includes(type);

const payoutStatusColors: Record<string, string> = { PENDING: '#F97316', APPROVED: '#4A9EFF', PAID: '#22C55E', REJECTED: '#EF4444' };
const payoutStatusLabels: Record<string, string> = { PENDING: 'En attente', APPROVED: 'Approuvé', PAID: 'Payé', REJECTED: 'Rejeté' };

export default function AdminWalletsPage() {
  const [activeTab, setActiveTab] = useState<'wallets' | 'payouts'>('wallets');

  // Wallets tab
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

  // Payouts tab
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutTotal, setPayoutTotal] = useState(0);
  const [payoutStatus, setPayoutStatus] = useState('');
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<any>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [selectedPayoutIds, setSelectedPayoutIds] = useState<Set<string>>(new Set());
  const [bulkPayoutLoading, setBulkPayoutLoading] = useState(false);

  const { toasts, addToast, removeToast } = useToast();
  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const payoutTotalPages = Math.max(1, Math.ceil(payoutTotal / limit));

  const loadWallets = useCallback(async (p: number = 1) => {
    setLoading(true);
    try {
      const res = await adminApi.wallets({ page: p, limit, search: search || undefined });
      setWallets(res.items || []);
      setTotal(res.total || 0);
      setPage(p);
    } catch { setWallets([]); }
    finally { setLoading(false); }
  }, [search]);

  const loadPayouts = useCallback(async (p: number = 1) => {
    setPayoutsLoading(true);
    try {
      const res = await adminApi.listPayoutRequests({ page: p, limit, status: payoutStatus || undefined });
      setPayouts(res.items || []);
      setPayoutTotal(res.total || 0);
      setPayoutPage(p);
    } catch { setPayouts([]); }
    finally { setPayoutsLoading(false); }
  }, [payoutStatus]);

  useEffect(() => { loadWallets(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === 'payouts') loadPayouts(1); }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (w: any) => {
    setSelectedWallet(w);
    setWalletDetail(null);
    setDetailLoading(true);
    try {
      const detail = await adminApi.merchantWallet(w.merchantId);
      setWalletDetail(detail);
    } catch { setWalletDetail(null); }
    finally { setDetailLoading(false); }
  };

  const handleCredit = async () => {
    if (!showCreditModal) return;
    const amount = Number(creditForm.amount);
    if (!amount || amount === 0) { addToast('error', 'Montant invalide', 'Veuillez saisir un montant.'); return; }
    setCreditLoading(true);
    try {
      await adminApi.creditMerchantWallet(showCreditModal.merchantId, amount, creditForm.note || undefined);
      addToast('success', amount > 0 ? 'Wallet crédité' : 'Wallet débité', `${fmtFcfa(Math.abs(amount))} ${amount > 0 ? 'ajoutés au' : 'retirés du'} wallet de ${showCreditModal.businessName}.`);
      setShowCreditModal(null);
      setCreditForm({ amount: '', note: '' });
      await loadWallets(page);
      if (selectedWallet?.merchantId === showCreditModal.merchantId) openDetail(showCreditModal);
    } catch (e: any) { addToast('error', 'Erreur', e?.message || 'Opération échouée.'); }
    finally { setCreditLoading(false); }
  };

  const handleApprovePayout = async (id: string, businessName: string) => {
    setActionLoading(id);
    try {
      await adminApi.approvePayout(id);
      addToast('success', 'Virement approuvé', `Le virement pour ${businessName} a été approuvé et le paiement CamPay initié.`);
      loadPayouts(payoutPage);
    } catch (e: any) { addToast('error', 'Erreur approbation', e?.message || 'Impossible d\'approuver.'); }
    finally { setActionLoading(null); }
  };

  const pendingPayouts = payouts.filter(p => p.status === 'PENDING');

  const togglePayoutSelect = (id: string) =>
    setSelectedPayoutIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleSelectAllPending = () =>
    setSelectedPayoutIds(prev => prev.size === pendingPayouts.length && pendingPayouts.length > 0
      ? new Set() : new Set(pendingPayouts.map(p => p.id)));

  const handleBulkApprove = async () => {
    if (selectedPayoutIds.size === 0) return;
    setBulkPayoutLoading(true);
    try {
      const res = await adminApi.bulkApprovePayouts(Array.from(selectedPayoutIds));
      addToast('success', 'Approbation groupée', `${res.succeeded} approuvé(s)${res.failed ? `, ${res.failed} échoué(s)` : ''}.`);
      setSelectedPayoutIds(new Set());
      loadPayouts(payoutPage);
    } catch { addToast('error', 'Erreur', 'Approbation groupée échouée.'); }
    finally { setBulkPayoutLoading(false); }
  };

  const handleBulkReject = async () => {
    if (selectedPayoutIds.size === 0) return;
    setBulkPayoutLoading(true);
    try {
      const res = await adminApi.bulkRejectPayouts(Array.from(selectedPayoutIds));
      addToast('success', 'Rejet groupé', `${res.succeeded} rejeté(s)${res.failed ? `, ${res.failed} échoué(s)` : ''}.`);
      setSelectedPayoutIds(new Set());
      loadPayouts(payoutPage);
    } catch { addToast('error', 'Erreur', 'Rejet groupé échoué.'); }
    finally { setBulkPayoutLoading(false); }
  };

  const handleRejectPayout = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      await adminApi.rejectPayout(rejectModal.id, rejectNote || undefined);
      addToast('success', 'Virement rejeté', `La demande de ${rejectModal.businessName} a été rejetée.`);
      setRejectModal(null);
      setRejectNote('');
      loadPayouts(payoutPage);
    } catch (e: any) { addToast('error', 'Erreur rejet', e?.message || 'Impossible de rejeter.'); }
    finally { setActionLoading(null); }
  };

  const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };
  const inputStyle = { background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' };
  const totalBalance = wallets.reduce((s, w) => s + (w.walletBalance || 0), 0);
  const pendingPayoutsCount = payouts.filter(p => p.status === 'PENDING').length;

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Finance', 'Wallets Commerciaux']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
              Finance Commerciaux
            </h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
              Wallets, soldes, virements CamPay des partenaires
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total commerciaux', value: total, icon: 'ri-store-2-line', color: '#4DB049' },
            { label: 'Solde total plateforme', value: fmtFcfa(totalBalance), icon: 'ri-wallet-3-line', color: '#22C55E' },
            { label: 'Solde moyen', value: fmtFcfa(wallets.length ? Math.round(totalBalance / wallets.length) : 0), icon: 'ri-bar-chart-line', color: '#4A9EFF' },
            { label: 'Virements en attente', value: pendingPayoutsCount, icon: 'ri-time-line', color: '#F97316' },
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

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'wallets' as const, label: 'Wallets', icon: 'ri-wallet-3-line' },
            { key: 'payouts' as const, label: 'Virements', icon: 'ri-bank-line', badge: pendingPayoutsCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all"
              style={{
                background: activeTab === tab.key ? 'linear-gradient(135deg, #014945, #027A74)' : '#F5FAF5',
                color: activeTab === tab.key ? '#FFFFFF' : '#6B7280',
                border: `1px solid ${activeTab === tab.key ? 'transparent' : '#E8F2F1'}`,
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              <i className={tab.icon} /> {tab.label}
              {tab.badge ? (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#F97316', color: '#FFFFFF' }}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ══ WALLETS TAB ══ */}
        {activeTab === 'wallets' && (
          <>
            {/* Search */}
            <div className="flex items-center gap-3" style={{ ...cardStyle, padding: '12px 16px', borderRadius: '16px' }}>
              <div className="flex items-center gap-2 flex-1" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', borderRadius: '8px', padding: '8px 12px' }}>
                <i className="ri-search-line text-sm" style={{ color: '#9CA3AF' }} />
                <input
                  type="text" placeholder="Rechercher par nom commercial..."
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadWallets(1)}
                  className="bg-transparent text-sm outline-none flex-1 placeholder:text-[#9CA3AF]"
                  style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                />
              </div>
              <button onClick={() => loadWallets(1)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
                style={{ background: 'rgba(77,176,89,0.15)', color: '#4DB049', border: '1px solid rgba(77,176,89,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-search-line mr-1" /> Rechercher
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden" style={cardStyle}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E8F2F1' }}>
                      {['Commercial', 'Propriétaire', 'Contact', 'Statut', 'Solde Wallet', 'Commandes', 'Produits', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} className="px-4 py-12 text-center"><i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#4DB049' }} /></td></tr>
                    ) : wallets.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-12 text-center"><p className="text-sm" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>Aucun résultat</p></td></tr>
                    ) : wallets.map((w, idx) => (
                      <tr key={w.merchantId} className="transition-colors hover:bg-gray-50"
                        style={{ borderBottom: idx < wallets.length - 1 ? '1px solid #F0F7F0' : 'none' }}>
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
                          <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                            style={{ background: `${merchantStatusColors[w.status] ?? '#6B7280'}20`, color: merchantStatusColors[w.status] ?? '#6B7280' }}>
                            {merchantStatusLabels[w.status] ?? w.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold whitespace-nowrap" style={{ color: '#4DB049', fontFamily: 'Montserrat, sans-serif' }}>{fmtFcfa(w.walletBalance)}</p>
                          <p className="text-[10px]" style={{ color: '#9CA3AF' }}>{w.currency}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-center" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>{w.totalOrders}</td>
                        <td className="px-4 py-3 text-sm text-center" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>{w.totalProducts}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openDetail(w)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" title="Voir détails">
                              <i className="ri-eye-line text-sm" style={{ color: '#4DB049' }} />
                            </button>
                            <button onClick={() => { setShowCreditModal(w); setCreditForm({ amount: '', note: '' }); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" title="Créditer / Débiter">
                              <i className="ri-wallet-line text-sm" style={{ color: '#4A9EFF' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #E8F2F1' }}>
                  <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Page {page}/{totalPages} — {total} commerciaux</p>
                  <div className="flex gap-1">
                    <button onClick={() => loadWallets(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 rounded text-sm disabled:opacity-40" style={{ background: '#F5FAF5', color: '#4DB049' }}>Précédent</button>
                    <button onClick={() => loadWallets(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1 rounded text-sm disabled:opacity-40" style={{ background: '#F5FAF5', color: '#4DB049' }}>Suivant</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ PAYOUTS TAB ══ */}
        {activeTab === 'payouts' && (
          <>
            {/* Filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={payoutStatus}
                onChange={(e) => { setPayoutStatus(e.target.value); loadPayouts(1); }}
                className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                style={inputStyle}
              >
                <option value="">Tous les statuts</option>
                <option value="PENDING">En attente</option>
                <option value="APPROVED">Approuvé</option>
                <option value="PAID">Payé</option>
                <option value="REJECTED">Rejeté</option>
              </select>
              <button onClick={() => loadPayouts(1)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
                style={{ background: 'rgba(77,176,89,0.15)', color: '#4DB049', border: '1px solid rgba(77,176,89,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-refresh-line mr-1" /> Actualiser
              </button>
            </div>

            {/* Bulk payout action bar */}
            {selectedPayoutIds.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl" style={{ background: 'rgba(77,176,89,0.1)', border: '1px solid #4DB049' }}>
                <span className="text-sm font-medium" style={{ color: '#014945' }}>{selectedPayoutIds.size} sélectionné(s)</span>
                <div className="flex gap-2 ml-auto">
                  <button onClick={handleBulkApprove} disabled={bulkPayoutLoading} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-60" style={{ background: '#22C55E20', color: '#22C55E', border: '1px solid #22C55E' }}>
                    {bulkPayoutLoading ? <i className="ri-loader-4-line animate-spin mr-1" /> : <i className="ri-check-double-line mr-1" />}Approuver
                  </button>
                  <button onClick={handleBulkReject} disabled={bulkPayoutLoading} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-60" style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF4444' }}>
                    <i className="ri-close-circle-line mr-1" />Rejeter
                  </button>
                  <button onClick={() => setSelectedPayoutIds(new Set())} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1' }}>Annuler</button>
                </div>
              </div>
            )}

            <div className="rounded-2xl overflow-hidden" style={cardStyle}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E8F2F1' }}>
                <div className="flex items-center gap-3">
                  {pendingPayouts.length > 0 && (
                    <input type="checkbox"
                      checked={selectedPayoutIds.size === pendingPayouts.length && pendingPayouts.length > 0}
                      onChange={toggleSelectAllPending}
                      className="accent-[#4DB049]"
                      title="Sélectionner tous les virements en attente"
                    />
                  )}
                  <h3 className="text-sm font-semibold" style={{ color: '#014945', fontFamily: 'Poppins, sans-serif' }}>
                    Demandes de virement ({payoutTotal})
                  </h3>
                </div>
                <div className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316', fontFamily: 'Poppins, sans-serif' }}>
                  <i className="ri-campfire-line mr-1" />Déclenche CamPay à l'approbation
                </div>
              </div>
              {payoutsLoading ? (
                <div className="py-12 text-center"><i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#4DB049' }} /></div>
              ) : payouts.length === 0 ? (
                <div className="py-12 text-center">
                  <i className="ri-bank-line text-3xl mb-3 block" style={{ color: '#E8F2F1' }} />
                  <p className="text-sm" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>Aucune demande de virement</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: '#F0F7F0' }}>
                  {payouts.map((p: any) => (
                    <div key={p.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors" style={{ background: selectedPayoutIds.has(p.id) ? 'rgba(77,176,89,0.04)' : undefined }}>
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {p.status === 'PENDING' && (
                          <input type="checkbox" checked={selectedPayoutIds.has(p.id)} onChange={() => togglePayoutSelect(p.id)} className="accent-[#4DB049] mt-1 flex-shrink-0" />
                        )}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${payoutStatusColors[p.status] ?? '#6B7280'}15` }}>
                          <i className="ri-send-plane-line text-base" style={{ color: payoutStatusColors[p.status] ?? '#6B7280' }} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold" style={{ color: '#1A2B1F', fontFamily: 'Montserrat, sans-serif' }}>{fmtFcfa(p.amount)}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{ background: `${payoutStatusColors[p.status] ?? '#6B7280'}15`, color: payoutStatusColors[p.status] ?? '#6B7280' }}>
                              {payoutStatusLabels[p.status] ?? p.status}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>
                            <span className="font-medium">{p.merchant?.businessName ?? '—'}</span>
                            {' · '}{p.provider?.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>
                            Demandé le {new Date(p.requestedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {p.processedAt && ` · Traité le ${new Date(p.processedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                          </p>
                          {p.note && <p className="text-[10px] mt-0.5 italic" style={{ color: '#6B7280' }}>{p.note}</p>}
                        </div>
                      </div>
                      {p.status === 'PENDING' && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleApprovePayout(p.id, p.merchant?.businessName)}
                            disabled={actionLoading === p.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-60 whitespace-nowrap"
                            style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)', fontFamily: 'Poppins, sans-serif' }}
                          >
                            {actionLoading === p.id ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-check-line" />} Approuver
                          </button>
                          <button
                            onClick={() => { setRejectModal(p); setRejectNote(''); }}
                            disabled={actionLoading === p.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-60 whitespace-nowrap"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', fontFamily: 'Poppins, sans-serif' }}
                          >
                            <i className="ri-close-line" /> Rejeter
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {payoutTotalPages > 1 && (
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #E8F2F1' }}>
                  <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Page {payoutPage}/{payoutTotalPages}</p>
                  <div className="flex gap-1">
                    <button onClick={() => loadPayouts(Math.max(1, payoutPage - 1))} disabled={payoutPage === 1} className="px-3 py-1 rounded text-sm disabled:opacity-40" style={{ background: '#F5FAF5', color: '#4DB049' }}>Précédent</button>
                    <button onClick={() => loadPayouts(Math.min(payoutTotalPages, payoutPage + 1))} disabled={payoutPage === payoutTotalPages} className="px-3 py-1 rounded text-sm disabled:opacity-40" style={{ background: '#F5FAF5', color: '#4DB049' }}>Suivant</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Wallet Detail Modal */}
      {selectedWallet && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }} onClick={() => setSelectedWallet(null)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid #E8F2F1' }}>
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                Wallet — {selectedWallet.businessName}
              </h2>
              <button onClick={() => setSelectedWallet(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(77,176,89,0.08)', border: '1px solid rgba(77,176,89,0.2)' }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Solde actuel</p>
                <p className="text-3xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                  {fmtFcfa(walletDetail?.walletBalance ?? selectedWallet.walletBalance)}
                </p>
                <button onClick={() => { setShowCreditModal(selectedWallet); setCreditForm({ amount: '', note: '' }); }}
                  className="mt-3 px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                  style={{ background: 'rgba(77,176,89,0.15)', color: '#4DB049', border: '1px solid rgba(77,176,89,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                  <i className="ri-wallet-line mr-1" /> Créditer / Débiter
                </button>
              </div>
              {detailLoading ? (
                <div className="text-center py-8"><i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#4DB049' }} /></div>
              ) : walletDetail ? (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Transactions récentes</p>
                    {!walletDetail.transactions?.length ? (
                      <p className="text-xs text-center py-4" style={{ color: '#9CA3AF' }}>Aucune transaction</p>
                    ) : (
                      <div className="space-y-1.5">
                        {walletDetail.transactions.slice(0, 10).map((tx: any) => {
                          const isCredit = txIsCredit(tx.type);
                          return (
                            <div key={tx.id} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: '#F5FAF5' }}>
                              <div>
                                <p className="text-xs font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{txTypeLabels[tx.type] ?? tx.type}</p>
                                <p className="text-[10px]" style={{ color: '#9CA3AF' }}>
                                  {new Date(tx.createdAt).toLocaleDateString('fr-FR')} {tx.provider ? `· ${tx.provider}` : ''}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-semibold" style={{ color: isCredit ? '#22C55E' : '#F97316', fontFamily: 'Montserrat, sans-serif' }}>
                                  {isCredit ? '+' : '-'}{fmtFcfa(Math.abs(tx.amount))}
                                </span>
                                <p className="text-[10px]" style={{ color: tx.status === 'COMPLETED' ? '#22C55E' : tx.status === 'FAILED' ? '#EF4444' : '#F97316' }}>{tx.status}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Demandes de virement</p>
                    {!walletDetail.payouts?.length ? (
                      <p className="text-xs text-center py-4" style={{ color: '#9CA3AF' }}>Aucune demande</p>
                    ) : (
                      <div className="space-y-1.5">
                        {walletDetail.payouts.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: '#F5FAF5' }}>
                            <div>
                              <p className="text-xs font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{fmtFcfa(p.amount)}</p>
                              <p className="text-[10px]" style={{ color: '#9CA3AF' }}>{p.provider?.replace(/_/g, ' ')} · {new Date(p.requestedAt).toLocaleDateString('fr-FR')}</p>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${payoutStatusColors[p.status] ?? '#6B7280'}15`, color: payoutStatusColors[p.status] ?? '#6B7280' }}>
                              {payoutStatusLabels[p.status] ?? p.status}
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
        <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowCreditModal(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Ajuster le Wallet</h2>
              <button onClick={() => setShowCreditModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'rgba(77,176,89,0.08)', border: '1px solid rgba(77,176,89,0.2)' }}>
              <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{showCreditModal.businessName}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                Solde : {fmtFcfa(walletDetail?.walletBalance ?? showCreditModal.walletBalance)}
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Montant (FCFA) — positif pour créditer, négatif pour débiter</label>
                <input type="number" value={creditForm.amount} onChange={(e) => setCreditForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Ex: 50000 ou -10000" className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Note (optionnel)</label>
                <input type="text" value={creditForm.note} onChange={(e) => setCreditForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Raison de l'ajustement" className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreditModal(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
                style={{ background: '#F5FAF5', color: '#374151', border: '1px solid #D1E8D1', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleCredit} disabled={creditLoading} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-60"
                style={{ background: '#014945', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                {creditLoading ? <><i className="ri-loader-4-line animate-spin mr-1" />Traitement…</> : <><i className="ri-check-line mr-1" />Confirmer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Payout Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setRejectModal(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#EF4444', fontFamily: 'Montserrat, sans-serif' }}>Rejeter le virement</h2>
              <button onClick={() => setRejectModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{rejectModal.merchant?.businessName}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: '#EF4444', fontFamily: 'Montserrat, sans-serif' }}>{fmtFcfa(rejectModal.amount)}</p>
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Raison du rejet (optionnel)</label>
              <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3}
                placeholder="Ex: Solde insuffisant, informations incorrectes..."
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={inputStyle} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
                style={{ background: '#F5FAF5', color: '#374151', border: '1px solid #D1E8D1', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleRejectPayout} disabled={actionLoading === rejectModal?.id} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-60"
                style={{ background: '#EF4444', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                {actionLoading === rejectModal?.id ? <><i className="ri-loader-4-line animate-spin mr-1" />Traitement…</> : <><i className="ri-close-line mr-1" />Confirmer le rejet</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </AdminLayout>
  );
}
