import { useState, useEffect } from 'react';
import Toast, { useToast } from '@/components/base/Toast';
import { adminApi, tokenStore } from '@/lib/api';

interface BnplFees {
  stockingFee: number;
  accountCreationFee: number;
  deliveryFee: number;
  collectionFee: number;
}

const defaultFees: BnplFees = {
  stockingFee: 3000,
  accountCreationFee: 500,
  deliveryFee: 0,
  collectionFee: 1000,
};

const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };
const inputStyle = { 
  background: '#F5FAF5', 
  border: '1px solid #E8F2F1', 
  color: '#1A2B1F', 
  fontFamily: 'Poppins, sans-serif',
  padding: '10px 12px',
  borderRadius: '8px',
  fontSize: '14px',
};

export default function BnplFeeSettingsPanel() {
  const [fees, setFees] = useState<BnplFees>(defaultFees);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<BnplFees>(defaultFees);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    loadFees();
  }, []);

  const loadFees = async () => {
    try {
      const data = await adminApi.getBnplFeeSettings();
      setFees(data);
      setEditForm(data);
    } catch (error) {
      console.error('Failed to load BNPL fees:', error);
      addToast('error', 'Erreur', 'Impossible de charger les frais BNPL');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await adminApi.updateBnplFeeSettings(editForm);
      setFees(editForm);
      setEditing(false);
      addToast('success', 'Frais mis à jour', 'Les frais BNPL ont été mis à jour avec succès');
    } catch (error) {
      console.error('Failed to update BNPL fees:', error);
      addToast('error', 'Erreur', 'Impossible de mettre à jour les frais BNPL');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditForm(fees);
    setEditing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
            Frais BNPL
          </h2>
          <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
            Gérez les frais appliqués aux achats BNPL
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ 
              background: 'linear-gradient(135deg, #4DB049, #22C55E)', 
              color: '#FFFFFF',
              fontFamily: 'Poppins, sans-serif'
            }}
          >
            <i className="ri-edit-line mr-2" />
            Modifier
          </button>
        )}
      </div>

      {/* Fee Settings */}
      <div className="rounded-2xl p-6 space-y-6" style={cardStyle}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stocking Fee */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>
              Frais de stockage <span className="text-xs text-gray-500">(par mois par produit)</span>
            </label>
            {editing ? (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6B7280' }}>FCFA</span>
                <input
                  type="number"
                  value={editForm.stockingFee}
                  onChange={(e) => setEditForm({ ...editForm, stockingFee: parseInt(e.target.value) || 0 })}
                  className="w-full pl-16"
                  style={inputStyle}
                  min="0"
                />
              </div>
            ) : (
              <div className="p-3 rounded-lg" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                <span className="text-lg font-semibold" style={{ color: '#014945' }}>
                  {formatCurrency(fees.stockingFee)}
                </span>
              </div>
            )}
          </div>

          {/* Account Creation Fee */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>
              Frais de création de compte <span className="text-xs text-gray-500">(unique, premier achat)</span>
            </label>
            {editing ? (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6B7280' }}>FCFA</span>
                <input
                  type="number"
                  value={editForm.accountCreationFee}
                  onChange={(e) => setEditForm({ ...editForm, accountCreationFee: parseInt(e.target.value) || 0 })}
                  className="w-full pl-16"
                  style={inputStyle}
                  min="0"
                />
              </div>
            ) : (
              <div className="p-3 rounded-lg" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                <span className="text-lg font-semibold" style={{ color: '#014945' }}>
                  {formatCurrency(fees.accountCreationFee)}
                </span>
              </div>
            )}
          </div>

          {/* Delivery Fee */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>
              Frais de livraison <span className="text-xs text-gray-500">(par défaut)</span>
            </label>
            {editing ? (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6B7280' }}>FCFA</span>
                <input
                  type="number"
                  value={editForm.deliveryFee}
                  onChange={(e) => setEditForm({ ...editForm, deliveryFee: parseInt(e.target.value) || 0 })}
                  className="w-full pl-16"
                  style={inputStyle}
                  min="0"
                />
              </div>
            ) : (
              <div className="p-3 rounded-lg" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                <span className="text-lg font-semibold" style={{ color: '#014945' }}>
                  {formatCurrency(fees.deliveryFee)}
                </span>
              </div>
            )}
          </div>

          {/* Collection Fee */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>
              Frais de collecte <span className="text-xs text-gray-500">(unique)</span>
            </label>
            {editing ? (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6B7280' }}>FCFA</span>
                <input
                  type="number"
                  value={editForm.collectionFee}
                  onChange={(e) => setEditForm({ ...editForm, collectionFee: parseInt(e.target.value) || 0 })}
                  className="w-full pl-16"
                  style={inputStyle}
                  min="0"
                />
              </div>
            ) : (
              <div className="p-3 rounded-lg" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                <span className="text-lg font-semibold" style={{ color: '#014945' }}>
                  {formatCurrency(fees.collectionFee)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {editing && (
          <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: '#E8F2F1' }}>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{ 
                background: 'linear-gradient(135deg, #4DB049, #22C55E)', 
                color: '#FFFFFF',
                fontFamily: 'Poppins, sans-serif'
              }}
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line animate-spin mr-2" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <i className="ri-save-line mr-2" />
                  Enregistrer
                </>
              )}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ 
                background: '#F5FAF5', 
                color: '#6B7280',
                border: '1px solid #E8F2F1',
                fontFamily: 'Poppins, sans-serif'
              }}
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="rounded-2xl p-6" style={{ background: '#F0FDF4', border: '1px solid #DCFCE7' }}>
        <div className="flex items-start gap-3">
          <i className="ri-information-line text-xl" style={{ color: '#22C55E', marginTop: '2px' }} />
          <div>
            <h4 className="font-semibold text-sm mb-2" style={{ color: '#166534', fontFamily: 'Poppins, sans-serif' }}>
              Comment les frais sont appliqués
            </h4>
            <ul className="text-sm space-y-1" style={{ color: '#15803D', fontFamily: 'Poppins, sans-serif' }}>
              <li>• <strong>Frais de stockage:</strong> Appliqués mensuellement par produit (3000 FCFA × nombre de mois)</li>
              <li>• <strong>Frais de création de compte:</strong> Facturés une seule fois lors du premier achat BNPL</li>
              <li>• <strong>Frais de livraison:</strong> Appliqués par défaut à chaque achat (0 FCFA par défaut)</li>
              <li>• <strong>Frais de collecte:</strong> Frais uniques de service (1000 FCFA par achat)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
