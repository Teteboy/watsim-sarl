export default function TestimonialsSection() {
  const testimonials = [
    { id: 1, name: 'Aminata Diallo', role: 'Entrepreneure', text: 'WATSIM m’a permis de développer mon business sans stress financier.' },
    { id: 2, name: 'Jean-Pierre Mbala', role: 'Étudiant', text: 'Le crédit BNPL est simple et les taux sont très corrects.' },
    { id: 3, name: 'Fatou Ndiaye', role: 'Commerçante', text: 'Mes clients adorent pouvoir payer en plusieurs fois.' },
  ];
  return (
    <section id="testimonials" className="py-24" style={{ background: '#FAFEF9' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span
            className="inline-block text-xs uppercase tracking-widest px-4 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(77,176,89,0.12)', color: '#4DB049', fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(77,176,89,0.25)' }}
          >
            Témoignages
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
            Ils font confiance à WATSIM
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
            Des milliers de Camerounais utilisent WATSIM au quotidien pour leurs achats et leur gestion financière.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E8F2F1',
              }}
            >
              {/* Stars */}
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <i key={i} className="ri-star-fill text-sm" style={{ color: '#4DB049' }} />
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(10,36,32,0.7)', fontFamily: 'Poppins, sans-serif' }}>
                &ldquo;{t.text}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: '#4DB049', color: '#FFFFFF', fontFamily: 'Montserrat, sans-serif' }}>
                  {t.name.split(' ').map(n => n[0]).join('') || 'U'}
                </div>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                    {t.name}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(10,36,32,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                    {t.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
