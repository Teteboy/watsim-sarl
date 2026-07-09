import { useState, useEffect } from 'react';
import Toast, { useToast } from '@/components/base/Toast';
import { adminApi, tokenStore } from '@/lib/api';

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="relative w-11 h-6 rounded-full transition-all cursor-pointer flex-shrink-0" style={{ background: enabled ? 'linear-gradient(135deg, #4DB049, #196D43)' : 'rgba(255,255,255,0.15)' }}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: enabled ? '22px' : '2px', background: enabled ? '#FFFFFF' : 'rgba(255,255,255,0.6)' }} />
    </button>
  );
}

export default function FeesSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [toggles, setToggles] = useState({ feesEnforced: true });
  const [defaultStorageFee, setDefaultStorageFee] = useState('0');
  const [defaultDeliveryFee, setDefaultDeliveryFee] = useState('0');
  const [defaultAccountFee, setDefaultAccountFee] = useState('0');
  const [applyToExisting, setApplyToExisting] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    if (!tokenStore?.access) { setLoading(false); return; }
    adminApi.getSystemSettings?.().then((settings: any) => {
      if (settings) {
        if (settings.default_storage_fee !== undefined) setDefaultStorageFee(settings.default_storage_fee);
        if (settings.default_delivery_fee !== undefined) setDefaultDeliveryFee(settings.default_delivery_fee);
        if (settings.default_account_fee !== undefined) setDefaultAccountFee(settings.default_account_fee);
        setToggles(prev => ({ ...prev, feesEnforced: settings.fees_enforced === 'true' || settings.fees_enforced === undefined ? prev.feesEnforced : settings.fees_enforced === 'true' }));
      }
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaved(true);
    try {
      await Promise.all([
        adminApi.setSystemSetting('default_storage_fee', defaultStorageFee),
        adminApi.setSystemSetting('default_delivery_fee', defaultDeliveryFee),
        adminApi.setSystemSetting('default_account_fee', defaultAccountFee),
        adminApi.setSystemSetting('fees_enforced', String(toggles.feesEnforced)),
      ]);
      if (applyToExisting) {
        const result = await adminApi.applyDefaultFees();
        addToast('success', 'Frais appliqués', `${result?.total ?? 0} produits mis à jour avec les frais par défaut.`);
      } else {
        addToast('success', 'Paramètres sauvegardés', 'Les frais par défaut ont été mis à jour.');
      }
    } catch {
      addToast('error', 'Erreur', 'Certains paramètres n\'ont pas pu être sauvegardés.');
    }
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p className="text-white/40 text-sm">Chargement…</p>;

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: 'linear-gradient(135deg, #014A41 0%, #014945 100%)', border: '1px solid rgba(77,176,89,0.12)' }}>
      <h3 className="text-sm font-semibold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>Frais par Défaut pour Produits</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Frais de Stockage (FCFA)</label>
          <input 
            type="number" 
            value={defaultStorageFee} 
            onChange={e => setDefaultStorageFee(e.target.value)} 
            className="w-full px-3 py-2 rounded-lg text-sm outline-none text-white" 
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }} 
            placeholder="0"
          />
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>Appliqué aux produits sans storageFee défini</p>
        </div>
        
        <div>
          <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Frais de Livraison (FCFA)</label>
          <input 
            type="number" 
            value={defaultDeliveryFee} 
            onChange={e => setDefaultDeliveryFee(e.target.value)} 
            className="w-full px-3 py-2 rounded-lg text-sm outline-none text-white" 
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }} 
            placeholder="0"
          />
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>Appliqué aux produits sans deliveryFee défini</p>
        </div>
        
        <div>
          <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Frais d'Ouverture Compte (FCFA)</label>
          <input 
            type="number" 
            value={defaultAccountFee} 
            onChange={e => setDefaultAccountFee(e.target.value)} 
            className="w-full px-3 py-2 rounded-lg text-sm outline-none text-white" 
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }} 
            placeholder="0"
          />
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>Pour les nouveaux comptes clients</p>
        </div>
      </div>

      <div className="space-y-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>Appliquer automatiquement aux nouveaux produits</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Les frais seront ajoutés automatiquement aux produits créés sans ces valeurs</p>
          </div>
          <ToggleSwitch enabled={toggles.feesEnforced} onChange={() => setToggles(prev => ({ ...prev, feesEnforced: !prev.feesEnforced }))} />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            checked={applyToExisting} 
            onChange={e => setApplyToExisting(e.target.checked)} 
            className="w-4 h-4 rounded" 
            style={{ accentColor: '#4DB049' }}
          />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif' }}>Appliquer immédiatement aux produits existants sans frais définis</span>
        </label>
      </div>

      <div className="flex justify-end pt-2">
        <button 
          onClick={handleSave} 
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all" 
          style={{ background: saved ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg, #4DB049, #196D43)', color: saved ? '#22C55E' : '#FFFFFF', border: saved ? '1px solid rgba(34,197,94,0.4)' : 'none', fontFamily: 'Poppins, sans-serif' }}
        >
          {saved ? <><i className="ri-checkbox-circle-line" /> Sauvegardé !</> : <><i className="ri-save-line" /> Sauvegarder</>}
        </button>
      </div>
    </div>
  );
}