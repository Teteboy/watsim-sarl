import { useState, useEffect } from 'react';
import MerchantLayout from '@/components/feature/MerchantLayout';
import Toast, { useToast } from '@/components/base/Toast';
import { merchantApi } from '@/lib/api';

const categories = ['Électronique', 'Mode & Vêtements', 'Alimentation', 'Maison & Déco', 'Santé & Beauté', 'Automobile', 'Sport & Loisirs', 'Éducation', 'Bureautique'];

export default function MerchantSettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const { toasts, addToast, removeToast } = useToast();

  const [profileForm, setProfileForm] = useState({
    name: '',
    owner: '',
    email: '',
    phone: '',
    category: '',
    city: '',
    operatingMarket: '',
    commissionRate: '',
  });

  const [loadingProfile, setLoadingProfile] = useState(true);

  const [payoutForm, setPayoutForm] = useState({
    method: 'MTN Mobile Money',
    phone: '+237 6 91 11 22 33',
    minPayout: '50000',
    autoPayout: true,
    payoutFrequency: 'biweekly',
  });

  const [notifSettings, setNotifSettings] = useState({
    newOrder: true,
    orderStatus: true,
    bnplPayment: true,
    lowStock: true,
    newReview: false,
    weeklyReport: true,
    smsAlerts: true,
    emailAlerts: true,
  });

  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactor: true,
    loginAlerts: true,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [profileRes, settingsRes] = await Promise.all([
          merchantApi.profile(),
          merchantApi.getSettings().catch(() => ({})),
        ]);

        const p = profileRes?.data ?? profileRes;
        if (p) {
          setProfileForm({
            name: p.name || '',
            owner: p.owner || '',
            email: p.email || '',
            phone: p.phone || '',
            category: p.category || '',
            city: p.city || '',
            operatingMarket: p.operatingMarket || '',
            commissionRate: p.commissionRate != null ? String(p.commissionRate) : '',
          });
        }

        const s = settingsRes?.data ?? settingsRes ?? {};
        if (s.payout) setPayoutForm(prev => ({ ...prev, ...s.payout }));
        if (s.notifications) setNotifSettings(prev => ({ ...prev, ...s.notifications }));

        // Load dedicated notification preferences if available (preferred)
        try {
          const notifPrefs = await merchantApi.getNotificationPreferences();
          const prefs = notifPrefs?.data ?? notifPrefs;
          if (prefs && Object.keys(prefs).length > 0) {
            setNotifSettings(prev => ({ ...prev, ...prefs }));
          }
        } catch {}

        if (s.security) setSecurityForm(prev => ({ ...prev, ...s.security, currentPassword: '', newPassword: '', confirmPassword: '' }));
      } catch (e) {
        // ignore
      } finally {
        setLoadingProfile(false);
      }
    };
    load();
  }, []);

  const saveProfile = async () => {
    try {
      await merchantApi.updateProfile({
        name: profileForm.name,
        owner: profileForm.owner,
        email: profileForm.email,
        phone: profileForm.phone,
        city: profileForm.city,
        category: profileForm.category,
        operatingMarket: profileForm.operatingMarket || undefined,
      });
      addToast('success', 'Profil mis à jour', 'Les informations de votre boutique ont été sauvegardées.');
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Échec de la mise à jour du profil.');
    }
  };

  const savePayout = async () => {
    try {
      const current = await merchantApi.getSettings().catch(() => ({}));
      const s = current?.data ?? current ?? {};
      await merchantApi.updateSettings({ ...s, payout: payoutForm });
      addToast('success', 'Paramètres de virement sauvegardés', 'Vos préférences de paiement ont été mises à jour.');
    } catch (e: any) {
      addToast('error', 'Erreur', 'Impossible de sauvegarder les paramètres de virement.');
    }
  };

  const saveNotifications = async () => {
    try {
      // Prefer the dedicated notification preferences endpoint
      await merchantApi.updateNotificationPreferences(notifSettings);
      addToast('success', 'Notifications mises à jour', 'Vos préférences de notification ont été sauvegardées.');
    } catch (e: any) {
      // Fallback to generic settings if dedicated endpoint fails
      try {
        const current = await merchantApi.getSettings().catch(() => ({}));
        const s = current?.data ?? current ?? {};
        await merchantApi.updateSettings({ ...s, notifications: notifSettings });
        addToast('success', 'Notifications mises à jour', 'Vos préférences de notification ont été sauvegardées.');
      } catch {
        addToast('error', 'Erreur', 'Impossible de sauvegarder les préférences de notification.');
      }
    }
  };

  const savePassword = async () => {
    if (!securityForm.currentPassword || !securityForm.newPassword) {
      addToast('error', 'Champs requis', 'Veuillez remplir tous les champs de mot de passe.');
      return;
    }
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      addToast('error', 'Mots de passe différents', 'Le nouveau mot de passe et la confirmation ne correspondent pas.');
      return;
    }
    try {
      await merchantApi.changePassword(securityForm.currentPassword, securityForm.newPassword);
      setSecurityForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      addToast('success', 'Mot de passe modifié', 'Votre mot de passe a été mis à jour avec succès.');
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Échec du changement de mot de passe.');
    }
  };

  const tabs = [
    { key: 'profile', label: 'Profil boutique', icon: 'ri-store-2-line' },
    { key: 'payout', label: 'Virements', icon: 'ri-bank-line' },
    { key: 'notifications', label: 'Notifications', icon: 'ri-notification-3-line' },
    { key: 'security', label: 'Sécurité', icon: 'ri-shield-keyhole-line' },
  ];

  return (
    <MerchantLayout breadcrumb={['Merchant', 'Paramètres']}>
      <Toast toasts={toasts} onRemove={removeToast} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Paramètres</h2>
          <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Gérez votre compte et votre boutique</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar tabs */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}>
            {/* Profile summary */}
            <div className="p-4 text-center" style={{ borderBottom: '1px solid #E8F2F1' }}>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-2"
                style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF' }}
              >
                {(profileForm.owner || '').split(' ').map(n => n[0] || '').join('').slice(0, 2) || 'M'}
              </div>
              <p className="text-sm font-semibold" style={{ color: '#014945', fontFamily: 'Poppins, sans-serif' }}>{profileForm.owner}</p>
              <p className="text-xs mt-0.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{profileForm.name}</p>
              <div className="flex items-center justify-center gap-1 mt-2">
                <i className="ri-shield-check-line text-xs" style={{ color: '#22C55E' }} />
                <span className="text-xs" style={{ color: '#22C55E', fontFamily: 'Poppins, sans-serif' }}>Vérifié</span>
              </div>
            </div>
            <nav className="p-2">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer mb-1"
                  style={{
                    background: activeTab === tab.key ? 'rgba(77,176,73,0.1)' : 'transparent',
                    color: activeTab === tab.key ? '#4DB049' : '#6B7280',
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: activeTab === tab.key ? 500 : 400,
                    borderLeft: activeTab === tab.key ? '3px solid #4DB049' : '3px solid transparent',
                  }}
                >
                  <i className={`${tab.icon} text-base`} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Profile tab */}
          {activeTab === 'profile' && (
            <div className="rounded-2xl p-6 space-y-5" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}>
              <h3 className="font-semibold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Informations de la boutique</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Nom de la boutique', key: 'name', type: 'text' },
                  { label: 'Propriétaire', key: 'owner', type: 'text' },
                  { label: 'Email', key: 'email', type: 'email' },
                  { label: 'Téléphone', key: 'phone', type: 'tel' },
                  { label: 'Ville', key: 'city', type: 'text' },
                  { label: 'Marché d\'exploitation', key: 'operatingMarket', type: 'text' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                    <input
                      type={field.type}
                      value={(profileForm as Record<string, string>)[field.key]}
                      onChange={e => setProfileForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                      style={{ background: '#F5FAF5', border: '1px solid #D1E8D1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Catégorie</label>
                  <select
                    value={profileForm.category}
                    onChange={e => setProfileForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                    style={{ background: '#F5FAF5', border: '1px solid #D1E8D1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {profileForm.commissionRate && (
                <div className="p-3 rounded-xl" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                  <p className="text-xs mb-0.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Taux de commission (défini par l'administration)</p>
                  <p className="text-sm font-semibold" style={{ color: '#014945', fontFamily: 'Poppins, sans-serif' }}>{profileForm.commissionRate}%</p>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <button
                  onClick={saveProfile}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
                >
                  <i className="ri-save-line" />
                  Sauvegarder
                </button>
              </div>
            </div>
          )}

          {/* Payout tab */}
          {activeTab === 'payout' && (
            <div className="rounded-2xl p-6 space-y-5" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}>
              <h3 className="font-semibold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Paramètres de virement</h3>

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Méthode de paiement</label>
                <div className="grid grid-cols-2 gap-3">
                  {['MTN Mobile Money', 'Orange Money'].map(method => (
                    <button
                      key={method}
                      onClick={() => setPayoutForm(prev => ({ ...prev, method }))}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: payoutForm.method === method ? 'rgba(77,176,73,0.08)' : '#F5FAF5',
                        border: `1px solid ${payoutForm.method === method ? 'rgba(77,176,73,0.3)' : '#E8F2F1'}`,
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: payoutForm.method === method ? 'rgba(77,176,73,0.15)' : '#EBEBEB' }}>
                        <i className="ri-smartphone-line text-sm" style={{ color: payoutForm.method === method ? '#4DB049' : '#9CA3AF' }} />
                      </div>
                      <span className="text-sm" style={{ color: payoutForm.method === method ? '#014945' : '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                        {method}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Numéro de téléphone</label>
                  <input
                    type="tel"
                    value={payoutForm.phone}
                    onChange={e => setPayoutForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: '#F5FAF5', border: '1px solid #D1E8D1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Montant minimum (FCFA)</label>
                  <input
                    type="number"
                    value={payoutForm.minPayout}
                    onChange={e => setPayoutForm(prev => ({ ...prev, minPayout: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: '#F5FAF5', border: '1px solid #D1E8D1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Fréquence de virement automatique</label>
                <div className="flex gap-2">
                  {[{ key: 'weekly', label: 'Hebdomadaire' }, { key: 'biweekly', label: 'Bi-mensuel' }, { key: 'monthly', label: 'Mensuel' }].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setPayoutForm(prev => ({ ...prev, payoutFrequency: f.key }))}
                      className="flex-1 py-2 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-all"
                      style={{
                        background: payoutForm.payoutFrequency === f.key ? 'rgba(77,176,73,0.12)' : '#F5FAF5',
                        color: payoutForm.payoutFrequency === f.key ? '#4DB049' : '#6B7280',
                        border: `1px solid ${payoutForm.payoutFrequency === f.key ? 'rgba(77,176,73,0.3)' : '#E8F2F1'}`,
                        fontFamily: 'Poppins, sans-serif',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>Virement automatique</p>
                  <p className="text-xs mt-0.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Déclencher automatiquement selon la fréquence</p>
                </div>
                <button
                  onClick={() => setPayoutForm(prev => ({ ...prev, autoPayout: !prev.autoPayout }))}
                  className="w-12 h-6 rounded-full transition-all cursor-pointer relative flex-shrink-0"
                  style={{ background: payoutForm.autoPayout ? '#4DB049' : '#D1D5DB' }}
                >
                  <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ background: '#fff', left: payoutForm.autoPayout ? '26px' : '2px' }} />
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={savePayout}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
                >
                  <i className="ri-save-line" />
                  Sauvegarder
                </button>
              </div>
            </div>
          )}

          {/* Notifications tab */}
          {activeTab === 'notifications' && (
            <div className="rounded-2xl p-6 space-y-4" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}>
              <h3 className="font-semibold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Préférences de notification</h3>

              <div className="space-y-3">
                {[
                  { key: 'newOrder', label: 'Nouvelle commande', desc: 'Recevoir une alerte à chaque nouvelle commande' },
                  { key: 'orderStatus', label: 'Changement de statut', desc: 'Mises à jour sur le statut des commandes' },
                  { key: 'bnplPayment', label: 'Paiement BNPL reçu', desc: 'Notification lors d\'un versement BNPL' },
                  { key: 'lowStock', label: 'Stock faible', desc: 'Alerte quand un produit passe sous 5 unités' },
                  { key: 'newReview', label: 'Nouvel avis client', desc: 'Notification lors d\'un avis sur vos produits' },
                  { key: 'weeklyReport', label: 'Rapport hebdomadaire', desc: 'Résumé de performance chaque lundi' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{item.desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifSettings(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                      className="w-12 h-6 rounded-full transition-all cursor-pointer relative flex-shrink-0"
                      style={{ background: notifSettings[item.key as keyof typeof notifSettings] ? '#4DB049' : '#D1D5DB' }}
                    >
                      <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ background: '#fff', left: notifSettings[item.key as keyof typeof notifSettings] ? '26px' : '2px' }} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-4" style={{ borderTop: '1px solid #E8F2F1' }}>
                <p className="text-xs mb-3 font-medium" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Canaux de notification</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'smsAlerts', label: 'SMS', icon: 'ri-message-3-line' },
                    { key: 'emailAlerts', label: 'Email', icon: 'ri-mail-line' },
                  ].map(ch => (
                    <div key={ch.key} className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                      <div className="flex items-center gap-2">
                        <i className={`${ch.icon} text-sm`} style={{ color: '#6B7280' }} />
                        <span className="text-sm" style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}>{ch.label}</span>
                      </div>
                      <button
                        onClick={() => setNotifSettings(prev => ({ ...prev, [ch.key]: !prev[ch.key as keyof typeof prev] }))}
                        className="w-10 h-5 rounded-full transition-all cursor-pointer relative"
                        style={{ background: notifSettings[ch.key as keyof typeof notifSettings] ? '#4DB049' : '#D1D5DB' }}
                      >
                        <span className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{ background: '#fff', left: notifSettings[ch.key as keyof typeof notifSettings] ? '22px' : '2px' }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={saveNotifications}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
                >
                  <i className="ri-save-line" />
                  Sauvegarder
                </button>
              </div>
            </div>
          )}

          {/* Security tab */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="rounded-2xl p-6 space-y-4" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}>
                <h3 className="font-semibold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Changer le mot de passe</h3>
                {[
                  { label: 'Mot de passe actuel', key: 'currentPassword' },
                  { label: 'Nouveau mot de passe', key: 'newPassword' },
                  { label: 'Confirmer le nouveau mot de passe', key: 'confirmPassword' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs mb-1.5 block" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                    <input
                      type="password"
                      value={(securityForm as Record<string, string | boolean>)[field.key] as string}
                      onChange={e => setSecurityForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: '#F5FAF5', border: '1px solid #D1E8D1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                    />
                  </div>
                ))}
                <div className="flex justify-end">
                  <button
                    onClick={savePassword}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
                  >
                    Mettre à jour
                  </button>
                </div>
              </div>

              <div className="rounded-2xl p-6 space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}>
                <h3 className="font-semibold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Sécurité du compte</h3>
                {[
                  { key: 'twoFactor', label: 'Authentification à deux facteurs', desc: 'Sécurisez votre compte avec un code OTP par SMS' },
                  { key: 'loginAlerts', label: 'Alertes de connexion', desc: 'Recevoir une notification à chaque connexion' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{item.desc}</p>
                    </div>
                    <button
                      onClick={() => setSecurityForm(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                      className="w-12 h-6 rounded-full transition-all cursor-pointer relative flex-shrink-0"
                      style={{ background: securityForm[item.key as keyof typeof securityForm] ? '#4DB049' : '#D1D5DB' }}
                    >
                      <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ background: '#fff', left: securityForm[item.key as keyof typeof securityForm] ? '26px' : '2px' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </MerchantLayout>
  );
}
