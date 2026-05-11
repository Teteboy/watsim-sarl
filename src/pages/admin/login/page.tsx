import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { login } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    setLoading(true);
    const success = await login(email.trim(), password);
    setLoading(false);

    if (success) {
      navigate('/admin');
    } else {
      setError("Identifiants incorrects. Essayez admin@watsim.com avec n'importe quel mot de passe.");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#050B16' }}
    >
      {/* Background radial glows */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 15% 25%, rgba(212,175,55,0.07) 0%, transparent 50%), radial-gradient(ellipse at 85% 75%, rgba(212,175,55,0.05) 0%, transparent 50%)',
        }}
      />
      <div
        className="absolute top-1/3 -left-40 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'rgba(212,175,55,0.04)', filter: 'blur(80px)' }}
      />
      <div
        className="absolute bottom-1/3 -right-40 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'rgba(212,175,55,0.04)', filter: 'blur(80px)' }}
      />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(rgba(212,175,55,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-6 cursor-pointer">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)' }}
            >
              <i className="ri-shield-star-line text-xl" style={{ color: '#0A1628' }} />
            </div>
            <div className="text-left">
              <span
                className="text-2xl font-bold block"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  background: 'linear-gradient(135deg, #D4AF37, #F5D76E)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                WATSIM
              </span>
              <span
                className="text-xs tracking-widest uppercase"
                style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}
              >
                Administration
              </span>
            </div>
          </Link>

          <h1
            className="text-white text-2xl font-bold mb-2"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            Accès Administrateur
          </h1>
          <p
            className="text-sm"
            style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Poppins, sans-serif' }}
          >
            Connectez-vous pour accéder au panneau de contrôle
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'linear-gradient(135deg, #152238, #0D1B2A)',
            border: '1px solid rgba(212,175,55,0.15)',
          }}
        >
          {/* Security badge */}
          <div
            className="flex items-center gap-3 p-3 rounded-xl mb-6"
            style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.12)' }}
          >
            <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
              <i className="ri-lock-password-line text-sm" style={{ color: '#D4AF37' }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: '#D4AF37', fontFamily: 'Poppins, sans-serif' }}>
                Zone sécurisée
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                Démo : <code
                  className="px-1 py-0.5 rounded"
                  style={{ background: 'rgba(212,175,55,0.15)', color: '#F5D76E' }}
                >admin@watsim.com</code> + n'importe quel mot de passe
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}
              >
                Adresse e-mail
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                  <i className="ri-mail-line text-sm" style={{ color: 'rgba(255,255,255,0.35)' }} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@watsim.com"
                  className="w-full pl-10 pr-4 py-3 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}
              >
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                  <i className="ri-lock-line text-sm" style={{ color: 'rgba(255,255,255,0.35)' }} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-pointer transition-colors"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
                >
                  <i className={showPassword ? 'ri-eye-off-line text-sm' : 'ri-eye-line text-sm'} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <i className="ri-error-warning-line text-sm mt-0.5 flex-shrink-0" style={{ color: '#EF4444' }} />
                <p className="text-xs" style={{ color: '#EF4444', fontFamily: 'Poppins, sans-serif' }}>
                  {error}
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap transition-all hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #D4AF37, #F5D76E)',
                color: '#0A1628',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line text-base animate-spin" />
                  Vérification en cours...
                </>
              ) : (
                <>
                  <i className="ri-shield-check-line text-base" />
                  Accéder au panneau
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
              accès restreint
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Merchant link */}
          <p
            className="text-center text-sm"
            style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}
          >
            Vous êtes commercial ?{' '}
            <Link
              to="/merchant/login"
              className="font-medium cursor-pointer transition-colors"
              style={{ color: '#D4AF37' }}
            >
              Espace commercial
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <Link
            to="/"
            className="text-xs cursor-pointer transition-colors"
            style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}
          >
            ← Retour à l'accueil
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span
            className="text-xs"
            style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}
          >
            © 2025 WATSIM
          </span>
        </div>
      </div>
    </div>
  );
}
