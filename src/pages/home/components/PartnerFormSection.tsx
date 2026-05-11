import { useState, FormEvent } from 'react';

export default function PartnerFormSection() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const textarea = form.querySelector('textarea');
    if (textarea && textarea.value.length > 500) {
      alert('Le message ne peut pas dépasser 500 caractères.');
      return;
    }
    setLoading(true);
    const data = new URLSearchParams(new FormData(form) as unknown as Record<string, string>);
    try {
      await fetch('https://readdy.ai/api/form/d7nlbjdnkhlbktri3lng', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data.toString(),
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="partner" className="py-24" style={{ background: '#0A1628' }}>
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <span
            className="inline-block text-xs uppercase tracking-widest px-4 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37', fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(212,175,55,0.25)' }}
          >
            Partenariat
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Devenez Commercial Partenaire
          </h2>
          <p className="text-base" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
            Rejoignez notre réseau et augmentez vos ventes grâce au BNPL WATSIM.
          </p>
        </div>

        {submitted ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            <i className="ri-checkbox-circle-line text-5xl mb-4" style={{ color: '#22C55E' }} />
            <h3 className="text-white font-bold text-xl mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Demande envoyée !
            </h3>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
              Notre équipe vous contactera sous 48h pour valider votre dossier.
            </p>
          </div>
        ) : (
          <form
            data-readdy-form
            id="partner-form"
            onSubmit={handleSubmit}
            className="rounded-2xl p-8 space-y-5"
            style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.15)' }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                  Nom de l&apos;entreprise *
                </label>
                <input
                  type="text"
                  name="company_name"
                  required
                  placeholder="Ex: TechShop Yaoundé"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(212,175,55,0.2)',
                    color: 'white',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                  Nom du responsable *
                </label>
                <input
                  type="text"
                  name="contact_name"
                  required
                  placeholder="Prénom et Nom"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(212,175,55,0.2)',
                    color: 'white',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="contact@entreprise.cm"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(212,175,55,0.2)',
                    color: 'white',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                  Téléphone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  placeholder="+237 6XX XX XX XX"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(212,175,55,0.2)',
                    color: 'white',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                Secteur d&apos;activité *
              </label>
              <select
                name="sector"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(212,175,55,0.2)',
                  color: 'rgba(255,255,255,0.7)',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                <option value="" style={{ background: '#0D1B2A' }}>Sélectionner un secteur</option>
                <option value="electronique" style={{ background: '#0D1B2A' }}>Électronique & High-Tech</option>
                <option value="mode" style={{ background: '#0D1B2A' }}>Mode & Vêtements</option>
                <option value="alimentation" style={{ background: '#0D1B2A' }}>Alimentation & Restauration</option>
                <option value="maison" style={{ background: '#0D1B2A' }}>Maison & Décoration</option>
                <option value="sante" style={{ background: '#0D1B2A' }}>Santé & Beauté</option>
                <option value="autre" style={{ background: '#0D1B2A' }}>Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                Message (optionnel)
              </label>
              <textarea
                name="message"
                rows={4}
                maxLength={500}
                placeholder="Décrivez votre activité et vos attentes..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(212,175,55,0.2)',
                  color: 'white',
                  fontFamily: 'Poppins, sans-serif',
                }}
              />
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                Maximum 500 caractères
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-semibold text-base transition-all duration-300 hover:scale-[1.02] cursor-pointer whitespace-nowrap disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #D4AF37, #F5D76E)',
                color: '#0A1628',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {loading ? 'Envoi en cours...' : 'Envoyer ma demande de partenariat'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
