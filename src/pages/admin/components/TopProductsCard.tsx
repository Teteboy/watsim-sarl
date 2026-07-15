import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, tokenStore } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/utils';

export default function TopProductsCard() {
  const navigate = useNavigate();
  const [topSold, setTopSold] = useState<any[]>([]);
  const [topRecent, setTopRecent] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'sold' | 'recent'>('sold');
  const [loading, setLoading] = useState(true);

  // Fetch real data from backend
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!tokenStore?.access) {
        setTopSold([]);
        setTopRecent([]);
        setLoading(false);
        return;
      }
      try {
        const res = await adminApi.products({ page: 1, limit: 50 });
        const items = (res as any)?.items ?? (res as any)?.data ?? [];
        if (!mounted) return;

        // Map backend products to UI format
        const mapped = items.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price ?? 0,
          sold: p.sold ?? p._count?.purchases ?? 0,
          stock: p.stock ?? 0,
          status: p.isActive && p.stock > 0 ? 'active' : 'inactive',
          image: p.imageUrl || (Array.isArray(p.gallery) && p.gallery[0]) || '',
          gallery: Array.isArray(p.gallery) ? p.gallery : [],
          merchant: p.merchant?.businessName || 'WATSIM',
          createdAt: p.createdAt,
        }));

        // Top sold: sort by sold count descending
        const bySold = [...mapped].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 5);
        setTopSold(bySold);

        // Top recent: sort by createdAt descending
        const byRecent = [...mapped].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 5);
        setTopRecent(byRecent);
      } catch {
        if (!mounted) return;
        setTopSold([]);
        setTopRecent([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const products = activeTab === 'sold' ? topSold : topRecent;
  const maxSold = topSold.length ? Math.max(1, ...topSold.map((p) => p.sold || 0)) : 1;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8F2F1',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3
          className="text-base font-semibold"
          style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}
        >
          Top Produits
        </h3>
        <div
          className="flex rounded-lg p-1"
          style={{ background: '#F5FAF5' }}
        >
          <button
            onClick={() => setActiveTab('sold')}
            className="px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
            style={{
              background: activeTab === 'sold' ? 'rgba(77,176,89,0.15)' : 'transparent',
              color: activeTab === 'sold' ? '#4DB049' : '#6B7280',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            Plus vendus
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className="px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
            style={{
              background: activeTab === 'recent' ? 'rgba(77,176,89,0.15)' : 'transparent',
              color: activeTab === 'recent' ? '#4DB049' : '#6B7280',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            Récents
          </button>
        </div>
      </div>

      {/* Products List */}
      <div className="px-5 pb-5 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <i className="ri-loader-4-line animate-spin text-2xl" style={{ color: '#4DB049' }} />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8">
            <i className="ri-shopping-bag-3-line text-3xl" style={{ color: '#E8F2F1' }} />
            <p className="text-sm mt-2" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Aucun produit</p>
          </div>
        ) : (
          products.map((product, index) => (
          <div
            key={product.id}
            onClick={() => navigate(`/admin/products?productId=${product.id}`)}
            className="flex items-center gap-3 cursor-pointer rounded-lg -mx-2 px-2 py-1.5 transition-colors hover:bg-gray-50"
          >
            {/* Rank */}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: index < 3 ? 'rgba(77,176,89,0.15)' : '#F5FAF5',
                color: index < 3 ? '#4DB049' : '#9CA3AF',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {index + 1}
            </div>

            {/* Product Image */}
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: '#F5FAF5' }}>
              {product.image ? (
                <img
                  src={resolveUploadUrl(product.image) ?? ''}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <i className="ri-image-line text-base" style={{ color: '#9CA3AF' }} />
              )}
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                {product.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  {product.merchant}
                </span>
                <span className="text-xs" style={{ color: '#E8F2F1' }}>·</span>
                <span className="text-xs font-medium" style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>
                  {product.price.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>

            {/* Sold Count / Progress */}
            {activeTab === 'sold' && (
              <div className="flex flex-col items-end gap-1 flex-shrink-0 w-24">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                    {product.sold}
                  </span>
                  <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                    vendus
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#F5FAF5' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(product.sold / maxSold) * 100}%`,
                      background: index < 3
                        ? 'linear-gradient(90deg, #4DB049, #22C55E)'
                        : 'linear-gradient(90deg, rgba(77,176,89,0.5), rgba(34,197,94,0.5))',
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
                <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  Stock: {product.stock}
                </span>
              </div>
            )}
          </div>
        ))
        )}
      </div>

      {/* Footer */}
      <div
        className="px-5 py-3 border-t flex items-center justify-between"
        style={{ borderColor: '#F0F7F0' }}
      >
        <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
          {activeTab === 'sold' ? 'Basé sur les ventes totales' : 'Derniers produits ajoutés'}
        </span>
        <button
          onClick={() => navigate('/admin/products')}
          className="text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}
        >
          Voir tout <i className="ri-arrow-right-line ml-1" />
        </button>
      </div>
    </div>
  );
}