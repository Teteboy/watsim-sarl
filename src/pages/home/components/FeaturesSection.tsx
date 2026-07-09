export default function FeaturesSection() {
  const features = [
    { id: 1, icon: 'ri-bank-card-line', title: 'Achat à Crédit', desc: 'Payez en plusieurs fois avec des taux compétitifs.' },
    { id: 2, icon: 'ri-wallet-3-line', title: 'Portefeuille Digital', desc: 'Gérez votre solde et vos paiements en un clic.' },
    { id: 3, icon: 'ri-shield-check-line', title: 'Sécurité Avancée', desc: 'KYC, authentification et surveillance en temps réel.' },
    { id: 4, icon: 'ri-store-2-line', title: 'Réseau de Commerçants', desc: 'Achetez chez des partenaires de confiance partout.' },
    { id: 5, icon: 'ri-bar-chart-2-line', title: 'Analyses & Rapports', desc: 'Suivez vos dépenses et votre score crédit.' },
    { id: 6, icon: 'ri-customer-service-2-line', title: 'Support 24/7', desc: 'Une équipe dédiée pour vous accompagner.' },
  ];

  return (
    <section id="features" className="py-24" style={{ background: '#FAFEF9' }}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span
            className="inline-block text-xs uppercase tracking-widest px-4 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(77,176,89,0.12)', color: '#4DB049', fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(77,176,89,0.25)' }}
          >
            Fonctionnalités
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(10,36,32,0.5)', fontFamily: 'Poppins, sans-serif' }}>
            Une plateforme complète pour gérer vos achats, votre argent et votre crédit en toute simplicité.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, idx) => (
            <div
              key={feature.id}
              className="group rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] cursor-default"
              style={{
                background: idx === 0
                  ? 'linear-gradient(135deg, rgba(77,176,89,0.15) 0%, rgba(77,176,89,0.05) 100%)'
                  : '#FFFFFF',
                border: idx === 0 ? '1px solid rgba(77,176,89,0.35)' : '1px solid #E8F2F1',
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(77,176,89,0.15)' }}
              >
                <i className={`${feature.icon} text-2xl`} style={{ color: '#4DB049' }} />
              </div>
              <h3 className="font-semibold text-lg mb-2" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
