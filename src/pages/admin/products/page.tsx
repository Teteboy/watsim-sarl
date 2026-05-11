import { useState } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { adminProducts as initialProducts } from '@/mocks/adminProducts';

type Product = typeof initialProducts[0];

const statusColors: Record<string, string> = { active: '#22C55E', out_of_stock: '#EF4444', inactive: '#6B7280' };
const statusLabels: Record<string, string> = { active: 'Actif', out_of_stock: 'Rupture', inactive: 'Inactif' };
const productCategories = ['Électronique', 'Mode & Vêtements', 'Alimentation', 'Maison & Déco', 'Santé & Beauté', 'Automobile', 'Éducation', 'Sport & Loisirs', 'Électroménager'];

export default function AdminProductsPage() {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bnplFilter, setBnplFilter] = useState('all');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', price: '', stock: '', bnplEligible: false });
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', merchant: '', category: 'Électronique', price: '', stock: '', bnplEligible: true });
  const { toasts, addToast, removeToast } = useToast();

  const allCategories = ['all', ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.merchant.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchBnpl = bnplFilter === 'all' || (bnplFilter === 'yes' ? p.bnplEligible : !p.bnplEligible);
    return matchSearch && matchCat && matchStatus && matchBnpl;
  });

  const totalRevenue = products.reduce((acc, p) => acc + p.price * p.sold, 0);

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setEditForm({ name: p.name, price: String(p.price), stock: String(p.stock), bnplEligible: p.bnplEligible });
  };

  const handleSaveEdit = () => {
    if (!editProduct) return;
    const updated = { ...editProduct, name: editForm.name, price: Number(editForm.price), stock: Number(editForm.stock), bnplEligible: editForm.bnplEligible, status: Number(editForm.stock) === 0 ? 'out_of_stock' : 'active' };
    setProducts(prev => prev.map(p => p.id === editProduct.id ? updated : p));
    setEditProduct(null);
    addToast('success', 'Produit modifié', `${editForm.name} a été mis à jour.`);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    setProducts(prev => prev.filter(p => p.id !== confirmDelete.id));
    setConfirmDelete(null);
    addToast('info', 'Produit supprimé', `${confirmDelete.name} a été retiré du catalogue.`);
  };

  const handleToggleBnpl = (product: Product) => {
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, bnplEligible: !p.bnplEligible } : p));
    addToast('info', 'Éligibilité BNPL modifiée', `${product.name} est maintenant ${!product.bnplEligible ? 'éligible' : 'non éligible'} au BNPL.`);
  };

  const handleAddProduct = () => {
    if (!addForm.name || !addForm.price) { addToast('error', 'Champs requis', 'Veuillez remplir le nom et le prix.'); return; }
    const newProduct: Product = {
      id: `PRD-${String(products.length + 1).padStart(3, '0')}`,
      name: addForm.name, merchant: addForm.merchant || 'Non assigné', merchantId: 'MCH-000',
      category: addForm.category, price: Number(addForm.price), stock: Number(addForm.stock),
      sold: 0, status: Number(addForm.stock) > 0 ? 'active' : 'out_of_stock',
      bnplEligible: addForm.bnplEligible,
      image: `https://readdy.ai/api/search-image?query=$%7BencodeURIComponent%28addForm.name%29%7D%20product%20white%20background%20studio&width=80&height=80&seq=new${products.length}&orientation=squarish`,
    };
    setProducts(prev => [newProduct, ...prev]);
    setShowAddModal(false);
    setAddForm({ name: '', merchant: '', category: 'Électronique', price: '', stock: '', bnplEligible: true });
    addToast('success', 'Produit ajouté', `${addForm.name} a été ajouté au catalogue.`);
  };

  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'Poppins, sans-serif' };

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Gestion', 'Produits']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Catalogue Produits</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{products.length} produits référencés</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
            <i className="ri-add-line" /> Ajouter Produit
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Produits', value: products.length, icon: 'ri-shopping-bag-3-line', color: '#D4AF37' },
            { label: 'Éligibles BNPL', value: products.filter(p => p.bnplEligible).length, icon: 'ri-bank-card-line', color: '#22C55E' },
            { label: 'Rupture de Stock', value: products.filter(p => p.status === 'out_of_stock').length, icon: 'ri-error-warning-line', color: '#EF4444' },
            { label: 'Revenus Générés', value: `${(totalRevenue / 1000000).toFixed(1)}M FCFA`, icon: 'ri-money-cny-circle-line', color: '#F97316' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}20` }}>
                <i className={`${s.icon} text-lg`} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>{s.value}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-4 flex flex-wrap gap-3 items-center" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <i className="ri-search-line text-white/40 text-sm" />
            <input type="text" placeholder="Rechercher produit ou commercial..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent text-white text-sm outline-none flex-1 placeholder-white/30" style={{ fontFamily: 'Poppins, sans-serif' }} />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>
            {allCategories.map(c => <option key={c} value={c} style={{ background: '#0D1B2A' }}>{c === 'all' ? 'Toutes catégories' : c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>
            <option value="all" style={{ background: '#0D1B2A' }}>Tous statuts</option>
            <option value="active" style={{ background: '#0D1B2A' }}>Actifs</option>
            <option value="out_of_stock" style={{ background: '#0D1B2A' }}>Rupture</option>
          </select>
          <select value={bnplFilter} onChange={e => setBnplFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>
            <option value="all" style={{ background: '#0D1B2A' }}>BNPL: Tous</option>
            <option value="yes" style={{ background: '#0D1B2A' }}>BNPL: Éligible</option>
            <option value="no" style={{ background: '#0D1B2A' }}>BNPL: Non éligible</option>
          </select>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Produit', 'Commercial', 'Catégorie', 'Prix', 'Stock', 'Vendus', 'BNPL', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => (
                  <tr key={p.id} className="transition-colors hover:bg-white/3" style={{ borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={p.image} alt={p.name} className="w-full h-full object-cover object-top" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{p.name}</p>
                          <p className="text-xs font-mono" style={{ color: '#D4AF37' }}>{p.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif' }}>{p.merchant}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif' }}>{p.category}</td>
                    <td className="px-4 py-3 text-sm font-medium whitespace-nowrap" style={{ color: '#D4AF37', fontFamily: 'Poppins, sans-serif' }}>{p.price.toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium" style={{ color: p.stock === 0 ? '#EF4444' : p.stock < 10 ? '#F97316' : 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>{p.stock}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>{p.sold}</td>
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
                        <button onClick={() => openEdit(p)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer" title="Modifier">
                          <i className="ri-edit-line text-sm" style={{ color: '#D4AF37' }} />
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
      </div>

      {/* Edit Product Modal */}
      {editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setEditProduct(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Modifier le Produit</h2>
              <button onClick={() => setEditProduct(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <img src={editProduct.image} alt={editProduct.name} className="w-12 h-12 rounded-lg object-cover object-top" />
              <div>
                <p className="text-sm font-medium text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{editProduct.id}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{editProduct.merchant}</p>
              </div>
            </div>
            <div className="space-y-3">
              {[{ label: 'Nom du produit', key: 'name', type: 'text' }, { label: 'Prix (FCFA)', key: 'price', type: 'number' }, { label: 'Stock disponible', key: 'stock', type: 'number' }].map(field => (
                <div key={field.key}>
                  <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                  <input type={field.type} value={editForm[field.key as keyof typeof editForm] as string} onChange={e => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
                </div>
              ))}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>Éligible BNPL</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Permettre l&apos;achat à crédit pour ce produit</p>
                </div>
                <button onClick={() => setEditForm(prev => ({ ...prev, bnplEligible: !prev.bnplEligible }))} className="relative w-11 h-6 rounded-full transition-all cursor-pointer flex-shrink-0" style={{ background: editForm.bnplEligible ? 'linear-gradient(135deg, #D4AF37, #F5D76E)' : 'rgba(255,255,255,0.15)' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: editForm.bnplEligible ? '22px' : '2px', background: editForm.bnplEligible ? '#0A1628' : 'rgba(255,255,255,0.6)' }} />
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditProduct(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-save-line mr-2" />Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Ajouter un Produit</h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="space-y-3">
              {[{ label: 'Nom du produit *', key: 'name', type: 'text' }, { label: 'Commercial', key: 'merchant', type: 'text' }, { label: 'Prix (FCFA) *', key: 'price', type: 'number' }, { label: 'Stock initial', key: 'stock', type: 'number' }].map(field => (
                <div key={field.key}>
                  <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                  <input type={field.type} value={addForm[field.key as keyof typeof addForm] as string} onChange={e => setAddForm(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
                </div>
              ))}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Catégorie</label>
                <select value={addForm.category} onChange={e => setAddForm(prev => ({ ...prev, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                  {productCategories.map(c => <option key={c} value={c} style={{ background: '#0D1B2A' }}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between py-1">
                <p className="text-sm text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>Éligible BNPL</p>
                <button onClick={() => setAddForm(prev => ({ ...prev, bnplEligible: !prev.bnplEligible }))} className="relative w-11 h-6 rounded-full transition-all cursor-pointer" style={{ background: addForm.bnplEligible ? 'linear-gradient(135deg, #D4AF37, #F5D76E)' : 'rgba(255,255,255,0.15)' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: addForm.bnplEligible ? '22px' : '2px', background: addForm.bnplEligible ? '#0A1628' : 'rgba(255,255,255,0.6)' }} />
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleAddProduct} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
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
