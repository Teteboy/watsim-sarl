import { useState, useEffect } from 'react';
import MerchantLayout from '@/components/feature/MerchantLayout';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { merchantApi } from '@/lib/api';
import { cardStyle, inputStyle, labelStyle, headingStyle, tableHeaderStyle, tableRowStyle, statusBadgeStyle, tableRowHoverClass } from '@/styles/admin-theme';

const kycColors: Record<string, string> = { verified: '#22C55E', pending: '#F97316', rejected: '#EF4444' };
const kycLabels: Record<string, string> = { verified: 'Vérifié', pending: 'En attente', rejected: 'Rejeté' };
const statusColors: Record<string, string> = { active: '#22C55E', suspended: '#EF4444' };

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  kycStatus: 'verified' | 'pending' | 'rejected';
  creditScore: number;
  creditLimit: number;
  walletBalance: number;
  status: 'active' | 'suspended';
  totalOrders: number;
  totalSpent: number;
  joinedAt: string;
  imageUrl?: string;
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? '#22C55E' : score >= 50 ? '#F97316' : '#EF4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: '#E8F2F1' }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-medium w-6" style={{ color, fontFamily: 'Poppins, sans-serif' }}>{score}</span>
    </div>
  );
}

export default function MerchantUsersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [page, setPage] = useState(1);

  const loadCustomers = async (pageNum: number = 1) => {
    setLoading(true);
    try {
      const params: any = { page: pageNum, limit };
      if (search) params.search = search;
      if (kycFilter !== 'all') params.kycStatus = kycFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await merchantApi.getMerchantCustomers(params);
      setCustomers(res.items || []);
      setTotal(res.total || 0);
      setPage(pageNum);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', creditLimit: '' });
  const [createUser, setCreateUser] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', phone: '', password: '', pin: '', creditLimit: '' });
  const [confirmSuspend, setConfirmSuspend] = useState<Customer | null>(null);
  const [showCreditModal, setShowCreditModal] = useState<Customer | null>(null);
  const [creditForm, setCreditForm] = useState({ amount: '', note: '' });
  const [creditLoading, setCreditLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleSuspendToggle = async (customer: Customer) => {
    const newStatus = customer.status === 'active' ? 'suspended' : 'active';
    setConfirmSuspend(null);
    try {
      await merchantApi.updateMerchantCustomerStatus(customer.id, newStatus);
    } catch {
      addToast('error', 'Échec mise à jour', `Impossible de modifier ${customer.name}.`);
      return;
    }
    setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, status: newStatus } : c));
    if (selectedCustomer?.id === customer.id) setSelectedCustomer(prev => prev ? { ...prev, status: newStatus } : null);
    addToast(newStatus === 'suspended' ? 'warning' : 'success',
      newStatus === 'suspended' ? 'Compte suspendu' : 'Compte réactivé',
      `${customer.name} a été ${newStatus === 'suspended' ? 'suspendu' : 'réactivé'} avec succès.`
    );
  };

  const openEdit = (customer: Customer) => {
    setEditCustomer(customer);
    setEditForm({ name: customer.name, email: customer.email, phone: customer.phone, creditLimit: String(customer.creditLimit) });
  };

  const handleCreditWallet = async () => {
    if (!showCreditModal) return;
    const amount = Number(creditForm.amount);
    if (!amount || amount === 0) {
      addToast('error', 'Montant invalide', 'Veuillez saisir un montant.');
      return;
    }
    setCreditLoading(true);
    try {
      await merchantApi.creditClientWallet(showCreditModal.id, amount, creditForm.note || undefined);
      addToast('success', amount > 0 ? 'Wallet crédité' : 'Wallet débité', `${amount > 0 ? 'Ajout' : 'Retrait'} de ${Math.abs(amount)} FCFA pour ${showCreditModal.name}.`);
      setShowCreditModal(null);
      setCreditForm({ amount: '', note: '' });
      await loadCustomers(page);
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Opération échouée.');
    } finally {
      setCreditLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editCustomer) return;
    const newLimit = Number(editForm.creditLimit);
    try {
      await merchantApi.updateMerchantCustomer(editCustomer.id, {
        fullName: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        creditLimit: newLimit,
      });
    } catch {
      addToast('error', 'Échec mise à jour', `Impossible de modifier ${editForm.name}.`);
      return;
    }
    setCustomers(prev => prev.map(c => c.id === editCustomer.id ? { ...c, name: editForm.name, email: editForm.email, phone: editForm.phone, creditLimit: newLimit } : c));
    if (selectedCustomer?.id === editCustomer.id) setSelectedCustomer(prev => prev ? { ...prev, name: editForm.name, email: editForm.email, phone: editForm.phone, creditLimit: newLimit } : null);
    setEditCustomer(null);
    addToast('success', 'Client modifié', `Les informations de ${editForm.name} ont été mises à jour.`);
  };

  const handleCreateUser = async () => {
    if (!createForm.name || !createForm.email || !createForm.phone || !createForm.password) {
      addToast('error', 'Champs requis', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (createForm.password.length < 6) {
      addToast('error', 'Erreur', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (createForm.pin && !/^\d{4,6}$/.test(createForm.pin)) {
      addToast('error', 'Erreur PIN', 'Le PIN doit contenir entre 4 et 6 chiffres.');
      return;
    }

    try {
      await merchantApi.createMerchantCustomer({
        fullName: createForm.name,
        email: createForm.email,
        phone: createForm.phone,
        password: createForm.password,
        pin: createForm.pin || undefined,
        creditLimit: createForm.creditLimit ? parseInt(createForm.creditLimit) : 100000,
      });
      addToast('success', 'Client créé', `${createForm.name} a été ajouté avec succès.`);
      setCreateUser(false);
      setCreateForm({ name: '', email: '', phone: '', password: '', pin: '', creditLimit: '' });
      await loadCustomers(1);
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Impossible de créer le client.');
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Nom', 'Email', 'Téléphone', 'KYC', 'Score', 'Plafond', 'Solde', 'Statut'];
    const rows = customers.map(c => [c.id, c.name, c.email, c.phone, c.kycStatus, c.creditScore, c.creditLimit, c.walletBalance, c.status]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'watsim_clients.csv'; a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Export réussi', `${customers.length} clients exportés en CSV.`);
  };

  const handleResetPassword = async (customer: Customer) => {
    try {
      const result = await merchantApi.resetMerchantCustomerPassword(customer.id);
      addToast('success', 'Mot de passe réinitialisé', result.password ? `Nouveau: ${result.password}` : 'Un email a été envoyé');
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Impossible de réinitialiser');
    }
  };

  return (
    <MerchantLayout breadcrumb={['WATSIM', 'Clients']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Gestion des Clients</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{total} clients enregistrés</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setCreateUser(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#ffffff', fontFamily: 'Poppins, sans-serif' }}>
              <i className="ri-add-line" />Créer Client
            </button>
            <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#4DB049', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
              <i className="ri-download-2-line" /> Exporter CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: customers.length, icon: 'ri-user-3-line', color: '#4DB049' },
            { label: 'Vérifiés KYC', value: customers.filter(u => u.kycStatus === 'verified').length, icon: 'ri-shield-check-line', color: '#22C55E' },
            { label: 'En attente KYC', value: customers.filter(u => u.kycStatus === 'pending').length, icon: 'ri-time-line', color: '#F97316' },
            { label: 'Suspendus', value: customers.filter(u => u.status === 'suspended').length, icon: 'ri-forbid-line', color: '#EF4444' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3" style={cardStyle}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}20` }}>
                <i className={`${s.icon} text-lg`} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{s.value}</p>
                <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-4 flex flex-wrap gap-3 items-center" style={cardStyle}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
            <i className="ri-search-line text-gray-400 text-sm" />
            <input type="text" placeholder="Rechercher par nom, email, ID..." value={search} onChange={e => { setSearch(e.target.value); loadCustomers(1); }} className="bg-transparent text-gray-900 text-sm outline-none flex-1 placeholder-gray-400" style={{ fontFamily: 'Poppins, sans-serif' }} />
          </div>
          <select value={kycFilter} onChange={e => { setKycFilter(e.target.value); loadCustomers(1); }} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
            <option value="all" style={{ background: '#FFFFFF' }}>Tous KYC</option>
            <option value="verified" style={{ background: '#FFFFFF' }}>Vérifiés</option>
            <option value="pending" style={{ background: '#FFFFFF' }}>En attente</option>
            <option value="rejected" style={{ background: '#FFFFFF' }}>Rejetés</option>
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); loadCustomers(1); }} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
            <option value="all" style={{ background: '#FFFFFF' }}>Tous statuts</option>
            <option value="active" style={{ background: '#FFFFFF' }}>Actifs</option>
            <option value="suspended" style={{ background: '#FFFFFF' }}>Suspendus</option>
          </select>
        </div>

        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #E8F2F1' }}>
                  {['ID', 'Client', 'Téléphone', 'KYC', 'Score Crédit', 'Plafond', 'Solde Wallet', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((customer, idx) => (
                  <tr key={customer.id} className="transition-colors hover:bg-gray-50" style={{ borderBottom: idx < customers.length - 1 ? '1px solid #F0F7F0' : 'none' }}>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: '#4DB049' }}>{customer.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {customer.imageUrl ? (
                          <img src={customer.imageUrl} alt={customer.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF' }}>
                            {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{customer.name}</p>
                          <p className="text-xs" style={{ color: '#6B7280' }}>{customer.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{customer.phone}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: `${kycColors[customer.kycStatus]}20`, color: kycColors[customer.kycStatus] }}>{kycLabels[customer.kycStatus]}</span>
                    </td>
                    <td className="px-4 py-3 w-32"><ScoreBar score={customer.creditScore} /></td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>{customer.creditLimit.toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>{customer.walletBalance.toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: `${statusColors[customer.status]}20`, color: statusColors[customer.status] }}>
                        {customer.status === 'active' ? 'Actif' : 'Suspendu'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedCustomer(customer)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" title="Voir détails">
                          <i className="ri-eye-line text-sm" style={{ color: '#4DB049' }} />
                        </button>
                        <button onClick={() => openEdit(customer)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" title="Modifier">
                          <i className="ri-edit-line text-sm" style={{ color: '#6B7280' }} />
                        </button>
                        <button onClick={() => { setShowCreditModal(customer); setCreditForm({ amount: '', note: '' }); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 transition-colors cursor-pointer" title="Créditer Wallet">
                          <i className="ri-wallet-3-line text-sm" style={{ color: '#4DB049' }} />
                        </button>
                        <button onClick={() => setConfirmSuspend(customer)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors cursor-pointer" title={customer.status === 'active' ? 'Suspendre' : 'Réactiver'}>
                          <i className={`${customer.status === 'active' ? 'ri-forbid-line' : 'ri-checkbox-circle-line'} text-sm`} style={{ color: customer.status === 'active' ? '#EF4444' : '#22C55E' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #E8F2F1' }}>
            <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{total} résultats — Page {page} / {totalPages}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => loadCustomers(Math.max(1, page - 1))} disabled={page === 1} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-30" style={{ background: '#F5FAF5', color: '#6B7280' }}>
                <i className="ri-arrow-left-s-line" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => loadCustomers(p)} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-colors cursor-pointer" style={{ background: p === page ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#F5FAF5', color: p === page ? '#FFFFFF' : '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{p}</button>
              ))}
              <button onClick={() => loadCustomers(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-30" style={{ background: '#F5FAF5', color: '#6B7280' }}>
                <i className="ri-arrow-right-s-line" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setSelectedCustomer(null)}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={cardStyle} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Détails Client</h2>
              <button onClick={() => setSelectedCustomer(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Montserrat, sans-serif' }}>
                {selectedCustomer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p className="font-semibold text-lg text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>{selectedCustomer.name}</p>
                <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{selectedCustomer.id}</p>
                <span className="px-2 py-0.5 rounded-full text-xs mt-1 inline-block" style={{ background: `${kycColors[selectedCustomer.kycStatus]}20`, color: kycColors[selectedCustomer.kycStatus] }}>{kycLabels[selectedCustomer.kycStatus]}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Email', value: selectedCustomer.email, icon: 'ri-mail-line' },
                { label: 'Téléphone', value: selectedCustomer.phone, icon: 'ri-phone-line' },
                { label: 'Score Crédit', value: `${selectedCustomer.creditScore}/100`, icon: 'ri-bar-chart-line' },
                { label: 'Plafond BNPL', value: `${selectedCustomer.creditLimit.toLocaleString('fr-FR')} FCFA`, icon: 'ri-bank-card-line' },
                { label: 'Solde Wallet', value: `${selectedCustomer.walletBalance.toLocaleString('fr-FR')} FCFA`, icon: 'ri-wallet-3-line' },
                { label: 'Commandes', value: selectedCustomer.totalOrders, icon: 'ri-shopping-bag-line' },
                { label: 'Total Dépensé', value: `${selectedCustomer.totalSpent.toLocaleString('fr-FR')} FCFA`, icon: 'ri-money-cny-circle-line' },
                { label: 'Inscrit le', value: selectedCustomer.joinedAt, icon: 'ri-calendar-line' },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <i className={`${item.icon} text-xs`} style={{ color: '#4DB049' }} />
                    <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                  </div>
                  <p className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setSelectedCustomer(null); setConfirmSuspend(selectedCustomer); }} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: selectedCustomer.status === 'active' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: selectedCustomer.status === 'active' ? '#EF4444' : '#22C55E', border: `1px solid ${selectedCustomer.status === 'active' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, fontFamily: 'Poppins, sans-serif' }}>
                <i className={`${selectedCustomer.status === 'active' ? 'ri-forbid-line' : 'ri-checkbox-circle-line'} mr-2`} />
                {selectedCustomer.status === 'active' ? 'Suspendre' : 'Réactiver'}
              </button>
              <button onClick={() => { setSelectedCustomer(null); openEdit(selectedCustomer); }} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-edit-line mr-2" />Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editCustomer && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setEditCustomer(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(1,73,69,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Modifier Client</h2>
              <button onClick={() => setEditCustomer(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nom complet', key: 'name', type: 'text' },
                { label: 'Email', key: 'email', type: 'email' },
                { label: 'Téléphone', key: 'phone', type: 'text' },
                { label: 'Plafond crédit (FCFA)', key: 'creditLimit', type: 'number' },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                  <input
                    type={field.type}
                    value={editForm[field.key as keyof typeof editForm]}
                    onChange={e => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditCustomer(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
                Annuler
              </button>
              <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-save-line mr-2" />Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Customer Modal */}
      {createUser && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setCreateUser(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(1,73,69,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Créer un Client</h2>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Nouveau compte client WATSIM</p>
              </div>
              <button onClick={() => setCreateUser(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nom complet *', key: 'name', type: 'text', placeholder: 'Ex: Jean Dupont' },
                { label: 'Email *', key: 'email', type: 'email', placeholder: 'exemple@email.com' },
                { label: 'Téléphone *', key: 'phone', type: 'text', placeholder: '+237 6 XX XX XX XX' },
                { label: 'Mot de passe *', key: 'password', type: 'password', placeholder: 'Min 6 caractères' },
                { label: 'PIN (4-6 chiffres)', key: 'pin', type: 'password', placeholder: '1234' },
                { label: 'Plafond crédit (FCFA)', key: 'creditLimit', type: 'number', placeholder: '100000' },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={createForm[field.key as keyof typeof createForm]}
                    onChange={e => setCreateForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCreateUser(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
                Annuler
              </button>
              <button onClick={handleCreateUser} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-user-add-line mr-2" />Créer le client
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmSuspend}
        title={confirmSuspend?.status === 'active' ? 'Suspendre le compte' : 'Réactiver le compte'}
        message={confirmSuspend?.status === 'active'
          ? `Voulez-vous suspendre le compte de ${confirmSuspend?.name} ? Le client ne pourra plus accéder à la plateforme.`
          : `Voulez-vous réactiver le compte de ${confirmSuspend?.name} ?`}
        confirmLabel={confirmSuspend?.status === 'active' ? 'Suspendre' : 'Réactiver'}
        confirmColor={confirmSuspend?.status === 'active' ? '#EF4444' : '#22C55E'}
        icon={confirmSuspend?.status === 'active' ? 'ri-forbid-line' : 'ri-checkbox-circle-line'}
        onConfirm={() => confirmSuspend && handleSuspendToggle(confirmSuspend)}
        onCancel={() => setConfirmSuspend(null)}
      />

      {/* Credit Wallet Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowCreditModal(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={cardStyle} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Créditer Wallet</h2>
              <button onClick={() => setShowCreditModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="p-3 rounded-xl" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
              <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{showCreditModal.name}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Solde actuel: {showCreditModal.walletBalance.toLocaleString('fr-FR')} FCFA</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Montant (FCFA)</label>
                <input
                  type="number"
                  value={creditForm.amount}
                  onChange={e => setCreditForm({ ...creditForm, amount: e.target.value })}
                  placeholder="Entrez le montant"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Note (optionnel)</label>
                <input
                  type="text"
                  value={creditForm.note}
                  onChange={e => setCreditForm({ ...creditForm, note: e.target.value })}
                  placeholder="Note de transaction"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreditModal(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
                Annuler
              </button>
              <button onClick={handleCreditWallet} disabled={creditLoading} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#ffffff', fontFamily: 'Poppins, sans-serif' }}>
                {creditLoading ? <><i className="ri-loader-4-line animate-spin mr-2" />Traitement…</> : <><i className="ri-check-line mr-2" />Confirmer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </MerchantLayout>
  );
}
