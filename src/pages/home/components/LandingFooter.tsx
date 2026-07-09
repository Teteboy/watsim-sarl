export default function LandingFooter() {
  return (
    <footer style={{ background: '#014945', borderTop: '1px solid rgba(77,176,89,0.2)' }}>
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden"
              >
                <img
                  src="/src/assets/images/logo_white.png"
                  alt="WATSIM"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <span className="text-white font-bold text-xl" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                WATSIM
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Poppins, sans-serif' }}>
              La plateforme BNPL de référence en Afrique centrale. Achetez maintenant, payez plus tard.
            </p>
            <div className="flex items-center gap-3">
              {['ri-facebook-fill', 'ri-twitter-x-line', 'ri-instagram-line', 'ri-linkedin-fill'].map((icon) => (
                <a
                  key={icon}
                  href="#"
                  rel="nofollow"
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <i className={`${icon} text-sm`} style={{ color: 'rgba(255,255,255,0.5)' }} />
                </a>
              ))}
            </div>
          </div>

          {/* Produit */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              <a href="#features">Produit</a>
            </h4>
            <ul className="space-y-2.5">
              {['Fonctionnalités BNPL', 'Portefeuille Électronique', 'Scoring de Crédit', 'Catalogue Produits', 'Cashback & Parrainage'].map((item) => (
                <li key={item}>
                  <a
                    href="#features"
                    className="text-sm transition-colors hover:text-white"
                    style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Poppins, sans-serif' }}
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Entreprise */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              <a href="#about">Entreprise</a>
            </h4>
            <ul className="space-y-2.5">
              {['À propos de WATSIM', 'Devenir Commercial', 'Carrières', 'Presse & Médias', 'Contact'].map((item) => (
                <li key={item}>
                  <a
                    href="#"
                    rel="nofollow"
                    className="text-sm transition-colors hover:text-white"
                    style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Poppins, sans-serif' }}
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Légal */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              <a href="#legal">Légal & Support</a>
            </h4>
            <ul className="space-y-2.5">
              {["Conditions d'utilisation", 'Politique de confidentialité', 'Conformité RGPD', 'Centre d\'aide', 'Signaler un problème'].map((item) => (
                <li key={item}>
                  <a
                    href="#"
                    rel="nofollow"
                    className="text-sm transition-colors hover:text-white"
                    style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Poppins, sans-serif' }}
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
            © 2026 WATSIM. Tous droits réservés. Plateforme fintech agréée au Cameroun.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
              Conforme OHADA · RGPD · PCI DSS
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
