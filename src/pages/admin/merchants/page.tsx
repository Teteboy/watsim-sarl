import { useState } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { adminMerchants as initialMerchants } from '@/mocks/adminMerchants';

type Merchant = typeof initialMerchants[0] & { password?: string };

const statusColors: Record<string, string> = { active: '#22C55E', pending: '#F97316', suspended: '#EF4444' };
const statusLabels: Record<string, string> = { active: 'Actif', pending: 'En attente', suspended: 'Suspendu' };
const categoryIcons: Record<string, string> = {
  'Électronique': 'ri-computer-line', 'Mode & Vêtements': 'ri-t-shirt-line', 'Alimentation': 'ri-restaurant-line',
  'Maison & Déco': 'ri-home-4-line', 'Santé & Beauté': 'ri-heart-pulse-line', 'Automobile': 'ri-car-line',
  'Éducation': 'ri-book-open-line', 'Sport & Loisirs': 'ri-football-line',
};

const categories = ['Électronique', 'Mode & Vêtements', 'Alimentation', 'Maison & Déco', 'Santé & Beauté', 'Automobile', 'Éducation', 'Sport & Loisirs'];

export default function AdminMerchantsPage() {
  const [merchants, setMerchants] = useState(initialMerchants);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [confirmAction, setConfirmAction] = useState<{ merchant: Merchant; action: 'approve' | 'reject' | 'suspend' } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', owner: '', email: '', password: '', phone: '', category: 'Électronique', city: '', operatingMarket: '' });
  const { toasts, addToast, removeToast } = useToast();

  const filtered = merchants.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.owner.toLowerCase().includes(search.toLowerCase()) || m.city.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleAction = () => {
    if (!confirmAction) return;
    const { merchant, action } = confirmAction;
    let newStatus: string = merchant.status;
    let toastMsg = '';
    if (action === 'approve') { newStatus = 'active'; toastMsg = `${merchant.name} a été approuvé et activé.`; }
    else if (action === 'reject') { newStatus = 'suspended'; toastMsg = `${merchant.name} a été rejeté.`; }
    else if (action === 'suspend') { newStatus = merchant.status === 'active' ? 'suspended' : 'active'; toastMsg = `${merchant.name} a été ${newStatus === 'suspended' ? 'suspendu' : 'réactivé'}.`; }
    setMerchants(prev => prev.map(m => m.id === merchant.id ? { ...m, status: newStatus, verified: action === 'approve' ? true : m.verified } : m));
    if (selectedMerchant?.id === merchant.id) setSelectedMerchant(prev => prev ? { ...prev, status: newStatus } : null);
    setConfirmAction(null);
    addToast(action === 'reject' ? 'error' : 'success', action === 'approve' ? 'Commercial approuvé' : action === 'reject' ? 'Commercial rejeté' : newStatus === 'suspended' ? 'Commercial suspendu' : 'Commercial réactivé', toastMsg);
  };

  const handleAddMerchant = () => {
    if (!addForm.name || !addForm.owner || !addForm.email || !addForm.password) { addToast('error', 'Champs requis', 'Veuillez remplir tous les champs obligatoires.'); return; }
    const newMerchant: Merchant = {
      id: `MCH-${String(merchants.length + 1).padStart(3, '0')}`,
      name: addForm.name, owner: addForm.owner, email: addForm.email, password: addForm.password, phone: addForm.phone,
      category: addForm.category, city: addForm.city, operatingMarket: addForm.operatingMarket || 'Non spécifié', status: 'pending', verified: false,
      products: 0, orders: 0, revenue: 0, joinedAt: new Date().toISOString().split('T')[0], rating: 0,
    };
    setMerchants(prev => [newMerchant, ...prev]);
    setShowAddModal(false);
    setAddForm({ name: '', owner: '', email: '', password: '', phone: '', category: 'Électronique', city: '', operatingMarket: '' });
    addToast('success', 'Commercial ajouté', `${addForm.name} a été ajouté en attente de validation.`);
  };

  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'Poppins, sans-serif' };

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Gestion', 'Commerciaux']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Gestion des Commerciaux</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{merchants.length} partenaires enregistrés</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => setViewMode('table')} className="w-8 h-8 flex items-center justify-center rounded-md transition-all cursor-pointer" style={{ background: viewMode === 'table' ? 'rgba(212,175,55,0.2)' : 'transparent', color: viewMode === 'table' ? '#D4AF37' : 'rgba(255,255,255,0.4)' }}>
                <i className="ri-list-check text-sm" />
              </button>
              <button onClick={() => setViewMode('grid')} className="w-8 h-8 flex items-center justify-center rounded-md transition-all cursor-pointer" style={{ background: viewMode === 'grid' ? 'rgba(212,175,55,0.2)' : 'transparent', color: viewMode === 'grid' ? '#D4AF37' : 'rgba(255,255,255,0.4)' }}>
                <i className="ri-grid-line text-sm" />
              </button>
            </div>
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
              <i className="ri-add-line" /> Ajouter Commercial
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: merchants.length, icon: 'ri-store-2-line', color: '#D4AF37' },
            { label: 'Actifs', value: merchants.filter(m => m.status === 'active').length, icon: 'ri-checkbox-circle-line', color: '#22C55E' },
            { label: 'En attente', value: merchants.filter(m => m.status === 'pending').length, icon: 'ri-time-line', color: '#F97316' },
            { label: 'Suspendus', value: merchants.filter(m => m.status === 'suspended').length, icon: 'ri-forbid-line', color: '#EF4444' },
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
            <input type="text" placeholder="Rechercher par nom, propriétaire, ville..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent text-white text-sm outline-none flex-1 placeholder-white/30" style={{ fontFamily: 'Poppins, sans-serif' }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>
            <option value="all" style={{ background: '#0D1B2A' }}>Tous statuts</option>
            <option value="active" style={{ background: '#0D1B2A' }}>Actifs</option>
            <option value="pending" style={{ background: '#0D1B2A' }}>En attente</option>
            <option value="suspended" style={{ background: '#0D1B2A' }}>Suspendus</option>
          </select>
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(m => (
              <div key={m.id} className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.01]" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }} onClick={() => setSelectedMerchant(m)}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.15)' }}>
                      <i className={`${categoryIcons[m.category] || 'ri-store-2-line'} text-xl`} style={{ color: '#D4AF37' }} />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>{m.name}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{m.city}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs whitespace-nowrap" style={{ background: `${statusColors[m.status]}20`, color: statusColors[m.status] }}>{statusLabels[m.status]}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[{ label: 'Produits', val: m.products }, { label: 'Commandes', val: m.orders }, { label: 'Note', val: m.rating > 0 ? m.rating : '—' }].map(item => (
                    <div key={item.label} className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-white font-bold text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>{item.val}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Revenus totaux</p>
                  <p className="text-sm font-semibold" style={{ color: '#D4AF37', fontFamily: 'Montserrat, sans-serif' }}>{m.revenue.toLocaleString('fr-FR')} FCFA</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Commercial', 'Propriétaire', 'Catégorie', 'Ville', 'Produits', 'Commandes', 'Revenus', 'Note', 'Statut', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, idx) => (
                    <tr key={m.id} className="transition-colors hover:bg-white/3" style={{ borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(212,175,55,0.15)' }}>
                            <i className={`${categoryIcons[m.category] || 'ri-store-2-line'} text-base`} style={{ color: '#D4AF37' }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{m.name}</p>
                            <p className="text-xs font-mono" style={{ color: '#D4AF37' }}>{m.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>{m.owner}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif' }}>{m.category}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif' }}>{m.city}</td>
                      <td className="px-4 py-3 text-sm text-center" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>{m.products}</td>
                      <td className="px-4 py-3 text-sm text-center" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>{m.orders}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap font-medium" style={{ color: '#D4AF37', fontFamily: 'Poppins, sans-serif' }}>{m.revenue.toLocaleString('fr-FR')} FCFA</td>
                      <td className="px-4 py-3">
                        {m.rating > 0 ? <div className="flex items-center gap-1"><i className="ri-star-fill text-xs" style={{ color: '#D4AF37' }} /><span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>{m.rating}</span></div> : <span className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: `${statusColors[m.status]}20`, color: statusColors[m.status] }}>{statusLabels[m.status]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelectedMerchant(m)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                            <i className="ri-eye-line text-sm" style={{ color: '#D4AF37' }} />
                          </button>
                          {m.status === 'pending' && (
                            <button onClick={() => setConfirmAction({ merchant: m, action: 'approve' })} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-500/10 transition-colors cursor-pointer" title="Approuver">
                              <i className="ri-checkbox-circle-line text-sm" style={{ color: '#22C55E' }} />
                            </button>
                          )}
                          <button onClick={() => setConfirmAction({ merchant: m, action: 'suspend' })} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer" title={m.status === 'active' ? 'Suspendre' : 'Réactiver'}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setSelectedMerchant(null)}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-5" style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Détails Commercial</h2>
              <button onClick={() => setSelectedMerchant(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.15)' }}>
                <i className={`${categoryIcons[selectedMerchant.category] || 'ri-store-2-line'} text-2xl`} style={{ color: '#D4AF37' }} />
              </div>
              <div>
                <p className="text-white font-semibold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>{selectedMerchant.name}</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>{selectedMerchant.id} — {selectedMerchant.category}</p>
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
              {selectedMerchant.status === 'pending' && (
                <button onClick={() => { setSelectedMerchant(null); setConfirmAction({ merchant: selectedMerchant, action: 'reject' }); }} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                  <i className="ri-close-circle-line mr-2" />Rejeter
                </button>
              )}
              <button onClick={() => { setSelectedMerchant(null); setConfirmAction({ merchant: selectedMerchant, action: selectedMerchant.status === 'pending' ? 'approve' : 'suspend' }); }} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
                <i className={`${selectedMerchant.status === 'pending' ? 'ri-checkbox-circle-line' : selectedMerchant.status === 'active' ? 'ri-forbid-line' : 'ri-play-circle-line'} mr-2`} />
                {selectedMerchant.status === 'pending' ? 'Approuver' : selectedMerchant.status === 'active' ? 'Suspendre' : 'Réactiver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Merchant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Ajouter un Commercial</h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)' }}>
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
                  <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                  <input type={field.type} value={addForm[field.key as keyof typeof addForm]} onChange={e => setAddForm(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
                </div>
              ))}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Catégorie</label>
                <select value={addForm.category} onChange={e => setAddForm(prev => ({ ...prev, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                  {categories.map(c => <option key={c} value={c} style={{ background: '#0D1B2A' }}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleAddMerchant} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-add-line mr-2" />Ajouter
              </button>
            </div>
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
