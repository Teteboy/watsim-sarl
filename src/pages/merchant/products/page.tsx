import { useState } from 'react';
import MerchantLayout from '@/components/feature/MerchantLayout';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { merchantProducts as initialProducts } from '@/mocks/merchantData';

type Product = typeof initialProducts[0];

const categoryColors: Record<string, string> = {
  Smartphones: '#D4AF37',
  Ordinateurs: '#4A9EFF',
  Tablettes: '#A855F7',
  Audio: '#22C55E',
  Moniteurs: '#F97316',
  Accessoires: '#EF4444',
  Drones: '#D4AF37',
  Bureautique: '#4A9EFF',
  Électroménager: '#22C55E',
};

export default function MerchantProductsPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBnpl, setFilterBnpl] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [addForm, setAddForm] = useState({ name: '', category: '', price: '', stock: '', bnplEligible: true });
  const { toasts, addToast, removeToast } = useToast();

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchBnpl = filterBnpl === 'all' || (filterBnpl === 'yes' ? p.bnplEligible : !p.bnplEligible);
    return matchSearch && matchStatus && matchBnpl;
  });

  const openEdit = (p: Product) => {
    setEditForm({ name: p.name, price: p.price, stock: p.stock, bnplEligible: p.bnplEligible, category: p.category });
    setSelectedProduct(p);
    setEditModal(true);
  };

  const saveEdit = () => {
    if (!selectedProduct) return;
    setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, ...editForm } : p));
    setEditModal(false);
    addToast('success', 'Produit mis à jour', `${editForm.name} a été modifié avec succès.`);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    setProducts(prev => prev.filter(p => p.id !== deleteConfirm.id));
    setDeleteConfirm(null);
    addToast('success', 'Produit supprimé', 'Le produit a été retiré du catalogue.');
  };

  const toggleBnpl = (id: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, bnplEligible: !p.bnplEligible } : p));
    const p = products.find(x => x.id === id);
    addToast('info', 'BNPL mis à jour', `${p?.name} est maintenant ${p?.bnplEligible ? 'non éligible' : 'éligible'} au BNPL.`);
  };

  const saveAdd = () => {
    if (!addForm.name || !addForm.price) return;
    const newProduct: Product = {
      id: `PRD-${String(products.length + 1).padStart(3, '0')}`,
      name: addForm.name,
      category: addForm.category || 'Autre',
      price: Number(addForm.price),
      stock: Number(addForm.stock) || 0,
      sold: 0,
      status: 'active',
      bnplEligible: addForm.bnplEligible,
      views: 0,
      rating: 0,
      image: `https://readdy.ai/api/search-image?query=$%7BencodeURIComponent%28addForm.name%29%7D%20product%20photography%20white%20background%20studio%20clean%20minimal%20professional&width=80&height=80&seq=newprd${Date.now()}&orientation=squarish`,
    };
    setProducts(prev => [newProduct, ...prev]);
    setAddModal(false);
    setAddForm({ name: '', category: '', price: '', stock: '', bnplEligible: true });
    addToast('success', 'Produit ajouté', `${newProduct.name} a été ajouté au catalogue.`);
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
          { label: 'Total produits', value: products.length, icon: 'ri-shopping-bag-3-line', color: '#D4AF37' },
          { label: 'Éligibles BNPL', value: bnplCount, icon: 'ri-bank-card-line', color: '#A855F7' },
          { label: 'Rupture de stock', value: outOfStock, icon: 'ri-error-warning-line', color: '#EF4444' },
          { label: 'Valeur stock', value: `${(totalValue / 1000000).toFixed(1)}M FCFA`, icon: 'ri-money-dollar-circle-line', color: '#22C55E' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}20` }}>
                <i className={`${s.icon} text-base`} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-white font-bold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>{s.value}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div
        className="rounded-2xl p-4 mb-4 flex flex-col md:flex-row gap-3 items-start md:items-center"
        style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}
      >
        <div className="relative flex-1 w-full">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'Poppins, sans-serif' }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'active', 'out_of_stock'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-2 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-all"
              style={{
                background: filterStatus === s ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
                color: filterStatus === s ? '#D4AF37' : 'rgba(255,255,255,0.5)',
                border: `1px solid ${filterStatus === s ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)'}`,
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {s === 'all' ? 'Tous' : s === 'active' ? 'Actifs' : 'Rupture'}
            </button>
          ))}
          <button
            onClick={() => setFilterBnpl(filterBnpl === 'all' ? 'yes' : 'all')}
            className="px-3 py-2 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-all"
            style={{
              background: filterBnpl !== 'all' ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.05)',
              color: filterBnpl !== 'all' ? '#A855F7' : 'rgba(255,255,255,0.5)',
              border: `1px solid ${filterBnpl !== 'all' ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.08)'}`,
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            <i className="ri-bank-card-line mr-1" />
            BNPL
          </button>
          <button
            onClick={() => setAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}
          >
            <i className="ri-add-line" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Products table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Produit', 'Catégorie', 'Prix', 'Stock', 'Vendus', 'Vues', 'Note', 'BNPL', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="transition-colors hover:bg-white/5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover object-top flex-shrink-0" />
                      <div>
                        <p className="text-white text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{p.name}</p>
                        <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{p.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{ background: `${categoryColors[p.category] || '#D4AF37'}20`, color: categoryColors[p.category] || '#D4AF37', fontFamily: 'Poppins, sans-serif' }}
                    >
                      {p.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white text-sm font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {p.price.toLocaleString()} FCFA
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: p.stock === 0 ? '#EF4444' : p.stock <= 5 ? '#F97316' : '#22C55E', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/60 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>{p.sold}</td>
                  <td className="px-4 py-3 text-white/60 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>{p.views.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {p.rating > 0 ? (
                      <div className="flex items-center gap-1">
                        <i className="ri-star-fill text-xs" style={{ color: '#D4AF37' }} />
                        <span className="text-white/70 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>{p.rating}</span>
                      </div>
                    ) : (
                      <span className="text-white/30 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleBnpl(p.id)}
                      className="text-xs px-2 py-1 rounded-full cursor-pointer transition-all hover:scale-105"
                      style={{
                        background: p.bnplEligible ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.06)',
                        color: p.bnplEligible ? '#A855F7' : 'rgba(255,255,255,0.3)',
                        border: `1px solid ${p.bnplEligible ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        fontFamily: 'Poppins, sans-serif',
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
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors hover:bg-white/10"
                        style={{ color: '#D4AF37' }}
                        title="Modifier"
                      >
                        <i className="ri-edit-line text-sm" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(p)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors hover:bg-red-500/10"
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
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <i className="ri-shopping-bag-3-line text-4xl text-white/20 mb-3 block" />
            <p className="text-white/40 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>Aucun produit trouvé</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={() => setEditModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>Modifier le produit</h3>
              <button onClick={() => setEditModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                <i className="ri-close-line" />
              </button>
            </div>
            {[
              { label: 'Nom du produit', key: 'name', type: 'text' },
              { label: 'Prix (FCFA)', key: 'price', type: 'number' },
              { label: 'Stock', key: 'stock', type: 'number' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-xs text-white/50 mb-1 block" style={{ fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                <input
                  type={field.type}
                  value={(editForm as Record<string, unknown>)[field.key] as string ?? ''}
                  onChange={e => setEditForm(prev => ({ ...prev, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                />
              </div>
            ))}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-white/70" style={{ fontFamily: 'Poppins, sans-serif' }}>Éligible BNPL</span>
              <button
                onClick={() => setEditForm(prev => ({ ...prev, bnplEligible: !prev.bnplEligible }))}
                className="w-12 h-6 rounded-full transition-all cursor-pointer relative"
                style={{ background: editForm.bnplEligible ? '#D4AF37' : 'rgba(255,255,255,0.1)' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                  style={{ background: '#fff', left: editForm.bnplEligible ? '26px' : '2px' }}
                />
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditModal(false)} className="flex-1 py-2.5 rounded-lg text-sm cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}>
                Annuler
              </button>
              <button onClick={saveEdit} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={() => setAddModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>Ajouter un produit</h3>
              <button onClick={() => setAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                <i className="ri-close-line" />
              </button>
            </div>
            {[
              { label: 'Nom du produit *', key: 'name', type: 'text', placeholder: 'Ex: Samsung Galaxy A55' },
              { label: 'Catégorie', key: 'category', type: 'text', placeholder: 'Ex: Smartphones' },
              { label: 'Prix (FCFA) *', key: 'price', type: 'number', placeholder: '185000' },
              { label: 'Stock initial', key: 'stock', type: 'number', placeholder: '10' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-xs text-white/50 mb-1 block" style={{ fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={(addForm as Record<string, unknown>)[field.key] as string ?? ''}
                  onChange={e => setAddForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                />
              </div>
            ))}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-white/70" style={{ fontFamily: 'Poppins, sans-serif' }}>Éligible BNPL</span>
              <button
                onClick={() => setAddForm(prev => ({ ...prev, bnplEligible: !prev.bnplEligible }))}
                className="w-12 h-6 rounded-full transition-all cursor-pointer relative"
                style={{ background: addForm.bnplEligible ? '#D4AF37' : 'rgba(255,255,255,0.1)' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                  style={{ background: '#fff', left: addForm.bnplEligible ? '26px' : '2px' }}
                />
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setAddModal(false)} className="flex-1 py-2.5 rounded-lg text-sm cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}>
                Annuler
              </button>
              <button onClick={saveAdd} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
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
