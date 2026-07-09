export default function CtaSection() {
  return (
    <section id="download" className="py-24 relative overflow-hidden" style={{ background: '#014945' }}>
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="https://readdy.ai/api/search-image?query=abstract%20green%20geometric%20pattern%20with%20dark%20teal%20background%2C%20luxury%20fintech%20brand%20visual%2C%20elegant%20lines%20and%20shapes%2C%20premium%20financial%20technology%20aesthetic%2C%20minimal%20modern%20design%2C%20green%20and%20teal%20color%20palette&width=1440&height=600&seq=cta1&orientation=landscape"
          alt=""
          className="w-full h-full object-cover object-top opacity-20"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(1,73,69,0.95) 0%, rgba(25,109,67,0.9) 100%)' }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
          style={{ background: 'rgba(77,176,89,0.15)', border: '1px solid rgba(77,176,89,0.3)' }}
        >
          <i className="ri-smartphone-line text-sm" style={{ color: '#4DB049' }} />
          <span className="text-sm" style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>
            Application Mobile Disponible
          </span>
        </div>

        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Commencez dès aujourd&apos;hui
          <br />
          <span style={{ background: 'linear-gradient(135deg, #4DB049, #196D43)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            C&apos;est gratuit !
          </span>
        </h2>

        <p className="text-lg mb-10" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Poppins, sans-serif' }}>
          Rejoignez plus de 50 000 utilisateurs qui font confiance à WATSIM pour leurs achats et leur gestion financière.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <a
            href="#"
            className="flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-base transition-all duration-300 hover:scale-105 cursor-pointer whitespace-nowrap"
            style={{
              background: '#4DB049',
              color: '#FFFFFF',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            <i className="ri-google-play-line text-xl" />
            Google Play Store
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-8 py-4 rounded-xl font-medium text-base transition-all duration-300 hover:bg-white/10 cursor-pointer whitespace-nowrap"
            style={{
              border: '1px solid rgba(255,255,255,0.25)',
              color: 'rgba(255,255,255,0.85)',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            <i className="ri-apple-line text-xl" />
            App Store (iOS)
          </a>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6">
          {[
            { icon: 'ri-shield-check-line', text: 'Données chiffrées' },
            { icon: 'ri-bank-line', text: 'Conforme OHADA' },
            { icon: 'ri-lock-line', text: 'PCI DSS' },
            { icon: 'ri-customer-service-2-line', text: 'Support 24/7' },
          ].map((badge) => (
            <div key={badge.text} className="flex items-center gap-2">
              <i className={`${badge.icon} text-sm`} style={{ color: '#4DB049' }} />
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                {badge.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
