import { useState } from 'react';
import MerchantLayout from '@/components/feature/MerchantLayout';
import Toast, { useToast } from '@/components/base/Toast';
import { merchantProfile } from '@/mocks/merchantData';

const categories = ['Électronique', 'Mode & Vêtements', 'Alimentation', 'Maison & Déco', 'Santé & Beauté', 'Automobile', 'Sport & Loisirs', 'Éducation', 'Bureautique'];

export default function MerchantSettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const { toasts, addToast, removeToast } = useToast();

  const [profileForm, setProfileForm] = useState({
    name: merchantProfile.name,
    owner: merchantProfile.owner,
    email: merchantProfile.email,
    phone: merchantProfile.phone,
    category: merchantProfile.category,
    city: merchantProfile.city,
    address: merchantProfile.address,
  });

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

  const saveProfile = () => {
    addToast('success', 'Profil mis à jour', 'Les informations de votre boutique ont été sauvegardées.');
  };

  const savePayout = () => {
    addToast('success', 'Paramètres de virement sauvegardés', 'Vos préférences de paiement ont été mises à jour.');
  };

  const saveNotifications = () => {
    addToast('success', 'Notifications mises à jour', 'Vos préférences de notification ont été sauvegardées.');
  };

  const savePassword = () => {
    if (!securityForm.currentPassword || !securityForm.newPassword) {
      addToast('error', 'Champs requis', 'Veuillez remplir tous les champs de mot de passe.');
      return;
    }
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      addToast('error', 'Mots de passe différents', 'Le nouveau mot de passe et la confirmation ne correspondent pas.');
      return;
    }
    setSecurityForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    addToast('success', 'Mot de passe modifié', 'Votre mot de passe a été mis à jour avec succès.');
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
          <h2 className="text-white text-2xl font-bold" style={{ fontFamily: 'Montserrat, sans-serif' }}>Paramètres</h2>
          <p className="text-white/40 text-sm mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Gérez votre compte et votre boutique</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar tabs */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}>
            {/* Profile summary */}
            <div className="p-4 border-b border-white/10 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-2"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628' }}
              >
                {merchantProfile.owner.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <p className="text-white text-sm font-semibold" style={{ fontFamily: 'Poppins, sans-serif' }}>{merchantProfile.owner}</p>
              <p className="text-white/40 text-xs mt-0.5" style={{ fontFamily: 'Poppins, sans-serif' }}>{merchantProfile.name}</p>
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
                    background: activeTab === tab.key ? 'rgba(212,175,55,0.12)' : 'transparent',
                    color: activeTab === tab.key ? '#D4AF37' : 'rgba(255,255,255,0.5)',
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: activeTab === tab.key ? 500 : 400,
                    borderLeft: activeTab === tab.key ? '3px solid #D4AF37' : '3px solid transparent',
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
            <div className="rounded-2xl p-6 space-y-5" style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}>
              <h3 className="text-white font-semibold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>Informations de la boutique</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Nom de la boutique', key: 'name', type: 'text' },
                  { label: 'Propriétaire', key: 'owner', type: 'text' },
                  { label: 'Email', key: 'email', type: 'email' },
                  { label: 'Téléphone', key: 'phone', type: 'tel' },
                  { label: 'Ville', key: 'city', type: 'text' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs text-white/50 mb-1.5 block" style={{ fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                    <input
                      type={field.type}
                      value={(profileForm as Record<string, string>)[field.key]}
                      onChange={e => setProfileForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block" style={{ fontFamily: 'Poppins, sans-serif' }}>Catégorie</label>
                  <select
                    value={profileForm.category}
                    onChange={e => setProfileForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                  >
                    {categories.map(c => <option key={c} value={c} style={{ background: '#0D1B2A' }}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block" style={{ fontFamily: 'Poppins, sans-serif' }}>Adresse complète</label>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={e => setProfileForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                />
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={saveProfile}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}
                >
                  <i className="ri-save-line" />
                  Sauvegarder
                </button>
              </div>
            </div>
          )}

          {/* Payout tab */}
          {activeTab === 'payout' && (
            <div className="rounded-2xl p-6 space-y-5" style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}>
              <h3 className="text-white font-semibold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>Paramètres de virement</h3>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block" style={{ fontFamily: 'Poppins, sans-serif' }}>Méthode de paiement</label>
                <div className="grid grid-cols-2 gap-3">
                  {['MTN Mobile Money', 'Orange Money'].map(method => (
                    <button
                      key={method}
                      onClick={() => setPayoutForm(prev => ({ ...prev, method }))}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: payoutForm.method === method ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${payoutForm.method === method ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: payoutForm.method === method ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.06)' }}>
                        <i className="ri-smartphone-line text-sm" style={{ color: payoutForm.method === method ? '#D4AF37' : 'rgba(255,255,255,0.4)' }} />
                      </div>
                      <span className="text-sm" style={{ color: payoutForm.method === method ? '#fff' : 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                        {method}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block" style={{ fontFamily: 'Poppins, sans-serif' }}>Numéro de téléphone</label>
                  <input
                    type="tel"
                    value={payoutForm.phone}
                    onChange={e => setPayoutForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block" style={{ fontFamily: 'Poppins, sans-serif' }}>Montant minimum (FCFA)</label>
                  <input
                    type="number"
                    value={payoutForm.minPayout}
                    onChange={e => setPayoutForm(prev => ({ ...prev, minPayout: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block" style={{ fontFamily: 'Poppins, sans-serif' }}>Fréquence de virement automatique</label>
                <div className="flex gap-2">
                  {[{ key: 'weekly', label: 'Hebdomadaire' }, { key: 'biweekly', label: 'Bi-mensuel' }, { key: 'monthly', label: 'Mensuel' }].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setPayoutForm(prev => ({ ...prev, payoutFrequency: f.key }))}
                      className="flex-1 py-2 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-all"
                      style={{
                        background: payoutForm.payoutFrequency === f.key ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
                        color: payoutForm.payoutFrequency === f.key ? '#D4AF37' : 'rgba(255,255,255,0.5)',
                        border: `1px solid ${payoutForm.payoutFrequency === f.key ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        fontFamily: 'Poppins, sans-serif',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div>
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>Virement automatique</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Déclencher automatiquement selon la fréquence</p>
                </div>
                <button
                  onClick={() => setPayoutForm(prev => ({ ...prev, autoPayout: !prev.autoPayout }))}
                  className="w-12 h-6 rounded-full transition-all cursor-pointer relative flex-shrink-0"
                  style={{ background: payoutForm.autoPayout ? '#D4AF37' : 'rgba(255,255,255,0.1)' }}
                >
                  <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ background: '#fff', left: payoutForm.autoPayout ? '26px' : '2px' }} />
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={savePayout}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}
                >
                  <i className="ri-save-line" />
                  Sauvegarder
                </button>
              </div>
            </div>
          )}

          {/* Notifications tab */}
          {activeTab === 'notifications' && (
            <div className="rounded-2xl p-6 space-y-4" style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}>
              <h3 className="text-white font-semibold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>Préférences de notification</h3>

              <div className="space-y-3">
                {[
                  { key: 'newOrder', label: 'Nouvelle commande', desc: 'Recevoir une alerte à chaque nouvelle commande' },
                  { key: 'orderStatus', label: 'Changement de statut', desc: 'Mises à jour sur le statut des commandes' },
                  { key: 'bnplPayment', label: 'Paiement BNPL reçu', desc: 'Notification lors d\'un versement BNPL' },
                  { key: 'lowStock', label: 'Stock faible', desc: 'Alerte quand un produit passe sous 5 unités' },
                  { key: 'newReview', label: 'Nouvel avis client', desc: 'Notification lors d\'un avis sur vos produits' },
                  { key: 'weeklyReport', label: 'Rapport hebdomadaire', desc: 'Résumé de performance chaque lundi' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div>
                      <p className="text-white text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{item.desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifSettings(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                      className="w-12 h-6 rounded-full transition-all cursor-pointer relative flex-shrink-0"
                      style={{ background: notifSettings[item.key as keyof typeof notifSettings] ? '#D4AF37' : 'rgba(255,255,255,0.1)' }}
                    >
                      <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ background: '#fff', left: notifSettings[item.key as keyof typeof notifSettings] ? '26px' : '2px' }} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-white/50 text-xs mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>Canaux de notification</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'smsAlerts', label: 'SMS', icon: 'ri-message-3-line' },
                    { key: 'emailAlerts', label: 'Email', icon: 'ri-mail-line' },
                  ].map(ch => (
                    <div key={ch.key} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-2">
                        <i className={`${ch.icon} text-sm`} style={{ color: 'rgba(255,255,255,0.5)' }} />
                        <span className="text-sm text-white/70" style={{ fontFamily: 'Poppins, sans-serif' }}>{ch.label}</span>
                      </div>
                      <button
                        onClick={() => setNotifSettings(prev => ({ ...prev, [ch.key]: !prev[ch.key as keyof typeof prev] }))}
                        className="w-10 h-5 rounded-full transition-all cursor-pointer relative"
                        style={{ background: notifSettings[ch.key as keyof typeof notifSettings] ? '#D4AF37' : 'rgba(255,255,255,0.1)' }}
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
                  style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}
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
              <div className="rounded-2xl p-6 space-y-4" style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}>
                <h3 className="text-white font-semibold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>Changer le mot de passe</h3>
                {[
                  { label: 'Mot de passe actuel', key: 'currentPassword' },
                  { label: 'Nouveau mot de passe', key: 'newPassword' },
                  { label: 'Confirmer le nouveau mot de passe', key: 'confirmPassword' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs text-white/50 mb-1.5 block" style={{ fontFamily: 'Poppins, sans-serif' }}>{field.label}</label>
                    <input
                      type="password"
                      value={(securityForm as Record<string, string | boolean>)[field.key] as string}
                      onChange={e => setSecurityForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
                    />
                  </div>
                ))}
                <div className="flex justify-end">
                  <button
                    onClick={savePassword}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}
                  >
                    Mettre à jour
                  </button>
                </div>
              </div>

              <div className="rounded-2xl p-6 space-y-3" style={{ background: 'linear-gradient(135deg, #152238, #0D1B2A)', border: '1px solid rgba(212,175,55,0.1)' }}>
                <h3 className="text-white font-semibold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>Sécurité du compte</h3>
                {[
                  { key: 'twoFactor', label: 'Authentification à deux facteurs', desc: 'Sécurisez votre compte avec un code OTP par SMS' },
                  { key: 'loginAlerts', label: 'Alertes de connexion', desc: 'Recevoir une notification à chaque connexion' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div>
                      <p className="text-white text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{item.desc}</p>
                    </div>
                    <button
                      onClick={() => setSecurityForm(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                      className="w-12 h-6 rounded-full transition-all cursor-pointer relative flex-shrink-0"
                      style={{ background: securityForm[item.key as keyof typeof securityForm] ? '#D4AF37' : 'rgba(255,255,255,0.1)' }}
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
