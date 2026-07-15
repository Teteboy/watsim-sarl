import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, tokenStore } from '@/lib/api';
import { mapMerchant, type BackendMerchant, type Paginated, type UiAdminMerchant } from '@/lib/api-adapters';

const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Actif', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  pending: { label: 'En attente', color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  suspended: { label: 'Suspendu', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

export default function RecentMerchantsCard() {
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState<UiAdminMerchant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const access = tokenStore.access;
        if (!access) return setMerchants([]);
        const res = await adminApi.merchants({ page: 1, limit: 5 });
        if (!mounted) return;
        const items = Array.isArray((res as any).items) ? (res as any).items.map(mapMerchant) : [];
        setMerchants(items);
      } catch {
        setMerchants([]);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F0F7F0' }}>
        <h3 className="font-semibold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Commerçants Récents</h3>
        <button
          onClick={() => navigate('/admin/merchants')}
          className="text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}
        >
          Gérer <i className="ri-arrow-right-line ml-1" />
        </button>
      </div>

      <div className="px-5 pb-5 space-y-3 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <i className="ri-loader-4-line animate-spin text-2xl" style={{ color: '#4DB049' }} />
          </div>
        ) : merchants.length === 0 ? (
          <div className="text-center py-8">
            <i className="ri-store-2-line text-3xl" style={{ color: '#E8F2F1' }} />
            <p className="text-sm mt-2" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Aucun commerçant</p>
          </div>
        ) : (
          merchants.map((m, index) => {
            const badge = statusBadge[m.status] ?? statusBadge.pending;
            return (
              <div
                key={m.id}
                onClick={() => navigate(`/admin/merchants?merchantId=${m.id}`)}
                className="flex items-center gap-3 cursor-pointer rounded-lg -mx-2 px-2 py-1.5 transition-colors hover:bg-gray-50"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: index < 3 ? 'rgba(77,176,89,0.15)' : '#F5FAF5', color: index < 3 ? '#4DB049' : '#9CA3AF', fontFamily: 'Montserrat, sans-serif' }}
                >
                  {index + 1}
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(77,176,89,0.15)' }}>
                  <i className="ri-store-2-line text-lg" style={{ color: '#4DB049' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{m.name}</p>
                  <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{m.city} · {m.category}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: badge.bg, color: badge.color, fontFamily: 'Poppins, sans-serif' }}
                  >
                    {badge.label}
                  </span>
                  <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{m.owner}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
