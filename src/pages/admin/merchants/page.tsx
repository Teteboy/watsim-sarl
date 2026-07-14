import { useEffect, useState } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { adminApi, authApi, ApiError } from '@/lib/api';
import { mapMerchant, type BackendMerchant, type BackendCategory, type Paginated, type UiAdminMerchant } from '@/lib/api-adapters';

type Merchant = UiAdminMerchant & {
  password?: string;
  userId?: string | null;
  tempPassword?: string;
};

const statusColors: Record<string, string> = { active: '#22C55E', pending: '#F97316', suspended: '#EF4444' };
const statusLabels: Record<string, string> = { active: 'Actif', pending: 'En attente', suspended: 'Suspendu' };
const categoryIcons: Record<string, string> = {
  'Électronique': 'ri-computer-line', 'Mode & Vêtements': 'ri-t-shirt-line', 'Alimentation': 'ri-restaurant-line',
  'Maison & Déco': 'ri-home-4-line', 'Santé & Beauté': 'ri-heart-pulse-line', 'Automobile': 'ri-car-line',
  'Éducation': 'ri-book-open-line', 'Sport & Loisirs': 'ri-football-line',
};

function CategoryPicker({ allCategories, selected, onChange, onAllChange }: {
  allCategories: BackendCategory[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onAllChange: (all: boolean) => void;
}) {
  const [all, setAll] = useState(false);
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter(x => x !== id));
    else onChange([...selected, id]);
  };
  const toggleAll = () => {
    const next = !all;
    setAll(next);
    onAllChange(next);
    if (next) onChange(allCategories.map(c => c.id));
    else onChange([]);
  };
  return (
    <div className="space-y-2">
      <label className="text-xs mb-1 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
        Catégories <span className="text-gray-400">(une ou plusieurs)</span>
      </label>
      <label className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50" style={{ border: '1px solid #E8F2F1' }}>
        <input type="checkbox" checked={all} onChange={toggleAll} className="accent-[#4DB049]" />
        <span className="text-sm font-medium" style={{ color: '#014945' }}>Toutes les catégories</span>
      </label>
      <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto pr-1">
        {allCategories.map(c => (
          <label key={c.id} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50 text-xs" style={{ border: '1px solid #E8F2F1' }}>
            <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} disabled={all} className="accent-[#4DB049]" />
            {c.icon && <i className={`${c.icon} text-[#4DB049]`} />}
            <span style={{ color: '#1A2B1F' }}>{c.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function AdminMerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const [availableCategories, setAvailableCategories] = useState<BackendCategory[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'ACTIVE' | 'SUSPENDED' | null>(null);

  const loadMerchants = async (pageNum: number = 1) => {
    try {
      const params: any = { page: pageNum, limit };
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await adminApi.merchants(params) as Paginated<BackendMerchant>;
      const data = res;
      if (Array.isArray(data.items)) {
        const mapped = data.items.map(mapMerchant) as unknown as Merchant[];
        const withTemps = mapped.map(m => ({
          ...m,
          tempPassword: tempPasswords[m.id] || (m as any).tempPassword,
        }));
        setMerchants(withTemps);
        setTotal(data.total || 0);
        setPage(pageNum);
      }
    } catch {
      setMerchants([]);
    }
  };

  useEffect(() => {
    loadMerchants(1);
    adminApi.categories().then((res: any) => {
      if (Array.isArray(res?.items)) setAvailableCategories(res.items);
      else if (Array.isArray(res)) setAvailableCategories(res);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    loadMerchants(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
    loadMerchants(1);
  };
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [confirmAction, setConfirmAction] = useState<{ merchant: Merchant; action: 'approve' | 'reject' | 'suspend' } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [resetResult, setResetResult] = useState<{ merchant: Merchant; tempPassword: string } | null>(null);
  const [addForm, setAddForm] = useState({
    name: '',
    owner: '',
    email: '',
    password: '',
    phone: '',
    category: '',
    city: '',
    operatingMarket: '',
  });
  const [addCategoryIds, setAddCategoryIds] = useState<string[]>([]);
  const [addAllCategories, setAddAllCategories] = useState(false);

  // Persist temporary passwords across reloads (so admin can see them after refresh)
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('admin_merchant_temp_passwords');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const { toasts, addToast, removeToast } = useToast();

  const filtered = merchants.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.owner.toLowerCase().includes(search.toLowerCase()) || m.city.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleAction = async () => {
    if (!confirmAction) return;
    const { merchant, action } = confirmAction;
    let newStatus: 'active' | 'pending' | 'suspended' = merchant.status as 'active' | 'pending' | 'suspended';
    let toastMsg = '';
    if (action === 'approve') { newStatus = 'active'; toastMsg = `${merchant.name} a été approuvé et activé.`; }
    else if (action === 'reject') { newStatus = 'suspended'; toastMsg = `${merchant.name} a été rejeté.`; }
    else if (action === 'suspend') { newStatus = merchant.status === 'active' ? 'suspended' : 'active'; toastMsg = `${merchant.name} a été ${newStatus === 'suspended' ? 'suspendu' : 'réactivé'}.`; }
    setConfirmAction(null);
    try {
      await adminApi.setMerchantStatus(merchant.id, newStatus.toUpperCase() as 'PENDING' | 'ACTIVE' | 'SUSPENDED');
    } catch {
      addToast('error', 'Échec mise à jour', `Impossible de modifier ${merchant.name}.`);
      return;
    }
    setMerchants(prev => prev.map(m => m.id === merchant.id ? { ...m, status: newStatus, verified: action === 'approve' ? true : m.verified } : m));
    if (selectedMerchant?.id === merchant.id) setSelectedMerchant(prev => prev ? { ...prev, status: newStatus } : null);

    try {
      if (action === 'approve') {
        await adminApi.setMerchantStatus(merchant.id, 'ACTIVE');
      } else {
        await adminApi.setMerchantStatus(merchant.id, newStatus.toUpperCase());
      }
    } catch (e) {
      addToast('error', 'Erreur', 'Le changement de statut a échoué côté serveur.');
    }
  };

  const handleResetPassword = async (merchant: Merchant) => {
    // Always prefer the linked user ID if we have it.
    // Fall back to merchant ID only as last resort (backend will try to resolve).
    const targetId = merchant.userId || merchant.id;

    if (!targetId) {
      addToast('error', 'Erreur', 'Ce commercial n\'a pas de compte utilisateur lié.');
      return;
    }

    try {
      const res = await adminApi.resetUserPassword(targetId);

      if (res.error) {
        addToast('error', 'Erreur', res.error);
        return;
      }

      const tempPw = res.temporaryPassword || res.password;

      // Persist so it survives page reload / refetch
      const updatedTemps = { ...tempPasswords, [merchant.id]: tempPw };
      setTempPasswords(updatedTemps);
      try {
        localStorage.setItem('admin_merchant_temp_passwords', JSON.stringify(updatedTemps));
      } catch { /* localStorage unavailable */ }

      // Update local list immediately
      setMerchants(prev =>
        prev.map(m => (m.id === merchant.id ? { ...m, tempPassword: tempPw } : m))
      );

      setResetResult({ merchant, tempPassword: tempPw });
      addToast('success', 'Mot de passe réinitialisé', `Nouveau mot de passe temporaire : ${tempPw}`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Échec de la réinitialisation';
      addToast('error', 'Erreur', msg);
    }
  };

  const handleAddMerchant = async () => {
    if (!addForm.name || !addForm.owner || !addForm.email || !addForm.password) { addToast('error', 'Champs requis', 'Veuillez remplir tous les champs obligatoires.'); return; }
    try {
      await authApi.registerMerchant({
        email: addForm.email,
        phone: addForm.phone || '+237000000000',
        password: addForm.password,
        fullName: addForm.owner,
        businessName: addForm.name,
        category: addCategoryIds.length > 0 ? (availableCategories.find(c => c.id === addCategoryIds[0])?.name ?? addForm.category) : addForm.category,
        city: addForm.city || 'Douala',
        categoryIds: addAllCategories ? [] : addCategoryIds,
        allCategories: addAllCategories,
      } as any);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erreur inconnue';
      addToast('error', 'Échec création', msg);
      return;
    }
    await loadMerchants(1);
    setShowAddModal(false);
    setAddForm({ name: '', owner: '', email: '', password: '', phone: '', category: '', city: '', operatingMarket: '' });
    setAddCategoryIds([]);
    setAddAllCategories(false);
    addToast('success', 'Commercial ajouté', `${addForm.name} a été ajouté en attente de validation.`);
  };

  const handleBulkAction = async (status: 'ACTIVE' | 'SUSPENDED') => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setBulkAction(status);
    try {
      await adminApi.bulkMerchantStatus(ids, status);
      setMerchants(prev => prev.map(m => selectedIds.has(m.id) ? { ...m, status: status.toLowerCase() as Merchant['status'] } : m));
      addToast('success', 'Action groupée', `${ids.length} commercial(s) mis à jour.`);
    } catch {
      addToast('error', 'Erreur', 'L\'action groupée a échoué.');
    }
    setSelectedIds(new Set());
    setBulkAction(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(m => m.id)));
  };

  const inputStyle = { background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' };
  const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Gestion', 'Commerciaux']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Gestion des Commerciaux</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{merchants.length} partenaires enregistrés</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
              <button onClick={() => setViewMode('table')} className="w-8 h-8 flex items-center justify-center rounded-md transition-all cursor-pointer" style={{ background: viewMode === 'table' ? 'rgba(77,176,89,0.15)' : 'transparent', color: viewMode === 'table' ? '#4DB049' : '#6B7280' }}>
                <i className="ri-list-check text-sm" />
              </button>
              <button onClick={() => setViewMode('grid')} className="w-8 h-8 flex items-center justify-center rounded-md transition-all cursor-pointer" style={{ background: viewMode === 'grid' ? 'rgba(77,176,89,0.15)' : 'transparent', color: viewMode === 'grid' ? '#4DB049' : '#6B7280' }}>
                <i className="ri-grid-line text-sm" />
              </button>
            </div>
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
              <i className="ri-add-line" /> Ajouter Commercial
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: merchants.length, icon: 'ri-store-2-line', color: '#4DB049' },
            { label: 'Actifs', value: merchants.filter(m => m.status === 'active').length, icon: 'ri-checkbox-circle-line', color: '#22C55E' },
            { label: 'En attente', value: merchants.filter(m => m.status === 'pending').length, icon: 'ri-time-line', color: '#F97316' },
            { label: 'Suspendus', value: merchants.filter(m => m.status === 'suspended').length, icon: 'ri-forbid-line', color: '#EF4444' },
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
            <input type="text" placeholder="Rechercher par nom, propriétaire, ville..." value={search} onChange={e => handleSearchChange(e.target.value)} className="bg-transparent text-gray-900 text-sm outline-none flex-1 placeholder-gray-400" style={{ fontFamily: 'Poppins, sans-serif' }} />
          </div>
          <select value={statusFilter} onChange={e => handleStatusChange(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
            <option value="all" style={{ background: '#FFFFFF' }}>Tous statuts</option>
            <option value="active" style={{ background: '#FFFFFF' }}>Actifs</option>
            <option value="pending" style={{ background: '#FFFFFF' }}>En attente</option>
            <option value="suspended" style={{ background: '#FFFFFF' }}>Suspendus</option>
          </select>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl" style={{ background: 'rgba(77,176,89,0.1)', border: '1px solid #4DB049' }}>
            <span className="text-sm font-medium" style={{ color: '#014945' }}>{selectedIds.size} sélectionné(s)</span>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => handleBulkAction('ACTIVE')} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: '#22C55E20', color: '#22C55E', border: '1px solid #22C55E' }}>
                <i className="ri-checkbox-circle-line mr-1" />Activer
              </button>
              <button onClick={() => handleBulkAction('SUSPENDED')} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF4444' }}>
                <i className="ri-forbid-line mr-1" />Suspendre
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1' }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(m => (
              <div key={m.id} className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.01]" style={cardStyle} onClick={() => setSelectedMerchant(m)}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(77,176,89,0.15)' }}>
                      <i className={`${categoryIcons[m.category] || 'ri-store-2-line'} text-xl`} style={{ color: '#4DB049' }} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>{m.name}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{m.city}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs whitespace-nowrap" style={{ background: `${statusColors[m.status]}20`, color: statusColors[m.status] }}>{statusLabels[m.status]}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[{ label: 'Produits', val: m.products }, { label: 'Commandes', val: m.orders }, { label: 'Note', val: m.rating > 0 ? m.rating : '—' }].map(item => (
                    <div key={item.label} className="rounded-lg p-2" style={{ background: '#F5FAF5' }}>
                      <p className="font-bold text-gray-900 text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>{item.val}</p>
                      <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                    </div>
                  ))}
                </div>
                 <div className="mt-3 pt-3" style={{ borderTop: '1px solid #E8F2F1' }}>
                   <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Revenus totaux</p>
                   <p className="text-sm font-semibold" style={{ color: '#4DB049', fontFamily: 'Montserrat, sans-serif' }}>{m.revenue.toLocaleString('fr-FR')} FCFA</p>
                 </div>

                 {/* Action buttons in grid */}
                 <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 text-xs">
                   <button
                     onClick={(e) => { e.stopPropagation(); handleResetPassword(m); }}
                     className="flex items-center gap-1 text-[#F59E0B] hover:text-[#4DB049] transition-colors"
                     title="Réinitialiser mot de passe"
                   >
                     <i className="ri-key-line" /> Reset PW
                   </button>
                   <button
                     onClick={(e) => { e.stopPropagation(); setSelectedMerchant(m); }}
                     className="flex items-center gap-1 text-[#4DB049] hover:underline"
                   >
                     Détails <i className="ri-arrow-right-line" />
                   </button>
                 </div>
               </div>
             ))}
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #F0F7F0' }}>
                    <th className="px-3 py-3">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="accent-[#4DB049]" />
                    </th>
                    {['Commercial', 'Propriétaire', 'Catégories', 'Ville', 'Produits', 'Commandes', 'Revenus', 'Note', 'Statut', 'User ID', 'Mot de passe', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, idx) => (
                    <tr key={m.id} className="transition-colors hover:bg-gray-50" style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F0F7F0' : 'none', background: selectedIds.has(m.id) ? 'rgba(77,176,89,0.05)' : undefined }}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleSelect(m.id)} className="accent-[#4DB049]" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(77,176,89,0.15)' }}>
                            <i className={`${categoryIcons[m.category] || 'ri-store-2-line'} text-base`} style={{ color: '#4DB049' }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium whitespace-nowrap" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{m.name}</p>
                            <p className="text-xs font-mono" style={{ color: '#6B7280' }}>{m.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{m.owner}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {m.categories.length > 0
                            ? m.categories.slice(0, 3).map(c => (
                                <span key={c.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs" style={{ background: `${c.color ?? '#4DB049'}20`, color: c.color ?? '#4DB049', border: `1px solid ${c.color ?? '#4DB049'}40` }}>
                                  {c.icon && <i className={`${c.icon} text-[10px]`} />}{c.name}
                                </span>
                              ))
                            : <span className="text-xs" style={{ color: '#9CA3AF' }}>{m.category || '—'}</span>}
                          {m.categories.length > 3 && <span className="text-xs" style={{ color: '#6B7280' }}>+{m.categories.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{m.city}</td>
                      <td className="px-4 py-3 text-sm text-center" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{m.products}</td>
                      <td className="px-4 py-3 text-sm text-center" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{m.orders}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap font-medium" style={{ color: '#014945', fontFamily: 'Poppins, sans-serif' }}>{m.revenue.toLocaleString('fr-FR')} FCFA</td>
                      <td className="px-4 py-3">
                        {m.rating > 0 ? <div className="flex items-center gap-1"><i className="ri-star-fill text-xs" style={{ color: '#4DB049' }} /><span className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{m.rating}</span></div> : <span className="text-sm" style={{ color: '#9CA3AF' }}>—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: `${statusColors[m.status]}20`, color: statusColors[m.status] }}>{statusLabels[m.status]}</span>
                      </td>
                      <td className="px-4 py-3 text-[10px] font-mono" style={{ color: '#9CA3AF' }} title={m.userId || 'Aucun compte lié'}>
                        {m.userId ? m.userId.slice(0, 8) + '…' : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono" style={{ color: (m.tempPassword || tempPasswords[m.id]) ? '#4DB049' : '#9CA3AF' }}>
                        {(m.tempPassword || tempPasswords[m.id]) || '—'}
                      </td>
                      <td className="px-4 py-3">
                         <div className="flex items-center gap-1">
                           <button onClick={() => setSelectedMerchant(m)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" title="Voir détails">
                             <i className="ri-eye-line text-sm" style={{ color: '#6B7280' }} />
                           </button>
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleResetPassword(m); }} 
                             className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" 
                             title="Réinitialiser mot de passe"
                           >
                             <i className="ri-key-line text-sm" style={{ color: '#F59E0B' }} />
                           </button>
                           {m.status === 'pending' && (
                             <button onClick={() => setConfirmAction({ merchant: m, action: 'approve' })} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" title="Approuver">
                               <i className="ri-checkbox-circle-line text-sm" style={{ color: '#22C55E' }} />
                             </button>
                           )}
                           <button onClick={() => setConfirmAction({ merchant: m, action: 'suspend' })} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" title={m.status === 'active' ? 'Suspendre' : 'Réactiver'}>
                             <i className={`${m.status === 'active' ? 'ri-forbid-line' : 'ri-play-circle-line'} text-sm`} style={{ color: m.status === 'active' ? '#EF4444' : '#22C55E' }} />
                           </button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Merchant Detail Modal */}
      {selectedMerchant && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setSelectedMerchant(null)}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Détails Commercial</h2>
              <button onClick={() => setSelectedMerchant(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(77,176,89,0.15)' }}>
                <i className={`${categoryIcons[selectedMerchant.category] || 'ri-store-2-line'} text-2xl`} style={{ color: '#4DB049' }} />
              </div>
              <div>
                <p className="font-semibold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{selectedMerchant.name}</p>
                <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{selectedMerchant.id} — {selectedMerchant.category}</p>
                <span className="px-2 py-0.5 rounded-full text-xs mt-1 inline-block" style={{ background: `${statusColors[selectedMerchant.status]}20`, color: statusColors[selectedMerchant.status] }}>{statusLabels[selectedMerchant.status]}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Propriétaire', value: selectedMerchant.owner, icon: 'ri-user-line' },
                { label: 'Email', value: selectedMerchant.email, icon: 'ri-mail-line' },
                { label: 'Téléphone', value: selectedMerchant.phone, icon: 'ri-phone-line' },
                { label: 'Ville', value: selectedMerchant.city, icon: 'ri-map-pin-line' },
                { label: 'Produits', value: selectedMerchant.products, icon: 'ri-shopping-bag-3-line' },
                { label: 'Commandes', value: selectedMerchant.orders, icon: 'ri-file-list-3-line' },
                { label: 'Marché d\'opération', value: selectedMerchant.operatingMarket || 'Non spécifié', icon: 'ri-global-line' },
                { label: 'Revenus Totaux', value: `${selectedMerchant.revenue.toLocaleString('fr-FR')} FCFA`, icon: 'ri-money-cny-circle-line' },
                 { label: 'Note Moyenne', value: selectedMerchant.rating > 0 ? `${selectedMerchant.rating}/5` : 'N/A', icon: 'ri-star-line' },
                 { label: 'Compte Utilisateur (userId)', value: selectedMerchant.userId || 'Aucun lié', icon: 'ri-link' },
               ].map(item => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <i className={`${item.icon} text-xs`} style={{ color: '#4DB049' }} />
                    <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{item.value}</p>
                </div>
              ))}
            </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleResetPassword(selectedMerchant)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
                  style={{ background: '#F5FAF5', color: '#4DB049', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}
                >
                  <i className="ri-key-line mr-2" />Réinitialiser mot de passe
                </button>

                {(!selectedMerchant.userId || selectedMerchant.userId === selectedMerchant.id) && (
                  <button
                    onClick={async () => {
                      const res = await adminApi.repairMerchantLinkage(selectedMerchant.id);
                      if (res.error) {
                        addToast('error', 'Erreur', res.error);
                      } else {
                        addToast('success', 'Lien réparé', `Nouveau compte : ${res.email}. Mot de passe temporaire : ${res.temporaryPassword}`);
                        // Reload list and update selected
                        try {
                          const fresh = await adminApi.merchants({ limit: 200 });
                          const data = fresh as Paginated<BackendMerchant>;
                          const mapped = data.items.map(mapMerchant) as unknown as Merchant[];
                          setMerchants(mapped);
                          const updated = mapped.find(m => m.id === selectedMerchant.id);
                          if (updated) setSelectedMerchant(updated);
                        } catch { /* refresh failed silently */ }
                      }
                    }}
                    className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
                    style={{ background: '#F5FAF5', color: '#4DB049', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}
                  >
                    <i className="ri-link mr-2" />Réparer le lien utilisateur
                  </button>
                )}

               {selectedMerchant.status === 'pending' && (
                 <button onClick={() => { setSelectedMerchant(null); setConfirmAction({ merchant: selectedMerchant, action: 'reject' }); }} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                   <i className="ri-close-circle-line mr-2" />Rejeter
                 </button>
               )}
               <button onClick={() => { setSelectedMerchant(null); setConfirmAction({ merchant: selectedMerchant, action: selectedMerchant.status === 'pending' ? 'approve' : 'suspend' }); }} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                 <i className={`${selectedMerchant.status === 'pending' ? 'ri-checkbox-circle-line' : selectedMerchant.status === 'active' ? 'ri-forbid-line' : 'ri-play-circle-line'} mr-2`} />
                 {selectedMerchant.status === 'pending' ? 'Approuver' : selectedMerchant.status === 'active' ? 'Suspendre' : 'Réactiver'}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Reset Password Result Modal */}
      {resetResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setResetResult(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold" style={{ color: '#014945' }}>Mot de passe réinitialisé</h3>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              Nouveau mot de passe temporaire pour <strong>{resetResult.merchant.email}</strong> :
            </p>
            <div className="p-4 rounded-xl font-mono text-xl text-center" style={{ background: 'rgba(77,176,89,0.1)', color: '#4DB049', border: '1px solid #4DB049' }}>
              {resetResult.tempPassword}
            </div>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Communiquez ce mot de passe au marchand. Il pourra le changer après connexion.</p>
            <button onClick={() => setResetResult(null)} className="w-full py-2.5 rounded-lg font-medium" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF' }}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Add Merchant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Ajouter un Commercial</h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nom de la boutique *', key: 'name', type: 'text' },
                { label: 'Propriétaire *', key: 'owner', type: 'text' },
                { label: 'Email *', key: 'email', type: 'email' },
                { label: 'Mot de passe *', key: 'password', type: 'password' },
                { label: 'Téléphone', key: 'phone', type: 'text' },
                { label: 'Ville', key: 'city', type: 'text' },
                { label: 'Marché d\'opération', key: 'operatingMarket', type: 'text' },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                  <input type={field.type} value={addForm[field.key as keyof typeof addForm]} onChange={e => setAddForm(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
                </div>
              ))}
              <CategoryPicker
                allCategories={availableCategories}
                selected={addCategoryIds}
                onChange={setAddCategoryIds}
                onAllChange={setAddAllCategories}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleAddMerchant} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-add-line mr-2" />Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination for Admin Merchants */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="text-xs" style={{ color: '#6B7280' }}>Page {page} / {totalPages} — {total} commerçants</div>
          <div className="flex gap-1">
            <button onClick={() => loadMerchants(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 rounded text-sm disabled:opacity-40" style={{ background: '#F5FAF5', color: '#4DB049' }}>Précédent</button>
            <button onClick={() => loadMerchants(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1 rounded text-sm disabled:opacity-40" style={{ background: '#F5FAF5', color: '#4DB049' }}>Suivant</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.action === 'approve' ? 'Approuver le commercial' : confirmAction?.action === 'reject' ? 'Rejeter le commercial' : confirmAction?.merchant.status === 'active' ? 'Suspendre le commercial' : 'Réactiver le commercial'}
        message={confirmAction?.action === 'approve' ? `Approuver ${confirmAction?.merchant.name} et l'activer sur la plateforme ?` : confirmAction?.action === 'reject' ? `Rejeter la demande de ${confirmAction?.merchant.name} ?` : `${confirmAction?.merchant.status === 'active' ? 'Suspendre' : 'Réactiver'} ${confirmAction?.merchant.name} ?`}
        confirmLabel={confirmAction?.action === 'approve' ? 'Approuver' : confirmAction?.action === 'reject' ? 'Rejeter' : confirmAction?.merchant.status === 'active' ? 'Suspendre' : 'Réactiver'}
        confirmColor={confirmAction?.action === 'approve' ? '#22C55E' : confirmAction?.action === 'reject' ? '#EF4444' : confirmAction?.merchant.status === 'active' ? '#EF4444' : '#22C55E'}
        icon={confirmAction?.action === 'approve' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}
        onConfirm={handleAction}
        onCancel={() => setConfirmAction(null)}
      />

      <Toast toasts={toasts} onRemove={removeToast} />
    </AdminLayout>
  );
}
