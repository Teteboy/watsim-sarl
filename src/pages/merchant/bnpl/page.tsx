import { useState } from 'react';
import MerchantLayout from '@/components/feature/MerchantLayout';
import Toast, { useToast } from '@/components/base/Toast';
import { merchantBnplPayments as initialBnpl, merchantPayouts } from '@/mocks/merchantData';

type BnplPayment = typeof initialBnpl[0];

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  active: { label: 'Actif', color: '#22C55E', icon: 'ri-checkbox-circle-line' },
  overdue: { label: 'En retard', color: '#EF4444', icon: 'ri-error-warning-line' },
  completed: { label: 'Soldé', color: '#4A9EFF', icon: 'ri-check-double-line' },
  pending: { label: 'En attente', color: '#F97316', icon: 'ri-time-line' },
};

const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

export default function MerchantBnplPage() {
  const [bnplList, setBnplList] = useState<BnplPayment[]>(initialBnpl);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedBnpl, setSelectedBnpl] = useState<BnplPayment | null>(null);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

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
    await new Promise(r => setTimeout(r, 1500));
    setReminderLoading(null);
    const b = bnplList.find(x => x.id === id);
    addToast('success', 'Relance envoyée', `SMS de relance envoyé à ${b?.customer}.`);
  };

  const requestPayout = () => {
    addToast('info', 'Demande de virement', 'Votre demande de virement a été soumise. Traitement sous 24h.');
  };

  return (
    <MerchantLayout breadcrumb={['Merchant', 'Paiements BNPL']}>
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total décaissé', value: `${fmt(totalDisbursed)} FCFA`, icon: 'ri-money-dollar-circle-line', color: '#D4AF37' },
          { label: 'Remboursé', value: `${fmt(totalRepaid)} FCFA`, icon: 'ri-checkbox-circle-line', color: '#22C55E' },
          { label: 'Encours', value: `${fmt(totalPending)} FCFA`, icon: 'ri-bank-card-line', color: '#4A9EFF' },
          { label: 'En retard', value: overdueCount, icon: 'ri-error-warning-line', color: '#EF4444' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}20` }}>
                <i className={`${s.icon} text-base`} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-white font-bold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>{s.value}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Repayment progress */}
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}>
          <h3 className="text-white font-semibold mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>Vue d&apos;ensemble des remboursements</h3>
          <div className="space-y-3">
            {[
              { label: 'Total décaissé', value: totalDisbursed, color: '#D4AF37', pct: 100 },
              { label: 'Remboursé', value: totalRepaid, color: '#22C55E', pct: (totalRepaid / totalDisbursed) * 100 },
              { label: 'Encours', value: totalPending, color: '#4A9EFF', pct: (totalPending / totalDisbursed) * 100 },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>{item.label}</span>
                  <span className="text-xs font-semibold" style={{ color: item.color, fontFamily: 'Montserrat, sans-serif' }}>
                    {fmt(item.value)} FCFA ({item.pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payout panel */}
        <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}>
          <h3 className="text-white font-semibold mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>Virements</h3>
          <div className="space-y-3 mb-4">
            {merchantPayouts.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div>
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{fmt(p.amount)} FCFA</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>{p.date}</p>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: p.status === 'completed' ? 'rgba(34,197,94,0.15)' : 'rgba(249,115,22,0.15)',
                    color: p.status === 'completed' ? '#22C55E' : '#F97316',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {p.status === 'completed' ? 'Reçu' : 'En attente'}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={requestPayout}
            className="w-full py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}
          >
            <i className="ri-bank-line mr-2" />
            Demander un virement
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all"
            style={{
              background: activeTab === tab.key ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
              color: activeTab === tab.key ? '#D4AF37' : 'rgba(255,255,255,0.5)',
              border: `1px solid ${activeTab === tab.key ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)'}`,
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* BNPL table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['ID', 'Client', 'Produit', 'Montant total', 'Progression', 'Versements', 'Prochaine échéance', 'Score', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const sc = statusConfig[b.status];
                const progress = (b.paidAmount / b.totalAmount) * 100;
                return (
                  <tr key={b.id} className="transition-colors hover:bg-white/5 cursor-pointer" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} onClick={() => setSelectedBnpl(b)}>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-semibold" style={{ color: '#D4AF37' }}>{b.id}</span>
                    </td>
                    <td className="px-4 py-3 text-white text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>{b.customer}</td>
                    <td className="px-4 py-3 text-white/60 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>{b.product}</td>
                    <td className="px-4 py-3 text-white font-semibold text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      {b.totalAmount.toLocaleString()} FCFA
                    </td>
                    <td className="px-4 py-3" style={{ minWidth: '120px' }}>
                      <div className="w-full h-1.5 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, background: b.status === 'overdue' ? '#EF4444' : '#D4AF37' }} />
                      </div>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{progress.toFixed(0)}%</span>
                    </td>
                    <td className="px-4 py-3 text-white/60 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {b.paidInstallments}/{b.installments}
                    </td>
                    <td className="px-4 py-3">
                      {b.nextDueDate ? (
                        <span
                          className="text-xs"
                          style={{ color: b.status === 'overdue' ? '#EF4444' : 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}
                        >
                          {b.nextDueDate}
                        </span>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: b.creditScore >= 700 ? '#22C55E' : b.creditScore >= 600 ? '#F97316' : '#EF4444', fontFamily: 'Montserrat, sans-serif' }}
                      >
                        {b.creditScore}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full w-fit"
                        style={{ background: `${sc.color}20`, color: sc.color, fontFamily: 'Poppins, sans-serif' }}
                      >
                        <i className={`${sc.icon} text-xs`} />
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {b.status === 'overdue' && (
                        <button
                          onClick={() => sendReminder(b.id)}
                          disabled={reminderLoading === b.id}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-all hover:scale-105 disabled:opacity-60"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)', fontFamily: 'Poppins, sans-serif' }}
                        >
                          {reminderLoading === b.id ? (
                            <i className="ri-loader-4-line animate-spin text-xs" />
                          ) : (
                            <i className="ri-notification-3-line text-xs" />
                          )}
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
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <i className="ri-bank-card-line text-4xl text-white/20 mb-3 block" />
            <p className="text-white/40 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>Aucun crédit BNPL trouvé</p>
          </div>
        )}
      </div>

      {/* BNPL detail modal */}
      {selectedBnpl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={() => setSelectedBnpl(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>Crédit {selectedBnpl.id}</h3>
              <button onClick={() => setSelectedBnpl(null)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                <i className="ri-close-line" />
              </button>
            </div>

            {/* Progress */}
            <div className="p-4 rounded-xl" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.12)' }}>
              <div className="flex justify-between mb-2">
                <span className="text-xs text-white/50" style={{ fontFamily: 'Poppins, sans-serif' }}>Remboursement</span>
                <span className="text-xs font-semibold" style={{ color: '#D4AF37', fontFamily: 'Montserrat, sans-serif' }}>
                  {((selectedBnpl.paidAmount / selectedBnpl.totalAmount) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(selectedBnpl.paidAmount / selectedBnpl.totalAmount) * 100}%`, background: selectedBnpl.status === 'overdue' ? '#EF4444' : 'linear-gradient(90deg, #D4AF37, #F5D76E)' }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <span style={{ color: '#22C55E' }}>Payé: {selectedBnpl.paidAmount.toLocaleString()} FCFA</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Restant: {selectedBnpl.remainingAmount.toLocaleString()} FCFA</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Client', value: selectedBnpl.customer },
                { label: 'Produit', value: selectedBnpl.product },
                { label: 'Montant total', value: `${selectedBnpl.totalAmount.toLocaleString()} FCFA` },
                { label: 'Versements', value: `${selectedBnpl.paidInstallments}/${selectedBnpl.installments}` },
                { label: 'Score crédit', value: `${selectedBnpl.creditScore}` },
                { label: 'Commande', value: selectedBnpl.orderId },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{item.value}</p>
                </div>
              ))}
            </div>

            {selectedBnpl.status === 'overdue' && (
              <button
                onClick={() => { sendReminder(selectedBnpl.id); setSelectedBnpl(null); }}
                className="w-full py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)', fontFamily: 'Poppins, sans-serif' }}
              >
                <i className="ri-notification-3-line mr-2" />
                Envoyer une relance
              </button>
            )}
          </div>
        </div>
      )}
    </MerchantLayout>
  );
}
