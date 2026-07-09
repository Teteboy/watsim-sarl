import { useEffect, useState } from 'react';
import { getCategoryData, tokenStore } from '@/lib/api';

export default function CategoryChart() {
  const [categoryData, setCategoryData] = useState<{ label: string; value: number; color: string }[]>([]);

  useEffect(() => {
    if (!tokenStore?.access) {
      setCategoryData([]);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const res = await getCategoryData();
        if (!mounted) return;
        setCategoryData((res as any)?.data ?? []);
      } catch {
        if (!mounted) return;
        setCategoryData([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (!categoryData.length) {
    return (
      <div className="rounded-2xl p-6 h-full" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: '#014945', fontFamily: 'Poppins, sans-serif' }}>Répartition par Catégorie</h3>
        </div>
        <div className="flex items-center justify-center h-40 text-sm" style={{ color: '#9CA3AF' }}>Aucune donnée disponible</div>
      </div>
    );
  }

  const total = categoryData.reduce((sum, d) => sum + d.value, 0) || 1;

  // Build donut segments
  let cumulative = 0;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  const segments = categoryData.map((d) => {
    const offset = circumference - (d.value / total) * circumference;
    const rotation = (cumulative / total) * 360;
    cumulative += d.value;
    return { ...d, offset, rotation };
  });

  return (
    <div
      className="rounded-2xl p-6 h-full"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8F2F1',
      }}
    >
      <div className="flex items-center gap-2 mb-5">
        <i className="ri-pie-chart-2-line text-lg" style={{ color: '#4DB049' }} />
        <h3 className="font-semibold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
          Répartition par Catégorie
        </h3>
      </div>

      {/* Donut */}
      <div className="flex justify-center mb-5">
        <div className="relative w-36 h-36">
          <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
            {segments.map((seg, i) => (
              <circle
                key={i}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="20"
                strokeDasharray={`${circumference - seg.offset} ${seg.offset}`}
                strokeDashoffset={
                  -((cumulative - seg.value - (i > 0 ? categoryData.slice(0, i).reduce((s, d) => s + d.value, 0) : 0)) / total) * circumference
                }
                style={{
                  strokeDashoffset: -(
                    (categoryData.slice(0, i).reduce((s, d) => s + d.value, 0) / total) *
                    circumference
                  ),
                }}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-bold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
              {total}%
            </span>
            <span className="text-xs" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>
              Total
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2.5">
        {categoryData.map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span className="text-sm flex-1 truncate" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
              {d.label}
            </span>
            <span className="text-sm font-medium" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
              {d.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
