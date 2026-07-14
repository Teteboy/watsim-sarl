import { useState, useEffect } from 'react';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { adminApi, tokenStore } from '@/lib/api';
type PlatformCategory = any; // real from adminApi.categories()

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="relative w-11 h-6 rounded-full transition-all cursor-pointer flex-shrink-0" style={{ background: enabled ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#E8F2F1' }}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: enabled ? '22px' : '2px', background: enabled ? '#FFFFFF' : '#9CA3AF' }} />
    </button>
  );
}

export default function CategoryManagementPanel() {
  const [categories, setCategories] = useState<PlatformCategory[]>([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editCategory, setEditCategory] = useState<PlatformCategory | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingMarginId, setEditingMarginId] = useState<string | null>(null);
  const [marginValue, setMarginValue] = useState('');
  const [showGlobalMarginModal, setShowGlobalMarginModal] = useState(false);
  const [globalMarginValue, setGlobalMarginValue] = useState('');
  const { toasts, addToast, removeToast } = useToast();

  // Load from backend (seed defaults if table empty)
  useEffect(() => {
    if (!tokenStore?.access) {
      setCategories([]);
      return;
    }
    (async () => {
      try {
        const catsFn = adminApi.categories;
        let list: any[] = catsFn ? await catsFn() : [];
        if (!Array.isArray(list)) list = (list as any)?.data || [];
        if (list.length === 0) {
          // seed some common categories
          const defaults = [
            { name: 'Électronique', description: 'Smartphones, ordinateurs, appareils électroniques', icon: 'ri-smartphone-line', color: '#D4AF37', featured: true },
            { name: 'Mode', description: 'Vêtements, chaussures et accessoires', icon: 'ri-t-shirt-line', color: '#22C55E', featured: true },
            { name: 'Maison', description: 'Meubles, décoration et électroménager', icon: 'ri-home-smile-line', color: '#4A9EFF' },
            { name: 'Santé & Beauté', description: 'Produits de santé, cosmétiques et bien-être', icon: 'ri-heart-pulse-line', color: '#EF4444' },
          ];
          for (const d of defaults) {
            try { await adminApi.createCategory(d); } catch { /* skip if already exists */ }
          }
          list = catsFn ? await catsFn() : [];
          if (!Array.isArray(list)) list = (list as any)?.data || [];
        }
        setCategories(list);
      } catch {
        setCategories([]);
      }
    })();
  }, []);

  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: 'ri-price-tag-3-line',
    color: '#D4AF37',
    featured: false,
    bnplEnabled: true,
    maxCredit: '',
    minScore: '',
    merchantCommission: '',
  });

  const iconOptions = [
    'ri-smartphone-line', 'ri-t-shirt-line', 'ri-home-smile-line', 'ri-heart-pulse-line',
    'ri-basketball-line', 'ri-sofa-line', 'ri-magic-line', 'ri-car-line',
    'ri-parent-line', 'ri-restaurant-line', 'ri-book-open-line', 'ri-headphone-line',
    'ri-gift-line', 'ri-plant-line', 'ri-tools-line', 'ri-price-tag-3-line',
  ];

  const colorOptions = [
    '#4DB049', '#22C55E', '#EF4444', '#4A9EFF', '#8B5CF6',
    '#F59E0B', '#EC4899', '#10B981', '#E066FF', '#6B7280',
  ];

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => a.sortOrder - b.sortOrder);

  const activeCount = categories.filter(c => c.active).length;
  const totalProducts = categories.reduce((s, c) => s + c.productsCount, 0);
  const totalMerchants = categories.reduce((s, c) => s + c.merchantsCount, 0);

  const toggleActive = async (id: string) => {
    const cat = categories.find((c: any) => c.id === id);
    if (!cat) return;
    const newActive = !cat.active;
    setCategories(prev => prev.map((c: any) => c.id === id ? { ...c, active: newActive } : c));
    try {
      await adminApi.updateCategory(id, { active: newActive });
      addToast('success', `Catégorie ${newActive ? 'activée' : 'désactivée'}`, `${cat.name} est maintenant ${newActive ? 'active' : 'inactive'}.`);
    } catch {
      setCategories(prev => prev.map((c: any) => c.id === id ? { ...c, active: cat.active } : c));
      addToast('error', 'Erreur', 'Mise à jour échouée.');
    }
  };

  const toggleFeatured = async (id: string) => {
    const cat = categories.find((c: any) => c.id === id);
    if (!cat) return;
    const newFeatured = !cat.featured;
    setCategories(prev => prev.map((c: any) => c.id === id ? { ...c, featured: newFeatured } : c));
    try {
      await adminApi.updateCategory(id, { featured: newFeatured });
      addToast('info', newFeatured ? 'Mis en vedette' : 'Retiré des vedettes', `${cat.name} ${newFeatured ? 'ajouté' : 'retiré'} de la page d\'accueil.`);
    } catch {
      setCategories(prev => prev.map((c: any) => c.id === id ? { ...c, featured: cat.featured } : c));
      addToast('error', 'Erreur', 'Mise à jour échouée.');
    }
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      addToast('error', 'Champs requis', 'Veuillez remplir le nom et la description.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      icon: form.icon,
      color: form.color,
      featured: form.featured,
      bnplEnabled: form.bnplEnabled,
      ...(form.maxCredit ? { maxCredit: Number(form.maxCredit) } : {}),
      ...(form.minScore ? { minScore: Number(form.minScore) } : {}),
      ...(form.merchantCommission ? { merchantCommission: Number(form.merchantCommission) } : {}),
    };
    try {
      const created = await adminApi.createCategory(payload);
      setCategories(prev => [...prev, created]);
      setShowAddModal(false);
      setForm({ name: '', description: '', icon: 'ri-price-tag-3-line', color: '#D4AF37', featured: false, bnplEnabled: true, maxCredit: '', minScore: '', merchantCommission: '' });
      addToast('success', 'Catégorie ajoutée', `${payload.name} a été créée avec succès.`);
    } catch {
      addToast('error', 'Erreur', 'Impossible de créer la catégorie.');
    }
  };

  const handleUpdate = async () => {
    if (!editCategory) return;
    try {
      await adminApi.updateCategory(editCategory.id, editCategory);
      setCategories(prev => prev.map((c: any) => c.id === editCategory.id ? editCategory : c));
      setEditCategory(null);
      addToast('success', 'Catégorie mise à jour', 'Les informations de la catégorie ont été modifiées.');
    } catch {
      addToast('error', 'Erreur', 'Échec de la mise à jour.');
    }
  };

  const openMarginEdit = (cat: PlatformCategory) => {
    setEditingMarginId(cat.id);
    setMarginValue(String(cat.markupPercentage ?? 20));
  };

  const saveMargin = async (catId: string) => {
    const margin = parseFloat(marginValue);
    if (isNaN(margin) || margin < 0 || margin > 100) {
      addToast('error', 'Erreur', 'La marge doit être entre 0 et 100%');
      return;
    }
    try {
      await adminApi.updateCategoryMargin(catId, margin);
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, markupPercentage: margin } : c));
      addToast('success', 'Marge mise à jour', `Marge mise à jour à ${margin}%`);
    } catch {
      addToast('error', 'Erreur', 'Impossible de mettre à jour la marge');
    }
    setEditingMarginId(null);
  };

  const handleGlobalMargin = () => {
    setGlobalMarginValue('20');
    setShowGlobalMarginModal(true);
  };

  const handleSaveGlobalMargin = async () => {
    if (!globalMarginValue) return;
    const margin = parseFloat(globalMarginValue);
    if (isNaN(margin) || margin < 0 || margin > 100) {
      addToast('error', 'Erreur', 'La marge doit être entre 0 et 100%');
      return;
    }
    try {
      const result = await adminApi.updateAllCategoryMargins(margin);
      setCategories(prev => prev.map(c => ({ ...c, markupPercentage: margin })));
      setShowGlobalMarginModal(false);
      addToast('success', 'Marges mises à jour', `${result.categoriesUpdated} catégories et ${result.productsUpdated} produits mis à jour`);
    } catch {
      addToast('error', 'Erreur', 'Impossible de mettre à jour les marges');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminApi.deleteCategory(id);
      setCategories(prev => prev.filter((c: any) => c.id !== id));
      setDeleteId(null);
      addToast('info', 'Catégorie supprimée', 'La catégorie a été retirée de la plateforme.');
    } catch {
      addToast('error', 'Erreur', 'Suppression impossible (peut-être utilisée).');
    }
  };

  const moveUp = async (index: number) => {
    if (index === 0) return;
    const list: any[] = [...categories];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;
    const updatedList = list.map((c, i) => ({ ...c, sortOrder: i + 1 }));
    setCategories(updatedList);
    // persist the two changed
    try {
      await Promise.all([
        adminApi.updateCategory(updatedList[index].id, { sortOrder: updatedList[index].sortOrder }),
        adminApi.updateCategory(updatedList[index-1].id, { sortOrder: updatedList[index-1].sortOrder }),
      ]);
    } catch {
      // revert not critical
    }
  };

  const moveDown = async (index: number) => {
    if (index === categories.length - 1) return;
    const list: any[] = [...categories];
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;
    const updatedList = list.map((c, i) => ({ ...c, sortOrder: i + 1 }));
    setCategories(updatedList);
    try {
      await Promise.all([
        adminApi.updateCategory(updatedList[index].id, { sortOrder: updatedList[index].sortOrder }),
        adminApi.updateCategory(updatedList[index+1].id, { sortOrder: updatedList[index+1].sortOrder }),
      ]);
    } catch { /* sort persist failed silently */ }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Catégories totales', value: categories.length.toString(), icon: 'ri-folder-line', color: '#4DB049' },
          { label: 'Catégories actives', value: activeCount.toString(), icon: 'ri-checkbox-circle-line', color: '#22C55E' },
          { label: 'Produits référencés', value: totalProducts.toLocaleString(), icon: 'ri-shopping-bag-3-line', color: '#4A9EFF' },
          { label: 'Commerçants', value: totalMerchants.toLocaleString(), icon: 'ri-store-3-line', color: '#F59E0B' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}>
            <div className="flex items-center gap-2 mb-2">
              <i className={card.icon} style={{ color: card.color }} />
              <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{card.label}</span>
            </div>
            <p className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#9CA3AF' }} />
          <input
            type="text"
            placeholder="Rechercher une catégorie..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
          />
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
          <i className="ri-add-line" /> Ajouter
        </button>
        <button onClick={handleGlobalMargin} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
          <i className="ri-percent-line" /> Marge Globale
        </button>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((cat, index) => (
          <div key={cat.id} className="rounded-2xl p-5 space-y-4" style={{ background: '#FFFFFF', border: `1px solid ${cat.active ? `${cat.color}30` : '#E8F2F1'}` }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cat.color}18` }}>
                  <i className={cat.icon} style={{ color: cat.color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{cat.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{cat.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {cat.featured && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${cat.color}18`, color: cat.color }}>Vedette</span>}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: cat.active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: cat.active ? '#22C55E' : '#EF4444' }}>
                  {cat.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-2 rounded-lg" style={{ background: '#F5FAF5' }}>
                <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>{cat.productsCount.toLocaleString()}</p>
                <p className="text-[10px]" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Produits</p>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ background: '#F5FAF5' }}>
                <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>{cat.merchantsCount}</p>
                <p className="text-[10px]" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Commerçants</p>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ background: editingMarginId === cat.id ? 'rgba(77,176,89,0.1)' : '#F5FAF5', border: editingMarginId === cat.id ? '1px solid #4DB049' : '1px solid transparent' }}>
                {editingMarginId === cat.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number" autoFocus value={marginValue} min="0" max="100" step="0.1"
                      onChange={e => setMarginValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveMargin(cat.id); if (e.key === 'Escape') setEditingMarginId(null); }}
                      onBlur={() => saveMargin(cat.id)}
                      className="w-12 text-xs text-center font-bold outline-none rounded"
                      style={{ background: 'transparent', color: '#014945', fontFamily: 'Montserrat, sans-serif' }}
                    />
                    <span className="text-xs font-bold" style={{ color: '#014945' }}>%</span>
                  </div>
                ) : (
                  <button onClick={() => openMarginEdit(cat)} className="w-full cursor-pointer" title="Cliquer pour modifier la marge">
                    <p className="text-sm font-bold" style={{ color: '#4DB049', fontFamily: 'Montserrat, sans-serif' }}>{cat.markupPercentage ?? 20}%</p>
                  </button>
                )}
                <p className="text-[10px]" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Marge</p>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ background: '#F5FAF5' }}>
                <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>#{cat.sortOrder}</p>
                <p className="text-[10px]" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Ordre</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid #F0F7F0' }}>
              <div className="flex items-center gap-1.5">
                <button onClick={() => moveUp(index)} disabled={index === 0} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer disabled:opacity-30 hover:bg-gray-100 transition-colors" style={{ color: '#6B7280' }}>
                  <i className="ri-arrow-up-line" />
                </button>
                <button onClick={() => moveDown(index)} disabled={index === filtered.length - 1} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer disabled:opacity-30 hover:bg-gray-100 transition-colors" style={{ color: '#6B7280' }}>
                  <i className="ri-arrow-down-line" />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Active</span>
                  <ToggleSwitch enabled={cat.active} onChange={() => toggleActive(cat.id)} />
                </div>
                <button onClick={() => toggleFeatured(cat.id)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" style={{ color: cat.featured ? cat.color : '#9CA3AF' }} title={cat.featured ? 'Retirer des vedettes' : 'Mettre en vedette'}>
                  <i className={cat.featured ? 'ri-star-fill' : 'ri-star-line'} />
                </button>
                <button onClick={() => setEditCategory(cat)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" style={{ color: '#6B7280' }}>
                  <i className="ri-edit-line" />
                </button>
                <button onClick={() => setDeleteId(cat.id)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" style={{ color: '#EF4444' }}>
                  <i className="ri-delete-bin-line" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl p-8 text-center" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}>
          <i className="ri-folder-open-line text-3xl mb-3 block" style={{ color: '#9CA3AF' }} />
          <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Aucune catégorie ne correspond à votre recherche.</p>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Nouvelle Catégorie</h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}><i className="ri-close-line text-lg" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Nom *</label>
                <input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }} placeholder="Ex: Livres & Culture" />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Description *</label>
                <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} maxLength={200} rows={3} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }} placeholder="Décrivez cette catégorie..." />
                <p className="text-[10px] mt-1 text-right" style={{ color: '#9CA3AF' }}>{form.description.length}/200</p>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Icône</label>
                <div className="grid grid-cols-8 gap-2">
                  {iconOptions.map(icon => (
                    <button key={icon} onClick={() => setForm(prev => ({ ...prev, icon }))} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: form.icon === icon ? 'rgba(77,176,89,0.15)' : '#F5FAF5', border: `1px solid ${form.icon === icon ? '#4DB049' : '#E8F2F1'}` }}>
                      <i className={icon} style={{ color: form.icon === icon ? '#4DB049' : '#9CA3AF' }} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Couleur</label>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map(color => (
                    <button key={color} onClick={() => setForm(prev => ({ ...prev, color }))} className="w-7 h-7 rounded-full cursor-pointer transition-all flex-shrink-0" style={{ background: color, border: `2px solid ${form.color === color ? '#4DB049' : 'transparent'}` }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ToggleSwitch enabled={form.featured} onChange={() => setForm(prev => ({ ...prev, featured: !prev.featured }))} />
                <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Afficher en vedette sur la page d'accueil</span>
              </div>
              <div className="flex items-center gap-3">
                <ToggleSwitch enabled={form.bnplEnabled} onChange={() => setForm(prev => ({ ...prev, bnplEnabled: !prev.bnplEnabled }))} />
                <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Activer le BNPL pour cette catégorie</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Crédit max (XAF)</label>
                  <input type="number" value={form.maxCredit} onChange={e => setForm(prev => ({ ...prev, maxCredit: e.target.value }))} className="w-full px-2 py-2 rounded-lg text-xs outline-none" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }} placeholder="300000" />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Score min</label>
                  <input type="number" value={form.minScore} onChange={e => setForm(prev => ({ ...prev, minScore: e.target.value }))} className="w-full px-2 py-2 rounded-lg text-xs outline-none" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }} placeholder="0" min="0" max="100" />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Commission (%)</label>
                  <input type="number" value={form.merchantCommission} onChange={e => setForm(prev => ({ ...prev, merchantCommission: e.target.value }))} className="w-full px-2 py-2 rounded-lg text-xs outline-none" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }} placeholder="2.5" step="0.1" />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-add-line mr-2" />Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editCategory && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setEditCategory(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Modifier la Catégorie</h2>
              <button onClick={() => setEditCategory(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}><i className="ri-close-line text-lg" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Nom</label>
                <input type="text" value={editCategory.name} onChange={e => setEditCategory(prev => prev ? { ...prev, name: e.target.value } : null)} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Description</label>
                <textarea value={editCategory.description} onChange={e => setEditCategory(prev => prev ? { ...prev, description: e.target.value } : null)} maxLength={200} rows={3} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Icône</label>
                <div className="grid grid-cols-8 gap-2">
                  {iconOptions.map(icon => (
                    <button key={icon} onClick={() => setEditCategory(prev => prev ? { ...prev, icon } : null)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: editCategory.icon === icon ? 'rgba(77,176,89,0.15)' : '#F5FAF5', border: `1px solid ${editCategory.icon === icon ? '#4DB049' : '#E8F2F1'}` }}>
                      <i className={icon} style={{ color: editCategory.icon === icon ? '#4DB049' : '#9CA3AF' }} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Couleur</label>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map(color => (
                    <button key={color} onClick={() => setEditCategory(prev => prev ? { ...prev, color } : null)} className="w-7 h-7 rounded-full cursor-pointer transition-all flex-shrink-0" style={{ background: color, border: `2px solid ${editCategory.color === color ? '#4DB049' : 'transparent'}` }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ToggleSwitch enabled={editCategory.featured} onChange={() => setEditCategory(prev => prev ? { ...prev, featured: !prev.featured } : null)} />
                <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Afficher en vedette sur la page d'accueil</span>
              </div>
              <div className="flex items-center gap-3">
                <ToggleSwitch enabled={!!editCategory.bnplEnabled} onChange={() => setEditCategory(prev => prev ? { ...prev, bnplEnabled: !prev.bnplEnabled } : null)} />
                <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Activer le BNPL pour cette catégorie</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Crédit max (XAF)</label>
                  <input type="number" value={editCategory.maxCredit ?? ''} onChange={e => setEditCategory(prev => prev ? { ...prev, maxCredit: e.target.value ? Number(e.target.value) : null } : null)} className="w-full px-2 py-2 rounded-lg text-xs outline-none" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }} placeholder="300000" />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Score min</label>
                  <input type="number" value={editCategory.minScore ?? ''} onChange={e => setEditCategory(prev => prev ? { ...prev, minScore: e.target.value ? Number(e.target.value) : null } : null)} className="w-full px-2 py-2 rounded-lg text-xs outline-none" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }} placeholder="0" min="0" max="100" />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Commission (%)</label>
                  <input type="number" value={editCategory.merchantCommission ?? ''} onChange={e => setEditCategory(prev => prev ? { ...prev, merchantCommission: e.target.value ? Number(e.target.value) : null } : null)} className="w-full px-2 py-2 rounded-lg text-xs outline-none" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }} placeholder="2.5" step="0.1" />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditCategory(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleUpdate} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-save-line mr-2" />Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <ConfirmDialog
          open={true}
          title="Supprimer la catégorie"
          message={`Voulez-vous vraiment supprimer ${categories.find(c => c.id === deleteId)?.name} ? Cette action est irréversible.`}
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {/* Global Margin Modal */}
      {showGlobalMarginModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowGlobalMarginModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                Marge Globale
              </h2>
              <button onClick={() => setShowGlobalMarginModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                Marge pour toutes les catégories (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={globalMarginValue}
                  onChange={(e) => setGlobalMarginValue(e.target.value)}
                  className="w-full pr-12 px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                  min="0"
                  max="100"
                  step="0.1"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6B7280' }}>%</span>
              </div>
              <div className="mt-3 p-3 rounded-lg" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <p className="text-xs font-medium" style={{ color: '#DC2626', fontFamily: 'Poppins, sans-serif' }}>
                  ⚠️ Attention
                </p>
                <p className="text-xs mt-1" style={{ color: '#991B1B', fontFamily: 'Poppins, sans-serif' }}>
                  Cette action mettra à jour la marge de TOUTES les catégories et recalculera les prix de TOUS les produits concernés.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowGlobalMarginModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
                Annuler
              </button>
              <button onClick={handleSaveGlobalMargin} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #DC2626, #B91C1C)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-percent-line mr-2" />
                Appliquer à tout
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}