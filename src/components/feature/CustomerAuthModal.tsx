import { useState, FormEvent } from 'react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'login' | 'register';
}

export default function CustomerAuthModal({ open, onClose, onSuccess, initialMode = 'login' }: Props) {
  const { login, register } = useCustomerAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const inputStyle = {
    background: '#FAFEF9',
    border: '1px solid #E8F2F1',
    color: '#014945',
    fontFamily: 'Poppins, sans-serif',
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = mode === 'login'
      ? await login(email.trim(), password)
      : await register({ email: email.trim(), phone: phone.trim(), password, fullName: fullName.trim() });
    setLoading(false);
    if (res.ok) {
      onSuccess?.();
      onClose();
    } else {
      setError(res.message ?? 'Une erreur est survenue');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
            {mode === 'login' ? 'Connexion Client' : 'Créer mon compte'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 cursor-pointer" style={{ color: 'rgba(10,36,32,0.5)' }}>
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        <div className="flex gap-2 p-1 rounded-lg" style={{ background: 'rgba(232,242,241,0.5)' }}>
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              className="flex-1 py-2 rounded-md text-sm font-medium transition-all cursor-pointer"
              style={{
                background: mode === m ? '#4DB049' : 'transparent',
                color: mode === m ? '#FFFFFF' : 'rgba(10,36,32,0.6)',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {m === 'login' ? 'Se connecter' : 'S\'inscrire'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <>
              <input type="text" required placeholder="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              <input type="tel" required placeholder="+237 6XX XX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
            </>
          )}
          <input type="email" required placeholder="votre@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
          <input type="password" required minLength={8} placeholder="Mot de passe (8 caractères min.)" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />

          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.2)' }}>
              <i className="ri-error-warning-line text-xs mt-0.5" style={{ color: '#E53935' }} />
              <p className="text-xs" style={{ color: '#E53935', fontFamily: 'Poppins, sans-serif' }}>{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full py-3 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60 transition-all" style={{ background: '#4DB049', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
            {loading ? 'Patientez...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>
      </div>
    </div>
  );
}
