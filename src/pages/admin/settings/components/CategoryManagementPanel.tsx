import { useState } from 'react';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { platformCategories, PlatformCategory } from '@/mocks/adminCategories';

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="relative w-11 h-6 rounded-full transition-all cursor-pointer flex-shrink-0" style={{ background: enabled ? 'linear-gradient(135deg, #D4AF37, #F5D76E)' : 'rgba(255,255,255,0.15)' }}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: enabled ? '22px' : '2px', background: enabled ? '#0A1628' : 'rgba(255,255,255,0.6)' }} />
    </button>
  );
}

export default function CategoryManagementPanel() {
  const [categories, setCategories] = useState<PlatformCategory[]>(platformCategories);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editCategory, setEditCategory] = useState<PlatformCategory | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: 'ri-price-tag-3-line',
    color: '#D4AF37',
    featured: false,
  });

  const iconOptions = [
    'ri-smartphone-line', 'ri-t-shirt-line', 'ri-home-smile-line', 'ri-heart-pulse-line',
    'ri-basketball-line', 'ri-sofa-line', 'ri-magic-line', 'ri-car-line',
    'ri-parent-line', 'ri-restaurant-line', 'ri-book-open-line', 'ri-headphone-line',
    'ri-gift-line', 'ri-plant-line', 'ri-tools-line', 'ri-price-tag-3-line',
  ];

  const colorOptions = [
    '#D4AF37', '#22C55E', '#EF4444', '#4A9EFF', '#8B5CF6',
    '#F59E0B', '#EC4899', '#10B981', '#E066FF', '#6B7280',
  ];

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => a.sortOrder - b.sortOrder);

  const activeCount = categories.filter(c => c.active).length;
  const totalProducts = categories.reduce((s, c) => s + c.productsCount, 0);
  const totalMerchants = categories.reduce((s, c) => s + c.merchantsCount, 0);

  const toggleActive = (id: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
    const cat = categories.find(c => c.id === id);
    addToast('success', `Catégorie ${cat?.active ? 'désactivée' : 'activée'}`, `${cat?.name} est maintenant ${cat?.active ? 'inactive' : 'active'}.`);
  };

  const toggleFeatured = (id: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, featured: !c.featured } : c));
    const cat = categories.find(c => c.id === id);
    addToast('info', cat?.featured ? 'Retiré des vedettes' : 'Mis en vedette', `${cat?.name} ${cat?.featured ? 'retiré' : 'ajouté'} à la page d'accueil.`);
  };

  const handleAdd = () => {
    if (!form.name.trim() || !form.description.trim()) {
      addToast('error', 'Champs requis', 'Veuillez remplir le nom et la description.');
      return;
    }
    const newCat: PlatformCategory = {
      id: form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      name: form.name.trim(),
      description: form.description.trim(),
      icon: form.icon,
      color: form.color,
      productsCount: 0,
      merchantsCount: 0,
      active: true,
      featured: form.featured,
      createdAt: new Date().toISOString().split('T')[0],
      sortOrder: categories.length + 1,
    };
    setCategories(prev => [...prev, newCat]);
    setShowAddModal(false);
    setForm({ name: '', description: '', icon: 'ri-price-tag-3-line', color: '#D4AF37', featured: false });
    addToast('success', 'Catégorie ajoutée', `${newCat.name} a été créée avec succès.`);
  };

  const handleUpdate = () => {
    if (!editCategory) return;
    setCategories(prev => prev.map(c => c.id === editCategory.id ? editCategory : c));
    setEditCategory(null);
    addToast('success', 'Catégorie mise à jour', 'Les informations de la catégorie ont été modifiées.');
  };

  const handleDelete = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    setDeleteId(null);
    addToast('info', 'Catégorie supprimée', 'La catégorie a été retirée de la plateforme.');
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const list = [...categories];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;
    setCategories(list.map((c, i) => ({ ...c, sortOrder: i + 1 })));
  };

  const moveDown = (index: number) => {
    if (index === categories.length - 1) return;
    const list = [...categories];
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;
    setCategories(list.map((c, i) => ({ ...c, sortOrder: i + 1 })));
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Catégories totales', value: categories.length.toString(), icon: 'ri-folder-line', color: '#D4AF37' },
          { label: 'Catégories actives', value: activeCount.toString(), icon: 'ri-checkbox-circle-line', color: '#22C55E' },
          { label: 'Produits référencés', value: totalProducts.toLocaleString(), icon: 'ri-shopping-bag-3-line', color: '#4A9EFF' },
          { label: 'Commerçants', value: totalMerchants.toLocaleString(), icon: 'ri-store-3-line', color: '#F59E0B' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }}>
            <div className="flex items-center gap-2 mb-2">
              <i className={card.icon} style={{ color: card.color }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>{card.label}</span>
            </div>
            <p className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }} />
          <input
            type="text"
            placeholder="Rechercher une catégorie..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none text-white"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
          />
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
          <i className="ri-add-line" /> Ajouter
        </button>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((cat, index) => (
          <div key={cat.id} className="rounded-2xl p-5 space-y-4" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: `1px solid ${cat.active ? `${cat.color}30` : 'rgba(255,255,255,0.06)'}` }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cat.color}18` }}>
                  <i className={cat.icon} style={{ color: cat.color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{cat.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{cat.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {cat.featured && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${cat.color}18`, color: cat.color }}>Vedette</span>}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: cat.active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: cat.active ? '#22C55E' : '#EF4444' }}>
                  {cat.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-sm font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>{cat.productsCount.toLocaleString()}</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Produits</p>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-sm font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>{cat.merchantsCount}</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Commerçants</p>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-sm font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>#{cat.sortOrder}</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Ordre</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-1.5">
                <button onClick={() => moveUp(index)} disabled={index === 0} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer disabled:opacity-30 hover:bg-white/5 transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <i className="ri-arrow-up-line" />
                </button>
                <button onClick={() => moveDown(index)} disabled={index === filtered.length - 1} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer disabled:opacity-30 hover:bg-white/5 transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <i className="ri-arrow-down-line" />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Active</span>
                  <ToggleSwitch enabled={cat.active} onChange={() => toggleActive(cat.id)} />
                </div>
                <button onClick={() => toggleFeatured(cat.id)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer hover:bg-white/5 transition-colors" style={{ color: cat.featured ? cat.color : 'rgba(255,255,255,0.3)' }} title={cat.featured ? 'Retirer des vedettes' : 'Mettre en vedette'}>
                  <i className={cat.featured ? 'ri-star-fill' : 'ri-star-line'} />
                </button>
                <button onClick={() => setEditCategory(cat)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer hover:bg-white/5 transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <i className="ri-edit-line" />
                </button>
                <button onClick={() => setDeleteId(cat.id)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer hover:bg-white/5 transition-colors" style={{ color: '#EF4444' }}>
                  <i className="ri-delete-bin-line" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }}>
          <i className="ri-folder-open-line text-3xl mb-3 block" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Aucune catégorie ne correspond à votre recherche.</p>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Nouvelle Catégorie</h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)' }}><i className="ri-close-line text-lg" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Nom *</label>
                <input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'Poppins, sans-serif' }} placeholder="Ex: Livres & Culture" />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Description *</label>
                <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} maxLength={200} rows={3} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'Poppins, sans-serif' }} placeholder="Décrivez cette catégorie..." />
                <p className="text-[10px] mt-1 text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>{form.description.length}/200</p>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Icône</label>
                <div className="grid grid-cols-8 gap-2">
                  {iconOptions.map(icon => (
                    <button key={icon} onClick={() => setForm(prev => ({ ...prev, icon }))} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: form.icon === icon ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.icon === icon ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.06)'}` }}>
                      <i className={icon} style={{ color: form.icon === icon ? '#D4AF37' : 'rgba(255,255,255,0.3)' }} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Couleur</label>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map(color => (
                    <button key={color} onClick={() => setForm(prev => ({ ...prev, color }))} className="w-7 h-7 rounded-full cursor-pointer transition-all flex-shrink-0" style={{ background: color, border: `2px solid ${form.color === color ? '#fff' : 'transparent'}` }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ToggleSwitch enabled={form.featured} onChange={() => setForm(prev => ({ ...prev, featured: !prev.featured }))} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Afficher en vedette sur la page d'accueil</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-add-line mr-2" />Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setEditCategory(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Modifier la Catégorie</h2>
              <button onClick={() => setEditCategory(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)' }}><i className="ri-close-line text-lg" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Nom</label>
                <input type="text" value={editCategory.name} onChange={e => setEditCategory(prev => prev ? { ...prev, name: e.target.value } : null)} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'Poppins, sans-serif' }} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Description</label>
                <textarea value={editCategory.description} onChange={e => setEditCategory(prev => prev ? { ...prev, description: e.target.value } : null)} maxLength={200} rows={3} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'Poppins, sans-serif' }} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Icône</label>
                <div className="grid grid-cols-8 gap-2">
                  {iconOptions.map(icon => (
                    <button key={icon} onClick={() => setEditCategory(prev => prev ? { ...prev, icon } : null)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: editCategory.icon === icon ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${editCategory.icon === icon ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.06)'}` }}>
                      <i className={icon} style={{ color: editCategory.icon === icon ? '#D4AF37' : 'rgba(255,255,255,0.3)' }} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Couleur</label>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map(color => (
                    <button key={color} onClick={() => setEditCategory(prev => prev ? { ...prev, color } : null)} className="w-7 h-7 rounded-full cursor-pointer transition-all flex-shrink-0" style={{ background: color, border: `2px solid ${editCategory.color === color ? '#fff' : 'transparent'}` }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ToggleSwitch enabled={editCategory.featured} onChange={() => setEditCategory(prev => prev ? { ...prev, featured: !prev.featured } : null)} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Afficher en vedette sur la page d'accueil</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditCategory(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleUpdate} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-save-line mr-2" />Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <ConfirmDialog
          title="Supprimer la catégorie"
          message={`Voulez-vous vraiment supprimer ${categories.find(c => c.id === deleteId)?.name} ? Cette action est irréversible.`}
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}