import { useState, useEffect } from 'react';
import logoWhite from '@/assets/images/logo_white.png';
import { Link } from 'react-router-dom';
import CustomerAuthModal from '@/components/feature/CustomerAuthModal';
import { useCustomerAuth, getCustomerAuthState } from '@/hooks/useCustomerAuth';

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const { logout } = useCustomerAuth();
  const [authState, setAuthState] = useState(getCustomerAuthState);
  const refreshAuth = () => setAuthState(getCustomerAuthState());
  const handleLogout = async () => { await logout(); refreshAuth(); };
  const openAuth = (mode: 'login' | 'register') => { setAuthMode(mode); setAuthOpen(true); };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'Fonctionnalités', href: '#features' },
    { label: 'Comment ça marche', href: '#how-it-works' },
    { label: 'Témoignages', href: '#testimonials' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'py-3' : 'py-5'
      }`}
      style={{
        background: scrolled ? 'rgba(1,73,69,0.97)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(77,176,89,0.15)' : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden"
          >
            <img
              src={logoWhite}
              alt="WATSIM"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <span className="text-white font-bold text-xl tracking-wide" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            WATSIM
          </span>
        </a>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm transition-colors duration-200 hover:text-white"
              style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'Poppins, sans-serif' }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/admin"
            className="text-sm px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer whitespace-nowrap"
            style={{
              color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(77,176,89,0.2)',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            Espace Admin
          </Link>
          {authState.isAuthenticated ? (
            <>
              <span className="text-sm px-3 py-2" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-user-line mr-1" />{authState.fullName ?? authState.customerEmail}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm px-4 py-2 rounded-lg cursor-pointer whitespace-nowrap"
                style={{ color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(77,176,89,0.2)', fontFamily: 'Poppins, sans-serif' }}
              >
                Déconnexion
              </button>
            </>
          ) : (
            <button
              onClick={() => openAuth('login')}
              className="text-sm px-5 py-2 rounded-lg font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
              style={{ background: '#4DB049', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
            >
              <i className="ri-login-box-line mr-1" />Connexion / Inscription
            </button>
          )}
        </div>

        {/* Hamburger */}
        <button
          className="md:hidden text-white cursor-pointer"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <i className={`${menuOpen ? 'ri-close-line' : 'ri-menu-line'} text-2xl`} />
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div
          className="md:hidden mt-2 mx-4 rounded-2xl p-4 space-y-2"
          style={{ background: '#014945', border: '1px solid rgba(77,176,89,0.2)' }}
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2.5 rounded-lg text-sm transition-colors hover:bg-white/5"
              style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}
            >
              {link.label}
            </a>
          ))}
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
            <Link
              to="/admin"
              className="text-center text-sm px-4 py-2.5 rounded-lg"
              style={{ color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(77,176,89,0.2)', fontFamily: 'Poppins, sans-serif' }}
            >
              Espace Admin
            </Link>
            {authState.isAuthenticated ? (
              <button
                onClick={() => { handleLogout(); setMenuOpen(false); }}
                className="text-center text-sm px-4 py-2.5 rounded-lg"
                style={{ color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(77,176,89,0.2)', fontFamily: 'Poppins, sans-serif' }}
              >
                Déconnexion ({authState.fullName ?? authState.customerEmail})
              </button>
            ) : (
              <button
                onClick={() => { openAuth('login'); setMenuOpen(false); }}
                className="text-center text-sm px-4 py-2.5 rounded-lg font-medium cursor-pointer"
                style={{ background: '#4DB049', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
              >
                Connexion / Inscription
              </button>
            )}
          </div>
        </div>
      )}
      <CustomerAuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSuccess={refreshAuth} initialMode={authMode} />
    </nav>
  );
}
