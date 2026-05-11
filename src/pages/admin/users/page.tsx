import { useState } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { adminUsers as initialUsers } from '@/mocks/adminUsers';

type User = typeof initialUsers[0];

const kycColors: Record<string, string> = { verified: '#22C55E', pending: '#F97316', rejected: '#EF4444' };
const kycLabels: Record<string, string> = { verified: 'Vérifié', pending: 'En attente', rejected: 'Rejeté' };
const statusColors: Record<string, string> = { active: '#22C55E', suspended: '#EF4444' };

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? '#22C55E' : score >= 50 ? '#F97316' : '#EF4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-medium w-6" style={{ color, fontFamily: 'Poppins, sans-serif' }}>{score}</span>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', creditLimit: '' });
  const [confirmSuspend, setConfirmSuspend] = useState<User | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 8;
  const { toasts, addToast, removeToast } = useToast();

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || u.id.toLowerCase().includes(search.toLowerCase());
    const matchKyc = kycFilter === 'all' || u.kycStatus === kycFilter;
    const matchStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchSearch && matchKyc && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleSuspendToggle = (user: User) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    if (selectedUser?.id === user.id) setSelectedUser(prev => prev ? { ...prev, status: newStatus } : null);
    setConfirmSuspend(null);
    addToast(newStatus === 'suspended' ? 'warning' : 'success',
      newStatus === 'suspended' ? 'Compte suspendu' : 'Compte réactivé',
      `${user.name} a été ${newStatus === 'suspended' ? 'suspendu' : 'réactivé'} avec succès.`
    );
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({ name: user.name, email: user.email, phone: user.phone, creditLimit: String(user.creditLimit) });
  };

  const handleSaveEdit = () => {
    if (!editUser) return;
    setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, name: editForm.name, email: editForm.email, phone: editForm.phone, creditLimit: Number(editForm.creditLimit) } : u));
    if (selectedUser?.id === editUser.id) setSelectedUser(prev => prev ? { ...prev, name: editForm.name, email: editForm.email, phone: editForm.phone, creditLimit: Number(editForm.creditLimit) } : null);
    setEditUser(null);
    addToast('success', 'Utilisateur modifié', `Les informations de ${editForm.name} ont été mises à jour.`);
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Nom', 'Email', 'Téléphone', 'KYC', 'Score', 'Plafond', 'Solde', 'Statut'];
    const rows = filtered.map(u => [u.id, u.name, u.email, u.phone, u.kycStatus, u.creditScore, u.creditLimit, u.walletBalance, u.status]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'watsim_utilisateurs.csv'; a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Export réussi', `${filtered.length} utilisateurs exportés en CSV.`);
  };

  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'Poppins, sans-serif' };

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Gestion', 'Utilisateurs']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Gestion des Utilisateurs</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{users.length} utilisateurs enregistrés</p>
          </div>
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
            <i className="ri-download-2-line" /> Exporter CSV
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: users.length, icon: 'ri-user-3-line', color: '#D4AF37' },
            { label: 'Vérifiés KYC', value: users.filter(u => u.kycStatus === 'verified').length, icon: 'ri-shield-check-line', color: '#22C55E' },
            { label: 'En attente KYC', value: users.filter(u => u.kycStatus === 'pending').length, icon: 'ri-time-line', color: '#F97316' },
            { label: 'Suspendus', value: users.filter(u => u.status === 'suspended').length, icon: 'ri-forbid-line', color: '#EF4444' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}20` }}>
                <i className={`${s.icon} text-lg`} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xl font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>{s.value}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-4 flex flex-wrap gap-3 items-center" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <i className="ri-search-line text-white/40 text-sm" />
            <input type="text" placeholder="Rechercher par nom, email, ID..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="bg-transparent text-white text-sm outline-none flex-1 placeholder-white/30" style={{ fontFamily: 'Poppins, sans-serif' }} />
          </div>
          <select value={kycFilter} onChange={e => { setKycFilter(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>
            <option value="all" style={{ background: '#0D1B2A' }}>Tous KYC</option>
            <option value="verified" style={{ background: '#0D1B2A' }}>Vérifiés</option>
            <option value="pending" style={{ background: '#0D1B2A' }}>En attente</option>
            <option value="rejected" style={{ background: '#0D1B2A' }}>Rejetés</option>
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>
            <option value="all" style={{ background: '#0D1B2A' }}>Tous statuts</option>
            <option value="active" style={{ background: '#0D1B2A' }}>Actifs</option>
            <option value="suspended" style={{ background: '#0D1B2A' }}>Suspendus</option>
          </select>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['ID', 'Utilisateur', 'Téléphone', 'KYC', 'Score Crédit', 'Plafond', 'Solde Wallet', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((user, idx) => (
                  <tr key={user.id} className="transition-colors hover:bg-white/3" style={{ borderBottom: idx < paginated.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: '#D4AF37' }}>{user.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628' }}>
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{user.name}</p>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif' }}>{user.phone}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: `${kycColors[user.kycStatus]}20`, color: kycColors[user.kycStatus] }}>{kycLabels[user.kycStatus]}</span>
                    </td>
                    <td className="px-4 py-3 w-32"><ScoreBar score={user.creditScore} /></td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>{user.creditLimit.toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>{user.walletBalance.toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: `${statusColors[user.status]}20`, color: statusColors[user.status] }}>
                        {user.status === 'active' ? 'Actif' : 'Suspendu'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedUser(user)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer" title="Voir détails">
                          <i className="ri-eye-line text-sm" style={{ color: '#D4AF37' }} />
                        </button>
                        <button onClick={() => openEdit(user)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer" title="Modifier">
                          <i className="ri-edit-line text-sm" style={{ color: 'rgba(255,255,255,0.5)' }} />
                        </button>
                        <button onClick={() => setConfirmSuspend(user)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer" title={user.status === 'active' ? 'Suspendre' : 'Réactiver'}>
                          <i className={`${user.status === 'active' ? 'ri-forbid-line' : 'ri-checkbox-circle-line'} text-sm`} style={{ color: user.status === 'active' ? '#EF4444' : '#22C55E' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{filtered.length} résultats — Page {page} / {totalPages}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-30" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>
                <i className="ri-arrow-left-s-line" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-colors cursor-pointer" style={{ background: p === page ? 'linear-gradient(135deg, #D4AF37, #F5D76E)' : 'rgba(255,255,255,0.05)', color: p === page ? '#0A1628' : 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif' }}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-30" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>
                <i className="ri-arrow-right-s-line" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setSelectedUser(null)}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-5" style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Détails Utilisateur</h2>
              <button onClick={() => setSelectedUser(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Montserrat, sans-serif' }}>
                {selectedUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p className="text-white font-semibold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>{selectedUser.name}</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>{selectedUser.id}</p>
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
                { label: 'Inscrit le', value: selectedUser.joinedAt, icon: 'ri-calendar-line' },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <i className={`${item.icon} text-xs`} style={{ color: '#D4AF37' }} />
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                  </div>
                  <p className="text-sm font-medium text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{item.value}</p>
                </div>
              ))}
            </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setEditUser(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Modifier Utilisateur</h2>
              <button onClick={() => setEditUser(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)' }}>
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
                  <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                  <input
                    type={field.type}
                    value={editForm[field.key as keyof typeof editForm]}
                    onChange={e => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditUser(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}>
                Annuler
              </button>
              <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-save-line mr-2" />Sauvegarder
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

      <Toast toasts={toasts} onRemove={removeToast} />
    </AdminLayout>
  );
}
