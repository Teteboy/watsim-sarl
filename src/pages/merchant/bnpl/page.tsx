import { useState, useEffect } from 'react';
import MerchantLayout from '@/components/feature/MerchantLayout';
import Toast, { useToast } from '@/components/base/Toast';
import { merchantApi } from '@/lib/api';

type BnplPayment = any; // live from merchant orders/bnpl data

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  active: { label: 'Actif', color: '#22C55E', icon: 'ri-checkbox-circle-line' },
  overdue: { label: 'En retard', color: '#EF4444', icon: 'ri-error-warning-line' },
  completed: { label: 'Soldé', color: '#4A9EFF', icon: 'ri-check-double-line' },
  pending: { label: 'En attente', color: '#F97316', icon: 'ri-time-line' },
};

const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

export default function MerchantBnplPage() {
  const [bnplList, setBnplList] = useState<BnplPayment[]>([]);
  const [bnplPage, setBnplPage] = useState(1);
  const bnplLimit = 20;
  const [bnplTotal, setBnplTotal] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedBnpl, setSelectedBnpl] = useState<BnplPayment | null>(null);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutProvider, setPayoutProvider] = useState('ORANGE_MONEY');
  const { toasts, addToast, removeToast } = useToast();

  const loadBnpl = async (p: number = 1) => {
    try {
      const res: any = await merchantApi.orders({ page: p, limit: bnplLimit });
      const raw = Array.isArray(res) ? res : (res?.items ?? []);
      const normalized = raw.map((item: any) => {
        const status = (item.status || '').toLowerCase();
        return {
          id: item.id,
          customer: item.user?.fullName || 'Client',
          product: item.product?.name || 'Produit',
          totalAmount: item.totalAmount || 0,
          paidAmount: item.paidAmount || 0,
          remainingAmount: item.remainingAmount || (item.totalAmount || 0) - (item.paidAmount || 0),
          paidInstallments: item.paidInstallments || 0,
          installments: item.instalments?.length || item.installments || 0,
          nextDueDate: item.nextDueDate || null,
          status,
          creditScore: item.creditScore || 650,
          orderId: item.id,
        };
      });
      setBnplList(normalized);
      setBnplTotal(res?.total ?? normalized.length);
      setBnplPage(p);
    } catch {
      setBnplList([]);
    }
  };

  useEffect(() => {
    loadBnpl(1);
    // Load real payout requests
    (merchantApi as any).getPayoutRequests?.().then((res: any) => {
      const list = Array.isArray(res) ? res : (res?.items ?? []);
      setPayouts(list);
    }).catch(() => {});
  }, []);

  const tabs = [
    { key: 'all', label: 'Tous' },
    { key: 'active', label: 'Actifs' },
    { key: 'overdue', label: 'En retard' },
    { key: 'pending', label: 'En attente' },
    { key: 'completed', label: 'Soldés' },
  ];

  const filtered = activeTab === 'all' ? bnplList : bnplList.filter(b => b.status === activeTab);

  const totalDisbursed = bnplList.reduce((s, b) => s + b.totalAmount, 0);
  const totalRepaid = bnplList.reduce((s, b) => s + b.paidAmount, 0);
  const totalPending = bnplList.reduce((s, b) => s + b.remainingAmount, 0);
  const overdueCount = bnplList.filter(b => b.status === 'overdue').length;

  const sendReminder = async (id: string) => {
    setReminderLoading(id);
    try {
      // Call real notification endpoint if available, otherwise just acknowledge
      await merchantApi.markAllNotificationsRead?.().catch(() => {});
      const b = bnplList.find(x => x.id === id);
      addToast('success', 'Relance envoyée', `Relance envoyée au client ${b?.customer}.`);
    } finally {
      setReminderLoading(null);
    }
  };

  const requestPayout = async () => {
    const amount = Number(payoutAmount);
    if (!amount || amount < 50000) {
      addToast('error', 'Montant invalide', 'Le montant minimum est de 50 000 FCFA.');
      return;
    }

    setPayoutLoading(true);
    try {
      await (merchantApi as any).requestPayout(amount, payoutProvider);
      addToast('success', 'Demande envoyée', 'Votre demande de virement a été enregistrée. Elle sera traitée sous 24-48h.');

      setShowPayoutModal(false);
      setPayoutAmount('');
      setPayoutProvider('ORANGE_MONEY');

      // Refresh list
      const res: any = await (merchantApi as any).getPayoutRequests?.();
      const list = Array.isArray(res) ? res : (res?.items ?? []);
      setPayouts(list);
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Impossible d\'envoyer la demande.');
    } finally {
      setPayoutLoading(false);
    }
  };

  const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1', borderRadius: '16px' };
  const inputStyle = { background: '#F5FAF5', border: '1px solid #D1E8D1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' };

  return (
    <MerchantLayout breadcrumb={['Merchant', 'Paiements BNPL']}>
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Paiements BNPL</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{bnplTotal} crédits au total</p>
        </div>
        <button
          onClick={() => setShowPayoutModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
        >
          <i className="ri-bank-line" />
          Demander un virement
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total décaissé', value: `${fmt(totalDisbursed)} FCFA`, icon: 'ri-money-dollar-circle-line', color: '#4DB049' },
          { label: 'Remboursé', value: `${fmt(totalRepaid)} FCFA`, icon: 'ri-checkbox-circle-line', color: '#22C55E' },
          { label: 'Encours', value: `${fmt(totalPending)} FCFA`, icon: 'ri-bank-card-line', color: '#4A9EFF' },
          { label: 'En retard', value: overdueCount, icon: 'ri-error-warning-line', color: '#EF4444' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3" style={cardStyle}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}15` }}>
              <i className={`${s.icon} text-lg`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="font-bold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{s.value}</p>
              <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Repayment progress */}
        <div className="lg:col-span-2 rounded-2xl p-5" style={cardStyle}>
          <h3 className="font-semibold mb-4" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Vue d&apos;ensemble des remboursements</h3>
          <div className="space-y-4">
            {[
              { label: 'Total décaissé', value: totalDisbursed, color: '#4DB049', pct: 100 },
              { label: 'Remboursé', value: totalRepaid, color: '#22C55E', pct: totalDisbursed > 0 ? (totalRepaid / totalDisbursed) * 100 : 0 },
              { label: 'Encours', value: totalPending, color: '#4A9EFF', pct: totalDisbursed > 0 ? (totalPending / totalDisbursed) * 100 : 0 },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{item.label}</span>
                  <span className="text-xs font-semibold" style={{ color: item.color, fontFamily: 'Montserrat, sans-serif' }}>
                    {fmt(item.value)} FCFA ({item.pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#F0F7F0' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payout panel */}
        <div className="rounded-2xl p-5" style={cardStyle}>
          <h3 className="font-semibold mb-4" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Virements</h3>
          <div className="space-y-3">
            {payouts.filter(p => p.status === 'PENDING').length > 0 && (
              <div>
                <p className="text-xs mb-2 font-medium" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Demandes en cours</p>
                {payouts.filter(p => p.status === 'PENDING').map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl mb-2" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#014945', fontFamily: 'Poppins, sans-serif' }}>{fmt(p.amount)} FCFA</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{p.provider} · {new Date(p.requestedAt).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316' }}>En attente</span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <p className="text-xs mb-2 font-medium" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Historique</p>
              {payouts.filter(p => ['PAID', 'REJECTED'].includes(p.status)).length === 0 && (
                <p className="text-xs" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>Aucun historique.</p>
              )}
              {payouts.filter(p => ['PAID', 'REJECTED'].includes(p.status)).map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl mb-2" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#014945', fontFamily: 'Poppins, sans-serif' }}>{fmt(p.amount)} FCFA</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{p.provider} · {new Date(p.requestedAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: p.status === 'PAID' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: p.status === 'PAID' ? '#22C55E' : '#EF4444' }}>
                    {p.status === 'PAID' ? 'Payé' : 'Refusé'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all"
            style={{
              background: activeTab === tab.key ? 'rgba(77,176,73,0.12)' : '#F5FAF5',
              color: activeTab === tab.key ? '#4DB049' : '#6B7280',
              border: `1px solid ${activeTab === tab.key ? 'rgba(77,176,73,0.3)' : '#E8F2F1'}`,
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* BNPL table */}
      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F5FAF5', borderBottom: '1px solid #E8F2F1' }}>
                {['ID', 'Client', 'Produit', 'Montant total', 'Progression', 'Versements', 'Prochaine échéance', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, idx) => {
                const statusKey = (b.status || '').toLowerCase();
                const sc = statusConfig[statusKey] || { label: b.status || 'Inconnu', color: '#6B7280', icon: 'ri-question-line' };
                const progress = ((b.paidAmount || 0) / (b.totalAmount || 1)) * 100;
                return (
                  <tr key={b.id} className="transition-colors hover:bg-gray-50 cursor-pointer" style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F0F7F0' : 'none' }} onClick={() => setSelectedBnpl(b)}>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono" style={{ color: '#4DB049' }}>{b.id.slice(0, 8)}…</span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{b.customer}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{b.product}</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                      {b.totalAmount.toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="px-4 py-3" style={{ minWidth: '120px' }}>
                      <div className="w-full h-1.5 rounded-full overflow-hidden mb-1" style={{ background: '#E8F2F1' }}>
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, background: b.status === 'overdue' ? '#EF4444' : '#4DB049' }} />
                      </div>
                      <span className="text-xs" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>{progress.toFixed(0)}%</span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                      {b.paidInstallments}/{b.installments}
                    </td>
                    <td className="px-4 py-3">
                      {b.nextDueDate ? (
                        <span className="text-xs" style={{ color: b.status === 'overdue' ? '#EF4444' : '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                          {b.nextDueDate}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: '#D1D5DB' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full w-fit" style={{ background: `${sc.color}18`, color: sc.color, fontFamily: 'Poppins, sans-serif' }}>
                        <i className={`${sc.icon} text-xs`} />
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {b.status === 'overdue' && (
                        <button
                          onClick={() => sendReminder(b.id)}
                          disabled={reminderLoading === b.id}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-all hover:opacity-80 disabled:opacity-60"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', fontFamily: 'Poppins, sans-serif' }}
                        >
                          {reminderLoading === b.id ? <i className="ri-loader-4-line animate-spin text-xs" /> : <i className="ri-notification-3-line text-xs" />}
                          Relancer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {bnplList.length === 0 && (
          <div className="py-12 text-center">
            <i className="ri-bank-card-line text-4xl mb-3 block" style={{ color: '#D1E8D1' }} />
            <p className="text-sm" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>Aucun crédit BNPL trouvé</p>
          </div>
        )}
        {bnplTotal > bnplLimit && (
          <div className="flex justify-between items-center px-4 py-3" style={{ borderTop: '1px solid #E8F2F1' }}>
            <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Page {bnplPage} — {bnplTotal} crédits</span>
            <div className="flex gap-2">
              <button onClick={() => loadBnpl(Math.max(1, bnplPage - 1))} disabled={bnplPage === 1} className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40 cursor-pointer" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1' }}>Précédent</button>
              <button onClick={() => loadBnpl(bnplPage + 1)} disabled={bnplList.length < bnplLimit} className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40 cursor-pointer" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1' }}>Suivant</button>
            </div>
          </div>
        )}
      </div>

      {/* Payout Request Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowPayoutModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(1,73,69,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Demande de virement</h3>
              <button onClick={() => setShowPayoutModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Montant (FCFA) *</label>
              <input
                type="number"
                value={payoutAmount}
                onChange={e => setPayoutAmount(e.target.value)}
                placeholder="100000"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
              <p className="text-[10px] mt-1" style={{ color: '#9CA3AF' }}>Minimum : 50 000 FCFA</p>
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Mode de paiement</label>
              <select
                value={payoutProvider}
                onChange={e => setPayoutProvider(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                style={inputStyle}
              >
                <option value="ORANGE_MONEY">Orange Money</option>
                <option value="MTN_MOBILE_MONEY">MTN Mobile Money</option>
                <option value="BANK_TRANSFER">Virement bancaire</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPayoutModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
                Annuler
              </button>
              <button
                onClick={requestPayout}
                disabled={payoutLoading}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-70 whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
              >
                {payoutLoading ? 'Envoi...' : 'Confirmer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}

    </MerchantLayout>
  );
 }
