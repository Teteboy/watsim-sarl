export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src="https://readdy.ai/api/search-image?query=modern%20african%20city%20skyline%20at%20night%20with%20glowing%20lights%2C%20futuristic%20financial%20district%2C%20Douala%20Cameroon%20cityscape%2C%20vibrant%20urban%20scene%20with%20tall%20buildings%2C%20green%20and%20teal%20tones%2C%20long%20exposure%20photography%2C%20cinematic%20wide%20angle%20shot%2C%20high%20contrast%20dramatic%20lighting&width=1440&height=900&seq=hero1&orientation=landscape"
          alt="WATSIM Hero"
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(1,73,69,0.92) 0%, rgba(10,36,32,0.85) 50%, rgba(1,73,69,0.90) 100%)' }} />
      </div>

      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-10"
            style={{
              width: `${80 + i * 40}px`,
              height: `${80 + i * 40}px`,
              background: 'radial-gradient(circle, #4DB049, transparent)',
              left: `${10 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              animation: `pulse ${3 + i * 0.5}s ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8" style={{ background: 'rgba(77,176,89,0.15)', border: '1px solid rgba(77,176,89,0.3)' }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#4DB049' }} />
          <span className="text-sm font-medium" style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>
            Disponible au Cameroun — Bientôt en Afrique Centrale
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Achetez Maintenant,
          <br />
          <span style={{ background: 'linear-gradient(135deg, #4DB049, #196D43)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Payez Plus Tard
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10" style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'Poppins, sans-serif', lineHeight: '1.8' }}>
          WATSIM révolutionne le commerce en Afrique centrale. Achetez chez nos commerciaux partenaires et remboursez en 2, 3 ou 6 mensualités flexibles.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <a
            href="#download"
            className="flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-base transition-all duration-300 hover:scale-105 cursor-pointer whitespace-nowrap"
            style={{
              background: '#4DB049',
              color: '#FFFFFF',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            <i className="ri-google-play-line text-xl" />
            Télécharger sur Android
          </a>
          <a
            href="#how-it-works"
            className="flex items-center gap-3 px-8 py-4 rounded-xl font-medium text-base transition-all duration-300 hover:bg-white/10 cursor-pointer whitespace-nowrap"
            style={{
              border: '1px solid rgba(255,255,255,0.25)',
              color: 'rgba(255,255,255,0.85)',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            <i className="ri-play-circle-line text-xl" />
            Voir comment ça marche
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {[
            { value: '50 000+', label: 'Utilisateurs' },
            { value: '500+', label: 'Commerciaux' },
            { value: '2 Mrd FCFA', label: 'Volume Traité' },
            { value: '94%', label: 'Satisfaction' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-4 text-center"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(77,176,89,0.15)', backdropFilter: 'blur(8px)' }}
            >
              <p className="text-2xl font-bold mb-1" style={{ color: '#4DB049', fontFamily: 'Montserrat, sans-serif' }}>
                {stat.value}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
          Défiler
        </span>
        <i className="ri-arrow-down-line text-lg" style={{ color: 'rgba(255,255,255,0.3)' }} />
      </div>
    </section>
  );
}
