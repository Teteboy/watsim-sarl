import { useState, useRef } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { adminPublicities, publicityTypes, publicityPositions, publicityStatuses } from '@/mocks/adminPublicities';

export default function AdminPublicitiesPage() {
  const [publicities, setPublicities] = useState(adminPublicities);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'budget' | 'clicks' | 'ctr'>('budget');
  const [editingPub, setEditingPub] = useState<typeof adminPublicities[0] | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toasts, addToast, removeToast } = useToast();

  const [confirmAction, setConfirmAction] = useState<{ pub: typeof adminPublicities[0]; action: 'delete' } | null>(null);

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
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesType = typeFilter === 'all' || p.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'budget') return b.budget - a.budget;
      if (sortBy === 'clicks') return b.clicks - a.clicks;
      return b.ctr - a.ctr;
    });

  const stats = {
    total: publicities.length,
    active: publicities.filter((p) => p.status === 'active').length,
    totalBudget: publicities.reduce((s, p) => s + p.budget, 0),
    totalSpent: publicities.reduce((s, p) => s + p.spent, 0),
    totalClicks: publicities.reduce((s, p) => s + p.clicks, 0),
    totalImpressions: publicities.reduce((s, p) => s + p.impressions, 0),
  };

  const avgCtr = stats.totalImpressions > 0
    ? ((stats.totalClicks / stats.totalImpressions) * 100).toFixed(2)
    : '0.00';

  const handleToggleStatus = (id: string) => {
    const pub = publicities.find((p) => p.id === id);
    if (!pub) return;

    if (pub.status === 'active') {
      setPublicities((prev) => prev.map((p) => p.id === id ? { ...p, status: 'paused' as const } : p));
      addToast('success', 'Publicité mise en pause', `La publicité ${id} a été mise en pause.`);
    } else if (pub.status === 'paused') {
      setPublicities((prev) => prev.map((p) => p.id === id ? { ...p, status: 'active' as const } : p));
      addToast('success', 'Publicité réactivée', `La publicité ${id} a été réactivée.`);
    }
  };

  const handleDelete = (pub: typeof adminPublicities[0]) => {
    setConfirmAction({ pub, action: 'delete' });
  };

  const confirmDelete = () => {
    if (!confirmAction) return;
    setPublicities((prev) => prev.filter((p) => p.id !== confirmAction.pub.id));
    addToast('success', 'Publicité supprimée', `La publicité ${confirmAction.pub.id} a été supprimée.`);
    setConfirmAction(null);
  };

  const handleApprove = (id: string) => {
    setPublicities((prev) => prev.map((p) => p.id === id ? { ...p, status: 'active' as const } : p));
    addToast('success', 'Publicité approuvée', `La publicité ${id} a été approuvée et activée.`);
  };

  const handleAdd = () => {
    if (!newPub.name || !newPub.merchant || !newPub.budget || !newPub.startDate || !newPub.endDate) {
      addToast('error', 'Champs requis', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    const id = `PUB-${String(publicities.length + 1).padStart(3, '0')}`;
    const pub = {
      ...newPub,
      id,
      status: 'pending' as const,
      spent: 0,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      image: newPub.image || 'https://readdy.ai/api/search-image?query=generic%20promotional%20advertising%20banner%20placeholder%20on%20dark%20blue%20background%20with%20gold%20accents%2C%20minimalist%20professional%20design&width=300&height=120&seq=pubdefault&orientation=landscape',
    };
    setPublicities((prev) => [pub, ...prev]);
    setShowAddModal(false);
    setNewPub({ name: '', merchant: '', merchantId: '', type: 'banner', budget: 0, position: 'homepage_hero', startDate: '', endDate: '', image: '' });
    addToast('success', 'Publicité créée', `La publicité ${id} a été créée avec succès.`);
  };

  const handleSaveEdit = () => {
    if (!editingPub) return;
    setPublicities((prev) => prev.map((p) => p.id === editingPub.id ? editingPub : p));
    setEditingPub(null);
    addToast('success', 'Publicité mise à jour', `La publicité ${editingPub.id} a été mise à jour.`);
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

  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'Poppins, sans-serif' };

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Gestion', 'Publicités Mobile']}>
      <div className="space-y-6">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Publicités Mobile App
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
              Gérer les publicités affichées dans l'application mobile WATSIM
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
            style={{
              background: 'linear-gradient(135deg, #D4AF37, #F5D76E)',
              color: '#0A1628',
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
            { label: 'Total publicités', value: stats.total, icon: 'ri-advertisement-line', color: '#D4AF37' },
            { label: 'Actives', value: stats.active, icon: 'ri-checkbox-circle-line', color: '#22C55E' },
            { label: 'Budget total', value: `${(stats.totalBudget / 1000).toFixed(0)}K FCFA`, icon: 'ri-money-cny-circle-line', color: '#3B82F6' },
            { label: 'Dépensé', value: `${(stats.totalSpent / 1000).toFixed(0)}K FCFA`, icon: 'ri-wallet-3-line', color: '#F59E0B' },
            { label: 'CTR moyen', value: `${avgCtr}%`, icon: 'ri-bar-chart-line', color: '#8B5CF6' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{
                background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
                border: '1px solid rgba(212,175,55,0.15)',
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${stat.color}20` }}>
                <i className={`${stat.icon} text-lg`} style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>{stat.label}</p>
                <p className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <input
                type="text"
                placeholder="Rechercher une publicité..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg text-sm outline-none w-64"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#FFFFFF',
                  fontFamily: 'Poppins, sans-serif',
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#FFFFFF',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              <option value="all" style={{ background: '#0A1628' }}>Tous les statuts</option>
              {publicityStatuses.map((s) => (
                <option key={s.value} value={s.value} style={{ background: '#0A1628' }}>{s.label}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#FFFFFF',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              <option value="all" style={{ background: '#0A1628' }}>Tous les types</option>
              {publicityTypes.map((t) => (
                <option key={t.value} value={t.value} style={{ background: '#0A1628' }}>{t.label}</option>
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
                  background: sortBy === key ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
                  color: sortBy === key ? '#D4AF37' : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${sortBy === key ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.1)'}`,
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
          style={{
            background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
            border: '1px solid rgba(212,175,55,0.15)',
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Publicité', 'Type', 'Position', 'Budget / Dépensé', 'Performance', 'Statut', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}
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
                      className="transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      {/* Publicité */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-16 h-10 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                            onClick={() => setSelectedImage(pub.image)}
                          >
                            <img src={pub.image} alt={pub.name} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>
                              {pub.name}
                            </p>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                              {pub.id} · {pub.merchant}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 flex items-center justify-center">
                            <i className={`${getTypeIcon(pub.type)} text-sm`} style={{ color: '#D4AF37' }} />
                          </div>
                          <span className="text-sm text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                            {publicityTypes.find((t) => t.value === pub.type)?.label || pub.type}
                          </span>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          {getPositionLabel(pub.position)}
                        </span>
                      </td>

                      {/* Budget / Dépensé */}
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                              {pub.spent.toLocaleString('fr-FR')} / {pub.budget.toLocaleString('fr-FR')} FCFA
                            </span>
                            <span className="text-xs font-medium" style={{ color: '#D4AF37', fontFamily: 'Poppins, sans-serif' }}>
                              {progress.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(progress, 100)}%`,
                                background: progress >= 90
                                  ? 'linear-gradient(90deg, #EF4444, #F87171)'
                                  : 'linear-gradient(90deg, #D4AF37, #F5D76E)',
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Performance */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <i className="ri-eye-line text-xs" style={{ color: 'rgba(255,255,255,0.4)' }} />
                            <span className="text-xs text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                              {pub.impressions.toLocaleString('fr-FR')} vues
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <i className="ri-cursor-line text-xs" style={{ color: 'rgba(255,255,255,0.4)' }} />
                            <span className="text-xs text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                              {pub.clicks.toLocaleString('fr-FR')} clics
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <i className="ri-percent-line text-xs" style={{ color: 'rgba(255,255,255,0.4)' }} />
                            <span className="text-xs font-medium" style={{ color: '#22C55E', fontFamily: 'Poppins, sans-serif' }}>
                              {pub.ctr.toFixed(2)}% CTR
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
                        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                          {pub.startDate} → {pub.endDate}
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {(pub.status === 'active' || pub.status === 'paused') && (
                            <button
                              onClick={() => handleToggleStatus(pub.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                              style={{ background: 'rgba(255,255,255,0.05)' }}
                              title={pub.status === 'active' ? 'Mettre en pause' : 'Réactiver'}
                            >
                              <i className={`${pub.status === 'active' ? 'ri-pause-circle-line' : 'ri-play-circle-line'} text-sm`} style={{ color: pub.status === 'active' ? '#F59E0B' : '#22C55E' }} />
                            </button>
                          )}
                          {pub.status === 'pending' && (
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
                            onClick={() => setEditingPub(pub)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                            style={{ background: 'rgba(255,255,255,0.05)' }}
                            title="Modifier"
                          >
                            <i className="ri-edit-line text-sm" style={{ color: 'rgba(255,255,255,0.5)' }} />
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
                      <i className="ri-advertisement-line text-4xl mb-3 block" style={{ color: 'rgba(255,255,255,0.15)' }} />
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-2xl w-full">
            <img
              src={selectedImage}
              alt="Publicité"
              className="w-full rounded-xl"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{
              background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
              border: '1px solid rgba(212,175,55,0.2)',
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Nouvelle publicité mobile
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <i className="ri-close-line text-white/60" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
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
                <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
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
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                    Type
                  </label>
                  <select
                    value={newPub.type}
                    onChange={(e) => setNewPub({ ...newPub, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    {publicityTypes.map((t) => (
                      <option key={t.value} value={t.value} style={{ background: '#0A1628' }}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                    Position
                  </label>
                  <select
                    value={newPub.position}
                    onChange={(e) => setNewPub({ ...newPub, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    {publicityPositions.map((p) => (
                      <option key={p.value} value={p.value} style={{ background: '#0A1628' }}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
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
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
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
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
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
                <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
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
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.6)',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    <i className="ri-upload-2-line mr-1" />
                    Upload
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={() => {}} />
                </div>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                  Format recommandé : 1200x400px, JPG ou PNG
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap"
                style={{
                  background: 'linear-gradient(135deg, #D4AF37, #F5D76E)',
                  color: '#0A1628',
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{
              background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
              border: '1px solid rgba(212,175,55,0.2)',
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Modifier {editingPub.id}
              </h3>
              <button
                onClick={() => setEditingPub(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <i className="ri-close-line text-white/60" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
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
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                    Type
                  </label>
                  <select
                    value={editingPub.type}
                    onChange={(e) => setEditingPub({ ...editingPub, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    {publicityTypes.map((t) => (
                      <option key={t.value} value={t.value} style={{ background: '#0A1628' }}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                    Position
                  </label>
                  <select
                    value={editingPub.position}
                    onChange={(e) => setEditingPub({ ...editingPub, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    {publicityPositions.map((p) => (
                      <option key={p.value} value={p.value} style={{ background: '#0A1628' }}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
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
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
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
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
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
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingPub(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap"
                style={{
                  background: 'linear-gradient(135deg, #D4AF37, #F5D76E)',
                  color: '#0A1628',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                Enregistrer
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