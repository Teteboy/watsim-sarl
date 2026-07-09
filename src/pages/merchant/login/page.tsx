import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMerchantAuth } from '@/hooks/useMerchantAuth';

export default function MerchantLoginPage() {
  const navigate = useNavigate();
  const { login } = useMerchantAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

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
      navigate('/merchant');
    } else {
      setError('Identifiants incorrects. Essayez techshop@watsim.cm / Merchant@123');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#FAFEF9' }}
    >
      {/* Background decorations */}
      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 20% 20%, rgba(77,176,89,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(77,176,89,0.05) 0%, transparent 50%)',
        }}
      />
      <div
        className="absolute top-1/4 -left-32 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'rgba(77,176,89,0.06)', filter: 'blur(60px)' }}
      />
      <div
        className="absolute bottom-1/4 -right-32 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'rgba(77,176,89,0.06)', filter: 'blur(60px)' }}
      />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(rgba(77,176,89,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(77,176,89,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-6 cursor-pointer">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)' }}
            >
              <i className="ri-store-2-line text-xl" style={{ color: '#FFFFFF' }} />
            </div>
            <div className="text-left">
              <span
                className="text-2xl font-bold block"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  color: '#014945',
                }}
              >
                WATSIM
              </span>
              <span
                className="text-xs tracking-widest uppercase"
                style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}
              >
                Espace Commercial
              </span>
            </div>
          </Link>

          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}
          >
            Connexion
          </h1>
          <p
            className="text-sm"
            style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}
          >
            Accédez à votre tableau de bord commercial
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8F2F1',
            boxShadow: '0 4px 20px rgba(77,176,89,0.08)',
          }}
        >
          {/* Demo hint */}
          <div
            className="flex items-start gap-3 p-3 rounded-xl mb-6"
            style={{ background: 'rgba(77,176,89,0.08)', border: '1px solid rgba(77,176,89,0.15)' }}
          >
            <i className="ri-information-line text-sm mt-0.5 flex-shrink-0" style={{ color: '#4DB049' }} />
            <p className="text-xs leading-relaxed" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
              <strong style={{ color: '#4DB049' }}>Démo :</strong> Utilisez{' '}
              <code
                className="px-1.5 py-0.5 rounded text-xs"
                style={{ background: 'rgba(77,176,89,0.15)', color: '#014945' }}
              >
                techshop@watsim.cm
              </code>{' / '}<code
                className="px-1.5 py-0.5 rounded text-xs"
                style={{ background: 'rgba(77,176,89,0.15)', color: '#014945' }}
              >Merchant@123</code>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
              >
                Adresse e-mail
              </label>
              <div className="relative">
                <div
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center"
                >
                  <i className="ri-mail-line text-sm" style={{ color: '#9CA3AF' }} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="w-full pl-10 pr-4 py-3 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: '#F5FAF5',
                    border: '1px solid #E8F2F1',
                    color: '#1A2B1F',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#4DB049';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E8F2F1';
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  className="block text-sm font-medium"
                  style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
                >
                  Mot de passe
                </label>
                <button
                  type="button"
                  className="text-xs cursor-pointer transition-colors"
                  style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                  <i className="ri-lock-line text-sm" style={{ color: '#9CA3AF' }} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: '#F5FAF5',
                    border: '1px solid #E8F2F1',
                    color: '#1A2B1F',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#4DB049';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E8F2F1';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-pointer transition-colors"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#4DB049'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
                >
                  <i className={showPassword ? 'ri-eye-off-line text-sm' : 'ri-eye-line text-sm'} />
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRememberMe((v) => !v)}
                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 cursor-pointer transition-all"
                style={{
                  background: rememberMe ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#F5FAF5',
                  border: rememberMe ? 'none' : '1px solid #E8F2F1',
                }}
              >
                {rememberMe && <i className="ri-check-line text-xs" style={{ color: '#FFFFFF' }} />}
              </button>
              <span
                className="text-sm cursor-pointer select-none"
                style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}
                onClick={() => setRememberMe((v) => !v)}
              >
                Se souvenir de moi
              </span>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
              >
                <i className="ri-error-warning-line text-sm mt-0.5 flex-shrink-0" style={{ color: '#EF4444' }} />
                <p className="text-xs" style={{ color: '#DC2626', fontFamily: 'Poppins, sans-serif' }}>
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
                background: 'linear-gradient(135deg, #4DB049, #22C55E)',
                color: '#FFFFFF',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line text-base animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                <>
                  <i className="ri-login-box-line text-base" />
                  Se connecter
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: '#E8F2F1' }} />
            <span className="text-xs" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>
              ou
            </span>
            <div className="flex-1 h-px" style={{ background: '#E8F2F1' }} />
          </div>

          {/* Register CTA */}
          <p
            className="text-center text-sm"
            style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}
          >
            Pas encore partenaire ?{' '}
            <Link
              to="/#partner"
              className="font-medium cursor-pointer transition-colors"
              style={{ color: '#4DB049' }}
            >
              Devenir commercial
            </Link>
          </p>
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <Link
            to="/"
            className="text-xs cursor-pointer transition-colors"
            style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}
          >
            ← Retour à l'accueil
          </Link>
          <span style={{ color: '#E8F2F1' }}>|</span>
          <span
            className="text-xs"
            style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}
          >
            © 2025 WATSIM
          </span>
        </div>
      </div>
    </div>
  );
}
