import { categoryData } from '@/mocks/dashboard';

export default function CategoryChart() {
  const total = categoryData.reduce((sum, d) => sum + d.value, 0);

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
        background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
        border: '1px solid rgba(212,175,55,0.15)',
      }}
    >
      <div className="flex items-center gap-2 mb-5">
        <i className="ri-pie-chart-2-line text-lg" style={{ color: '#D4AF37' }} />
        <h3 className="text-white font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
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
            <span className="text-white font-bold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {total}%
            </span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
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
            <span className="text-sm flex-1 truncate" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>
              {d.label}
            </span>
            <span className="text-sm font-medium" style={{ color: '#D4AF37', fontFamily: 'Montserrat, sans-serif' }}>
              {d.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
