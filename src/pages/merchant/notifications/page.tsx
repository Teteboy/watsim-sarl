import { useEffect, useState } from 'react';
import MerchantLayout from '@/components/feature/MerchantLayout';
import { merchantApi } from '@/lib/api';

export default function MerchantNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await merchantApi.getMerchantNotifications();
      setNotifications(res.data || res || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    try {
      await merchantApi.markNotificationRead(id);
      await load();
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await merchantApi.markAllNotificationsRead();
      await load();
    } catch { /* ignore */ }
  };

  const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1', borderRadius: '16px' };

  return (
    <MerchantLayout breadcrumb={['Merchant', 'Notifications']}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
              Mes Notifications
            </h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
              {notifications.filter(n => !n.isRead).length} non lue(s)
            </p>
          </div>
          {notifications.some((n) => !n.isRead) && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:opacity-80"
              style={{ background: '#F5FAF5', color: '#4DB049', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}
            >
              <i className="ri-check-double-line" />
              Tout marquer comme lu
            </button>
          )}
        </div>

        {loading ? (
          <div className="rounded-2xl p-8 flex items-center justify-center" style={cardStyle}>
            <div className="flex items-center gap-3" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
              <i className="ri-loader-4-line text-xl animate-spin" style={{ color: '#4DB049' }} />
              Chargement...
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={cardStyle}>
            <i className="ri-notification-off-line text-4xl mb-3 block" style={{ color: '#D1E8D1' }} />
            <p className="text-sm" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>Aucune notification pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="rounded-2xl p-5 flex justify-between items-start transition-all"
                style={{
                  background: n.isRead ? '#FFFFFF' : 'rgba(77,176,73,0.04)',
                  border: n.isRead ? '1px solid #E8F2F1' : '1px solid rgba(77,176,73,0.2)',
                  borderRadius: '16px',
                }}
              >
                <div className="flex items-start gap-4 flex-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: n.isRead ? '#F5FAF5' : 'rgba(77,176,73,0.12)' }}
                  >
                    <i className="ri-notification-3-line text-lg" style={{ color: n.isRead ? '#9CA3AF' : '#4DB049' }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{n.title}</span>
                      {!n.isRead && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(77,176,73,0.15)', color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>Nouveau</span>
                      )}
                    </div>
                    <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{n.body}</p>
                    <p className="text-xs mt-2" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>
                      <i className="ri-time-line mr-1" />
                      {new Date(n.createdAt).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
                {!n.isRead && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ml-4 flex-shrink-0 cursor-pointer transition-all hover:opacity-80"
                    style={{ background: '#F5FAF5', color: '#4DB049', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}
                  >
                    <i className="ri-check-line" />
                    Lu
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </MerchantLayout>
  );
}
