import { useState, useEffect } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import BnplSettingsPanel from './components/BnplSettingsPanel';
import BnplFeeSettingsPanel from './components/BnplFeeSettingsPanel';
import CategoryManagementPanel from './components/CategoryManagementPanel';
import { adminApi, tokenStore } from '@/lib/api';

const settingsTabs = [
  { id: 'bnpl', label: 'Paramètres BNPL', icon: 'ri-bank-card-line' },
  { id: 'categories', label: 'Catégories', icon: 'ri-price-tag-3-line' },
  { id: 'wallet', label: 'Wallet & Paiements', icon: 'ri-wallet-3-line' },
  { id: 'kyc', label: 'KYC & Sécurité', icon: 'ri-shield-check-line' },
  { id: 'notifications', label: 'Notifications', icon: 'ri-notification-3-line' },
  { id: 'roles', label: 'Rôles & Accès', icon: 'ri-user-settings-line' },
];

// Hardcoded list removed — Roles & Access tab now shows ONLY real users with role 'ADMIN' from the database.

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  OPERATIONS: 'Administration Opérations',
  FINANCE: 'Administration Finance',
  SUPPORT: 'Agent Support',
  SECURITY: 'Agent Sécurité',
};
const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };

const roleColors: Record<string, string> = {
  SUPER_ADMIN: '#4DB049',
  OPERATIONS: '#0EA5E9',
  FINANCE: '#22C55E',
  SUPPORT: '#4A9EFF',
  SECURITY: '#EF4444',
};

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="relative w-11 h-6 rounded-full transition-all cursor-pointer flex-shrink-0" style={{ background: enabled ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#E8F2F1' }}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: enabled ? '22px' : '2px', background: enabled ? '#FFFFFF' : '#9CA3AF' }} />
    </button>
  );
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('bnpl');
  const [saved, setSaved] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'SUPPORT' });
  const [editRoleUser, setEditRoleUser] = useState<any | null>(null);
  const [editRoleValue, setEditRoleValue] = useState('');
  const [roles, setRoles] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const { toasts, addToast, removeToast } = useToast();

  // Wallet Settings
  const [minDeposit, setMinDeposit] = useState('1000');
  const [maxDeposit, setMaxDeposit] = useState('500000');
  const [transferFee, setTransferFee] = useState('0.5');
  const [withdrawalFee, setWithdrawalFee] = useState('1');

  // Toggles
  const [toggles, setToggles] = useState({
    walletEnabled: true,
    kycRequired: true,
    biometricEnabled: true,
    smsOtp: true,
    emailNotif: true,
    pushNotif: true,
    fraudDetection: true,
    autoBlock: true,
    maintenanceMode: false,
  });

  const toggle = async (key: keyof typeof toggles) => {
    const newValue = !toggles[key];
    setToggles(prev => ({ ...prev, [key]: newValue }));
    try {
      await adminApi.setSystemSetting(key, String(newValue));
    } catch { /* setting persist failed silently */ }
  };

  // Load persisted settings from backend
  useEffect(() => {
    if (!tokenStore?.access) return;
    adminApi.getSystemSettings?.().then((settings: any) => {
      if (settings) {
        // wallet numeric fields
        if (settings.wallet_min_deposit) setMinDeposit(settings.wallet_min_deposit);
        if (settings.wallet_max_deposit) setMaxDeposit(settings.wallet_max_deposit);
        if (settings.transfer_fee) setTransferFee(settings.transfer_fee);
        if (settings.withdrawal_fee) setWithdrawalFee(settings.withdrawal_fee);

        // toggles
        setToggles(prev => ({
          ...prev,
          walletEnabled: settings.wallet_enabled === 'true' || settings.wallet_enabled === undefined ? prev.walletEnabled : settings.wallet_enabled === 'true',
          kycRequired: settings.kyc_required !== 'false',
          biometricEnabled: settings.biometric_enabled !== 'false',
          smsOtp: settings.sms_otp !== 'false',
          emailNotif: settings.email_notif !== 'false',
          pushNotif: settings.push_notif !== 'false',
          fraudDetection: settings.fraud_detection !== 'false',
          autoBlock: settings.auto_block !== 'false',
          maintenanceMode: settings.maintenance_mode === 'true',
        }));
      }
    }).catch(() => {});
  }, []);

  // Load ONLY real ADMIN users for the Roles & Access tab
  useEffect(() => {
    if (!tokenStore?.access) return;

    adminApi.users({ role: 'ADMIN', limit: 50 })
      .then((res: any) => {
        const items = res?.items || res || [];
        setAdmins(items);

        const mapped = items.map((u: any) => ({
          id: u.id,
          name: u.fullName || u.email.split('@')[0],
          email: u.email,
          role: u.adminRole || 'SUPPORT',
          lastLogin: u.updatedAt ? new Date(u.updatedAt).toLocaleString('fr-FR') : (u.createdAt ? new Date(u.createdAt).toLocaleString('fr-FR') : 'Jamais'),
          status: u.isActive ? 'active' : 'inactive',
        }));

        setRoles(mapped);
      })
      .catch(() => {
        setRoles([]);
      });
  }, []);

  const handleSave = async () => {
    setSaved(true);
    try {
      await Promise.all([
        adminApi.setSystemSetting('wallet_min_deposit', minDeposit),
        adminApi.setSystemSetting('wallet_max_deposit', maxDeposit),
        adminApi.setSystemSetting('transfer_fee', transferFee),
        adminApi.setSystemSetting('withdrawal_fee', withdrawalFee),
      ]);
      addToast('success', 'Paramètres sauvegardés', 'La configuration de la plateforme a été mise à jour.');
    } catch {
      addToast('error', 'Erreur', 'Certains paramètres n\'ont pas pu être sauvegardés.');
    }
    setTimeout(() => setSaved(false), 2500);
  };

  const handleInvite = async () => {
    if (!inviteForm.name) { addToast('error', 'Champ requis', 'Veuillez remplir le nom complet.'); return; }
    try {
      // Email is optional; backend generates a placeholder when omitted
      await adminApi.createAdminUser({
        email: inviteForm.email || undefined,
        phone: `+237${Date.now().toString().slice(-8)}`, // placeholder unique phone
        fullName: inviteForm.name,
        password: 'Admin@123',
        adminRole: inviteForm.role as 'SUPER_ADMIN' | 'OPERATIONS' | 'FINANCE' | 'SUPPORT' | 'SECURITY',
      });
      // reload admins
      const res: any = await adminApi.users({ role: 'ADMIN', limit: 50 });
      const items = res?.items || res || [];
      const mapped = items.map((u: any) => ({
        id: u.id,
        name: u.fullName || u.email.split('@')[0],
        email: u.email,
        role: u.adminRole || 'SUPPORT',
        lastLogin: u.updatedAt ? new Date(u.updatedAt).toLocaleString('fr-FR') : (u.createdAt ? new Date(u.createdAt).toLocaleString('fr-FR') : 'Jamais'),
        status: u.isActive ? 'active' : 'inactive',
      }));
      setRoles(mapped);
      setAdmins(items);
      setShowInviteModal(false);
      setInviteForm({ name: '', email: '', role: 'SUPPORT' });
      addToast('success', 'Admin créé', `Compte admin créé pour ${inviteForm.email || inviteForm.name} (mot de passe temporaire: Admin@123)`);
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Impossible de créer le compte admin.');
    }
  };

  const handleSaveRole = async () => {
    if (!editRoleUser) return;
    try {
      await adminApi.updateAdminRole(editRoleUser.id, editRoleValue as 'SUPER_ADMIN' | 'OPERATIONS' | 'FINANCE' | 'SUPPORT' | 'SECURITY');
      setRoles(prev => prev.map(r => r.id === editRoleUser.id ? { ...r, role: editRoleValue } : r));
      setEditRoleUser(null);
      addToast('success', 'Rôle modifié', `Le rôle de ${editRoleUser.name} a été mis à jour.`);
    } catch (error: any) {
      addToast('error', 'Erreur', error?.message || 'Impossible de modifier ce rôle.');
    }
  };

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Système', 'Paramètres']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Paramètres Système</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Configuration globale de la plateforme WATSIM</p>
          </div>
          {activeTab !== 'bnpl' && (
            <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all" style={{ background: saved ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg, #4DB049, #22C55E)', color: saved ? '#22C55E' : '#FFFFFF', border: saved ? '1px solid rgba(34,197,94,0.4)' : 'none', fontFamily: 'Poppins, sans-serif' }}>
              {saved ? <><i className="ri-checkbox-circle-line" /> Sauvegardé !</> : <><i className="ri-save-line" /> Sauvegarder</>}
            </button>
          )}
        </div>

        <div className="flex gap-6">
          {/* Sidebar Tabs */}
          <div className="w-56 flex-shrink-0 space-y-1">
            {settingsTabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all cursor-pointer text-left" style={{ background: activeTab === tab.id ? 'rgba(77,176,89,0.12)' : 'transparent', color: activeTab === tab.id ? '#4DB049' : '#6B7280', borderLeft: activeTab === tab.id ? '3px solid #4DB049' : '3px solid transparent', fontFamily: 'Poppins, sans-serif' }}>
                <i className={`${tab.icon} text-base`} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            {activeTab === 'bnpl' && (
              <div className="space-y-6">
                <BnplFeeSettingsPanel />
                <BnplSettingsPanel />
              </div>
            )}
            {activeTab === 'categories' && <CategoryManagementPanel />}

            {activeTab === 'wallet' && (
              <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
                <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>Limites & Frais Wallet</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[{ label: 'Dépôt minimum (FCFA)', value: minDeposit, set: setMinDeposit }, { label: 'Dépôt maximum (FCFA)', value: maxDeposit, set: setMaxDeposit }, { label: 'Frais transfert (%)', value: transferFee, set: setTransferFee }, { label: 'Frais retrait (%)', value: withdrawalFee, set: setWithdrawalFee }].map((f) => (
                    <div key={f.label}>
                      <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{f.label}</label>
                      <input type="number" value={f.value} onChange={(e) => f.set(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none text-gray-900" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }} />
                    </div>
                  ))}
                </div>
                <div className="space-y-3 pt-2" style={{ borderTop: '1px solid #E8F2F1' }}>
                  {[{ key: 'walletEnabled' as const, label: 'Wallet activé', desc: 'Activer/désactiver le portefeuille électronique' }].map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                        <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{item.desc}</p>
                      </div>
                      <ToggleSwitch enabled={toggles[item.key]} onChange={() => toggle(item.key)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'kyc' && (
              <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
                <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>KYC & Sécurité</h3>
                <div className="space-y-4">
                  {[
                    { key: 'kycRequired' as const, label: 'KYC obligatoire', desc: 'Exiger la vérification d\u0027identité pour accéder au BNPL' },
                    { key: 'biometricEnabled' as const, label: 'Authentification biométrique', desc: 'Permettre la connexion par empreinte digitale / Face ID' },
                    { key: 'smsOtp' as const, label: 'OTP par SMS', desc: 'Envoyer un code de vérification par SMS lors de la connexion' },
                    { key: 'fraudDetection' as const, label: 'Détection de fraude IA', desc: 'Activer le microservice IA de détection de fraude en temps réel' },
                    { key: 'autoBlock' as const, label: 'Blocage automatique', desc: 'Bloquer automatiquement les comptes suspects détectés par l\u0027IA' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #F0F7F0' }}>
                      <div>
                        <p className="text-sm text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                        <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{item.desc}</p>
                      </div>
                      <ToggleSwitch enabled={toggles[item.key]} onChange={() => toggle(item.key)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
                <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>Canaux de Notification</h3>
                <div className="space-y-4">
                  {[
                    { key: 'emailNotif' as const, label: 'Notifications Email', desc: 'Envoyer des emails transactionnels et alertes aux utilisateurs' },
                    { key: 'pushNotif' as const, label: 'Notifications Push (Firebase)', desc: 'Envoyer des notifications push via Firebase Cloud Messaging' },
                    { key: 'smsOtp' as const, label: 'SMS Transactionnels', desc: 'Envoyer des SMS pour les transactions importantes et rappels' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #F0F7F0' }}>
                      <div>
                        <p className="text-sm text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                        <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{item.desc}</p>
                      </div>
                      <ToggleSwitch enabled={toggles[item.key]} onChange={() => toggle(item.key)} />
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-4" style={{ background: 'rgba(77,176,89,0.08)', border: '1px solid rgba(77,176,89,0.2)' }}>
                  <p className="text-xs" style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>
                    <i className="ri-information-line mr-1" />
                    Les notifications Firebase nécessitent une configuration des clés API dans les variables d\u0027environnement du serveur.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'roles' && (
              <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E8F2F1' }}>
                  <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>Équipe Administrative</h3>
                  <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                    <i className="ri-user-add-line" /> Inviter
                  </button>
                </div>
                <div className="divide-y" style={{ borderColor: '#F0F7F0' }}>
                  {roles.map((admin) => (
                    <div key={admin.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF' }}>
                          {admin.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{admin.name}</p>
                          <p className="text-xs" style={{ color: '#6B7280' }}>{admin.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: `${roleColors[admin.role]}20`, color: roleColors[admin.role] }}>{roleLabels[admin.role]}</span>
                          <p className="text-xs mt-1" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>Dernière connexion: {admin.lastLogin}</p>
                        </div>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: admin.status === 'active' ? '#22C55E' : '#6B7280' }} />
                        <button onClick={() => { setEditRoleUser(admin); setEditRoleValue(admin.role); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                          <i className="ri-edit-line text-sm" style={{ color: '#6B7280' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Maintenance Mode Banner */}
        <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: toggles.maintenanceMode ? 'rgba(239,68,68,0.1)' : '#FFFFFF', border: `1px solid ${toggles.maintenanceMode ? 'rgba(239,68,68,0.4)' : '#E8F2F1'}` }}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.2)' }}>
              <i className="ri-tools-line text-lg" style={{ color: '#EF4444' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>Mode Maintenance</p>
              <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Mettre la plateforme en maintenance — les utilisateurs verront une page d\u0027indisponibilité</p>
            </div>
          </div>
          <ToggleSwitch enabled={toggles.maintenanceMode} onChange={() => toggle('maintenanceMode')} />
        </div>
      </div>

      {/* Invite Admin Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setShowInviteModal(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={cardStyle} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Inviter un Admin</h2>
              <button onClick={() => setShowInviteModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}><i className="ri-close-line text-lg" /></button>
            </div>
            <div className="space-y-3">
              {[{ label: 'Nom complet *', key: 'name', type: 'text' }, { label: 'Email', key: 'email', type: 'email' }].map(field => (
                <div key={field.key}>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                  <input type={field.type} value={inviteForm[field.key as keyof typeof inviteForm]} onChange={e => setInviteForm(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }} />
                </div>
              ))}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Rôle</label>
                <select value={inviteForm.role} onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                  {Object.entries(roleLabels).map(([val, label]) => <option key={val} value={val} style={{ background: '#FFFFFF' }}>{label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowInviteModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleInvite} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-mail-send-line mr-2" />Envoyer invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editRoleUser && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setEditRoleUser(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={cardStyle} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Modifier le Rôle</h2>
              <button onClick={() => setEditRoleUser(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}><i className="ri-close-line text-lg" /></button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#F5FAF5' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF' }}>{editRoleUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
              <div>
                <p className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{editRoleUser.name}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>{editRoleUser.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(roleLabels).map(([val, label]) => (
                <button key={val} onClick={() => setEditRoleValue(val)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all cursor-pointer" style={{ background: editRoleValue === val ? `${roleColors[val]}15` : '#F5FAF5', border: `1px solid ${editRoleValue === val ? `${roleColors[val]}40` : '#E8F2F1'}`, color: editRoleValue === val ? roleColors[val] : '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  {label}
                  {editRoleValue === val && <i className="ri-checkbox-circle-fill" style={{ color: roleColors[val] }} />}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditRoleUser(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleSaveRole} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-save-line mr-2" />Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </AdminLayout>
  );
}