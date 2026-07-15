import { useState, useEffect } from 'react';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { adminApi, tokenStore, type BnplCategoryConfig } from '@/lib/api';

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="relative w-11 h-6 rounded-full transition-all cursor-pointer flex-shrink-0" style={{ background: enabled ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#E8F2F1' }}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: enabled ? '22px' : '2px', background: enabled ? '#FFFFFF' : '#9CA3AF' }} />
    </button>
  );
}

const categoryIcons: Record<string, string> = {
  electronics: 'ri-smartphone-line',
  electronique: 'ri-smartphone-line',
  fashion: 'ri-t-shirt-line',
  mode: 'ri-t-shirt-line',
  home: 'ri-home-smile-line',
  maison: 'ri-home-smile-line',
  health: 'ri-heart-pulse-line',
  'sante-beaute': 'ri-heart-pulse-line',
  sports: 'ri-basketball-line',
  furniture: 'ri-sofa-line',
  meubles: 'ri-sofa-line',
  beauty: 'ri-magic-line',
  automotive: 'ri-car-line',
  automobile: 'ri-car-line',
};

// Style constants for light theme
const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };
const inputStyle = { background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' };

// Default BNPL category settings (fallback when API is unavailable)
const defaultBnplCategorySettings: BnplCategoryConfig[] = [
  { id: 'electronics', name: 'Électronique', enabled: true, maxCredit: 500000, minScore: 60, merchantCommission: 3.5 },
  { id: 'fashion', name: 'Mode', enabled: true, maxCredit: 200000, minScore: 55, merchantCommission: 4.0 },
  { id: 'home', name: 'Maison', enabled: true, maxCredit: 800000, minScore: 65, merchantCommission: 3.0 },
  { id: 'health', name: 'Santé & Beauté', enabled: true, maxCredit: 300000, minScore: 60, merchantCommission: 3.5 },
  { id: 'sports', name: 'Sports', enabled: true, maxCredit: 250000, minScore: 55, merchantCommission: 4.0 },
  { id: 'furniture', name: 'Meubles', enabled: true, maxCredit: 1000000, minScore: 70, merchantCommission: 2.5 },
  { id: 'beauty', name: 'Cosmétiques', enabled: true, maxCredit: 150000, minScore: 50, merchantCommission: 4.5 },
  { id: 'automotive', name: 'Automobile', enabled: false, maxCredit: 2000000, minScore: 75, merchantCommission: 2.0 },
];

export default function BnplSettingsPanel() {
  const [categories, setCategories] = useState<BnplCategoryConfig[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BnplCategoryConfig>>();
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  // Load from backend
  useEffect(() => {
    if (!tokenStore?.access) {
      setCategories(defaultBnplCategorySettings); // fallback to defaults if not admin
      return;
    }
    const bnplFn = adminApi.bnplCategorySettings;
    (bnplFn ? bnplFn() : Promise.resolve([] as any)).then((res: any) => {
      const list = Array.isArray(res) ? res : (res?.data ?? []);
      if (list.length) setCategories(list);
      else setCategories(defaultBnplCategorySettings);
    }).catch(() => setCategories(defaultBnplCategorySettings));
  }, []);

  const toggleCategory = async (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const newEnabled = !cat.enabled;
    // optimistic
    setCategories(prev => prev.map(c => c.id === id ? { ...c, enabled: newEnabled } : c));
    try {
      await adminApi.updateCategory(id, { bnplEnabled: newEnabled });
      addToast('success', `Catégorie ${newEnabled ? 'activée' : 'désactivée'}`, `${cat.name} est maintenant ${newEnabled ? 'active' : 'inactive'} pour le BNPL.`);
    } catch {
      // revert
      setCategories(prev => prev.map(c => c.id === id ? { ...c, enabled: cat.enabled } : c));
      addToast('error', 'Erreur', 'Impossible de mettre à jour la catégorie.');
    }
  };

  const startEdit = (cat: BnplCategoryConfig) => {
    setEditingId(cat.id);
    setEditForm({ ...cat });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const payload = { ...editForm };
    try {
      await adminApi.updateCategory(editingId, payload);
      setCategories(prev => prev.map(c =>
        c.id === editingId ? { ...c, ...payload } as BnplCategoryConfig : c
      ));
      setEditingId(null);
      setEditForm({});
      addToast('success', 'Paramètres mis à jour', 'Les paramètres BNPL de la catégorie ont été sauvegardés.');
    } catch {
      addToast('error', 'Erreur', 'Échec de la sauvegarde.');
    }
  };

  const resetToDefault = async (id: string) => {
    const original = defaultBnplCategorySettings.find(c => c.id === id);
    if (!original) return;
    try {
      await adminApi.updateCategory(id, {
        enabled: original.enabled,
        maxCredit: original.maxCredit,
        minScore: original.minScore,
        merchantCommission: original.merchantCommission,
      });
      setCategories(prev => prev.map(c => c.id === id ? original : c));
      setConfirmReset(null);
      addToast('info', 'Réinitialisé', 'Les paramètres ont été restaurés aux valeurs par défaut.');
    } catch {
      addToast('error', 'Erreur', 'Impossible de réinitialiser.');
    }
  };

  const updateEditField = (field: keyof BnplCategoryConfig, value: unknown) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };



  const activeCount = categories.filter(c => c.enabled).length;
  const totalMaxCredit = categories.reduce((sum, c) => sum + c.maxCredit, 0);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Catégories actives', value: activeCount.toString(), icon: 'ri-checkbox-circle-line', color: '#22C55E' },
          { label: 'Catégories inactives', value: (categories.length - activeCount).toString(), icon: 'ri-close-circle-line', color: '#EF4444' },
          { label: 'Crédit max total', value: `${(totalMaxCredit / 1000000).toFixed(1)}M FCFA`, icon: 'ri-money-cny-circle-line', color: '#4DB049' },
          { label: 'Commission moyenne', value: `${(categories.reduce((s, c) => s + c.merchantCommission, 0) / categories.length).toFixed(1)}%`, icon: 'ri-percent-line', color: '#4A9EFF' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-4" style={cardStyle}>
            <div className="flex items-center gap-2 mb-2">
              <i className={`${card.icon}`} style={{ color: card.color }} />
              <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{card.label}</span>
            </div>
            <p className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Category Cards */}
      <div className="space-y-3">
        {categories.map(cat => {
          const isExpanded = expandedId === cat.id;
          const isEditing = editingId === cat.id;

          return (
            <div key={cat.id} className="rounded-2xl overflow-hidden transition-all" style={{ background: '#FFFFFF', border: `1px solid ${cat.enabled ? 'rgba(77,176,89,0.2)' : '#E8F2F1'}` }}>
              {/* Header Row */}
              <div
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : cat.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cat.enabled ? 'rgba(77,176,89,0.15)' : '#F5FAF5' }}>
                    <i className={`${categoryIcons[cat.slug ?? cat.id]} text-base`} style={{ color: cat.enabled ? '#4DB049' : '#9CA3AF' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{cat.name}</p>
                    <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                      Max {cat.maxCredit.toLocaleString()} FCFA · Score min {cat.minScore} · Commission {cat.merchantCommission}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: cat.enabled ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: cat.enabled ? '#22C55E' : '#EF4444' }}>
                    {cat.enabled ? 'Actif' : 'Inactif'}
                  </span>
                  <i className={`ri-arrow-down-s-line text-base transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: '#9CA3AF' }} />
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-1 space-y-4" style={{ borderTop: '1px solid #F0F7F0' }}>
                  {/* Toggle + Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ToggleSwitch enabled={cat.enabled} onChange={() => toggleCategory(cat.id)} />
                      <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                        {cat.enabled ? 'BNPL activé pour cette catégorie' : 'BNPL désactivé pour cette catégorie'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditing ? (
                        <>
                          <button onClick={() => setConfirmReset(cat.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer whitespace-nowrap hover:bg-gray-100 transition-colors" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif', border: '1px solid #E8F2F1' }}>
                            <i className="ri-restart-line" /> Réinitialiser
                          </button>
                          <button onClick={() => startEdit(cat)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer whitespace-nowrap hover:bg-white/5 transition-colors" style={{ color: '#D4AF37', fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(212,175,55,0.2)' }}>
                            <i className="ri-edit-line" /> Modifier
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg text-xs cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', fontFamily: 'Poppins, sans-serif', border: '1px solid #E8F2F1' }}>
                            Annuler
                          </button>
                          <button onClick={saveEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
                            <i className="ri-save-line" /> Sauvegarder
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Max Credit */}
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Plafond crédit max (FCFA)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.maxCredit ?? cat.maxCredit}
                          onChange={e => updateEditField('maxCredit', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                        />
                      ) : (
                        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#F5FAF5', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{cat.maxCredit.toLocaleString()} FCFA</p>
                      )}
                    </div>

                    {/* Min Score */}
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Score minimum requis</label>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.minScore ?? cat.minScore}
                          onChange={e => updateEditField('minScore', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                        />
                      ) : (
                        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#F5FAF5', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{cat.minScore} pts</p>
                      )}
                    </div>

                    {/* Merchant Commission */}
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Commission commerçant (%)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editForm.merchantCommission ?? cat.merchantCommission}
                          onChange={e => updateEditField('merchantCommission', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                        />
                      ) : (
                        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#F5FAF5', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{cat.merchantCommission}%</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm Reset Dialog */}
      {confirmReset && (
        <ConfirmDialog
          open={true}
          title="Réinitialiser les paramètres"
          message={`Voulez-vous vraiment restaurer les valeurs par défaut pour ${categories.find(c => c.id === confirmReset)?.name} ?`}
          confirmLabel="Réinitialiser"
          cancelLabel="Annuler"
          onConfirm={() => resetToDefault(confirmReset)}
          onCancel={() => setConfirmReset(null)}
        />
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}