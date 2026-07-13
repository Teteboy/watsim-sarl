import { useEffect, useState } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import { adminApi } from '@/lib/api';
import { mapTransaction, type BackendTransaction, type Paginated } from '@/lib/api-adapters';

const typeColors: Record<string, string> = {
  bnpl_purchase: '#D4AF37',
  wallet_deposit: '#22C55E',
  wallet_withdrawal: '#F97316',
  transfer: '#4A9EFF',
  repayment: '#A855F7',
};
const typeLabels: Record<string, string> = {
  bnpl_purchase: 'Achat BNPL',
  wallet_deposit: 'Dépôt',
  wallet_withdrawal: 'Retrait',
  transfer: 'Transfert',
  repayment: 'Remboursement',
};
const typeIcons: Record<string, string> = {
  bnpl_purchase: 'ri-bank-card-line',
  wallet_deposit: 'ri-arrow-down-circle-line',
  wallet_withdrawal: 'ri-arrow-up-circle-line',
  transfer: 'ri-exchange-line',
  repayment: 'ri-refund-2-line',
};
const statusColors: Record<string, string> = { completed: '#22C55E', pending: '#F97316', failed: '#EF4444' };
const statusLabels: Record<string, string> = { completed: 'Complété', pending: 'En cours', failed: 'Échoué' };

const transactionTypes = [
  { value: 'all', label: 'Tous' },
  { value: 'bnpl_purchase', label: 'Achat BNPL' },
  { value: 'wallet_deposit', label: 'Dépôt' },
  { value: 'wallet_withdrawal', label: 'Retrait' },
  { value: 'transfer', label: 'Transfert' },
  { value: 'repayment', label: 'Remboursement' },
];

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    adminApi.transactions({ limit: 200 })
      .then((res) => {
        const data = res as Paginated<BackendTransaction>;
        if (Array.isArray(data.items) && data.items.length > 0) {
          setTransactions(data.items.map(mapTransaction));
        }
      })
      .catch(() => null);
  }, []);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    user: '', userId: '', type: 'wallet_deposit', amount: '', merchant: '', method: 'Mobile Money', description: ''
  });
  const { toasts, addToast, removeToast } = useToast();

  const filtered = transactions.filter((t) => {
    const matchSearch = t.id.toLowerCase().includes(search.toLowerCase()) || t.user.toLowerCase().includes(search.toLowerCase()) || t.merchant.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || t.type === typeFilter;
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const totalVolume = transactions.filter(t => t.status === 'completed').reduce((acc, t) => acc + t.amount, 0);

  const handleExport = () => {
    const headers = ['ID', 'Utilisateur', 'Type', 'Montant', 'Marchand', 'Méthode', 'Date', 'Statut'];
    const rows = filtered.map(t => [t.id, t.user, t.type, t.amount, t.merchant, t.method, t.date, t.status]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'watsim_transactions.csv'; a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Export réussi', `${filtered.length} transactions exportées en CSV.`);
  };

  const handleApproveCash = (txn: any) => {
    setTransactions(prev => prev.map(t => t.id === txn.id ? { ...t, status: 'completed' } : t));
    addToast('success', 'Transaction approuvée', `Transaction ${txn.id} marquée comme complétée.`);
  };

  const handleAddTransaction = async () => {
    if (!addForm.user || !addForm.amount || !addForm.description) {
      addToast('error', 'Champs requis', 'Veuillez remplir les champs obligatoires.');
      return;
    }

    // Map UI transaction types to backend types
    const typeMap: Record<string, string> = {
      'bnpl_purchase': 'PURCHASE',
      'wallet_deposit': 'DEPOSIT',
      'wallet_withdrawal': 'WITHDRAWAL',
      'transfer': 'REFUND',
      'repayment': 'REPAYMENT',
    };

    try {
      const created = await adminApi.createTransaction({
        userId: addForm.userId || addForm.user, // Use userId if available, otherwise use user name (backend will resolve)
        type: typeMap[addForm.type] || 'DEPOSIT',
        amount: Number(addForm.amount),
        description: addForm.description,
        merchantId: addForm.merchant || undefined,
        method: addForm.method,
      });

      // Reload transactions list to include the new one from backend
      const res = await adminApi.transactions({ limit: 200 });
      const data = res as Paginated<BackendTransaction>;
      if (Array.isArray(data.items) && data.items.length > 0) {
        setTransactions(data.items.map(mapTransaction));
      }

      setShowAddModal(false);
      setAddForm({ user: '', userId: '', type: 'wallet_deposit', amount: '', merchant: '', method: 'Mobile Money', description: '' });
      addToast('success', 'Transaction ajoutée', `Transaction créée avec succès.`);
    } catch (e: any) {
      addToast('error', 'Échec création', e?.message || 'Impossible de créer la transaction.');
    }
  };

  const handleDownloadReceipt = () => {
    if (!selectedTxn) return;
    const content = `REÇU WATSIM\n${'='.repeat(40)}\nID: ${selectedTxn.id}\nUtilisateur: ${selectedTxn.user}\nMontant: ${selectedTxn.amount.toLocaleString('fr-FR')} FCFA\nType: ${selectedTxn.type}\nMarchand: ${selectedTxn.merchant}\nMéthode: ${selectedTxn.method}\nDate: ${selectedTxn.date}\nStatut: ${selectedTxn.status}\n${'='.repeat(40)}\nWATSIM — Buy Now Pay Later Cameroun`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `recu_${selectedTxn.id}.txt`; a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Reçu téléchargé', `Reçu ${selectedTxn.id} téléchargé.`);
  };

  const inputStyle = { background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' };
  const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Finance', 'Transactions']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Transactions</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Historique complet des transactions</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
              <i className="ri-add-line" /> Ajouter Transaction
            </button>
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#4DB049', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
              <i className="ri-download-2-line" /> Exporter
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Volume Total', value: `${(totalVolume / 1000000).toFixed(2)}M FCFA`, icon: 'ri-exchange-line', color: '#4DB049' },
            { label: 'Complétées', value: transactions.filter(t => t.status === 'completed').length, icon: 'ri-checkbox-circle-line', color: '#22C55E' },
            { label: 'En cours', value: transactions.filter(t => t.status === 'pending').length, icon: 'ri-time-line', color: '#F97316' },
            { label: 'Échouées', value: transactions.filter(t => t.status === 'failed').length, icon: 'ri-close-circle-line', color: '#EF4444' },
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

        {/* Type Tabs */}
        <div className="flex flex-wrap gap-2">
          {transactionTypes.map((t) => (
            <button key={t.value} onClick={() => setTypeFilter(t.value)} className="px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap" style={{ background: typeFilter === t.value ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#F5FAF5', color: typeFilter === t.value ? '#FFFFFF' : '#6B7280', border: typeFilter === t.value ? 'none' : '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-2xl p-4 flex flex-wrap gap-3 items-center" style={cardStyle}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
            <i className="ri-search-line text-gray-400 text-sm" />
            <input type="text" placeholder="Rechercher par ID, utilisateur, marchand..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent text-gray-900 text-sm outline-none flex-1 placeholder-gray-400" style={{ fontFamily: 'Poppins, sans-serif' }} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
            <option value="all" style={{ background: '#FFFFFF' }}>Tous statuts</option>
            <option value="completed" style={{ background: '#FFFFFF' }}>Complétées</option>
            <option value="pending" style={{ background: '#FFFFFF' }}>En cours</option>
            <option value="failed" style={{ background: '#FFFFFF' }}>Échouées</option>
          </select>
        </div>

        {/* Transactions Table */}
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #E8F2F1' }}>
                  {['ID Transaction', 'Utilisateur', 'Type', 'Montant', 'Marchand/Dest.', 'Méthode', 'Date', 'Statut', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((txn, idx) => (
                  <tr key={txn.id} className="transition-colors hover:bg-gray-50" style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F0F7F0' : 'none' }}>
                    <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: '#4DB049' }}>{txn.id}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{txn.user}</p>
                        <p className="text-xs font-mono" style={{ color: '#6B7280' }}>{txn.userId}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${typeColors[txn.type]}20` }}>
                          <i className={`${typeIcons[txn.type]} text-sm`} style={{ color: typeColors[txn.type] }} />
                        </div>
                        <span className="text-xs whitespace-nowrap" style={{ color: typeColors[txn.type], fontFamily: 'Poppins, sans-serif' }}>{typeLabels[txn.type]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap" style={{ color: '#4DB049', fontFamily: 'Montserrat, sans-serif' }}>{txn.amount.toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{txn.merchant}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{txn.method}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>{txn.date}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: `${statusColors[txn.status]}20`, color: statusColors[txn.status] }}>{statusLabels[txn.status]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedTxn(txn)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                          <i className="ri-eye-line text-sm" style={{ color: '#4DB049' }} />
                        </button>
                        {txn.method === 'Cash' && txn.status === 'pending' && (
                          <button onClick={() => handleApproveCash(txn)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-500/10 transition-colors cursor-pointer" title="Approuver paiement cash">
                            <i className="ri-checkbox-circle-line text-sm" style={{ color: '#22C55E' }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setSelectedTxn(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Détails Transaction</h2>
              <button onClick={() => setSelectedTxn(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: `${typeColors[selectedTxn.type]}20` }}>
                <i className={`${typeIcons[selectedTxn.type]} text-2xl`} style={{ color: typeColors[selectedTxn.type] }} />
              </div>
              <p className="text-3xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{selectedTxn.amount.toLocaleString('fr-FR')} FCFA</p>
              <p className="text-sm mt-1" style={{ color: typeColors[selectedTxn.type], fontFamily: 'Poppins, sans-serif' }}>{typeLabels[selectedTxn.type]}</p>
              <span className="px-3 py-1 rounded-full text-xs font-medium mt-2 inline-block" style={{ background: `${statusColors[selectedTxn.status]}20`, color: statusColors[selectedTxn.status] }}>{statusLabels[selectedTxn.status]}</span>
            </div>
            <div className="space-y-3">
              {[
                { label: 'ID Transaction', value: selectedTxn.id },
                { label: 'Utilisateur', value: `${selectedTxn.user} (${selectedTxn.userId})` },
                { label: 'Description', value: selectedTxn.description },
                { label: 'Marchand / Destinataire', value: selectedTxn.merchant },
                { label: 'Méthode de paiement', value: selectedTxn.method },
                { label: 'Date & Heure', value: selectedTxn.date },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4 py-2" style={{ borderBottom: '1px solid #E8F2F1' }}>
                  <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                  <p className="text-sm text-right font-medium text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{item.value}</p>
                </div>
              ))}
            </div>
            <button onClick={handleDownloadReceipt} className="w-full py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(77,176,89,0.1)', color: '#4DB049', border: '1px solid rgba(77,176,89,0.3)', fontFamily: 'Poppins, sans-serif' }}>
              <i className="ri-file-download-line mr-2" />Télécharger le reçu
            </button>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={cardStyle} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Ajouter une Transaction</h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Utilisateur *', key: 'user', type: 'text', placeholder: 'Nom de l\'utilisateur' },
                { label: 'ID Utilisateur', key: 'userId', type: 'text', placeholder: 'Auto-généré si vide' },
                { label: 'Montant (FCFA) *', key: 'amount', type: 'number', placeholder: '0' },
                { label: 'Marchand / Destinataire', key: 'merchant', type: 'text', placeholder: 'Nom du marchand' },
                { label: 'Description *', key: 'description', type: 'text', placeholder: 'Détails de la transaction' },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                  <input type={field.type} placeholder={field.placeholder} value={addForm[field.key as keyof typeof addForm] as string} onChange={e => setAddForm(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
                </div>
              ))}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Type de Transaction</label>
                <select value={addForm.type} onChange={e => setAddForm(prev => ({ ...prev, type: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                  {transactionTypes.slice(1).map(t => <option key={t.value} value={t.value} style={{ background: '#FFFFFF' }}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Méthode de Paiement</label>
                <select value={addForm.method} onChange={e => setAddForm(prev => ({ ...prev, method: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                  {['Mobile Money', 'Wallet', 'BNPL', 'Cash'].map(m => <option key={m} value={m} style={{ background: '#FFFFFF' }}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleAddTransaction} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-add-line mr-2" />Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </AdminLayout>
  );
}
