import { useState, useEffect } from 'react';
import { getTransactionChartData, tokenStore } from '@/lib/api';

const periods = ['7j', '30j', '12m'] as const;
type Period = typeof periods[number];

export default function TransactionChart() {
  const [activePeriod, setActivePeriod] = useState<Period>('12m');
  const [data, setData] = useState<{ month: string; transactions: number; revenue: number }[]>([]);

  useEffect(() => {
    // Do not call protected endpoint if not authenticated
    if (!tokenStore?.access) {
      setData([]);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const res = await getTransactionChartData();
        if (!mounted) return;
        setData((res as any)?.data ?? []);
      } catch {
        if (!mounted) return;
        setData([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (!data.length) {
    return (
      <div
        className="rounded-2xl p-6"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8F2F1',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
              Évolution des Transactions
            </h3>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
              Aucune donnée disponible
            </p>
          </div>
        </div>
      </div>
    );
  }

  const maxTx = Math.max(1, ...data.map((d) => d.transactions));
  const maxRev = Math.max(1, ...data.map((d) => d.revenue));
  const denom = Math.max(1, data.length - 1);

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8F2F1',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
            Évolution des Transactions
          </h3>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
            Transactions et revenus BNPL
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: '#F5FAF5' }}>
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
              style={{
                fontFamily: 'Poppins, sans-serif',
                background: activePeriod === p ? 'rgba(77,176,89,0.15)' : 'transparent',
                color: activePeriod === p ? '#4DB049' : '#6B7280',
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
          <div className="w-3 h-3 rounded-full" style={{ background: '#4DB049' }} />
          <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
            Transactions
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: '#4A9EFF' }} />
          <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
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
              stroke="#E8F2F1"
              strokeWidth="1"
            />
          ))}

          {/* Bars (revenue) */}
          {data.map((d, i) => {
            const barWidth = 40;
            const denom = Math.max(1, data.length - 1);
            const x = (i / denom) * 720 + 40 - barWidth / 2;
            const barH = Math.max(0, (d.revenue / maxRev) * 160);
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
                const denom = Math.max(1, data.length - 1);
                const x = (i / denom) * 720 + 40;
                const y = 200 - Math.max(0, (d.transactions / maxTx) * 180);
                return `${x},${y}`;
              })
              .join(' ')}
            fill="none"
            stroke="#4DB049"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots */}
          {data.map((d, i) => {
            const denom = Math.max(1, data.length - 1);
            const x = (i / denom) * 720 + 40;
            const y = 200 - Math.max(0, (d.transactions / maxTx) * 180);
            return (
              <circle key={`dot-${i}`} cx={x} cy={y} r="4" fill="#4DB049" stroke="#FFFFFF" strokeWidth="2" />
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
          {data.map((d) => (
            <span
              key={d.month}
              className="text-xs"
              style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}
            >
              {d.month}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
