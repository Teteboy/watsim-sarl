interface KpiCardProps {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: string;
  sparkline: number[];
}

export default function KpiCard({ label, value, trend, trendUp, icon, sparkline }: KpiCardProps) {
  const max = Math.max(...sparkline);
  const min = Math.min(...sparkline);
  const range = max - min || 1;

  const points = sparkline
    .map((v, i) => {
      const x = (i / (sparkline.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 80 - 10;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div
      className="relative rounded-2xl p-5 overflow-hidden transition-transform duration-200 hover:scale-[1.02] cursor-default"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8F2F1',
      }}
    >
      {/* Sparkline background */}
      <div className="absolute right-0 bottom-0 w-28 h-16 opacity-20">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <polyline
            points={points}
            fill="none"
            stroke="#4DB049"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
        style={{ background: 'rgba(77,176,89,0.15)' }}
      >
        <i className={`${icon} text-xl`} style={{ color: '#4DB049' }} />
      </div>

      {/* Label */}
      <p className="text-sm mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
        {label}
      </p>

      {/* Value */}
      <p className="text-2xl font-bold mb-2" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
        {value}
      </p>

      {/* Trend */}
      <div className="flex items-center gap-1">
        <i
          className={`${trendUp ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-sm`}
          style={{ color: trendUp ? '#22C55E' : '#EF4444' }}
        />
        <span
          className="text-xs font-medium"
          style={{ color: trendUp ? '#22C55E' : '#EF4444', fontFamily: 'Poppins, sans-serif' }}
        >
          {trend}
        </span>
        <span className="text-xs" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>
          vs mois dernier
        </span>
      </div>
    </div>
  );
}
