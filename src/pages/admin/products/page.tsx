import { useState, useEffect } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { getPublicCategories, adminApi, suggestProductPrice } from '@/lib/api';

type GalleryItem = { id?: string; imageUrl: string; sortOrder?: number };

type Product = {
  id: string;
  name: string;
  merchant?: string;
  merchantId?: string;
  category?: string;
  categoryId?: string;
  buyPrice?: number;
  costPrice?: number;
  price: number;
  sellPrice?: number;
  description?: string;
  stock: number;
  sold?: number;
  status?: string;
  bnplEligible?: boolean;
  image?: string;
  gallery?: GalleryItem[];
  deliveryFee?: number;
  storageFee?: number;
  isActive?: boolean;
};

const statusColors: Record<string, string> = { active: '#22C55E', out_of_stock: '#EF4444', inactive: '#6B7280' };
const statusLabels: Record<string, string> = { active: 'Actif', out_of_stock: 'Rupture', inactive: 'Inactif' };
const productCategories = ['Électronique', 'Mode & Vêtements', 'Alimentation', 'Maison & Déco', 'Santé & Beauté', 'Automobile', 'Éducation', 'Sport & Loisirs', 'Électroménager'];

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadAdminProducts = async (pageNum: number = 1) => {
    try {
      const body = await adminApi.products({ page: pageNum, limit });
      const items = Array.isArray(body) ? body : body.items ?? body.data ?? [];
      const tot = Number(body?.total ?? items.length);
      const normalized = items.map((it: any) => ({
        id: it.id || it._id || it.code || `PRD-${Math.random().toString(36).slice(2,8)}`,
        name: it.name || it.title || 'Produit',
        merchant: it.merchant?.businessName || it.merchant?.name || (typeof it.merchant === 'string' ? it.merchant : 'Non assigné'),
        merchantId: it.merchant?.id || it.merchantId || 'MCH-000',
        category: it.category?.name || (typeof it.category === 'string' ? it.category : it.merchant?.category) || 'Autre',
        categoryId: it.category?.id || it.categoryId,
        buyPrice: Number(it.buyPrice ?? it.buy_price ?? it.cost) || Number(it.price) || 0,
        price: Number(it.price ?? it.sellPrice ?? it.sell_price) || Number(it.buyPrice) || 0,
        sellPrice: Number(it.sellPrice ?? it.sell_price) || Number(it.price) || 0,
        description: it.description || it.desc || '',
        stock: Number(it.stock ?? it.quantity ?? 0),
        sold: Number(it.sold ?? it.sales ?? 0),
        status: (Number(it.stock ?? it.quantity ?? 0) === 0) ? 'out_of_stock' : 'active',
        bnplEligible: !!it.bnplEligible,
        image: it.imageUrl || it.image || '',
        gallery: Array.isArray(it.gallery)
          ? it.gallery.map((g: any) => typeof g === 'string' ? { imageUrl: g } : { id: g.id, imageUrl: g.imageUrl, sortOrder: g.sortOrder })
          : (it.imageUrl ? [{ imageUrl: it.imageUrl }] : []),
        deliveryFee: Number(it.deliveryFee ?? 0),
        storageFee: Number(it.storageFee ?? 0),
        isActive: it.isActive !== false,
      }));
      setProducts(normalized);
      setTotal(tot);
      setPage(pageNum);
    } catch {
      setProducts([]);
      setTotal(0);
    }
  };

  useEffect(() => {
    loadAdminProducts(1);
  }, []);

  // Load real platform categories
  useEffect(() => {
    getPublicCategories().then(res => {
      const list = (res as any)?.data ?? (Array.isArray(res) ? res : []);
      setAvailableCategories(list);
    }).catch(() => setAvailableCategories([]));
  }, []);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bnplFilter, setBnplFilter] = useState('all');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', costPrice: '', price: '', stock: '', bnplEligible: false, category: '', categoryId: '', deliveryFee: '', storageFee: '', isActive: true });
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ 
    name: '', 
    merchantId: '', 
    merchantName: '',
    category: '', 
    categoryId: '', 
    buyPrice: '', 
    price: '', 
    description: '', 
    stock: '', 
    bnplEligible: true,
    image: '',
    deliveryFee: '',
    storageFee: '',
    isActive: true,
  });
  const [addImageFile, setAddImageFile] = useState<File | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [availableMerchants, setAvailableMerchants] = useState<any[]>([]);

  // Lazy load merchants only when opening add modal (prevents 401 on page load if not admin-authed)
  useEffect(() => {
    if (!showAddModal) return;
    adminApi.merchants({ limit: 100 })
      .then(res => {
        const items = (res as any)?.items ?? (Array.isArray(res) ? res : []);
        setAvailableMerchants(items);
      })
      .catch(() => setAvailableMerchants([]));
  }, [showAddModal]);
  const { toasts, addToast, removeToast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleBulkProductActive = async (isActive: boolean) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      await adminApi.bulkProductActive(ids, isActive);
      setProducts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, isActive, status: isActive ? 'active' : 'inactive' } : p));
      addToast('success', 'Action groupée', `${ids.length} produit(s) mis à jour.`);
    } catch {
      addToast('error', 'Erreur', 'L\'action groupée a échoué.');
    }
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      await adminApi.bulkDeleteProducts(ids);
      setProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
      addToast('info', 'Produits supprimés', `${ids.length} produit(s) supprimé(s).`);
    } catch {
      addToast('error', 'Erreur', 'La suppression groupée a échoué.');
    }
    setSelectedIds(new Set());
  };

  const allCategories = ['all', ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.merchant.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchBnpl = bnplFilter === 'all' || (bnplFilter === 'yes' ? p.bnplEligible : !p.bnplEligible);
    return matchSearch && matchCat && matchStatus && matchBnpl;
  });

  const totalRevenue = products.reduce((acc, p) => acc + (p.buyPrice || p.price) * (p.sold || 0), 0);

  const handleImageUpload = async (file: File): Promise<string | null> => {
    if (!file) return null;
    setUploadingImage(true);
    try {
      const result = await adminApi.uploadImage(file);
      return result.url;
    } catch (e: any) {
      addToast('error', 'Erreur upload', e?.message || 'Impossible d\'uploader l\'image');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setEditForm({
      name: p.name,
      description: p.description || '',
      costPrice: String(p.costPrice || p.buyPrice || ''),
      price: String(p.price),
      stock: String(p.stock),
      bnplEligible: p.bnplEligible,
      category: p.category || '',
      categoryId: p.categoryId || '',
      deliveryFee: String((p as any).deliveryFee || 0),
      storageFee: String((p as any).storageFee || 0),
      isActive: (p as any).isActive !== undefined ? (p as any).isActive : true,
    });
    setEditImageFile(null);
  };

  const handleSaveEdit = async () => {
    if (!editProduct) return;
    const updatedLocal = {
      ...editProduct,
      name: editForm.name,
      price: Number(editForm.price),
      stock: Number(editForm.stock),
      bnplEligible: editForm.bnplEligible,
      category: editForm.category || editProduct.category,
      categoryId: editForm.categoryId || editProduct.categoryId,
      deliveryFee: Number(editForm.deliveryFee || 0),
      storageFee: Number(editForm.storageFee || 0),
      isActive: editForm.isActive,
      status: Number(editForm.stock) === 0 ? 'out_of_stock' : (editForm.isActive ? 'active' : 'inactive')
    };

    try {
      let imageUrl = editProduct.image;
      if (editImageFile) {
        const uploaded = await handleImageUpload(editImageFile);
        if (uploaded) imageUrl = uploaded;
      }
      // Attempt real update via admin API
      await adminApi.updateProduct(editProduct.id, {
        name: updatedLocal.name,
        description: editForm.description || undefined,
        price: updatedLocal.price,
        costPrice: editForm.costPrice ? Number(editForm.costPrice) : (updatedLocal.buyPrice || updatedLocal.costPrice || undefined),
        stock: updatedLocal.stock,
        bnplEligible: updatedLocal.bnplEligible,
        categoryId: updatedLocal.categoryId,
        imageUrl,
        deliveryFee: updatedLocal.deliveryFee,
        storageFee: updatedLocal.storageFee,
        isActive: updatedLocal.isActive,
      });
    } catch {
      // fallback: local update is already prepared
    }

    await loadAdminProducts(page);

    setEditProduct(null);
    addToast('success', 'Produit modifié', `${editForm.name} a été mis à jour.`);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    try {
      await adminApi.deleteProduct(target.id);
      setProducts(prev => prev.filter(p => p.id !== target.id));
      addToast('info', 'Produit supprimé', `${target.name} a été retiré du catalogue.`);
    } catch {
      addToast('error', 'Erreur', 'Impossible de supprimer le produit.');
    }
  };

  const handleToggleBnpl = async (product: Product) => {
    const newVal = !product.bnplEligible;
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, bnplEligible: newVal } : p));
    try {
      await adminApi.updateProduct(product.id, { bnplEligible: newVal });
      addToast('info', 'Éligibilité BNPL modifiée', `${product.name} est maintenant ${newVal ? 'éligible' : 'non éligible'} au BNPL.`);
    } catch {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, bnplEligible: !newVal } : p));
      addToast('error', 'Erreur', 'Impossible de modifier l\'éligibilité BNPL.');
    }
  };

  const handleAddProduct = async () => {
    if (!addForm.name || !addForm.buyPrice || !addForm.stock || !addForm.categoryId) {
      addToast('error', 'Champs requis', 'Nom, prix d\'achat, stock et catégorie sont obligatoires.');
      return;
    }
    try {
      let imageUrl = addForm.image || undefined;
      if (addImageFile) {
        const uploaded = await handleImageUpload(addImageFile);
        if (uploaded) imageUrl = uploaded;
      }
      const payload: any = {
        merchantId: addForm.merchantId || undefined,
        name: addForm.name,
        description: addForm.description || undefined,
        costPrice: Number(addForm.buyPrice),
        price: addForm.price ? Number(addForm.price) : undefined,
        stock: Number(addForm.stock) || 0,
        bnplEligible: addForm.bnplEligible,
        categoryId: addForm.categoryId || undefined,
        imageUrl,
        deliveryFee: Number(addForm.deliveryFee || 0),
        storageFee: Number(addForm.storageFee || 0),
        isActive: addForm.isActive,
      };
      await adminApi.createProduct(payload);
      addToast('success', 'Produit ajouté', `${addForm.name} a été créé via le backend.`);

      await loadAdminProducts(1);

      setShowAddModal(false);
      setAddForm({ name: '', merchantId: '', merchantName: '', category: '', categoryId: '', buyPrice: '', price: '', description: '', stock: '', bnplEligible: true, image: '', deliveryFee: '', storageFee: '', isActive: true });
      setAddImageFile(null);
    } catch (e: any) {
      addToast('error', 'Erreur backend', e?.message || 'Impossible de créer le produit.');
    }
  };

  const inputStyle = { background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' };
  const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Gestion', 'Produits']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Catalogue Produits</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{products.length} produits référencés</p>
          </div>
            <button onClick={() => {
              if (!addForm.categoryId && availableCategories.length > 0) {
                const first = availableCategories[0];
                setAddForm(prev => ({ ...prev, categoryId: first.id || first.slug || '', category: first.name || '' }));
              }
              setShowAddModal(true);
            }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
            <i className="ri-add-line" /> Ajouter Produit
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Produits', value: products.length, icon: 'ri-shopping-bag-3-line', color: '#4DB049' },
            { label: 'Éligibles BNPL', value: products.filter(p => p.bnplEligible).length, icon: 'ri-bank-card-line', color: '#22C55E' },
            { label: 'Rupture de Stock', value: products.filter(p => p.status === 'out_of_stock').length, icon: 'ri-error-warning-line', color: '#EF4444' },
            { label: 'Revenus Générés', value: `${(totalRevenue / 1000000).toFixed(1)}M FCFA`, icon: 'ri-money-cny-circle-line', color: '#F97316' },
          ].map(s => (
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

        <div className="rounded-2xl p-4 flex flex-wrap gap-3 items-center" style={cardStyle}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
            <i className="ri-search-line text-gray-400 text-sm" />
            <input type="text" placeholder="Rechercher produit ou commercial..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent text-gray-900 text-sm outline-none flex-1 placeholder-gray-400" style={{ fontFamily: 'Poppins, sans-serif' }} />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
            {allCategories.map(c => <option key={c} value={c} style={{ background: '#FFFFFF' }}>{c === 'all' ? 'Toutes catégories' : c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
            <option value="all" style={{ background: '#FFFFFF' }}>Tous statuts</option>
            <option value="active" style={{ background: '#FFFFFF' }}>Actifs</option>
            <option value="out_of_stock" style={{ background: '#FFFFFF' }}>Rupture</option>
          </select>
          <select value={bnplFilter} onChange={e => setBnplFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
            <option value="all" style={{ background: '#FFFFFF' }}>BNPL: Tous</option>
            <option value="yes" style={{ background: '#FFFFFF' }}>BNPL: Éligible</option>
            <option value="no" style={{ background: '#FFFFFF' }}>BNPL: Non éligible</option>
          </select>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl" style={{ background: 'rgba(77,176,89,0.1)', border: '1px solid #4DB049' }}>
            <span className="text-sm font-medium" style={{ color: '#014945' }}>{selectedIds.size} sélectionné(s)</span>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => handleBulkProductActive(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: '#22C55E20', color: '#22C55E', border: '1px solid #22C55E' }}>
                <i className="ri-checkbox-circle-line mr-1" />Activer
              </button>
              <button onClick={() => handleBulkProductActive(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF4444' }}>
                <i className="ri-forbid-line mr-1" />Désactiver
              </button>
              <button onClick={handleBulkDelete} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: '#EF444440', color: '#EF4444', border: '1px solid #EF4444' }}>
                <i className="ri-delete-bin-line mr-1" />Supprimer
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
                    <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={() => setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)))} className="accent-[#4DB049]" />
                  </th>
                   {['Produit', 'Commercial', 'Catégorie', 'Prix de vente', 'Stock', 'Vendus', 'Frais livraison', 'Frais stockage', 'BNPL', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => (
                  <tr key={p.id} className="transition-colors hover:bg-gray-50" style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F0F7F0' : 'none', background: selectedIds.has(p.id) ? 'rgba(77,176,89,0.05)' : undefined }}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="accent-[#4DB049]" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ background: '#F5FAF5' }}>
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="w-full h-full object-cover object-top" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><i className="ri-image-line text-base" style={{ color: '#9CA3AF' }} /></div>
                          )}
                          {p.gallery && p.gallery.length > 1 && (
                            <span className="absolute bottom-0 right-0 w-4 h-4 rounded-tl-md flex items-center justify-center text-[9px] font-bold" style={{ background: '#4DB049', color: '#FFF' }}>{p.gallery.length}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{p.name}</p>
                          <p className="text-xs font-mono" style={{ color: '#4DB049' }}>{p.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{p.merchant}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{p.category}</td>
                     <td className="px-4 py-3 text-sm font-medium whitespace-nowrap" style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>{(p.sellPrice || p.price).toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium" style={{ color: p.stock === 0 ? '#EF4444' : p.stock < 10 ? '#F97316' : '#374151', fontFamily: 'Poppins, sans-serif' }}>{p.stock}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>{p.sold}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{(p.deliveryFee || 0).toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{(p.storageFee || 0).toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggleBnpl(p)} className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-all hover:opacity-80" style={{ background: p.bnplEligible ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', color: p.bnplEligible ? '#22C55E' : '#6B7280' }}>
                        {p.bnplEligible ? 'Éligible' : 'Non éligible'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: `${statusColors[p.status]}20`, color: statusColors[p.status] }}>{statusLabels[p.status]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" title="Modifier">
                          <i className="ri-edit-line text-sm" style={{ color: '#4DB049' }} />
                        </button>
                        <button onClick={() => setConfirmDelete(p)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer" title="Supprimer">
                          <i className="ri-delete-bin-line text-sm" style={{ color: '#EF4444' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
             </table>
           </div>
         </div>

         {/* Pagination for admin products */}
         {totalPages > 1 && (
           <div className="flex items-center justify-between mt-4 px-1">
             <div className="text-xs text-gray-500" style={{ fontFamily: 'Poppins, sans-serif' }}>
               Page {page} / {totalPages} — {total} produits
             </div>
             <div className="flex gap-1">
               <button onClick={() => loadAdminProducts(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 rounded text-sm disabled:opacity-40" style={{ background: '#F5FAF5', color: '#4DB049' }}>Précédent</button>
               {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                 const p = i + 1;
                 return (
                   <button key={p} onClick={() => loadAdminProducts(p)} className="w-8 h-8 text-xs rounded" style={{ background: p === page ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#F5FAF5', color: p === page ? '#FFFFFF' : '#6B7280' }}>{p}</button>
                 );
               })}
               <button onClick={() => loadAdminProducts(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1 rounded text-sm disabled:opacity-40" style={{ background: '#F5FAF5', color: '#4DB049' }}>Suivant</button>
             </div>
           </div>
         )}
       </div>

      {/* Edit Product Modal */}
      {editProduct && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setEditProduct(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(1,73,69,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Modifier le Produit</h2>
              <button onClick={() => setEditProduct(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="rounded-xl p-3" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ background: '#E8F2F1' }}>
                  {editProduct.image ? (
                    <img src={editProduct.image} alt={editProduct.name} className="w-full h-full object-cover object-top" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><i className="ri-image-line text-xl" style={{ color: '#9CA3AF' }} /></div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{editProduct.id}</p>
                  <p className="text-xs" style={{ color: '#6B7280' }}>{editProduct.merchant}</p>
                </div>
              </div>
              {editProduct.gallery && editProduct.gallery.length > 0 && (
                <div>
                  <p className="text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Galerie ({editProduct.gallery.length} image{editProduct.gallery.length > 1 ? 's' : ''})</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {editProduct.gallery.map((g, i) => (
                      <div key={g.id ?? i} className="w-10 h-10 rounded-lg overflow-hidden" style={{ border: '1px solid #E8F2F1' }}>
                        <img src={g.imageUrl} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {[{ label: 'Nom du produit', key: 'name', type: 'text' }, { label: 'Prix d\'achat / Coût (FCFA)', key: 'costPrice', type: 'number' }, { label: 'Prix de vente (FCFA)', key: 'price', type: 'number' }, { label: 'Stock disponible', key: 'stock', type: 'number' }].map(field => (
                <div key={field.key}>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                  <input type={field.type} value={editForm[field.key as keyof typeof editForm] as string} onChange={e => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
                </div>
              ))}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Description</label>
                <textarea rows={3} value={editForm.description} onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={inputStyle} placeholder="Description du produit..." />
              </div>
              {/* Category for edit - to support re-mapping like in merchant products */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Catégorie</label>
                <select
                  value={editForm.categoryId || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const cat = availableCategories.find((c: any) => c.id === val || c.slug === val) || availableCategories.find((c: any) => c.name === val);
                    setEditForm(prev => ({ ...prev, categoryId: val, category: cat?.name || val || prev.category }));
                  }}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                  style={inputStyle}
                >
                  {availableCategories.length > 0 ? (
                    availableCategories.map((c: any) => <option key={c.id} value={c.id || c.slug} style={{ background: '#FFFFFF' }}>{c.name}</option>)
                  ) : (
                    <option value="">Chargement...</option>
                  )}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Image du produit</label>
                <div className="flex items-center gap-3">
                  {(editProduct.image || editImageFile) && (
                    <img
                      src={editImageFile ? URL.createObjectURL(editImageFile) : editProduct.image}
                      alt="Preview"
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  )}
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) setEditImageFile(file);
                      }}
                    />
                    <div className="px-3 py-2.5 rounded-lg text-sm text-center" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                      <i className="ri-upload-cloud-line mr-2" />
                      {editImageFile ? editImageFile.name : 'Choisir une image'}
                    </div>
                  </label>
                  {editImageFile && (
                    <button
                      onClick={() => setEditImageFile(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg"
                      style={{ background: '#F5FAF5', color: '#EF4444' }}
                    >
                      <i className="ri-close-line" />
                    </button>
                  )}
                </div>
                {uploadingImage && <p className="text-xs mt-1" style={{ color: '#6B7280' }}>Upload en cours...</p>}
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>Éligible BNPL</p>
                  <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Permettre l&apos;achat à crédit pour ce produit</p>
                </div>
                <button onClick={() => setEditForm(prev => ({ ...prev, bnplEligible: !prev.bnplEligible }))} className="relative w-11 h-6 rounded-full transition-all cursor-pointer flex-shrink-0" style={{ background: editForm.bnplEligible ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#E5E7EB' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: editForm.bnplEligible ? '22px' : '2px', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Frais de livraison (FCFA)</label>
                <input type="number" value={editForm.deliveryFee || ''} onChange={e => setEditForm(prev => ({ ...prev, deliveryFee: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Frais de stockage (FCFA)</label>
                <input type="number" value={editForm.storageFee || ''} onChange={e => setEditForm(prev => ({ ...prev, storageFee: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>Statut actif</p>
                  <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Produit visible dans le catalogue</p>
                </div>
                <button onClick={() => setEditForm(prev => ({ ...prev, isActive: !prev.isActive }))} className="relative w-11 h-6 rounded-full transition-all cursor-pointer flex-shrink-0" style={{ background: editForm.isActive ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#E5E7EB' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: editForm.isActive ? '22px' : '2px', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditProduct(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-save-line mr-2" />Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(1,73,69,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Ajouter un Produit</h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                 { label: 'Nom du produit *', key: 'name', type: 'text' },
                 { label: 'Quantité *', key: 'stock', type: 'number' },
               ].map(field => (
                 <div key={field.key}>
                   <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                   <input type={field.type} value={addForm[field.key as keyof typeof addForm] as string} onChange={e => setAddForm(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
                 </div>
               ))}

              {/* Merchant dropdown - required for admin creation */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Marchand (Commercial) *</label>
                <select
                  value={addForm.merchantId || ''}
                  onChange={e => {
                    const m = availableMerchants.find((x: any) => x.id === e.target.value);
                    setAddForm(prev => ({ 
                      ...prev, 
                      merchantId: e.target.value, 
                      merchantName: m?.businessName || m?.name || '' 
                    }));
                  }}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                  style={inputStyle}
                >
                  <option value="">-- Choisir le marchand --</option>
                  {availableMerchants.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.businessName || m.name} {m.city ? `(${m.city})` : ''}
                    </option>
                  ))}
                </select>
                {availableMerchants.length === 0 && (
                  <p className="text-[10px] mt-1" style={{ color: '#EF4444' }}>Chargement des marchands (connexion admin requise)...</p>
                )}
              </div>

              {/* Buy price with live backend suggestion */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Prix d'achat (FCFA) *</label>
                <input
                  type="number"
                  value={addForm.buyPrice || ''}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setAddForm(prev => ({ ...prev, buyPrice: val }));
                    if (val && Number(val) > 0 && addForm.categoryId) {
                      try {
                        const res = await suggestProductPrice(Number(val), addForm.categoryId);
                        if (res?.suggestedPrice) {
                          setAddForm(prev => ({ ...prev, price: String(res.suggestedPrice) }));
                        }
                      } catch (err) {
                        // ignore suggestion errors
                      }
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Catégorie</label>
                <select
                  value={addForm.categoryId || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const cat = availableCategories.find((c: any) => c.id === val || c.slug === val) || availableCategories.find((c: any) => c.name === val);
                    setAddForm(prev => ({ ...prev, categoryId: val, category: cat?.name || val || prev.category }));
                  }}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                  style={inputStyle}
                >
                  {availableCategories.length > 0 ? (
                    availableCategories.map((c: any) => <option key={c.id} value={c.id || c.slug} style={{ background: '#FFFFFF' }}>{c.name}</option>)
                  ) : (
                    <option value="">Chargement des catégories...</option>
                  )}
                </select>
              </div>
               <div>
                 <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Prix de vente (FCFA) — suggéré par backend</label>
                 <input
                   type="number"
                   value={addForm.price || ''}
                   onChange={e => setAddForm(prev => ({ ...prev, price: e.target.value }))}
                   className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                   style={inputStyle}
                 />
               </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Description</label>
                <textarea value={addForm.description} onChange={e => setAddForm(prev => ({ ...prev, description: e.target.value }))} rows={3} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Image du produit</label>
                <div className="flex items-center gap-3">
                  {addImageFile && (
                    <img
                      src={URL.createObjectURL(addImageFile)}
                      alt="Preview"
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  )}
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) setAddImageFile(file);
                      }}
                    />
                    <div className="px-3 py-2.5 rounded-lg text-sm text-center" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                      <i className="ri-upload-cloud-line mr-2" />
                      {addImageFile ? addImageFile.name : 'Choisir une image'}
                    </div>
                  </label>
                  {addImageFile && (
                    <button
                      onClick={() => setAddImageFile(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg"
                      style={{ background: '#F5FAF5', color: '#EF4444' }}
                    >
                      <i className="ri-close-line" />
                    </button>
                  )}
                </div>
                {uploadingImage && <p className="text-xs mt-1" style={{ color: '#6B7280' }}>Upload en cours...</p>}
              </div>
              <div className="flex items-center justify-between py-1">
                <p className="text-sm font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>Éligible BNPL</p>
                <button onClick={() => setAddForm(prev => ({ ...prev, bnplEligible: !prev.bnplEligible }))} className="relative w-11 h-6 rounded-full transition-all cursor-pointer" style={{ background: addForm.bnplEligible ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#E5E7EB' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: addForm.bnplEligible ? '22px' : '2px', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Frais de livraison (FCFA)</label>
                <input type="number" value={addForm.deliveryFee || ''} onChange={e => setAddForm(prev => ({ ...prev, deliveryFee: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Frais de stockage (FCFA)</label>
                <input type="number" value={addForm.storageFee || ''} onChange={e => setAddForm(prev => ({ ...prev, storageFee: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              </div>
              <div className="flex items-center justify-between py-1">
                <p className="text-sm font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>Statut actif</p>
                <button onClick={() => setAddForm(prev => ({ ...prev, isActive: !prev.isActive }))} className="relative w-11 h-6 rounded-full transition-all cursor-pointer" style={{ background: addForm.isActive ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#E5E7EB' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: addForm.isActive ? '22px' : '2px', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleAddProduct} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-add-line mr-2" />Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!confirmDelete} title="Supprimer le produit" message={`Voulez-vous supprimer "${confirmDelete?.name}" du catalogue ? Cette action est irréversible.`} confirmLabel="Supprimer" confirmColor="#EF4444" icon="ri-delete-bin-line" onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
      <Toast toasts={toasts} onRemove={removeToast} />
    </AdminLayout>
  );
}
