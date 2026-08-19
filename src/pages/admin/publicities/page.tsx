import { useState, useRef, useEffect } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { adminApi, API_PREFIX } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/utils';

// Publicity configuration constants
const publicityTypes = [
  { value: 'banner', label: 'Bannière', icon: 'ri-image-line' },
  { value: 'video', label: 'Vidéo', icon: 'ri-video-line' },
  { value: 'popup', label: 'Popup', icon: 'ri-notification-badge-line' },
];

const publicityPositions = [
  { value: 'home_top', label: 'Accueil - Haut' },
  { value: 'home_middle', label: 'Accueil - Milieu' },
  { value: 'home_bottom', label: 'Accueil - Bas' },
  { value: 'search_results', label: 'Résultats de recherche' },
  { value: 'product_detail', label: 'Détail produit' },
  { value: 'checkout', label: 'Checkout' },
];

const publicityStatuses = [
  { value: 'ACTIVE', label: 'Active', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  { value: 'PAUSED', label: 'En pause', color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  { value: 'ENDED', label: 'Terminée', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  { value: 'PENDING', label: 'En attente', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  { value: 'DRAFT', label: 'Brouillon', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' },
  { value: 'REJECTED', label: 'Rejetée', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
];

export default function AdminPublicitiesPage() {
  const [publicities, setPublicities] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await adminApi.publicities({ page: 1, limit: 100 });
        if (!mounted) return;
        const items = Array.isArray(res) ? res : res.items ?? [];
        setPublicities(items);
      } catch {
        // fallback to empty
        setPublicities([]);
      }
    })();
    return () => { mounted = false; };
  }, []);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'budget' | 'clicks' | 'ctr'>('budget');
  const [editingPub, setEditingPub] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toasts, addToast, removeToast } = useToast();

  const [confirmAction, setConfirmAction] = useState<{ pub: any; action: 'delete' } | null>(null);
  const [detailPub, setDetailPub] = useState<any | null>(null);

  const [newPub, setNewPub] = useState({
    name: '',
    merchant: '',
    merchantId: '',
    type: 'banner',
    budget: 0,
    position: 'homepage_hero',
    startDate: '',
    endDate: '',
    image: '',
  });

  const filtered = publicities
    .filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.merchant.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter.toUpperCase();
      const matchesType = typeFilter === 'all' || p.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'budget') return b.budget - a.budget;
      if (sortBy === 'clicks') return b.clicks - a.clicks;
      const ctrA = a.ctr ?? (a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0);
      const ctrB = b.ctr ?? (b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0);
      return ctrB - ctrA;
    });

  const stats = {
    total: publicities.length,
    active: publicities.filter((p) => p.status === 'ACTIVE').length,
    totalBudget: publicities.reduce((s, p) => s + p.budget, 0),
    totalSpent: publicities.reduce((s, p) => s + p.spent, 0),
    totalClicks: publicities.reduce((s, p) => s + p.clicks, 0),
    totalImpressions: publicities.reduce((s, p) => s + p.impressions, 0),
  };

  const avgCtr = stats.totalImpressions > 0
    ? ((stats.totalClicks / stats.totalImpressions) * 100).toFixed(2)
    : '0.00';

  const handleToggleStatus = async (id: string) => {
    const pub = publicities.find((p) => p.id === id);
    if (!pub) return;

    const newStatus = pub.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await adminApi.updatePublicity(id, { status: newStatus });
      setPublicities((prev) => prev.map((p) => p.id === id ? { ...p, status: newStatus } : p));
      addToast('success', newStatus === 'ACTIVE' ? 'Publicité réactivée' : 'Publicité mise en pause', `La publicité ${id} a été ${newStatus === 'ACTIVE' ? 'réactivée' : 'mise en pause'}.`);
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Échec de la mise à jour.');
    }
  };

  const handleDelete = (pub: any) => {
    setConfirmAction({ pub, action: 'delete' });
  };

  const confirmDelete = async () => {
    if (!confirmAction) return;
    try {
      await adminApi.deletePublicity(confirmAction.pub.id);
    } catch { /* delete failed, optimistically removed */ }
    setPublicities((prev) => prev.filter((p) => p.id !== confirmAction.pub.id));
    addToast('success', 'Publicité supprimée', `La publicité ${confirmAction.pub.id} a été supprimée.`);
    setConfirmAction(null);
  };

  const handleApprove = async (id: string) => {
    try {
      await adminApi.updatePublicity(id, { status: 'ACTIVE' });
      setPublicities((prev) => prev.map((p) => p.id === id ? { ...p, status: 'ACTIVE' } : p));
      addToast('success', 'Publicité approuvée', `La publicité ${id} a été approuvée et activée.`);
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Échec de l\'approbation.');
    }
  };

  const handleAdd = async () => {
    if (!newPub.name || !newPub.budget || !newPub.startDate || !newPub.endDate) {
      addToast('error', 'Champs requis', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    try {
      const created = await adminApi.createPublicity({
        name: newPub.name,
        merchantId: newPub.merchantId || undefined,
        type: newPub.type.toUpperCase(),
        position: newPub.position.toUpperCase(),
        budget: Number(newPub.budget),
        startDate: newPub.startDate,
        endDate: newPub.endDate,
        imageUrl: newPub.image || undefined,
      });
      setPublicities((prev) => [created, ...prev]);
      setShowAddModal(false);
      setNewPub({ name: '', merchant: '', merchantId: '', type: 'banner', budget: 0, position: 'homepage_hero', startDate: '', endDate: '', image: '' });
      addToast('success', 'Publicité créée', `La publicité a été créée avec succès.`);
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Échec de la création.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPub) return;
    try {
      await adminApi.updatePublicity(editingPub.id, {
        name: editingPub.name,
        status: editingPub.status?.toUpperCase(),
        budget: Number(editingPub.budget),
        imageUrl: editingPub.image || editingPub.imageUrl,
        position: editingPub.position,
        type: editingPub.type?.toUpperCase(),
        startDate: editingPub.startDate,
        endDate: editingPub.endDate,
      });
      setPublicities((prev) => prev.map((p) => p.id === editingPub.id ? editingPub : p));
      setEditingPub(null);
      addToast('success', 'Publicité mise à jour', `La publicité ${editingPub.id} a été mise à jour.`);
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Échec de la mise à jour.');
    }
  };

  const getStatusStyle = (status: string) => {
    const s = publicityStatuses.find((ps) => ps.value === status);
    return s || { color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', label: status };
  };

  const getTypeIcon = (type: string) => {
    const t = publicityTypes.find((pt) => pt.value === type);
    return t?.icon || 'ri-image-line';
  };

  const getPositionLabel = (pos: string) => {
    const p = publicityPositions.find((pp) => pp.value === pos);
    return p?.label || pos;
  };

  const inputStyle = { background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' };
  const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Gestion', 'Publicités Mobile']}>
      <div className="space-y-6">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
              Publicités Mobile App
            </h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
              Gérer les publicités affichées dans l'application mobile WATSIM
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
            style={{
              background: 'linear-gradient(135deg, #4DB049, #22C55E)',
              color: '#FFFFFF',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            <i className="ri-add-line" />
            Nouvelle publicité
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {[
            { label: 'Total publicités', value: stats.total, icon: 'ri-advertisement-line', color: '#4DB049' },
            { label: 'Actives', value: stats.active, icon: 'ri-checkbox-circle-line', color: '#22C55E' },
            { label: 'Budget total', value: `${(stats.totalBudget / 1000).toFixed(0)}K FCFA`, icon: 'ri-money-cny-circle-line', color: '#3B82F6' },
            { label: 'Dépensé', value: `${(stats.totalSpent / 1000).toFixed(0)}K FCFA`, icon: 'ri-wallet-3-line', color: '#F59E0B' },
            { label: 'CTR moyen', value: `${avgCtr}%`, icon: 'ri-bar-chart-line', color: '#8B5CF6' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-4 flex items-center gap-3"
              style={cardStyle}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${stat.color}20` }}>
                <i className={`${stat.icon} text-lg`} style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{stat.label}</p>
                <p className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#9CA3AF' }} />
              <input
                type="text"
                placeholder="Rechercher une publicité..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg text-sm outline-none w-64"
                style={{
                  background: '#F5FAF5',
                  border: '1px solid #E8F2F1',
                  color: '#1A2B1F',
                  fontFamily: 'Poppins, sans-serif',
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
              style={{
                background: '#F5FAF5',
                border: '1px solid #E8F2F1',
                color: '#1A2B1F',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              <option value="all" style={{ background: '#FFFFFF' }}>Tous les statuts</option>
              {publicityStatuses.map((s) => (
                <option key={s.value} value={s.value} style={{ background: '#FFFFFF' }}>{s.label}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
              style={{
                background: '#F5FAF5',
                border: '1px solid #E8F2F1',
                color: '#1A2B1F',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              <option value="all" style={{ background: '#FFFFFF' }}>Tous les types</option>
              {publicityTypes.map((t) => (
                <option key={t.value} value={t.value} style={{ background: '#FFFFFF' }}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            {(['budget', 'clicks', 'ctr'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                style={{
                  background: sortBy === key ? 'rgba(77,176,89,0.15)' : '#F5FAF5',
                  color: sortBy === key ? '#4DB049' : '#6B7280',
                  border: `1px solid ${sortBy === key ? 'rgba(77,176,89,0.3)' : '#E8F2F1'}`,
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {key === 'budget' ? 'Budget' : key === 'clicks' ? 'Clics' : 'CTR'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={cardStyle}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #E8F2F1' }}>
                  {['Publicité', 'Type', 'Position', 'Budget / Dépensé', 'Performance', 'Statut', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider"
                      style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((pub) => {
                  const statusStyle = getStatusStyle(pub.status);
                  const progress = pub.budget > 0 ? (pub.spent / pub.budget) * 100 : 0;
                  return (
                    <tr
                      key={pub.id}
                      className="transition-colors hover:bg-gray-50"
                      style={{ borderBottom: '1px solid #F0F7F0' }}
                    >
                      {/* Publicité */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-16 h-10 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                            onClick={() => setSelectedImage(pub.imageUrl || pub.image)}
                          >
                            <img src={resolveUploadUrl(pub.imageUrl || pub.image) ?? ''} alt={pub.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>
                              {pub.name}
                            </p>
                            <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                              {pub.id} · {typeof pub.merchant === 'string' ? pub.merchant : pub.merchant?.businessName || pub.merchant?.name || '-'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 flex items-center justify-center">
                            <i className={`${getTypeIcon(pub.type)} text-sm`} style={{ color: '#4DB049' }} />
                          </div>
                          <span className="text-sm text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                            {publicityTypes.find((t) => t.value === pub.type)?.label || pub.type}
                          </span>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          {getPositionLabel(pub.position)}
                        </span>
                      </td>

                      {/* Budget / Dépensé */}
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                              {pub.spent.toLocaleString('fr-FR')} / {pub.budget.toLocaleString('fr-FR')} FCFA
                            </span>
                            <span className="text-xs font-medium" style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>
                              {progress.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#E8F2F1' }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(progress, 100)}%`,
                                background: progress >= 90
                                  ? 'linear-gradient(90deg, #EF4444, #F87171)'
                                  : 'linear-gradient(90deg, #4DB049, #22C55E)',
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Performance */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <i className="ri-eye-line text-xs" style={{ color: '#9CA3AF' }} />
                            <span className="text-xs text-gray-700" style={{ fontFamily: 'Poppins, sans-serif' }}>
                              {pub.impressions.toLocaleString('fr-FR')} vues
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <i className="ri-cursor-line text-xs" style={{ color: '#9CA3AF' }} />
                            <span className="text-xs text-gray-700" style={{ fontFamily: 'Poppins, sans-serif' }}>
                              {pub.clicks.toLocaleString('fr-FR')} clics
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <i className="ri-percent-line text-xs" style={{ color: '#9CA3AF' }} />
                            <span className="text-xs font-medium" style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>
                              {pub.ctr ? pub.ctr.toFixed(2) : pub.impressions > 0 ? ((pub.clicks / pub.impressions) * 100).toFixed(2) : '0.00'}% CTR
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3">
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-medium inline-block"
                          style={{
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            fontFamily: 'Poppins, sans-serif',
                          }}
                        >
                          {statusStyle.label}
                        </span>
                        <p className="text-xs mt-1" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>
                          {pub.startDate} → {pub.endDate}
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {(pub.status === 'ACTIVE' || pub.status === 'PAUSED') && (
                            <button
                              onClick={() => handleToggleStatus(pub.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                              style={{ background: '#F5FAF5' }}
                              title={pub.status === 'ACTIVE' ? 'Mettre en pause' : 'Réactiver'}
                            >
                              <i className={`${pub.status === 'ACTIVE' ? 'ri-pause-circle-line' : 'ri-play-circle-line'} text-sm`} style={{ color: pub.status === 'ACTIVE' ? '#F59E0B' : '#22C55E' }} />
                            </button>
                          )}
                          {pub.status === 'PENDING' && (
                            <button
                              onClick={() => handleApprove(pub.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                              style={{ background: 'rgba(34,197,94,0.12)' }}
                              title="Approuver"
                            >
                              <i className="ri-check-line text-sm" style={{ color: '#22C55E' }} />
                            </button>
                          )}
                          <button
                            onClick={() => setDetailPub(pub)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                            style={{ background: '#F5FAF5' }}
                            title="Voir les détails"
                          >
                            <i className="ri-eye-line text-sm" style={{ color: '#6B7280' }} />
                          </button>
                          <button
                            onClick={() => setEditingPub(pub)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                            style={{ background: '#F5FAF5' }}
                            title="Modifier"
                          >
                            <i className="ri-edit-line text-sm" style={{ color: '#6B7280' }} />
                          </button>
                          <button
                            onClick={() => handleDelete(pub)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                            style={{ background: 'rgba(239,68,68,0.08)' }}
                            title="Supprimer"
                          >
                            <i className="ri-delete-bin-line text-sm" style={{ color: '#EF4444' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <i className="ri-advertisement-line text-4xl mb-3 block" style={{ color: '#D1E8D1' }} />
                      <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                        Aucune publicité trouvée
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-2xl w-full">
            <img
              src={resolveUploadUrl(selectedImage) ?? ''}
              alt="Publicité"
              className="w-full rounded-xl"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              style={{ maxHeight: '60vh', objectFit: 'contain' }}
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
              style={{ background: '#EF4444' }}
            >
              <i className="ri-close-line text-white text-sm" />
            </button>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={cardStyle}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                Nouvelle publicité mobile
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                style={{ background: '#F5FAF5' }}
              >
                <i className="ri-close-line text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  Nom de la campagne *
                </label>
                <input
                  type="text"
                  value={newPub.name}
                  onChange={(e) => setNewPub({ ...newPub, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                  placeholder="Ex: Campagne Samsung Galaxy"
                />
              </div>

              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  Commercial *
                </label>
                <input
                  type="text"
                  value={newPub.merchant}
                  onChange={(e) => setNewPub({ ...newPub, merchant: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                  placeholder="Ex: TechShop Yaoundé"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                    Type
                  </label>
                  <select
                    value={newPub.type}
                    onChange={(e) => setNewPub({ ...newPub, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    {publicityTypes.map((t) => (
                      <option key={t.value} value={t.value} style={{ background: '#FFFFFF' }}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                    Position
                  </label>
                  <select
                    value={newPub.position}
                    onChange={(e) => setNewPub({ ...newPub, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    {publicityPositions.map((p) => (
                      <option key={p.value} value={p.value} style={{ background: '#FFFFFF' }}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  Budget (FCFA) *
                </label>
                <input
                  type="number"
                  value={newPub.budget || ''}
                  onChange={(e) => setNewPub({ ...newPub, budget: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                  placeholder="150000"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                    Date début *
                  </label>
                  <input
                    type="date"
                    value={newPub.startDate}
                    onChange={(e) => setNewPub({ ...newPub, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                    Date fin *
                  </label>
                  <input
                    type="date"
                    value={newPub.endDate}
                    onChange={(e) => setNewPub({ ...newPub, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  Image de la publicité
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={newPub.image}
                    onChange={(e) => setNewPub({ ...newPub, image: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="URL de l'image..."
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                    style={{
                      background: '#F5FAF5',
                      border: '1px solid #E8F2F1',
                      color: '#4DB049',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    <i className="ri-upload-2-line mr-1" />
                    Upload
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const result = await adminApi.uploadImage(file);
                      setNewPub({ ...newPub, image: result.url });
                      addToast('success', 'Image uploadée', 'L\'image a été uploadée avec succès.');
                    } catch (err: any) {
                      addToast('error', 'Erreur upload', err?.message || 'Échec de l\'upload.');
                    }
                    e.target.value = '';
                  }} />
                </div>
                {newPub.image && (
                  <div className="mt-2">
                    <img src={resolveUploadUrl(newPub.image) ?? ''} alt="Preview" className="w-full h-24 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
                <p className="text-xs mt-1" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>
                  Format recommandé : 1200x400px, JPG ou PNG
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
                style={{
                  background: '#F5FAF5',
                  border: '1px solid #E8F2F1',
                  color: '#6B7280',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap"
                style={{
                  background: 'linear-gradient(135deg, #4DB049, #22C55E)',
                  color: '#FFFFFF',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                Créer la publicité
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPub && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(1,73,69,0.15)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                Modifier {editingPub.id}
              </h3>
              <button
                onClick={() => setEditingPub(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-100"
                style={{ background: '#F5FAF5' }}
              >
                <i className="ri-close-line" style={{ color: '#6B7280' }} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  Nom de la campagne
                </label>
                <input
                  type="text"
                  value={editingPub.name}
                  onChange={(e) => setEditingPub({ ...editingPub, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                    Type
                  </label>
                  <select
                    value={editingPub.type}
                    onChange={(e) => setEditingPub({ ...editingPub, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    {publicityTypes.map((t) => (
                      <option key={t.value} value={t.value} style={{ background: '#FFFFFF' }}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                    Position
                  </label>
                  <select
                    value={editingPub.position}
                    onChange={(e) => setEditingPub({ ...editingPub, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    {publicityPositions.map((p) => (
                      <option key={p.value} value={p.value} style={{ background: '#FFFFFF' }}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  Budget (FCFA)
                </label>
                <input
                  type="number"
                  value={editingPub.budget}
                  onChange={(e) => setEditingPub({ ...editingPub, budget: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                    Date début
                  </label>
                  <input
                    type="date"
                    value={editingPub.startDate}
                    onChange={(e) => setEditingPub({ ...editingPub, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                    Date fin
                  </label>
                  <input
                    type="date"
                    value={editingPub.endDate}
                    onChange={(e) => setEditingPub({ ...editingPub, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  Image de la publicité
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={editingPub.imageUrl || editingPub.image || ''}
                    onChange={(e) => setEditingPub({ ...editingPub, imageUrl: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="URL de l'image..."
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                    style={{
                      background: '#F5FAF5',
                      border: '1px solid #E8F2F1',
                      color: '#4DB049',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    <i className="ri-upload-2-line mr-1" />
                    Upload
                  </button>
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const result = await adminApi.uploadImage(file);
                      setEditingPub({ ...editingPub, imageUrl: result.url });
                      addToast('success', 'Image uploadée', 'L\'image a été uploadée avec succès.');
                    } catch (err: any) {
                      addToast('error', 'Erreur upload', err?.message || 'Échec de l\'upload.');
                    }
                    e.target.value = '';
                  }} />
                </div>
                {(editingPub.imageUrl || editingPub.image) && (
                  <div className="mt-2">
                    <img src={resolveUploadUrl(editingPub.imageUrl || editingPub.image) ?? ''} alt="Preview" className="w-full h-24 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingPub(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
                style={{
                  background: '#F5FAF5',
                  border: '1px solid #E8F2F1',
                  color: '#6B7280',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap"
                style={{
                  background: 'linear-gradient(135deg, #4DB049, #22C55E)',
                  color: '#FFFFFF',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailPub && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => setDetailPub(null)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(1,73,69,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                  Détails de la publicité
                </h3>
                <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  {detailPub.id}
                </p>
              </div>
              <button
                onClick={() => setDetailPub(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-100"
                style={{ background: '#F5FAF5' }}
              >
                <i className="ri-close-line" style={{ color: '#6B7280' }} />
              </button>
            </div>

            <div className="space-y-5">
              {(() => {
                const statusStyle = getStatusStyle(detailPub.status);
                const progress = detailPub.budget > 0 ? (detailPub.spent / detailPub.budget) * 100 : 0;
                const ctr = detailPub.ctr ?? (detailPub.impressions > 0 ? (detailPub.clicks / detailPub.impressions) * 100 : 0);
                return (
                  <>
                    <div className="rounded-xl overflow-hidden border border-[#E8F2F1]">
                      <img
                        src={resolveUploadUrl(detailPub.imageUrl || detailPub.image) ?? ''}
                        alt={detailPub.name}
                        className="w-full h-48 sm:h-64 object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Nom de la campagne</p>
                        <p className="text-sm font-semibold" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{detailPub.name}</p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Statut</p>
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-medium inline-block"
                          style={{ background: statusStyle.bg, color: statusStyle.color, fontFamily: 'Poppins, sans-serif' }}
                        >
                          {statusStyle.label}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Type</p>
                        <p className="text-sm font-semibold" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                          {publicityTypes.find((t) => t.value === detailPub.type)?.label || detailPub.type}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Position</p>
                        <p className="text-sm font-semibold" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                          {getPositionLabel(detailPub.position)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Commercial / Marchand</p>
                        <p className="text-sm font-semibold" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                          {typeof detailPub.merchant === 'string' ? detailPub.merchant : detailPub.merchant?.businessName || detailPub.merchant?.name || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Budget</p>
                        <p className="text-sm font-semibold" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                          {detailPub.budget.toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Dépensé</p>
                        <p className="text-sm font-semibold" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                          {detailPub.spent.toLocaleString('fr-FR')} FCFA ({progress.toFixed(0)}%)
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Période</p>
                        <p className="text-sm font-semibold" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                          {detailPub.startDate} → {detailPub.endDate}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl p-4" style={{ background: '#F5FAF5' }}>
                      <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                        Performance
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Impressions</p>
                          <p className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                            {detailPub.impressions.toLocaleString('fr-FR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Clics</p>
                          <p className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                            {detailPub.clicks.toLocaleString('fr-FR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>CTR</p>
                          <p className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                            {ctr.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#E8F2F1' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(progress, 100)}%`,
                          background: progress >= 90
                            ? 'linear-gradient(90deg, #EF4444, #F87171)'
                            : 'linear-gradient(90deg, #4DB049, #22C55E)',
                        }}
                      />
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDetailPub(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
                style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  const pub = detailPub;
                  setDetailPub(null);
                  setEditingPub(pub);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
              >
                Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        title="Supprimer la publicité"
        message={confirmAction ? `Êtes-vous sûr de vouloir supprimer la publicité ${confirmAction.pub.id} (${confirmAction.pub.name}) ? Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        confirmColor="#EF4444"
        icon="ri-delete-bin-line"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmAction(null)}
      />

      <Toast toasts={toasts} onRemove={removeToast} />
    </AdminLayout>
  );
}