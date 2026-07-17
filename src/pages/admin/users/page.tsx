import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
// adminUsers mock removed - live fetch via adminApi.users()
import { adminApi } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/utils';
import { mapUser, type BackendUser, type Paginated, type UiAdminUser } from '@/lib/api-adapters';

type User = UiAdminUser;

const kycColors: Record<string, string> = { verified: '#22C55E', pending: '#F97316', rejected: '#EF4444' };
const kycLabels: Record<string, string> = { verified: 'Vérifié', pending: 'En attente', rejected: 'Rejeté' };
const statusColors: Record<string, string> = { active: '#22C55E', suspended: '#EF4444' };

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

export default function AdminUsersPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [page, setPage] = useState(1);

  const loadUsers = async (pageNum: number = 1) => {
    setLoading(true);
    try {
      const params: any = { page: pageNum, limit };
      if (search) params.search = search;
      if (kycFilter !== 'all') params.kycStatus = kycFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await adminApi.users(params) as Paginated<BackendUser>;
      const data = res;
      if (Array.isArray(data.items)) {
        setUsers(data.items.map(mapUser) as unknown as User[]);
        setTotal(data.total || 0);
        setPage(pageNum);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Open edit modal for userId passed from dashboard
  useEffect(() => {
    const userId = searchParams.get('userId');
    if (!userId || users.length === 0) return;
    const target = users.find(u => u.id === userId);
    if (target) {
      openEdit(target);
      // Clean the URL without reloading
      navigate('/admin/users', { replace: true });
    }
  }, [searchParams, users]);

  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', creditLimit: '', status: '' });
  const [createUser, setCreateUser] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', phone: '', creditLimit: '', password: '', pin: '', role: 'CUSTOMER' });
  const [confirmSuspend, setConfirmSuspend] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  const [showCreditModal, setShowCreditModal] = useState<User | null>(null);
  const [creditForm, setCreditForm] = useState({ amount: '', note: '' });
  const [creditLoading, setCreditLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleSelectAll = () =>
    setSelectedIds(prev => prev.size === users.length && users.length > 0 ? new Set() : new Set(users.map(u => u.id)));

  const handleBulkActive = async (isActive: boolean) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      await adminApi.bulkUserActive(ids, isActive);
      setUsers(prev => prev.map(u => selectedIds.has(u.id) ? { ...u, status: isActive ? 'active' as const : 'suspended' as const } : u));
      addToast('success', 'Action groupée', `${ids.length} utilisateur(s) mis à jour.`);
    } catch {
      addToast('error', 'Erreur', 'L\'action groupée a échoué.');
    }
    setSelectedIds(new Set());
  };

  // Server-side pagination: users is already the current page
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleSuspendToggle = async (user: User) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    setConfirmSuspend(null);
    try {
      await adminApi.setUserActive(user.id, newStatus === 'active');
    } catch {
      addToast('error', 'Échec mise à jour', `Impossible de modifier ${user.name}.`);
      return;
    }
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    if (selectedUser?.id === user.id) setSelectedUser(prev => prev ? { ...prev, status: newStatus } : null);
    addToast(newStatus === 'suspended' ? 'warning' : 'success',
      newStatus === 'suspended' ? 'Compte suspendu' : 'Compte réactivé',
      `${user.name} a été ${newStatus === 'suspended' ? 'suspendu' : 'réactivé'} avec succès.`
    );
  };

  const handleKycDecision = async (user: User, status: 'VERIFIED' | 'REJECTED') => {
    try {
      await adminApi.setKyc(user.id, status);
    } catch {
      addToast('error', 'Échec KYC', `Impossible de mettre à jour le KYC de ${user.name}.`);
      return;
    }
    const ui = status === 'VERIFIED' ? 'verified' : 'rejected';
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, kycStatus: ui as User['kycStatus'] } : u));
    if (selectedUser?.id === user.id) setSelectedUser(prev => prev ? { ...prev, kycStatus: ui as User['kycStatus'] } : null);
    addToast('success', 'KYC mis à jour', `${user.name} : ${status === 'VERIFIED' ? 'vérifié' : 'rejeté'}.`);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({ name: user.name, email: user.email, phone: user.phone, creditLimit: String(user.creditLimit), status: user.status });
  };

  const handleDeleteUser = async (user: User) => {
    setConfirmDelete(null);
    try {
      await adminApi.deleteUser(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      if (selectedUser?.id === user.id) setSelectedUser(null);
      addToast('success', 'Utilisateur supprimé', `${user.name} a été supprimé.`);
    } catch (e: any) {
      addToast('error', 'Échec suppression', e?.message || `Impossible de supprimer ${user.name}.`);
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    const newLimit = Number(editForm.creditLimit);
    try {
      await adminApi.updateUser(editUser.id, {
        fullName: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        creditLimit: newLimit,
      });
      if (editForm.status !== editUser.status) {
        await adminApi.setUserActive(editUser.id, editForm.status === 'active');
      }
    } catch (e: any) {
      addToast('error', 'Échec mise à jour', e?.message || `Impossible de modifier ${editForm.name}.`);
      return;
    }
    const updated = { name: editForm.name, email: editForm.email, phone: editForm.phone, creditLimit: newLimit, status: editForm.status as User['status'] };
    setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...updated } : u));
    if (selectedUser?.id === editUser.id) setSelectedUser(prev => prev ? { ...prev, ...updated } : null);
    setEditUser(null);
    addToast('success', 'Utilisateur modifié', `Les informations de ${editForm.name} ont été mises à jour.`);
  };

  const handleCreateUser = async () => {
    if (!createForm.name || !createForm.phone) {
      addToast('error', 'Champs requis', 'Veuillez remplir le nom et le téléphone.');
      return;
    }

    try {
      const created = await adminApi.createUser({
        fullName: createForm.name,
        email: createForm.email || undefined,
        phone: createForm.phone,
        creditLimit: Number(createForm.creditLimit) || 100000,
        role: createForm.role || 'CUSTOMER',
        ...(createForm.password ? { password: createForm.password } : {}),
        ...(createForm.pin ? { pin: createForm.pin } : {}),
      });

      // Reload users list to include the new user from backend
      await loadUsers(page);

      setCreateUser(false);
      setCreateForm({ name: '', email: '', phone: '', creditLimit: '', password: '', pin: '', role: 'CUSTOMER' });
      addToast('success', 'Utilisateur créé', `${createForm.name} a été créé avec succès.`);
    } catch (e: any) {
      addToast('error', 'Échec création', e?.message || 'Impossible de créer l\'utilisateur.');
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Nom', 'Email', 'Téléphone', 'KYC', 'Score', 'Plafond', 'Solde', 'Statut'];
    const rows = users.map(u => [u.id, u.name, u.email, u.phone, u.kycStatus, u.creditScore, u.creditLimit, u.walletBalance, u.status]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'watsim_utilisateurs.csv'; a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Export réussi', `${users.length} utilisateurs exportés en CSV.`);
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
      await adminApi.creditClientWallet(showCreditModal.id, amount, creditForm.note || undefined);
      addToast('success', amount > 0 ? 'Wallet crédité' : 'Wallet débité', `${amount > 0 ? 'Ajout' : 'Retrait'} de ${Math.abs(amount)} FCFA pour ${showCreditModal.name}.`);
      setShowCreditModal(null);
      setCreditForm({ amount: '', note: '' });
      await loadUsers(page);
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Opération échouée.');
    } finally {
      setCreditLoading(false);
    }
  };

  const inputStyle = { background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' };
  const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Gestion', 'Utilisateurs']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Gestion des Utilisateurs</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{total} utilisateurs enregistrés</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setCreateUser(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#ffffff', fontFamily: 'Poppins, sans-serif' }}>
              <i className="ri-add-line" />Créer Utilisateur
            </button>
            <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#4DB049', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
              <i className="ri-download-2-line" /> Exporter CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: users.length, icon: 'ri-user-3-line', color: '#4DB049' },
            { label: 'Vérifiés KYC', value: users.filter(u => u.kycStatus === 'verified').length, icon: 'ri-shield-check-line', color: '#22C55E' },
            { label: 'En attente KYC', value: users.filter(u => u.kycStatus === 'pending').length, icon: 'ri-time-line', color: '#F97316' },
            { label: 'Suspendus', value: users.filter(u => u.status === 'suspended').length, icon: 'ri-forbid-line', color: '#EF4444' },
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
            <input type="text" placeholder="Rechercher par nom, email, ID..." value={search} onChange={e => { setSearch(e.target.value); loadUsers(1); }} className="bg-transparent text-gray-900 text-sm outline-none flex-1 placeholder-gray-400" style={{ fontFamily: 'Poppins, sans-serif' }} />
          </div>
            <select value={kycFilter} onChange={e => { setKycFilter(e.target.value); loadUsers(1); }} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
            <option value="all" style={{ background: '#FFFFFF' }}>Tous KYC</option>
            <option value="verified" style={{ background: '#FFFFFF' }}>Vérifiés</option>
            <option value="pending" style={{ background: '#FFFFFF' }}>En attente</option>
            <option value="rejected" style={{ background: '#FFFFFF' }}>Rejetés</option>
          </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); loadUsers(1); }} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
            <option value="all" style={{ background: '#FFFFFF' }}>Tous statuts</option>
            <option value="active" style={{ background: '#FFFFFF' }}>Actifs</option>
            <option value="suspended" style={{ background: '#FFFFFF' }}>Suspendus</option>
          </select>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl" style={{ background: 'rgba(77,176,89,0.1)', border: '1px solid #4DB049' }}>
            <span className="text-sm font-medium" style={{ color: '#014945' }}>{selectedIds.size} sélectionné(s)</span>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => handleBulkActive(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: '#22C55E20', color: '#22C55E', border: '1px solid #22C55E' }}>
                <i className="ri-user-follow-line mr-1" />Activer
              </button>
              <button onClick={() => handleBulkActive(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF4444' }}>
                <i className="ri-user-forbid-line mr-1" />Suspendre
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1' }}>Annuler</button>
            </div>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #E8F2F1' }}>
                  <th className="px-3 py-3">
                    <input type="checkbox" checked={selectedIds.size === users.length && users.length > 0} onChange={toggleSelectAll} className="accent-[#4DB049]" />
                  </th>
                  {['ID', 'Utilisateur', 'Téléphone', 'KYC', 'Score Crédit', 'Plafond', 'Solde Wallet', 'Statut', 'Inscription', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr key={user.id} className="transition-colors hover:bg-gray-50" style={{ borderBottom: idx < users.length - 1 ? '1px solid #F0F7F0' : 'none', background: selectedIds.has(user.id) ? 'rgba(77,176,89,0.05)' : undefined }}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selectedIds.has(user.id)} onChange={() => toggleSelect(user.id)} className="accent-[#4DB049]" />
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: '#4DB049' }}>{user.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.image ? (
                          <img src={resolveUploadUrl(user.image) ?? ''} alt={user.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF' }}>
                            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{user.name}</p>
                          <p className="text-xs" style={{ color: '#6B7280' }}>{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{user.phone}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: `${kycColors[user.kycStatus]}20`, color: kycColors[user.kycStatus] }}>{kycLabels[user.kycStatus]}</span>
                    </td>
                    <td className="px-4 py-3 w-32"><ScoreBar score={user.creditScore} /></td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>{user.creditLimit.toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>{user.walletBalance.toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: `${statusColors[user.status]}20`, color: statusColors[user.status] }}>
                        {user.status === 'active' ? 'Actif' : 'Suspendu'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>{user.joinedAt ? new Date(user.joinedAt).toLocaleDateString('fr-FR') : '—'}</p>
                      <p className="text-[10px]" style={{ color: '#9CA3AF' }}>{user.joinedAt ? new Date(user.joinedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedUser(user)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" title="Voir détails">
                          <i className="ri-eye-line text-sm" style={{ color: '#4DB049' }} />
                        </button>
                        <button onClick={() => openEdit(user)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" title="Modifier">
                          <i className="ri-edit-line text-sm" style={{ color: '#6B7280' }} />
                        </button>
                        <button onClick={() => { setShowCreditModal(user); setCreditForm({ amount: '', note: '' }); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 transition-colors cursor-pointer" title="Créditer Wallet">
                          <i className="ri-wallet-3-line text-sm" style={{ color: '#4DB049' }} />
                        </button>
                        <button onClick={() => setConfirmSuspend(user)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors cursor-pointer" title={user.status === 'active' ? 'Suspendre' : 'Réactiver'}>
                          <i className={`${user.status === 'active' ? 'ri-forbid-line' : 'ri-checkbox-circle-line'} text-sm`} style={{ color: user.status === 'active' ? '#EF4444' : '#22C55E' }} />
                        </button>
                        <button onClick={() => setConfirmDelete(user)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors cursor-pointer" title="Supprimer">
                          <i className="ri-delete-bin-line text-sm" style={{ color: '#EF4444' }} />
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
               <button onClick={() => loadUsers(Math.max(1, page - 1))} disabled={page === 1} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-30" style={{ background: '#F5FAF5', color: '#6B7280' }}>
                 <i className="ri-arrow-left-s-line" />
               </button>
               {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                 <button key={p} onClick={() => loadUsers(p)} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-colors cursor-pointer" style={{ background: p === page ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#F5FAF5', color: p === page ? '#FFFFFF' : '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{p}</button>
               ))}
               <button onClick={() => loadUsers(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-30" style={{ background: '#F5FAF5', color: '#6B7280' }}>
                 <i className="ri-arrow-right-s-line" />
               </button>
             </div>
           </div>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setSelectedUser(null)}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={cardStyle} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Détails Utilisateur</h2>
              <button onClick={() => setSelectedUser(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              {selectedUser.image ? (
                <img src={resolveUploadUrl(selectedUser.image) ?? ''} alt={selectedUser.name} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Montserrat, sans-serif' }}>
                  {selectedUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
              )}
              <div>
                <p className="font-semibold text-lg text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>{selectedUser.name}</p>
                <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{selectedUser.id}</p>
                <span className="px-2 py-0.5 rounded-full text-xs mt-1 inline-block" style={{ background: `${kycColors[selectedUser.kycStatus]}20`, color: kycColors[selectedUser.kycStatus] }}>{kycLabels[selectedUser.kycStatus]}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Email', value: selectedUser.email, icon: 'ri-mail-line' },
                { label: 'Téléphone', value: selectedUser.phone, icon: 'ri-phone-line' },
                { label: 'Score Crédit', value: `${selectedUser.creditScore}/100`, icon: 'ri-bar-chart-line' },
                { label: 'Plafond BNPL', value: `${selectedUser.creditLimit.toLocaleString('fr-FR')} FCFA`, icon: 'ri-bank-card-line' },
                { label: 'Solde Wallet', value: `${selectedUser.walletBalance.toLocaleString('fr-FR')} FCFA`, icon: 'ri-wallet-3-line' },
                { label: 'Transactions', value: selectedUser.transactions, icon: 'ri-exchange-line' },
                { label: 'Total Dépensé', value: `${selectedUser.totalSpent.toLocaleString('fr-FR')} FCFA`, icon: 'ri-money-cny-circle-line' },
                { label: 'Inscrit le', value: selectedUser.joinedAt ? new Date(selectedUser.joinedAt).toLocaleString('fr-FR') : '—', icon: 'ri-calendar-line' },
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
            {selectedUser.kycStatus === 'pending' && (
              <div className="flex gap-3">
                <button onClick={() => handleKycDecision(selectedUser, 'REJECTED')} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                  <i className="ri-close-circle-line mr-2" />Rejeter KYC
                </button>
                <button onClick={() => handleKycDecision(selectedUser, 'VERIFIED')} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                  <i className="ri-shield-check-line mr-2" />Approuver KYC
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setSelectedUser(null); setConfirmSuspend(selectedUser); }} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: selectedUser.status === 'active' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: selectedUser.status === 'active' ? '#EF4444' : '#22C55E', border: `1px solid ${selectedUser.status === 'active' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, fontFamily: 'Poppins, sans-serif' }}>
                <i className={`${selectedUser.status === 'active' ? 'ri-forbid-line' : 'ri-checkbox-circle-line'} mr-2`} />
                {selectedUser.status === 'active' ? 'Suspendre' : 'Réactiver'}
              </button>
              <button onClick={() => { setSelectedUser(null); openEdit(selectedUser); }} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-edit-line mr-2" />Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setEditUser(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={cardStyle} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Modifier Utilisateur</h2>
              <button onClick={() => setEditUser(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
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
                    style={inputStyle}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Statut</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                  style={inputStyle}
                >
                  <option value="active">Actif</option>
                  <option value="suspended">Suspendu</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditUser(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
                Annuler
              </button>
              <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-save-line mr-2" />Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {createUser && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setCreateUser(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={cardStyle} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Créer un Utilisateur</h2>
              <button onClick={() => setCreateUser(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Rôle</label>
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                  style={inputStyle}
                >
                  <option value="CUSTOMER">Client</option>
                  <option value="MERCHANT">Marchand</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              {[
                { label: 'Nom complet *', key: 'name', type: 'text', placeholder: 'Ex: Jean Dupont' },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'exemple@email.com' },
                { label: 'Téléphone *', key: 'phone', type: 'text', placeholder: '+237 6 XX XX XX XX' },
                { label: 'Mot de passe (optionnel)', key: 'password', type: 'password', placeholder: 'Laisser vide pour auto-générer' },
                { label: 'PIN 4 chiffres (optionnel)', key: 'pin', type: 'password', placeholder: 'Ex: 1234' },
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
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCreateUser(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
                Annuler
              </button>
              <button onClick={handleCreateUser} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#ffffff', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-add-line mr-2" />Créer
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmSuspend}
        title={confirmSuspend?.status === 'active' ? 'Suspendre le compte' : 'Réactiver le compte'}
        message={confirmSuspend?.status === 'active'
          ? `Voulez-vous suspendre le compte de ${confirmSuspend?.name} ? L'utilisateur ne pourra plus accéder à la plateforme.`
          : `Voulez-vous réactiver le compte de ${confirmSuspend?.name} ?`}
        confirmLabel={confirmSuspend?.status === 'active' ? 'Suspendre' : 'Réactiver'}
        confirmColor={confirmSuspend?.status === 'active' ? '#EF4444' : '#22C55E'}
        icon={confirmSuspend?.status === 'active' ? 'ri-forbid-line' : 'ri-checkbox-circle-line'}
        onConfirm={() => confirmSuspend && handleSuspendToggle(confirmSuspend)}
        onCancel={() => setConfirmSuspend(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Supprimer l'utilisateur"
        message={`Voulez-vous vraiment supprimer ${confirmDelete?.name} ? Cette action est irréversible. Les comptes avec achats ou transactions ne peuvent pas être supprimés.`}
        confirmLabel="Supprimer"
        confirmColor="#EF4444"
        icon="ri-delete-bin-line"
        onConfirm={() => confirmDelete && handleDeleteUser(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
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
    </AdminLayout>
  );
}
