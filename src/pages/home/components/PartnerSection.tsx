export default function PartnerSection() {
  const partners = [
    { id: 1, name: 'Orange', logo: 'ri-smartphone-line' },
    { id: 2, name: 'MTN', logo: 'ri-wifi-line' },
    { id: 3, name: 'Jumia', logo: 'ri-shopping-bag-3-line' },
    { id: 4, name: 'Sahara', logo: 'ri-store-2-line' },
  ];
  return (
    <section className="py-16" style={{ background: '#FAFEF9', borderTop: '1px solid rgba(77,176,89,0.1)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-sm uppercase tracking-widest mb-10" style={{ color: 'rgba(10,36,32,0.4)', fontFamily: 'Poppins, sans-serif' }}>
          Nos Partenaires de Confiance
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-200 hover:scale-105 cursor-default"
              style={{ background: 'rgba(232,242,241,0.5)', border: '1px solid #E8F2F1' }}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <i className={`${partner.logo} text-lg`} style={{ color: 'rgba(10,36,32,0.4)' }} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                {partner.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
