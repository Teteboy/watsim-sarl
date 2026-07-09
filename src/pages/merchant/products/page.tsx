import { useEffect, useState } from 'react';
import MerchantLayout from '@/components/feature/MerchantLayout';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { API_PREFIX, getPublicCategories, suggestProductPrice } from '@/lib/api';
import { merchantApi } from '@/lib/api';
import { cardStyle, inputStyle, labelStyle, headingStyle, pageTitleStyle, tableHeaderStyle, tableRowStyle, primaryButtonStyle, secondaryButtonStyle, statusBadgeStyle, tableRowHoverClass } from '@/styles/admin-theme';

type Product = {
  id: string;
  name: string;
  category: string;
  categoryId?: string;
  price: number;
  stock: number;
  sold: number;
  status: string;
  bnplEligible: boolean;
  views: number;
  rating: number;
  image: string;
  gallery?: string[];
};

type BackendProduct = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  imageUrl?: string | null;
  gallery?: string[] | null;
  bnplEligible: boolean;
  isActive: boolean;
  merchantId: string;
  category?: { id: string; name: string; slug?: string } | null;
  merchant?: { category?: string } | null;
};

function mapBackendProduct(p: BackendProduct): Product {
  const catObj = p.category as any;
  const catName = (catObj && typeof catObj === 'object' ? catObj.name : catObj) || p.merchant?.category || 'Autre';
  const catId = (catObj && typeof catObj === 'object' ? catObj.id : undefined) || (p as any).categoryId;
  return {
    id: p.id,
    name: p.name,
    category: catName,
    categoryId: catId,
    price: Number(p.price),
    stock: p.stock,
    sold: 0,
    status: p.isActive && p.stock > 0 ? 'active' : p.stock === 0 ? 'out_of_stock' : 'inactive',
    bnplEligible: p.bnplEligible,
    views: 0,
    rating: 0,
    image: p.imageUrl || (Array.isArray(p.gallery) && p.gallery[0]) || '',
    gallery: Array.isArray(p.gallery) ? p.gallery : (p.imageUrl ? [p.imageUrl] : []),
  };
}

const categoryColors: Record<string, string> = {
  Smartphones: '#4DB049',
  Ordinateurs: '#4A9EFF',
  Tablettes: '#A855F7',
  Audio: '#22C55E',
  Moniteurs: '#F97316',
  Accessoires: '#EF4444',
  Drones: '#4DB049',
  Bureautique: '#4A9EFF',
  Électroménager: '#22C55E',
};

export default function MerchantProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBnpl, setFilterBnpl] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [addForm, setAddForm] = useState({ name: '', category: '', categoryId: '', buyPrice: '', price: '', stock: '', bnplEligible: true, image: '' });
  const [addImageFile, setAddImageFile] = useState<File | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [addGalleryFiles, setAddGalleryFiles] = useState<File[]>([]);
  const [editGalleryFiles, setEditGalleryFiles] = useState<File[]>([]);
  const [removedGalleryUrls, setRemovedGalleryUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const { toasts, addToast, removeToast } = useToast();

  const loadProducts = async (pageNum: number = 1) => {
    try {
      const res: any = await merchantApi.products({ page: pageNum, limit });
      const items = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      const tot = res?.total ?? items.length;
      setProducts(items.map(mapBackendProduct));
      setTotal(tot);
      setPage(pageNum);
    } catch {
      setProducts([]);
      setTotal(0);
    }
  };

  useEffect(() => {
    loadProducts(1);
  }, []);

  // Load platform categories for assignment dropdown
  useEffect(() => {
    getPublicCategories().then(res => {
      const list = (res as any)?.data ?? (Array.isArray(res) ? res : []);
      setAvailableCategories(list);
    }).catch(() => setAvailableCategories([]));
  }, []);

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchBnpl = filterBnpl === 'all' || (filterBnpl === 'yes' ? p.bnplEligible : !p.bnplEligible);
    return matchSearch && matchStatus && matchBnpl;
  });

  const openEdit = (p: Product) => {
    setEditForm({ name: p.name, price: p.price, stock: p.stock, bnplEligible: p.bnplEligible, category: p.category, categoryId: p.categoryId, image: p.image, gallery: p.gallery ?? [] });
    setEditImageFile(null);
    setEditGalleryFiles([]);
    setRemovedGalleryUrls([]);
    setSelectedProduct(p);
    setEditModal(true);
  };

  const handleImageUpload = async (file: File, type: 'add' | 'edit'): Promise<string | null> => {
    if (!file) return null;
    setUploadingImage(true);
    try {
      const result = await merchantApi.uploadImage(file);
      return result.url;
    } catch (e: any) {
      addToast('error', 'Erreur upload', e?.message || 'Impossible d\'uploader l\'image');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const saveEdit = async () => {
    if (!selectedProduct) return;
    try {
      let imageUrl = editForm.image;
      if (editImageFile) {
        const uploaded = await handleImageUpload(editImageFile, 'edit');
        if (uploaded) imageUrl = uploaded;
      }
      // Upload new gallery files
      const newGalleryUrls: string[] = [];
      for (const file of editGalleryFiles) {
        const url = await handleImageUpload(file, 'edit');
        if (url) newGalleryUrls.push(url);
      }
      // Merge: keep existing gallery minus removed, then add new uploads
      const existingGallery = (editForm.gallery as string[] | undefined) ?? [];
      const mergedGallery = [
        ...existingGallery.filter(u => !removedGalleryUrls.includes(u)),
        ...newGalleryUrls,
      ];
      await merchantApi.updateProduct(selectedProduct.id, {
        name: editForm.name,
        stock: editForm.stock,
        bnplEligible: editForm.bnplEligible,
        categoryId: (editForm as any).categoryId,
        imageUrl,
        gallery: mergedGallery.length > 0 ? mergedGallery : undefined,
      } as any);
      setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, ...editForm, image: imageUrl || p.image, gallery: mergedGallery } : p));
      setEditModal(false);
      setEditImageFile(null);
      setEditGalleryFiles([]);
      setRemovedGalleryUrls([]);
      addToast('success', 'Produit mis à jour', `${editForm.name} a été modifié avec succès.`);
    } catch (e) {
      addToast('error', 'Erreur', e instanceof Error ? e.message : 'Échec de la mise à jour.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await merchantApi.deleteProduct(deleteConfirm.id);
      setProducts(prev => prev.filter(p => p.id !== deleteConfirm.id));
      addToast('success', 'Produit supprimé', 'Le produit a été retiré du catalogue.');
    } catch (e) {
      addToast('error', 'Erreur', e instanceof Error ? e.message : 'Échec de la suppression.');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const toggleBnpl = async (id: string) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const next = !p.bnplEligible;
    try {
      await merchantApi.updateProduct(id, { bnplEligible: next });
      setProducts(prev => prev.map(x => x.id === id ? { ...x, bnplEligible: next } : x));
      addToast('info', 'BNPL mis à jour', `${p.name} est maintenant ${next ? 'éligible' : 'non éligible'} au BNPL.`);
    } catch (e) {
      addToast('error', 'Erreur', e instanceof Error ? e.message : 'Échec de la mise à jour.');
    }
  };

  const saveAdd = async () => {
    if (!addForm.name || !addForm.categoryId) {
      addToast('error', 'Catégorie requise', 'Veuillez sélectionner une catégorie pour le produit.');
      return;
    }
    if (!addForm.price && !addForm.buyPrice) {
      addToast('error', 'Prix requis', 'Entrez un prix de vente ou un prix d\'achat pour calcul automatique.');
      return;
    }
    try {
      let imageUrl = addForm.image;
      if (addImageFile) {
        const uploaded = await handleImageUpload(addImageFile, 'add');
        if (uploaded) imageUrl = uploaded;
      }
      // Upload gallery files
      const galleryUrls: string[] = [];
      for (const file of addGalleryFiles) {
        const url = await handleImageUpload(file, 'add');
        if (url) galleryUrls.push(url);
      }
      const payload: any = {
        name: addForm.name,
        stock: Number(addForm.stock) || 0,
        bnplEligible: addForm.bnplEligible,
        categoryId: addForm.categoryId || undefined,
        imageUrl: imageUrl || undefined,
      };
      if (galleryUrls.length > 0) payload.gallery = galleryUrls;
      if (addForm.buyPrice) payload.costPrice = Number(addForm.buyPrice);
      if (addForm.price) payload.price = Number(addForm.price);
      const created = await merchantApi.createProduct(payload) as BackendProduct;
      const newProduct = mapBackendProduct({ ...created, isActive: true, imageUrl: imageUrl || (created as any).imageUrl, gallery: galleryUrls.length > 0 ? galleryUrls : (created as any).gallery });
      const chosenCat = availableCategories.find((c: any) => c.id === addForm.categoryId || c.slug === addForm.categoryId);
      newProduct.category = (created as any)?.category?.name || chosenCat?.name || addForm.category || 'Autre';
      if ((created as any)?.category?.id) newProduct.categoryId = (created as any).category.id;
      setProducts(prev => [newProduct, ...prev]);
      setAddModal(false);
      setAddForm({ name: '', category: '', categoryId: '', buyPrice: '', price: '', stock: '', bnplEligible: true, image: '' });
      setAddImageFile(null);
      setAddGalleryFiles([]);
      addToast('success', 'Produit ajouté', `${newProduct.name} a été ajouté au catalogue.`);
    } catch (e) {
      addToast('error', 'Erreur', e instanceof Error ? e.message : 'Échec de la création.');
    }
  };

  const totalValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const bnplCount = products.filter(p => p.bnplEligible).length;
  const outOfStock = products.filter(p => p.stock === 0).length;

  return (
    <MerchantLayout breadcrumb={['Merchant', 'Produits']}>
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total produits', value: products.length, icon: 'ri-shopping-bag-3-line', color: '#4DB049' },
          { label: 'Éligibles BNPL', value: bnplCount, icon: 'ri-bank-card-line', color: '#A855F7' },
          { label: 'Rupture de stock', value: outOfStock, icon: 'ri-error-warning-line', color: '#EF4444' },
          { label: 'Valeur stock', value: `${(totalValue / 1000000).toFixed(1)}M FCFA`, icon: 'ri-money-dollar-circle-line', color: '#22C55E' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={cardStyle}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <i className={`${s.icon} text-base`} style={{ color: s.color }} />
              </div>
              <div>
                <p className="font-bold text-lg text-watsim-primaryDark font-montserrat">{s.value}</p>
                <p className="text-xs text-watsim-textMuted font-poppins">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div
        className="rounded-2xl p-4 mb-4 flex flex-col md:flex-row gap-3 items-start md:items-center"
        style={cardStyle}
      >
        <div className="relative flex-1 w-full">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none font-poppins"
            style={inputStyle}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'active', 'out_of_stock'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-2 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-all font-poppins"
              style={{
                background: filterStatus === s ? 'rgba(77,176,89,0.15)' : '#F5FAF5',
                color: filterStatus === s ? '#4DB049' : '#6B7280',
                border: `1px solid ${filterStatus === s ? '#4DB049' : '#E8F2F1'}`,
              }}
            >
              {s === 'all' ? 'Tous' : s === 'active' ? 'Actifs' : 'Rupture'}
            </button>
          ))}
          <button
            onClick={() => setFilterBnpl(filterBnpl === 'all' ? 'yes' : 'all')}
            className="px-3 py-2 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-all"
            style={{
              background: filterBnpl !== 'all' ? 'rgba(168,85,247,0.15)' : '#F5FAF5',
              color: filterBnpl !== 'all' ? '#A855F7' : '#6B7280',
              border: `1px solid ${filterBnpl !== 'all' ? 'rgba(168,85,247,0.3)' : '#E8F2F1'}`,
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            <i className="ri-bank-card-line mr-1" />
            BNPL
          </button>
          <button
            onClick={() => {
              if (!addForm.categoryId && availableCategories.length > 0) {
                const first = availableCategories[0];
                setAddForm(prev => ({ ...prev, categoryId: first.id || first.slug || '', category: first.name || '' }));
              }
              setAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105 font-poppins"
            style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF' }}
          >
            <i className="ri-add-line" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Products table */}
      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={tableHeaderStyle}>
                {['Produit', 'Catégorie', 'Prix', 'Stock', 'Vendus', 'Vues', 'Note', 'BNPL', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-wider text-watsim-primary font-poppins">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className={`transition-colors ${tableRowHoverClass}`} style={tableRowStyle}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: '#F5FAF5' }}>
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="w-full h-full object-cover object-top" />
                        ) : (
                          <i className="ri-image-line text-base" style={{ color: '#9CA3AF' }} />
                        )}
                        {p.gallery && p.gallery.length > 1 && (
                          <span className="absolute bottom-0 right-0 w-4 h-4 rounded-tl-md flex items-center justify-center text-[9px] font-bold" style={{ background: '#4DB049', color: '#FFF' }}>{p.gallery.length}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-watsim-text font-poppins">{p.name}</p>
                        <p className="text-xs font-mono text-gray-400">{p.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-1 rounded-full font-poppins"
                      style={statusBadgeStyle(categoryColors[p.category] || '#4DB049')}
                    >
                      {p.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-watsim-primaryDark font-montserrat">
                    {p.price.toLocaleString()} FCFA
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-sm font-semibold font-montserrat"
                      style={{ color: p.stock === 0 ? '#EF4444' : p.stock <= 5 ? '#F97316' : '#22C55E' }}
                    >
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-watsim-textMuted font-poppins">{p.sold}</td>
                  <td className="px-4 py-3 text-sm text-watsim-textMuted font-poppins">{p.views.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {p.rating > 0 ? (
                      <div className="flex items-center gap-1">
                        <i className="ri-star-fill text-xs text-watsim-primary" />
                        <span className="text-sm text-watsim-textMuted font-poppins">{p.rating}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleBnpl(p.id)}
                      className="text-xs px-2 py-1 rounded-full cursor-pointer transition-all hover:scale-105 font-poppins"
                      style={{
                        background: p.bnplEligible ? 'rgba(168,85,247,0.15)' : '#F5FAF5',
                        color: p.bnplEligible ? '#A855F7' : '#9CA3AF',
                        border: `1px solid ${p.bnplEligible ? 'rgba(168,85,247,0.3)' : '#E8F2F1'}`,
                      }}
                    >
                      {p.bnplEligible ? 'Oui' : 'Non'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        background: p.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: p.status === 'active' ? '#22C55E' : '#EF4444',
                        fontFamily: 'Poppins, sans-serif',
                      }}
                    >
                      {p.status === 'active' ? 'Actif' : 'Rupture'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors hover:bg-gray-100"
                        style={{ color: '#4DB049' }}
                        title="Modifier"
                      >
                        <i className="ri-edit-line text-sm" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(p)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors hover:bg-gray-100"
                        style={{ color: '#EF4444' }}
                        title="Supprimer"
                      >
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
           </table>
         </div>

         {/* Pagination */}
         {totalPages > 1 && (
           <div className="flex items-center justify-between mt-4">
             <div className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
               Page {page} / {totalPages} — {total} produits
             </div>
             <div className="flex items-center gap-1">
               <button
                 onClick={() => { const np = Math.max(1, page - 1); loadProducts(np); }}
                 disabled={page === 1}
                 className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors disabled:opacity-40"
                 style={{ background: '#F5FAF5', color: '#4DB049' }}
               >
                 ←
               </button>
               {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map(p => (
                 <button
                   key={p}
                   onClick={() => loadProducts(p)}
                   className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors"
                   style={{
                     background: p === page ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#F5FAF5',
                     color: p === page ? '#FFFFFF' : '#6B7280',
                   }}
                 >
                   {p}
                 </button>
               ))}
               <button
                 onClick={() => { const np = Math.min(totalPages, page + 1); loadProducts(np); }}
                 disabled={page === totalPages}
                 className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors disabled:opacity-40"
                 style={{ background: '#F5FAF5', color: '#4DB049' }}
               >
                 →
               </button>
             </div>
           </div>
         )}

         {products.length === 0 && (
           <div className="py-12 text-center">
             <i className="ri-shopping-bag-3-line text-4xl mb-3 block" style={{ color: '#E8F2F1' }} />
             <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Aucun produit trouvé</p>
           </div>
         )}
       </div>

      {/* Edit Modal */}
      {editModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => { setEditModal(false); setEditGalleryFiles([]); setRemovedGalleryUrls([]); }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Modifier le produit</h3>
              <button onClick={() => setEditModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer hover:bg-gray-100" style={{ color: '#6B7280' }}>
                <i className="ri-close-line" />
              </button>
            </div>
            {[
              { label: 'Nom du produit', key: 'name', type: 'text' },
              { label: 'Stock', key: 'stock', type: 'number' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-xs mb-1 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                <input
                  type={field.type}
                  value={(editForm as Record<string, unknown>)[field.key] as string ?? ''}
                  onChange={e => setEditForm(prev => ({ ...prev, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                />
              </div>
            ))}

            {/* Price is admin-only after creation */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Prix de vente (FCFA)</label>
              <input
                type="number"
                value={(editForm as any).price ?? ''}
                disabled
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-not-allowed"
                style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}
              />
              <p className="text-[10px] mt-0.5" style={{ color: '#F59E0B' }}>Le prix ne peut être modifié que par un administrateur.</p>
            </div>
            {/* Category selector in edit (to allow re-mapping product to a platform category) */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Catégorie</label>
              <select
                value={(editForm as any).categoryId || ''}
                onChange={e => {
                  const val = e.target.value;
                  const cat = availableCategories.find((c: any) => c.id === val || c.slug === val);
                  setEditForm(prev => ({ ...prev, categoryId: val, category: cat?.name || '' }));
                }}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
              >
                {availableCategories.length > 0 ? (
                  availableCategories.map((c: any) => (
                    <option key={c.id} value={c.id || c.slug}>{c.name}</option>
                  ))
                ) : (
                  <option value="">Chargement...</option>
                )}
              </select>
            </div>
            {/* Gallery upload — existing + new */}
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Galerie d&apos;images</label>
              {/* Existing gallery thumbnails with remove */}
              {(() => {
                const existing = ((editForm.gallery as string[] | undefined) ?? []).filter(u => !removedGalleryUrls.includes(u));
                return existing.length > 0 ? (
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {existing.map((url, i) => (
                      <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden group" style={{ border: '1px solid #E8F2F1' }}>
                        <img src={url} alt={`Galerie ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => setRemovedGalleryUrls(prev => [...prev, url])}
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          style={{ background: 'rgba(239,68,68,0.7)' }}
                        >
                          <i className="ri-delete-bin-line text-white text-sm" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
              {/* New gallery files preview */}
              {editGalleryFiles.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {editGalleryFiles.map((file, i) => (
                    <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden group" style={{ border: '1px solid #4DB049' }}>
                      <img src={URL.createObjectURL(file)} alt={`Nouveau ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setEditGalleryFiles(prev => prev.filter((_, j) => j !== i))}
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        style={{ background: 'rgba(239,68,68,0.7)' }}
                      >
                        <i className="ri-delete-bin-line text-white text-sm" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) setEditGalleryFiles(prev => [...prev, ...files]);
                    e.target.value = '';
                  }}
                />
                <div className="px-3 py-2 rounded-lg text-sm text-center" style={{ background: '#F5FAF5', border: '1px dashed #4DB049', color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>
                  <i className="ri-image-add-line mr-2" />Ajouter des images à la galerie
                </div>
              </label>
            </div>
            {/* Image principale */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Image principale</label>
              <div className="flex items-center gap-3">
                {(editForm.image || editImageFile) && (
                  <img
                    src={editImageFile ? URL.createObjectURL(editImageFile) : editForm.image}
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
              <span className="text-sm" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>Éligible BNPL</span>
              <button
                onClick={() => setEditForm(prev => ({ ...prev, bnplEligible: !prev.bnplEligible }))}
                className="w-12 h-6 rounded-full transition-all cursor-pointer relative"
                style={{ background: editForm.bnplEligible ? '#4DB049' : '#E8F2F1' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                  style={{ background: '#fff', left: editForm.bnplEligible ? '26px' : '2px' }}
                />
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditModal(false)} className="flex-1 py-2.5 rounded-lg text-sm cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
                Annuler
              </button>
              <button onClick={saveEdit} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => { setAddModal(false); setAddGalleryFiles([]); setAddImageFile(null); }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Ajouter un produit</h3>
              <button onClick={() => { setAddModal(false); setAddGalleryFiles([]); setAddImageFile(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer hover:bg-gray-100" style={{ color: '#6B7280' }}>
                <i className="ri-close-line" />
              </button>
            </div>
            {[
              { label: 'Nom du produit *', key: 'name', type: 'text', placeholder: 'Ex: Samsung Galaxy A55' },
              { label: 'Stock initial', key: 'stock', type: 'number', placeholder: '10' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-xs mb-1 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={(addForm as Record<string, unknown>)[field.key] as string ?? ''}
                  onChange={e => setAddForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                />
              </div>
            ))}

            {/* Buy price (cost) + live backend-suggested sell price */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Prix d'achat (coût) *</label>
              <input
                type="number"
                placeholder="120000"
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
                    } catch { /* price suggestion failed */ }
                  }
                }}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Prix de vente (FCFA) — suggéré automatiquement</label>
              <input
                type="number"
                value={addForm.price || ''}
                onChange={e => setAddForm(prev => ({ ...prev, price: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
              />
              <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>Calculé par le backend selon la marge de la catégorie</p>
            </div>
            {/* Category selector using real platform categories */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Catégorie</label>
               <select
                 value={addForm.categoryId || ''}
                 onChange={e => {
                   const val = e.target.value;
                   const cat = availableCategories.find((c: any) => c.id === val || c.slug === val);
                   setAddForm(prev => ({ ...prev, categoryId: val, category: cat?.name || '' }));
                 }}
                 className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                 style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
               >
                 {availableCategories.length > 0 ? (
                   availableCategories.map((c: any) => (
                     <option key={c.id} value={c.id || c.slug}>{c.name}</option>
                   ))
                 ) : (
                   <option value="">Chargement des catégories...</option>
                 )}
               </select>
            </div>
            {/* Gallery upload — add modal */}
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Galerie d&apos;images</label>
              {addGalleryFiles.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {addGalleryFiles.map((file, i) => (
                    <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden group" style={{ border: '1px solid #4DB049' }}>
                      <img src={URL.createObjectURL(file)} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setAddGalleryFiles(prev => prev.filter((_, j) => j !== i))}
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        style={{ background: 'rgba(239,68,68,0.7)' }}
                      >
                        <i className="ri-delete-bin-line text-white text-sm" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) setAddGalleryFiles(prev => [...prev, ...files]);
                    e.target.value = '';
                  }}
                />
                <div className="px-3 py-2 rounded-lg text-sm text-center" style={{ background: '#F5FAF5', border: '1px dashed #4DB049', color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>
                  <i className="ri-image-add-line mr-2" />Ajouter des images à la galerie
                </div>
              </label>
            </div>
            {/* Image principale — add modal */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Image principale</label>
              <div className="flex items-center gap-3">
                {(addForm.image || addImageFile) && (
                  <img
                    src={addImageFile ? URL.createObjectURL(addImageFile) : addForm.image}
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
                      if (file) {
                        setAddImageFile(file);
                        setAddForm(prev => ({ ...prev, image: URL.createObjectURL(file) }));
                      }
                    }}
                  />
                  <div className="px-3 py-2.5 rounded-lg text-sm text-center" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                    <i className="ri-upload-cloud-line mr-2" />
                    {addImageFile ? addImageFile.name : 'Choisir une image'}
                  </div>
                </label>
                {addImageFile && (
                  <button
                    onClick={() => {
                      setAddImageFile(null);
                      setAddForm(prev => ({ ...prev, image: '' }));
                    }}
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
              <span className="text-sm" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>Éligible BNPL</span>
              <button
                onClick={() => setAddForm(prev => ({ ...prev, bnplEligible: !prev.bnplEligible }))}
                className="w-12 h-6 rounded-full transition-all cursor-pointer relative"
                style={{ background: addForm.bnplEligible ? '#4DB049' : '#E8F2F1' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                  style={{ background: '#fff', left: addForm.bnplEligible ? '26px' : '2px' }}
                />
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setAddModal(false); setAddGalleryFiles([]); setAddImageFile(null); }} className="flex-1 py-2.5 rounded-lg text-sm cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
                Annuler
              </button>
              <button onClick={saveAdd} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Supprimer le produit"
        message={`Êtes-vous sûr de vouloir supprimer "${deleteConfirm?.name}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmColor="#EF4444"
        icon="ri-delete-bin-line"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </MerchantLayout>
  );
}
