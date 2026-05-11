import { features } from '@/mocks/landing';

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24" style={{ background: '#050B16' }}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span
            className="inline-block text-xs uppercase tracking-widest px-4 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37', fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(212,175,55,0.25)' }}
          >
            Fonctionnalités
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
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
                  ? 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.05) 100%)'
                  : 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
                border: idx === 0 ? '1px solid rgba(212,175,55,0.35)' : '1px solid rgba(212,175,55,0.12)',
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(212,175,55,0.15)' }}
              >
                <i className={`${feature.icon} text-2xl`} style={{ color: '#D4AF37' }} />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Poppins, sans-serif' }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
