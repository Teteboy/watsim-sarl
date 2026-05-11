import { useState } from 'react';
import { adminProducts } from '@/mocks/adminProducts';

export default function TopProductsCard() {
  const [activeTab, setActiveTab] = useState<'sold' | 'recent'>('sold');

  const topSold = [...adminProducts]
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  const topRecent = [...adminProducts]
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 5);

  const products = activeTab === 'sold' ? topSold : topRecent;

  const maxSold = Math.max(...topSold.map((p) => p.sold));

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
        border: '1px solid rgba(212,175,55,0.15)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3
          className="text-base font-semibold text-white"
          style={{ fontFamily: 'Montserrat, sans-serif' }}
        >
          Top Produits
        </h3>
        <div
          className="flex rounded-lg p-1"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <button
            onClick={() => setActiveTab('sold')}
            className="px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
            style={{
              background: activeTab === 'sold' ? 'rgba(212,175,55,0.2)' : 'transparent',
              color: activeTab === 'sold' ? '#D4AF37' : 'rgba(255,255,255,0.5)',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            Plus vendus
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className="px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
            style={{
              background: activeTab === 'recent' ? 'rgba(212,175,55,0.2)' : 'transparent',
              color: activeTab === 'recent' ? '#D4AF37' : 'rgba(255,255,255,0.5)',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            Récents
          </button>
        </div>
      </div>

      {/* Products List */}
      <div className="px-5 pb-5 space-y-3">
        {products.map((product, index) => (
          <div key={product.id} className="flex items-center gap-3">
            {/* Rank */}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: index < 3 ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
                color: index < 3 ? '#D4AF37' : 'rgba(255,255,255,0.4)',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {index + 1}
            </div>

            {/* Product Image */}
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {product.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                  {product.merchant}
                </span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                <span className="text-xs font-medium" style={{ color: '#D4AF37', fontFamily: 'Poppins, sans-serif' }}>
                  {product.price.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>

            {/* Sold Count / Progress */}
            {activeTab === 'sold' && (
              <div className="flex flex-col items-end gap-1 flex-shrink-0 w-24">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {product.sold}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                    vendus
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(product.sold / maxSold) * 100}%`,
                      background: index < 3
                        ? 'linear-gradient(90deg, #D4AF37, #F5D76E)'
                        : 'linear-gradient(90deg, rgba(212,175,55,0.5), rgba(245,215,110,0.5))',
                    }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'recent' && (
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: product.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: product.status === 'active' ? '#22C55E' : '#EF4444',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {product.status === 'active' ? 'Actif' : 'Rupture'}
                </span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                  Stock: {product.stock}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="px-5 py-3 border-t flex items-center justify-between"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
          {activeTab === 'sold' ? 'Basé sur les ventes totales' : 'Derniers produits ajoutés'}
        </span>
        <button
          className="text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          style={{ color: '#D4AF37', fontFamily: 'Poppins, sans-serif' }}
        >
          Voir tout <i className="ri-arrow-right-line ml-1" />
        </button>
      </div>
    </div>
  );
}