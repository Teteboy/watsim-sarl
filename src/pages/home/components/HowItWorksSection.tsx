import { howItWorks } from '@/mocks/landing';

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24" style={{ background: '#0A1628' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <div>
            <span
              className="inline-block text-xs uppercase tracking-widest px-4 py-1.5 rounded-full mb-4"
              style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37', fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(212,175,55,0.25)' }}
            >
              Comment ça marche
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Simple, Rapide,
              <br />
              <span style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Accessible à Tous
              </span>
            </h2>
            <p className="text-base mb-10" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Poppins, sans-serif', lineHeight: '1.8' }}>
              En quelques étapes simples, accédez au crédit BNPL et gérez vos finances depuis votre smartphone.
            </p>

            {/* Steps */}
            <div className="space-y-6">
              {howItWorks.map((step, idx) => (
                <div key={step.step} className="flex items-start gap-5">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
                    style={{
                      background: idx === 0 ? 'linear-gradient(135deg, #D4AF37, #F5D76E)' : 'rgba(212,175,55,0.12)',
                      color: idx === 0 ? '#0A1628' : '#D4AF37',
                      fontFamily: 'Montserrat, sans-serif',
                      border: idx !== 0 ? '1px solid rgba(212,175,55,0.25)' : 'none',
                    }}
                  >
                    {step.step}
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      {step.title}
                    </h4>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif', lineHeight: '1.7' }}>
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Phone Mockup */}
          <div className="flex justify-center">
            <div className="relative">
              {/* Glow */}
              <div
                className="absolute inset-0 rounded-3xl blur-3xl opacity-30"
                style={{ background: 'radial-gradient(circle, #D4AF37, transparent)' }}
              />
              {/* Phone frame */}
              <div
                className="relative w-72 rounded-3xl overflow-hidden"
                style={{ border: '2px solid rgba(212,175,55,0.3)', background: '#0D1B2A' }}
              >
                {/* Status bar */}
                <div className="flex items-center justify-between px-5 py-3" style={{ background: '#0A1628' }}>
                  <span className="text-xs text-white/60" style={{ fontFamily: 'Poppins, sans-serif' }}>9:41</span>
                  <div className="flex items-center gap-1">
                    <i className="ri-wifi-line text-xs text-white/60" />
                    <i className="ri-battery-2-charge-line text-xs text-white/60" />
                  </div>
                </div>

                {/* App content */}
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Bonjour,</p>
                      <p className="text-white font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>Jean-Baptiste 👋</p>
                    </div>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      JB
                    </div>
                  </div>

                  {/* Balance Card */}
                  <div
                    className="rounded-2xl p-4 mb-4"
                    style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)' }}
                  >
                    <p className="text-xs mb-1" style={{ color: 'rgba(10,22,40,0.6)', fontFamily: 'Poppins, sans-serif' }}>Solde Wallet</p>
                    <p className="text-2xl font-bold" style={{ color: '#0A1628', fontFamily: 'Montserrat, sans-serif' }}>125 000 FCFA</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs" style={{ color: 'rgba(10,22,40,0.6)', fontFamily: 'Poppins, sans-serif' }}>Crédit BNPL disponible :</span>
                      <span className="text-xs font-semibold" style={{ color: '#0A1628', fontFamily: 'Montserrat, sans-serif' }}>375 000 FCFA</span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { icon: 'ri-add-line', label: 'Dépôt' },
                      { icon: 'ri-arrow-up-line', label: 'Retrait' },
                      { icon: 'ri-send-plane-line', label: 'Transfert' },
                      { icon: 'ri-shopping-cart-2-line', label: 'Acheter' },
                    ].map((action) => (
                      <div key={action.label} className="flex flex-col items-center gap-1">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: 'rgba(212,175,55,0.12)' }}
                        >
                          <i className={`${action.icon} text-sm`} style={{ color: '#D4AF37' }} />
                        </div>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                          {action.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Recent Transactions */}
                  <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                    Transactions récentes
                  </p>
                  {[
                    { name: 'TechShop Yaoundé', amount: '-45 000', type: 'BNPL', icon: 'ri-shopping-bag-line', color: '#EF4444' },
                    { name: 'Orange Money', amount: '+50 000', type: 'Dépôt', icon: 'ri-phone-line', color: '#22C55E' },
                    { name: 'Remboursement', amount: '-15 000', type: 'BNPL', icon: 'ri-bank-card-line', color: '#F97316' },
                  ].map((tx) => (
                    <div key={tx.name} className="flex items-center gap-3 py-2 border-b border-white/5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${tx.color}20` }}
                      >
                        <i className={`${tx.icon} text-xs`} style={{ color: tx.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>{tx.name}</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>{tx.type}</p>
                      </div>
                      <span className="text-xs font-medium" style={{ color: tx.color, fontFamily: 'Montserrat, sans-serif' }}>
                        {tx.amount} FCFA
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
