import { useState } from 'react';


export default function FaqSection() {
  const [openId, setOpenId] = useState<number | null>(1);

  const faqs = [
    { id: 1, q: 'Comment puis-je obtenir du crédit BNPL ?', a: 'Inscrivez-vous, complétez votre KYC et votre limite de crédit sera activée automatiquement.' },
    { id: 2, q: 'Quels sont les frais ?', a: 'Aucun frais caché. Les intérêts sont transparents et affichés avant chaque achat.' },
    { id: 3, q: 'Puis-je rembourser par anticipation ?', a: 'Oui, vous pouvez rembourser tout ou partie de votre crédit à tout moment sans pénalité.' },
  ];

  return (
    <section id="faq" className="py-24" style={{ background: '#FAFEF9' }}>
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-16">
          <span
            className="inline-block text-xs uppercase tracking-widest px-4 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(77,176,89,0.12)', color: '#4DB049', fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(77,176,89,0.25)' }}
          >
            FAQ
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
            Questions Fréquentes
          </h2>
          <p className="text-lg" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
            Tout ce que vous devez savoir sur WATSIM.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq) => (
            <div
              key={faq.id}
              className="rounded-2xl overflow-hidden transition-all duration-300"
              style={{
                background: '#FFFFFF',
                border: openId === faq.id ? '1px solid rgba(77,176,89,0.35)' : '1px solid #E8F2F1',
              }}
            >
              <button
                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer"
              >
                <span
                  className="font-medium text-sm md:text-base"
                  style={{ color: openId === faq.id ? '#4DB049' : 'rgba(10,36,32,0.85)', fontFamily: 'Poppins, sans-serif' }}
                >
                  {faq.q}
                </span>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ml-4 transition-all duration-300"
                  style={{
                    background: openId === faq.id ? 'rgba(77,176,89,0.2)' : 'rgba(232,242,241,0.5)',
                    transform: openId === faq.id ? 'rotate(45deg)' : 'rotate(0deg)',
                  }}
                >
                  <i className="ri-add-line text-sm" style={{ color: openId === faq.id ? '#4DB049' : 'rgba(10,36,32,0.4)' }} />
                </div>
              </button>
              {openId === faq.id && (
                <div className="px-6 pb-5">
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(10,36,32,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
