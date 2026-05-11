import { partners } from '@/mocks/landing';

export default function PartnerSection() {
  return (
    <section className="py-16" style={{ background: '#050B16', borderTop: '1px solid rgba(212,175,55,0.1)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-sm uppercase tracking-widest mb-10" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
          Nos Partenaires de Confiance
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-200 hover:scale-105 cursor-default"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <i className={`${partner.logo} text-lg`} style={{ color: 'rgba(255,255,255,0.4)' }} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                {partner.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
