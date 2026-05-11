import { useState } from 'react';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { bnplCategorySettings, BnplCategoryConfig } from '@/mocks/adminBnplSettings';

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="relative w-11 h-6 rounded-full transition-all cursor-pointer flex-shrink-0" style={{ background: enabled ? 'linear-gradient(135deg, #D4AF37, #F5D76E)' : 'rgba(255,255,255,0.15)' }}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: enabled ? '22px' : '2px', background: enabled ? '#0A1628' : 'rgba(255,255,255,0.6)' }} />
    </button>
  );
}

const categoryIcons: Record<string, string> = {
  electronics: 'ri-smartphone-line',
  fashion: 'ri-t-shirt-line',
  home: 'ri-home-smile-line',
  health: 'ri-heart-pulse-line',
  sports: 'ri-basketball-line',
  furniture: 'ri-sofa-line',
  beauty: 'ri-magic-line',
  automotive: 'ri-car-line',
};

export default function BnplSettingsPanel() {
  const [categories, setCategories] = useState<BnplCategoryConfig[]>(bnplCategorySettings);
  const [expandedId, setExpandedId] = useState<string | null>('electronics');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BnplCategoryConfig>>();
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  const toggleCategory = (id: string) => {
    setCategories(prev => prev.map(c =>
      c.id === id ? { ...c, enabled: !c.enabled } : c
    ));
    const cat = categories.find(c => c.id === id);
    addToast('success', `Catégorie ${cat?.enabled ? 'désactivée' : 'activée'}`, `${cat?.name} est maintenant ${cat?.enabled ? 'inactive' : 'active'} pour le BNPL.`);
  };

  const startEdit = (cat: BnplCategoryConfig) => {
    setEditingId(cat.id);
    setEditForm({ ...cat });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (!editingId) return;
    setCategories(prev => prev.map(c =>
      c.id === editingId ? { ...c, ...editForm } as BnplCategoryConfig : c
    ));
    setEditingId(null);
    setEditForm({});
    addToast('success', 'Paramètres mis à jour', 'Les paramètres BNPL de la catégorie ont été sauvegardés.');
  };

  const resetToDefault = (id: string) => {
    const original = bnplCategorySettings.find(c => c.id === id);
    if (!original) return;
    setCategories(prev => prev.map(c => c.id === id ? original : c));
    setConfirmReset(null);
    addToast('info', 'Réinitialisé', 'Les paramètres ont été restaurés aux valeurs par défaut.');
  };

  const updateEditField = (field: keyof BnplCategoryConfig, value: unknown) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const updateRate = (plan: 'plan2m' | 'plan3m' | 'plan6m', value: number) => {
    setEditForm(prev => ({
      ...prev,
      rates: { ...(prev.rates || {}), [plan]: value },
    }));
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
          { label: 'Crédit max total', value: `${(totalMaxCredit / 1000000).toFixed(1)}M FCFA`, icon: 'ri-money-cny-circle-line', color: '#D4AF37' },
          { label: 'Taux moyen 3 mois', value: `${(categories.reduce((s, c) => s + c.rates.plan3m, 0) / categories.length).toFixed(1)}%`, icon: 'ri-percent-line', color: '#4A9EFF' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }}>
            <div className="flex items-center gap-2 mb-2">
              <i className={`${card.icon}`} style={{ color: card.color }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>{card.label}</span>
            </div>
            <p className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Category Cards */}
      <div className="space-y-3">
        {categories.map(cat => {
          const isExpanded = expandedId === cat.id;
          const isEditing = editingId === cat.id;

          return (
            <div key={cat.id} className="rounded-2xl overflow-hidden transition-all" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: `1px solid ${cat.enabled ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
              {/* Header Row */}
              <div
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : cat.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cat.enabled ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)' }}>
                    <i className={`${categoryIcons[cat.id]} text-base`} style={{ color: cat.enabled ? '#D4AF37' : 'rgba(255,255,255,0.3)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{cat.name}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                      Max {cat.maxCredit.toLocaleString()} FCFA · Score min {cat.minScore} · Commission {cat.merchantCommission}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: cat.enabled ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: cat.enabled ? '#22C55E' : '#EF4444' }}>
                    {cat.enabled ? 'Actif' : 'Inactif'}
                  </span>
                  <i className={`ri-arrow-down-s-line text-base transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-1 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  {/* Toggle + Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ToggleSwitch enabled={cat.enabled} onChange={() => toggleCategory(cat.id)} />
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                        {cat.enabled ? 'BNPL activé pour cette catégorie' : 'BNPL désactivé pour cette catégorie'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditing ? (
                        <>
                          <button onClick={() => setConfirmReset(cat.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer whitespace-nowrap hover:bg-white/5 transition-colors" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <i className="ri-restart-line" /> Réinitialiser
                          </button>
                          <button onClick={() => startEdit(cat)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer whitespace-nowrap hover:bg-white/5 transition-colors" style={{ color: '#D4AF37', fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(212,175,55,0.2)' }}>
                            <i className="ri-edit-line" /> Modifier
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg text-xs cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(255,255,255,0.1)' }}>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Max Credit */}
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Plafond crédit max (FCFA)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.maxCredit ?? cat.maxCredit}
                          onChange={e => updateEditField('maxCredit', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none text-white"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                        />
                      ) : (
                        <p className="text-sm text-white px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', fontFamily: 'Poppins, sans-serif' }}>{cat.maxCredit.toLocaleString()} FCFA</p>
                      )}
                    </div>

                    {/* Min Score */}
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Score minimum requis</label>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.minScore ?? cat.minScore}
                          onChange={e => updateEditField('minScore', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none text-white"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                        />
                      ) : (
                        <p className="text-sm text-white px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', fontFamily: 'Poppins, sans-serif' }}>{cat.minScore} pts</p>
                      )}
                    </div>

                    {/* Down Payment */}
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Acompte minimum (%)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editForm.downPaymentPercent ?? cat.downPaymentPercent}
                          onChange={e => updateEditField('downPaymentPercent', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none text-white"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                        />
                      ) : (
                        <p className="text-sm text-white px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', fontFamily: 'Poppins, sans-serif' }}>{cat.downPaymentPercent}%</p>
                      )}
                    </div>

                    {/* Rate 2M */}
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Taux 2 mois (%)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editForm.rates?.plan2m ?? cat.rates.plan2m}
                          onChange={e => updateRate('plan2m', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none text-white"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                        />
                      ) : (
                        <p className="text-sm text-white px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', fontFamily: 'Poppins, sans-serif' }}>{cat.rates.plan2m}%</p>
                      )}
                    </div>

                    {/* Rate 3M */}
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Taux 3 mois (%)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editForm.rates?.plan3m ?? cat.rates.plan3m}
                          onChange={e => updateRate('plan3m', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none text-white"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                        />
                      ) : (
                        <p className="text-sm text-white px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', fontFamily: 'Poppins, sans-serif' }}>{cat.rates.plan3m}%</p>
                      )}
                    </div>

                    {/* Rate 6M */}
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Taux 6 mois (%)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editForm.rates?.plan6m ?? cat.rates.plan6m}
                          onChange={e => updateRate('plan6m', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none text-white"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                        />
                      ) : (
                        <p className="text-sm text-white px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', fontFamily: 'Poppins, sans-serif' }}>{cat.rates.plan6m}%</p>
                      )}
                    </div>

                    {/* Grace Period */}
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Délai de grâce (jours)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.gracePeriodDays ?? cat.gracePeriodDays}
                          onChange={e => updateEditField('gracePeriodDays', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none text-white"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                        />
                      ) : (
                        <p className="text-sm text-white px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', fontFamily: 'Poppins, sans-serif' }}>{cat.gracePeriodDays} jours</p>
                      )}
                    </div>

                    {/* Penalty Rate */}
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Taux pénalité retard (%)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editForm.penaltyRate ?? cat.penaltyRate}
                          onChange={e => updateEditField('penaltyRate', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none text-white"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                        />
                      ) : (
                        <p className="text-sm text-white px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', fontFamily: 'Poppins, sans-serif' }}>{cat.penaltyRate}%</p>
                      )}
                    </div>

                    {/* Merchant Commission */}
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Commission commerçant (%)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editForm.merchantCommission ?? cat.merchantCommission}
                          onChange={e => updateEditField('merchantCommission', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none text-white"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                        />
                      ) : (
                        <p className="text-sm text-white px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', fontFamily: 'Poppins, sans-serif' }}>{cat.merchantCommission}%</p>
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