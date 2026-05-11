import { useState } from 'react';
import { recentAlerts } from '@/mocks/dashboard';

const alertStyles: Record<string, { border: string; icon: string; bg: string }> = {
  high: { border: '#EF4444', icon: 'text-red-400', bg: 'rgba(239,68,68,0.08)' },
  medium: { border: '#F97316', icon: 'text-orange-400', bg: 'rgba(249,115,22,0.08)' },
  low: { border: '#4A9EFF', icon: 'text-blue-400', bg: 'rgba(74,158,255,0.08)' },
};

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState(recentAlerts);

  const dismiss = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
        border: '1px solid rgba(212,175,55,0.15)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <i className="ri-alarm-warning-line text-lg" style={{ color: '#D4AF37' }} />
          <h3 className="text-white font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Alertes Système
          </h3>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontFamily: 'Poppins, sans-serif' }}
        >
          {alerts.filter((a) => a.type === 'high').length} critiques
        </span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <i className="ri-checkbox-circle-line text-3xl" style={{ color: '#22C55E' }} />
            <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
              Aucune alerte active
            </p>
          </div>
        ) : (
          alerts.map((alert) => {
            const style = alertStyles[alert.type];
            return (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-xl transition-all duration-200"
                style={{
                  background: style.bg,
                  borderLeft: `3px solid ${style.border}`,
                }}
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className={`${alert.icon} text-sm ${style.icon}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'Poppins, sans-serif' }}>
                    {alert.message}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                    {alert.time}
                  </p>
                </div>
                <button
                  onClick={() => dismiss(alert.id)}
                  className="w-5 h-5 flex items-center justify-center flex-shrink-0 rounded hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-xs" style={{ color: 'rgba(255,255,255,0.3)' }} />
                </button>
              </div>
            );
          })
        )}
      </div>

      <button
        className="w-full mt-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
        style={{
          background: 'rgba(212,175,55,0.08)',
          border: '1px solid rgba(212,175,55,0.2)',
          color: '#D4AF37',
          fontFamily: 'Poppins, sans-serif',
        }}
      >
        Voir toutes les alertes
      </button>
    </div>
  );
}
