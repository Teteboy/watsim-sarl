import { testimonials } from '@/mocks/landing';

export default function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-24" style={{ background: '#050B16' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span
            className="inline-block text-xs uppercase tracking-widest px-4 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37', fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(212,175,55,0.25)' }}
          >
            Témoignages
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Ils font confiance à WATSIM
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
            Des milliers de Camerounais utilisent WATSIM au quotidien pour leurs achats et leur gestion financière.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
                border: '1px solid rgba(212,175,55,0.15)',
              }}
            >
              {/* Stars */}
              <div className="flex items-center gap-1 mb-4">
                {[...Array(t.rating)].map((_, i) => (
                  <i key={i} className="ri-star-fill text-sm" style={{ color: '#D4AF37' }} />
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>
                &ldquo;{t.text}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="w-11 h-11 rounded-full object-cover object-top flex-shrink-0"
                />
                <div>
                  <p className="text-white font-medium text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {t.name}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
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
