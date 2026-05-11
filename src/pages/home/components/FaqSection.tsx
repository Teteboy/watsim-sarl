import { useState } from 'react';
import { faqs } from '@/mocks/landing';

export default function FaqSection() {
  const [openId, setOpenId] = useState<number | null>(1);

  return (
    <section id="faq" className="py-24" style={{ background: '#0A1628' }}>
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-16">
          <span
            className="inline-block text-xs uppercase tracking-widest px-4 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37', fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(212,175,55,0.25)' }}
          >
            FAQ
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Questions Fréquentes
          </h2>
          <p className="text-lg" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
            Tout ce que vous devez savoir sur WATSIM.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq) => (
            <div
              key={faq.id}
              className="rounded-2xl overflow-hidden transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
                border: openId === faq.id ? '1px solid rgba(212,175,55,0.35)' : '1px solid rgba(212,175,55,0.1)',
              }}
            >
              <button
                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer"
              >
                <span
                  className="font-medium text-sm md:text-base"
                  style={{ color: openId === faq.id ? '#D4AF37' : 'rgba(255,255,255,0.85)', fontFamily: 'Poppins, sans-serif' }}
                >
                  {faq.question}
                </span>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ml-4 transition-all duration-300"
                  style={{
                    background: openId === faq.id ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
                    transform: openId === faq.id ? 'rotate(45deg)' : 'rotate(0deg)',
                  }}
                >
                  <i className="ri-add-line text-sm" style={{ color: openId === faq.id ? '#D4AF37' : 'rgba(255,255,255,0.4)' }} />
                </div>
              </button>
              {openId === faq.id && (
                <div className="px-6 pb-5">
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Poppins, sans-serif' }}>
                    {faq.answer}
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
