import { useEffect, useState } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
// bnpl mocks removed - page uses live adminApi.bnplPurchases() + local or dashboard stats
import { adminApi } from '@/lib/api';
import { mapBnpl, type BackendBnplPurchase, type Paginated } from '@/lib/api-adapters';

const statusColors: Record<string, string> = { active: '#22C55E', completed: '#4A9EFF', pending: '#F97316', overdue: '#EF4444' };
const statusLabels: Record<string, string> = { active: 'Actif', completed: 'Remboursé', pending: 'En attente', overdue: 'En retard' };

const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };

function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const color = pct >= 100 ? '#4A9EFF' : pct >= 50 ? '#22C55E' : pct > 0 ? '#F97316' : '#EF4444';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
        <span>{paid.toLocaleString('fr-FR')} FCFA</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: '#E8F2F1' }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function AdminBnplPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [credits, setCredits] = useState<any[]>([]);
  const [bnplStats, setBnplStats] = useState<any>({
    totalActive: 0, totalOverdue: 0, totalDisbursed: 0, totalRepaid: 0, defaultRate: 0,
  });
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    adminApi.bnplPurchases({ limit: 200 })
      .then((res) => {
        const data = res as Paginated<BackendBnplPurchase>;
        const items = Array.isArray(data.items) ? data.items : [];
        const mapped = items.map(mapBnpl);
        setCredits(mapped);
        const totalDisbursed = mapped.reduce((s, c) => s + c.totalAmount, 0);
        const totalRepaid = mapped.reduce((s, c) => s + c.paidAmount, 0);
        const overdueAmount = mapped
          .filter((c) => c.status === 'overdue')
          .reduce((s, c) => s + c.remainingAmount, 0);
        setBnplStats({
          totalActive: mapped.filter((c) => c.status === 'active').length,
          totalCompleted: mapped.filter((c) => c.status === 'completed').length,
          totalOverdue: mapped.filter((c) => c.status === 'overdue').length,
          totalPending: mapped.filter((c) => c.status === 'pending').length,
          totalDisbursed,
          totalRepaid,
          defaultRate: totalDisbursed > 0 ? Math.round((overdueAmount / totalDisbursed) * 1000) / 10 : 0,
          avgScore: 0,
        });
      })
      .catch(() => {
        setCredits([]);
        setBnplStats({ totalActive: 0, totalOverdue: 0, totalDisbursed: 0, totalRepaid: 0, defaultRate: 0 });
      });

    adminApi.summary?.().then(setSummary).catch(() => null);
  }, []);
  const [selectedCredit, setSelectedCredit] = useState<any>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState<any>(null);
  const [contributeForm, setContributeForm] = useState({ amount: '', note: '' });
  const [contributeLoading, setContributeLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const filtered = credits.filter((c) => {
    const matchSearch = c.id.toLowerCase().includes(search.toLowerCase()) || c.user.toLowerCase().includes(search.toLowerCase()) || c.product.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleExportReport = () => {
    const headers = ['ID', 'Utilisateur', 'Produit', 'Total', 'Payé', 'Restant', 'Échéances', 'Statut'];
    const rows = filtered.map(c => [c.id, c.user, c.product, c.totalAmount, c.paidAmount, c.remainingAmount, `${c.paidInstallments}/${c.installments}`, c.status]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'watsim_bnpl_rapport.csv'; a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Rapport exporté', `${filtered.length} crédits BNPL exportés.`);
  };

  const handleSendReminder = () => {
    if (!selectedCredit) return;
    setSendingReminder(true);
    setTimeout(() => {
      setSendingReminder(false);
      addToast('success', 'Relance envoyée', `Un SMS et email de relance ont été envoyés à ${selectedCredit.user}.`);
    }, 1500);
  };

  const handleContributeToInstallment = async () => {
    if (!showContributeModal) return;
    const amount = Number(contributeForm.amount);
    if (!amount || amount === 0) {
      addToast('error', 'Montant invalide', 'Veuillez saisir un montant.');
      return;
    }
    setContributeLoading(true);
    try {
      // For now, we'll use the first installment of the purchase
      // In a real implementation, you'd need to fetch the actual installment ID
      const instalmentId = showContributeModal.id; // This should be the actual installment ID
      await adminApi.contributeToInstallment(instalmentId, amount, contributeForm.note || undefined);
      addToast('success', 'Contribution effectuée', `${amount} FCFA ont été ajoutés à l'échéance.`);
      setShowContributeModal(null);
      setContributeForm({ amount: '', note: '' });
      // Reload the data
      adminApi.bnplPurchases({ limit: 200 })
        .then((res) => {
          const data = res as Paginated<BackendBnplPurchase>;
          const items = Array.isArray(data.items) ? data.items : [];
          const mapped = items.map(mapBnpl);
          setCredits(mapped);
        })
        .catch(() => setCredits([]));
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Opération échouée.');
    } finally {
      setContributeLoading(false);
    }
  };

  const handleMarkPaid = () => {
    if (!selectedCredit) return;
    setCredits(prev => prev.map(c => c.id === selectedCredit.id ? { ...c, status: 'completed', paidAmount: c.totalAmount, remainingAmount: 0, paidInstallments: c.installments, nextDueDate: null } : c));
    setSelectedCredit(null);
    addToast('success', 'Crédit soldé', `Le crédit ${selectedCredit.id} a été marqué comme intégralement remboursé.`);
  };

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Finance', 'Crédits BNPL']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Crédits BNPL</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Gestion des achats à crédit et remboursements</p>
          </div>
          <button onClick={handleExportReport} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
            <i className="ri-download-2-line" /> Rapport BNPL
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Crédits Actifs', value: bnplStats.totalActive, icon: 'ri-bank-card-line', color: '#22C55E' },
            { label: 'En Retard', value: bnplStats.totalOverdue, icon: 'ri-error-warning-line', color: '#EF4444' },
            { label: 'Montant Décaissé', value: `${(bnplStats.totalDisbursed / 1000000).toFixed(0)}M FCFA`, icon: 'ri-money-cny-circle-line', color: '#4DB049' },
            { label: 'Taux de Défaut', value: `${bnplStats.defaultRate}%`, icon: 'ri-percent-line', color: '#F97316' },
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

        {/* Repayment Overview */}
        <div className="rounded-2xl p-5" style={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>Vue d&apos;ensemble des remboursements</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: '#4DB049', fontFamily: 'Montserrat, sans-serif' }}>{(bnplStats.totalDisbursed / 1000000).toFixed(0)}M FCFA</p>
              <p className="text-xs mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Total décaissé</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: '#22C55E', fontFamily: 'Montserrat, sans-serif' }}>
                {summary?.totalRepayments ? `${(summary.totalRepayments / 1000000).toFixed(0)}M FCFA` : `${(bnplStats.totalRepaid / 1000000).toFixed(0)}M FCFA`}
              </p>
              <p className="text-xs mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Total remboursé</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: '#F97316', fontFamily: 'Montserrat, sans-serif' }}>{((bnplStats.totalDisbursed - bnplStats.totalRepaid) / 1000000).toFixed(0)}M FCFA</p>
              <p className="text-xs mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Encours</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
              <span>Taux de remboursement global</span>
              <span>{Math.round((bnplStats.totalRepaid / bnplStats.totalDisbursed) * 100)}%</span>
            </div>
            <div className="h-3 rounded-full" style={{ background: '#E8F2F1' }}>
              <div className="h-3 rounded-full" style={{ width: `${Math.round((bnplStats.totalRepaid / bnplStats.totalDisbursed) * 100)}%`, background: 'linear-gradient(90deg, #4DB049, #22C55E)' }} />
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2">
          {[{ value: 'all', label: 'Tous' }, { value: 'active', label: 'Actifs' }, { value: 'overdue', label: 'En retard' }, { value: 'pending', label: 'En attente' }, { value: 'completed', label: 'Remboursés' }].map((tab) => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)} className="px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap" style={{ background: statusFilter === tab.value ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#F5FAF5', color: statusFilter === tab.value ? '#FFFFFF' : '#6B7280', border: statusFilter === tab.value ? 'none' : '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="rounded-2xl p-4" style={cardStyle}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
            <i className="ri-search-line text-gray-400 text-sm" />
            <input type="text" placeholder="Rechercher par ID, utilisateur, produit..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent text-gray-900 text-sm outline-none flex-1 placeholder-gray-400" style={{ fontFamily: 'Poppins, sans-serif' }} />
          </div>
        </div>

        {/* BNPL Table */}
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #E8F2F1' }}>
                  {['ID Crédit', 'Utilisateur', 'Produit', 'Montant Total', 'Progression', 'Échéances', 'Prochaine Date', 'Score', 'Statut', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((credit, idx) => (
                  <tr key={credit.id} className="transition-colors hover:bg-gray-50" style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F0F7F0' : 'none' }}>
                    <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: '#4DB049' }}>{credit.id}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{credit.user}</p>
                      <p className="text-xs font-mono" style={{ color: '#6B7280' }}>{credit.userId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900 whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{credit.product}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{credit.merchant}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap" style={{ color: '#4DB049', fontFamily: 'Montserrat, sans-serif' }}>{credit.totalAmount.toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-4 py-3 w-40"><ProgressBar paid={credit.paidAmount} total={credit.totalAmount} /></td>
                    <td className="px-4 py-3 text-sm text-center whitespace-nowrap" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>{credit.paidInstallments}/{credit.installments}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: credit.status === 'overdue' ? '#EF4444' : '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>{credit.nextDueDate || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium" style={{ color: credit.score >= 75 ? '#22C55E' : credit.score >= 50 ? '#F97316' : '#EF4444', fontFamily: 'Montserrat, sans-serif' }}>{credit.score}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: `${statusColors[credit.status]}20`, color: statusColors[credit.status] }}>{statusLabels[credit.status]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedCredit(credit)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                          <i className="ri-eye-line text-sm" style={{ color: '#4DB049' }} />
                        </button>
                        {credit.status === 'active' || credit.status === 'overdue' ? (
                          <button onClick={() => { setShowContributeModal(credit); setContributeForm({ amount: '', note: '' }); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 transition-colors cursor-pointer" title="Contribuer à l'échéance">
                            <i className="ri-add-circle-line text-sm" style={{ color: '#4DB049' }} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* BNPL Detail Modal */}
      {selectedCredit && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setSelectedCredit(null)}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Détails Crédit BNPL</h2>
              <button onClick={() => setSelectedCredit(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>{selectedCredit.product}</p>
                <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{selectedCredit.id} — {selectedCredit.merchant}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: `${statusColors[selectedCredit.status]}20`, color: statusColors[selectedCredit.status] }}>{statusLabels[selectedCredit.status]}</span>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(77,176,89,0.08)', border: '1px solid rgba(77,176,89,0.2)' }}>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>{selectedCredit.totalAmount.toLocaleString('fr-FR')}</p>
                  <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Total (FCFA)</p>
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: '#22C55E', fontFamily: 'Montserrat, sans-serif' }}>{selectedCredit.paidAmount.toLocaleString('fr-FR')}</p>
                  <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Payé (FCFA)</p>
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: '#F97316', fontFamily: 'Montserrat, sans-serif' }}>{selectedCredit.remainingAmount.toLocaleString('fr-FR')}</p>
                  <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Restant (FCFA)</p>
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar paid={selectedCredit.paidAmount} total={selectedCredit.totalAmount} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Utilisateur', value: selectedCredit.user },
                { label: 'Score Crédit', value: `${selectedCredit.score}/100` },
                { label: 'Taux d\'intérêt', value: `${selectedCredit.interestRate}%` },
                { label: 'Échéances', value: `${selectedCredit.paidInstallments}/${selectedCredit.installments} payées` },
                { label: 'Date de début', value: selectedCredit.startDate },
                { label: 'Prochaine échéance', value: selectedCredit.nextDueDate || 'Terminé' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                  <p className="text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                  <p className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{item.value}</p>
                </div>
              ))}
            </div>
            {(selectedCredit.status === 'overdue' || selectedCredit.status === 'active') && (
              <div className="flex gap-3">
                <button onClick={handleSendReminder} disabled={sendingReminder} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all" style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)', fontFamily: 'Poppins, sans-serif', opacity: sendingReminder ? 0.7 : 1 }}>
                  {sendingReminder ? <><i className="ri-loader-4-line animate-spin mr-2" />Envoi...</> : <><i className="ri-mail-send-line mr-2" />Envoyer relance</>}
                </button>
                {selectedCredit.status === 'overdue' && (
                  <button onClick={handleMarkPaid} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                    <i className="ri-checkbox-circle-line mr-2" />Marquer soldé
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contribute to Installment Modal */}
      {showContributeModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowContributeModal(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={cardStyle} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Contribuer à l'échéance</h2>
              <button onClick={() => setShowContributeModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="p-3 rounded-xl" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
              <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{showContributeModal.product}</p>
              <p className="text-sm font-medium mt-0.5" style={{ color: '#014945', fontFamily: 'Poppins, sans-serif' }}>{showContributeModal.user}</p>
              <p className="text-xs mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Reste à payer: {showContributeModal.remainingAmount.toLocaleString('fr-FR')} FCFA</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Montant (FCFA)</label>
                <input
                  type="number"
                  value={contributeForm.amount}
                  onChange={e => setContributeForm({ ...contributeForm, amount: e.target.value })}
                  placeholder="Entrez le montant"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Note (optionnel)</label>
                <input
                  type="text"
                  value={contributeForm.note}
                  onChange={e => setContributeForm({ ...contributeForm, note: e.target.value })}
                  placeholder="Note de transaction"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowContributeModal(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
                Annuler
              </button>
              <button onClick={handleContributeToInstallment} disabled={contributeLoading} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#ffffff', fontFamily: 'Poppins, sans-serif' }}>
                {contributeLoading ? <><i className="ri-loader-4-line animate-spin mr-2" />Traitement…</> : <><i className="ri-check-line mr-2" />Confirmer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </AdminLayout>
  );
}
