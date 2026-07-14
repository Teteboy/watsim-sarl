import { useState, useEffect } from 'react';
import MerchantLayout from '@/components/feature/MerchantLayout';
import Toast, { useToast } from '@/components/base/Toast';
import { merchantApi } from '@/lib/api';

const fmtFcfa = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M FCFA`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(0)}K FCFA`
    : `${n} FCFA`;

const txTypeLabels: Record<string, string> = {
  PURCHASE: 'Achat BNPL',
  REPAYMENT: 'Remboursement',
  DEPOSIT: 'Crédit wallet',
  WITHDRAWAL: 'Retrait',
  REFUND: 'Remboursement client',
  TRANSFER_IN: 'Virement reçu',
  TRANSFER_OUT: 'Virement envoyé',
};
const txIsCredit = (type: string) => ['DEPOSIT', 'TRANSFER_IN', 'REPAYMENT'].includes(type);
const txTypeColors: Record<string, string> = {
  PURCHASE: '#4A9EFF',
  REPAYMENT: '#22C55E',
  DEPOSIT: '#4DB049',
  WITHDRAWAL: '#F97316',
  REFUND: '#A855F7',
  TRANSFER_IN: '#22C55E',
  TRANSFER_OUT: '#F97316',
};
const txTypeIcons: Record<string, string> = {
  PURCHASE: 'ri-shopping-cart-line',
  REPAYMENT: 'ri-arrow-up-circle-line',
  DEPOSIT: 'ri-add-circle-line',
  WITHDRAWAL: 'ri-arrow-down-circle-line',
  REFUND: 'ri-refund-2-line',
  TRANSFER_IN: 'ri-arrow-left-down-line',
  TRANSFER_OUT: 'ri-arrow-right-up-line',
};
const statusColors: Record<string, string> = {
  COMPLETED: '#22C55E',
  PENDING: '#F97316',
  FAILED: '#EF4444',
  REVERSED: '#6B7280',
};
const payoutStatusColors: Record<string, string> = {
  PENDING: '#F97316',
  APPROVED: '#4A9EFF',
  PAID: '#22C55E',
  REJECTED: '#EF4444',
};

const PAYOUT_PROVIDERS = [
  { value: 'MTN_MOBILE_MONEY', label: 'MTN Mobile Money' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'BANK_TRANSFER', label: 'Virement Bancaire' },
];

export default function MerchantWalletPage() {
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transactions' | 'payouts'>('transactions');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ amount: '', provider: 'MTN_MOBILE_MONEY' });
  const [payoutLoading, setPayoutLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const loadWallet = async () => {
    try {
      setLoading(true);
      const data = await merchantApi.wallet();
      setWallet(data);
    } catch {
      setWallet(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, []);

  const handleRequestPayout = async () => {
    const amount = Number(payoutForm.amount);
    if (!amount || amount < 50000) {
      addToast('error', 'Montant invalide', 'Le montant minimum de retrait est de 50 000 FCFA.');
      return;
    }
    setPayoutLoading(true);
    try {
      await merchantApi.requestPayout(amount, payoutForm.provider);
      addToast('success', 'Demande envoyée', `Votre demande de virement de ${fmtFcfa(amount)} a été soumise.`);
      setShowPayoutModal(false);
      setPayoutForm({ amount: '', provider: 'MTN_MOBILE_MONEY' });
      await loadWallet();
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Impossible de soumettre la demande.');
    } finally {
      setPayoutLoading(false);
    }
  };

  const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };
  const inputStyle = { background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' };

  return (
    <MerchantLayout breadcrumb={['WATSIM', 'Finance', 'Wallet']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
              Mon Wallet
            </h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
              Solde, revenus et historique des transactions
            </p>
          </div>
          <button
            onClick={() => setShowPayoutModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
            style={{ background: '#014945', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
          >
            <i className="ri-arrow-down-circle-line" /> Demander un virement
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <i className="ri-loader-4-line text-4xl animate-spin" style={{ color: '#4DB049' }} />
              <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                Chargement du wallet…
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Balance Hero Card */}
            <div
              className="rounded-2xl p-6 relative overflow-hidden"
              style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}
            >
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(77,176,89,0.15)' }}>
                    <i className="ri-wallet-3-line text-2xl" style={{ color: '#4DB049' }} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                      Solde disponible
                    </p>
                    <p className="text-3xl font-bold mt-0.5" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                      {fmtFcfa(wallet?.balance ?? 0)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Revenus totaux', value: fmtFcfa(wallet?.totalRevenue ?? 0), icon: 'ri-money-cny-circle-line', color: '#22C55E' },
                    { label: 'Ce mois', value: fmtFcfa(wallet?.revenueThisMonth ?? 0), icon: 'ri-calendar-line', color: '#4A9EFF' },
                    { label: 'Virements en attente', value: fmtFcfa(wallet?.pendingPayout ?? 0), icon: 'ri-time-line', color: '#F97316' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl p-3" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <i className={item.icon} style={{ color: item.color, fontSize: '12px' }} />
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                          {item.label}
                        </p>
                      </div>
                      <p className="text-sm font-bold" style={{ color: '#1A2B1F', fontFamily: 'Montserrat, sans-serif' }}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              {[
                { key: 'transactions' as const, label: 'Transactions', icon: 'ri-exchange-line' },
                { key: 'payouts' as const, label: 'Virements', icon: 'ri-bank-line' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all"
                  style={{
                    background: activeTab === tab.key ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#F5FAF5',
                    color: activeTab === tab.key ? '#FFFFFF' : '#6B7280',
                    border: `1px solid ${activeTab === tab.key ? 'transparent' : '#E8F2F1'}`,
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  <i className={tab.icon} /> {tab.label}
                  {tab.key === 'transactions' && wallet?.transactions?.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: 'rgba(255,255,255,0.3)' }}>
                      {wallet.transactions.length}
                    </span>
                  )}
                  {tab.key === 'payouts' && wallet?.payouts?.filter((p: any) => p.status === 'PENDING').length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: 'rgba(249,115,22,0.3)', color: '#F97316' }}>
                      {wallet.payouts.filter((p: any) => p.status === 'PENDING').length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Transactions */}
            {activeTab === 'transactions' && (
              <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                <div className="px-5 py-4" style={{ borderBottom: '1px solid #E8F2F1' }}>
                  <h3 className="text-sm font-semibold" style={{ color: '#014945', fontFamily: 'Poppins, sans-serif' }}>
                    Historique des transactions
                  </h3>
                </div>
                {!wallet?.transactions?.length ? (
                  <div className="p-8 text-center">
                    <i className="ri-exchange-line text-3xl mb-3 block" style={{ color: '#E8F2F1' }} />
                    <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                      Aucune transaction pour le moment
                    </p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: '#F0F7F0' }}>
                    {wallet.transactions.map((tx: any) => (
                      <div key={tx.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${txTypeColors[tx.type] ?? '#6B7280'}18` }}
                          >
                            <i
                              className={`${txTypeIcons[tx.type] ?? 'ri-exchange-line'} text-base`}
                              style={{ color: txTypeColors[tx.type] ?? '#6B7280' }}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                              {txTypeLabels[tx.type] ?? tx.type}
                            </p>
                            <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                              {new Date(tx.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              {tx.provider && ` · ${tx.provider}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className="text-sm font-semibold"
                            style={{ color: txIsCredit(tx.type) ? '#22C55E' : '#F97316', fontFamily: 'Montserrat, sans-serif' }}
                          >
                            {txIsCredit(tx.type) ? '+' : '-'}
                            {fmtFcfa(Math.abs(tx.amount))}
                          </p>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{
                              background: `${statusColors[tx.status] ?? '#6B7280'}18`,
                              color: statusColors[tx.status] ?? '#6B7280',
                            }}
                          >
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Payouts */}
            {activeTab === 'payouts' && (
              <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E8F2F1' }}>
                  <h3 className="text-sm font-semibold" style={{ color: '#014945', fontFamily: 'Poppins, sans-serif' }}>
                    Demandes de virement
                  </h3>
                  <button
                    onClick={() => setShowPayoutModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap"
                    style={{ background: '#014945', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
                  >
                    <i className="ri-add-line" /> Nouveau virement
                  </button>
                </div>
                {!wallet?.payouts?.length ? (
                  <div className="p-8 text-center">
                    <i className="ri-bank-line text-3xl mb-3 block" style={{ color: '#D1E8D1' }} />
                    <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                      Aucune demande de virement
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>
                      Montant minimum : 50 000 FCFA
                    </p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    {wallet.payouts.map((p: any) => (
                      <div key={p.id} className="px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${payoutStatusColors[p.status] ?? '#6B7280'}18` }}
                          >
                            <i className="ri-send-plane-line text-base" style={{ color: payoutStatusColors[p.status] ?? '#6B7280' }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                              {fmtFcfa(p.amount)} — {p.provider?.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                              {new Date(p.requestedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {p.note && ` · ${p.note}`}
                            </p>
                          </div>
                        </div>
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{
                            background: `${payoutStatusColors[p.status] ?? '#6B7280'}18`,
                            color: payoutStatusColors[p.status] ?? '#6B7280',
                          }}
                        >
                          {p.status === 'PENDING' ? 'En attente' : p.status === 'PAID' ? 'Payé' : p.status === 'REJECTED' ? 'Rejeté' : p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Payout Request Modal */}
      {showPayoutModal && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowPayoutModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(1,73,69,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                Demande de virement
              </h2>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer"
                style={{ color: '#6B7280' }}
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            <div className="p-3 rounded-xl" style={{ background: 'rgba(77,176,89,0.08)', border: '1px solid rgba(77,176,89,0.2)' }}>
              <p className="text-xs" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>
                Solde disponible
              </p>
              <p className="text-xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                {fmtFcfa(wallet?.balance ?? 0)}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  Montant (FCFA) — minimum 50 000 FCFA
                </label>
                <input
                  type="number"
                  value={payoutForm.amount}
                  onChange={(e) => setPayoutForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Ex: 100000"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  Méthode de paiement
                </label>
                <select
                  value={payoutForm.provider}
                  onChange={(e) => setPayoutForm((prev) => ({ ...prev, provider: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                  style={inputStyle}
                >
                  {PAYOUT_PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value} style={{ background: '#014945' }}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-xl p-3" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-information-line mr-1" style={{ color: '#F97316' }} />
                Les virements sont traités sous 24-48h ouvrables. Un frais de retrait peut s'appliquer selon les paramètres de la plateforme.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPayoutModal(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
                style={{ background: '#F5FAF5', color: '#374151', border: '1px solid #D1E8D1', fontFamily: 'Poppins, sans-serif' }}
              >
                Annuler
              </button>
              <button
                onClick={handleRequestPayout}
                disabled={payoutLoading}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-60"
                style={{ background: '#014945', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
              >
                {payoutLoading ? (
                  <><i className="ri-loader-4-line animate-spin mr-2" />Envoi…</>
                ) : (
                  <><i className="ri-send-plane-line mr-2" />Soumettre</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </MerchantLayout>
  );
}
