import { useState, FormEvent } from 'react';
import { useMerchantAuth } from '@/hooks/useMerchantAuth';

const SECTOR_TO_CATEGORY: Record<string, string> = {
  electronique: 'Électronique',
  mode: 'Mode & Vêtements',
  alimentation: 'Alimentation',
  maison: 'Maison & Déco',
  sante: 'Santé & Beauté',
  autre: 'Autre',
};

export default function PartnerFormSection() {
  const { register } = useMerchantAuth();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const message = String(fd.get('message') ?? '');
    if (message.length > 500) {
      setError('Le message ne peut pas dépasser 500 caractères.');
      return;
    }
    setLoading(true);
    try {
      const res = await register({
        businessName: String(fd.get('company_name') ?? ''),
        fullName: String(fd.get('contact_name') ?? ''),
        email: String(fd.get('email') ?? ''),
        phone: String(fd.get('phone') ?? ''),
        password: String(fd.get('password') ?? ''),
        city: String(fd.get('city') ?? ''),
        category: SECTOR_TO_CATEGORY[String(fd.get('sector') ?? '')] ?? 'Autre',
      });
      if (res.ok) setSubmitted(true);
      else setError(res.message ?? 'Inscription échouée');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: '#FAFEF9',
    border: '1px solid #E8F2F1',
    color: '#014945',
    fontFamily: 'Poppins, sans-serif',
  };

  return (
    <section id="partner" className="py-24" style={{ background: '#FAFEF9' }}>
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <span
            className="inline-block text-xs uppercase tracking-widest px-4 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(77,176,89,0.12)', color: '#4DB049', fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(77,176,89,0.25)' }}
          >
            Partenariat
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
            Devenez Commercial Partenaire
          </h2>
          <p className="text-base" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
            Rejoignez notre réseau et augmentez vos ventes grâce au BNPL WATSIM.
          </p>
        </div>

        {submitted ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: '#FFFFFF', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            <i className="ri-checkbox-circle-line text-5xl mb-4" style={{ color: '#22C55E' }} />
            <h3 className="font-bold text-xl mb-2" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
              Demande envoyée !
            </h3>
            <p className="text-sm" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
              Notre équipe vous contactera sous 48h pour valider votre dossier.
            </p>
          </div>
        ) : (
          <form
            data-readdy-form
            id="partner-form"
            onSubmit={handleSubmit}
            className="rounded-2xl p-8 space-y-5"
            style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                  Nom de l'entreprise *
                </label>
                <input
                  type="text"
                  name="company_name"
                  required
                  placeholder="Ex: TechShop Yaoundé"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                  Nom du responsable *
                </label>
                <input
                  type="text"
                  name="contact_name"
                  required
                  placeholder="Prénom et Nom"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="contact@entreprise.cm"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                  Téléphone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  placeholder="+237 6XX XX XX XX"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                  Mot de passe *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  placeholder="8 caractères minimum"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                  Ville *
                </label>
                <input
                  type="text"
                  name="city"
                  required
                  placeholder="Douala, Yaoundé..."
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                Secteur d'activité *
              </label>
              <select
                name="sector"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer"
                style={{
                  background: '#FAFEF9',
                  border: '1px solid #E8F2F1',
                  color: 'rgba(10,36,32,0.7)',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                <option value="" style={{ background: '#FFFFFF' }}>Sélectionner un secteur</option>
                <option value="electronique" style={{ background: '#FFFFFF' }}>Électronique & High-Tech</option>
                <option value="mode" style={{ background: '#FFFFFF' }}>Mode & Vêtements</option>
                <option value="alimentation" style={{ background: '#FFFFFF' }}>Alimentation & Restauration</option>
                <option value="maison" style={{ background: '#FFFFFF' }}>Maison & Décoration</option>
                <option value="sante" style={{ background: '#FFFFFF' }}>Santé & Beauté</option>
                <option value="autre" style={{ background: '#FFFFFF' }}>Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                Message (optionnel)
              </label>
              <textarea
                name="message"
                rows={4}
                maxLength={500}
                placeholder="Décrivez votre activité et vos attentes..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={inputStyle}
              />
              <p className="text-xs mt-1" style={{ color: 'rgba(10,36,32,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                Maximum 500 caractères
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.2)' }}>
                <i className="ri-error-warning-line text-sm mt-0.5" style={{ color: '#E53935' }} />
                <p className="text-xs" style={{ color: '#E53935', fontFamily: 'Poppins, sans-serif' }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-semibold text-base transition-all duration-300 hover:scale-[1.02] cursor-pointer whitespace-nowrap disabled:opacity-60"
              style={{
                background: '#4DB049',
                color: '#FFFFFF',
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
