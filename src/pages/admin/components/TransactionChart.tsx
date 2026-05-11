import { useState } from 'react';
import { transactionChartData } from '@/mocks/dashboard';

const periods = ['7j', '30j', '12m'] as const;
type Period = typeof periods[number];

export default function TransactionChart() {
  const [activePeriod, setActivePeriod] = useState<Period>('12m');

  const data = transactionChartData;
  const maxTx = Math.max(...data.map((d) => d.transactions));
  const maxRev = Math.max(...data.map((d) => d.revenue));

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
        border: '1px solid rgba(212,175,55,0.15)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white font-semibold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Évolution des Transactions
          </h3>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
            Transactions et revenus BNPL
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
              style={{
                fontFamily: 'Poppins, sans-serif',
                background: activePeriod === p ? 'rgba(212,175,55,0.2)' : 'transparent',
                color: activePeriod === p ? '#D4AF37' : 'rgba(255,255,255,0.4)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: '#D4AF37' }} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
            Transactions
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: '#4A9EFF' }} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
            Revenus (M FCFA)
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-52">
        <svg viewBox="0 0 800 200" preserveAspectRatio="none" className="w-full h-full">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1="0"
              y1={i * 50}
              x2="800"
              y2={i * 50}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
          ))}

          {/* Bars (revenue) */}
          {data.map((d, i) => {
            const barWidth = 40;
            const x = (i / (data.length - 1)) * 720 + 40 - barWidth / 2;
            const barH = (d.revenue / maxRev) * 160;
            const y = 200 - barH;
            return (
              <rect
                key={`bar-${i}`}
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx="4"
                fill="rgba(74,158,255,0.25)"
              />
            );
          })}

          {/* Line (transactions) */}
          <polyline
            points={data
              .map((d, i) => {
                const x = (i / (data.length - 1)) * 720 + 40;
                const y = 200 - (d.transactions / maxTx) * 180;
                return `${x},${y}`;
              })
              .join(' ')}
            fill="none"
            stroke="#D4AF37"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots */}
          {data.map((d, i) => {
            const x = (i / (data.length - 1)) * 720 + 40;
            const y = 200 - (d.transactions / maxTx) * 180;
            return (
              <circle key={`dot-${i}`} cx={x} cy={y} r="4" fill="#D4AF37" stroke="#0D1B2A" strokeWidth="2" />
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
          {data.map((d) => (
            <span
              key={d.month}
              className="text-xs"
              style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}
            >
              {d.month}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
