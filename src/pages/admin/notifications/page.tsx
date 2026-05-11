import { useState } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { adminNotifications as initialNotifications, notificationTargets, notificationTypes, notificationStatuses, notificationPriorities } from '@/mocks/adminNotifications';

type Notification = typeof initialNotifications[0];

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ notification: Notification; action: 'send' | 'delete' | 'pause' } | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  const [newNotification, setNewNotification] = useState({
    title: '',
    body: '',
    type: 'promotion',
    target: 'all',
    priority: 'normal',
    scheduledAt: '',
  });

  const filtered = notifications
    .filter((n) => {
      const matchSearch = n.title.toLowerCase().includes(search.toLowerCase()) || n.body.toLowerCase().includes(search.toLowerCase()) || n.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || n.status === statusFilter;
      const matchType = typeFilter === 'all' || n.type === typeFilter;
      return matchSearch && matchStatus && matchType;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      const priorityOrder = { urgent: 3, high: 2, normal: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

  const stats = {
    total: notifications.length,
    sent: notifications.filter((n) => n.status === 'sent').length,
    scheduled: notifications.filter((n) => n.status === 'scheduled').length,
    drafts: notifications.filter((n) => n.status === 'draft').length,
    totalSentCount: notifications.reduce((s, n) => s + n.sentCount, 0),
    totalReadCount: notifications.reduce((s, n) => s + n.readCount, 0),
  };

  const overallReadRate = stats.totalSentCount > 0 ? ((stats.totalReadCount / stats.totalSentCount) * 100).toFixed(1) : '0.0';

  const getStatusStyle = (status: string) => {
    const s = notificationStatuses.find((ns) => ns.value === status);
    return s || { color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', label: status };
  };

  const getTypeStyle = (type: string) => {
    const t = notificationTypes.find((nt) => nt.value === type);
    return t || { color: '#9CA3AF', icon: 'ri-notification-3-line', label: type };
  };

  const getPriorityColor = (priority: string) => {
    const p = notificationPriorities.find((np) => np.value === priority);
    return p?.color || '#4A9EFF';
  };

  const getTargetLabel = (target: string) => {
    const t = notificationTargets.find((nt) => nt.value === target);
    return t?.label || target;
  };

  const handleSendNow = () => {
    if (!confirmAction) return;
    const { notification, action } = confirmAction;
    if (action === 'send') {
      setNotifications((prev) => prev.map((n) => n.id === notification.id ? { ...n, status: 'sent' as const, sentAt: new Date().toISOString().replace('T', ' ').slice(0, 16), sentCount: n.audienceCount } : n));
      addToast('success', 'Notification envoyée', `"${notification.title}" a été envoyée à ${notification.audienceCount.toLocaleString('fr-FR')} utilisateurs.`);
    } else if (action === 'delete') {
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      addToast('info', 'Notification supprimée', `"${notification.title}" a été supprimée.`);
    } else if (action === 'pause') {
      setNotifications((prev) => prev.map((n) => n.id === notification.id ? { ...n, status: 'paused' as const } : n));
      addToast('warning', 'Notification en pause', `"${notification.title}" a été mise en pause.`);
    }
    setConfirmAction(null);
    setSelectedNotification(null);
  };

  const handleAddNotification = () => {
    if (!newNotification.title.trim() || !newNotification.body.trim()) {
      addToast('error', 'Champs requis', 'Veuillez remplir le titre et le contenu de la notification.');
      return;
    }
    const target = notificationTargets.find((t) => t.value === newNotification.target);
    const audienceCount = target ? Math.floor(Math.random() * 15000) + 500 : 0;
    const id = `NTF-${String(notifications.length + 1).padStart(3, '0')}`;
    const status = newNotification.scheduledAt ? 'scheduled' as const : 'draft' as const;
    const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const notification: Notification = {
      id,
      title: newNotification.title,
      body: newNotification.body,
      type: newNotification.type as Notification['type'],
      target: newNotification.target as Notification['target'],
      audienceCount,
      sentCount: 0,
      readCount: 0,
      status,
      scheduledAt: newNotification.scheduledAt || null,
      sentAt: null,
      createdAt,
      author: 'Super Admin',
      priority: newNotification.priority as Notification['priority'],
    };
    setNotifications((prev) => [notification, ...prev]);
    setShowAddModal(false);
    setNewNotification({ title: '', body: '', type: 'promotion', target: 'all', priority: 'normal', scheduledAt: '' });
    addToast('success', status === 'scheduled' ? 'Notification programmée' : 'Brouillon créé', `"${notification.title}" a été ${status === 'scheduled' ? 'programmée' : 'sauvegardée'}.`);
  };

  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'Poppins, sans-serif' };
  const selectStyle = { background: '#0A1628', color: '#FFFFFF' };

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Système', 'Notifications']}>
      <div className="space-y-6">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Gestion des Notifications
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
              Envoyer et suivre les notifications push et in-app
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
            style={{
              background: 'linear-gradient(135deg, #D4AF37, #F5D76E)',
              color: '#0A1628',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            <i className="ri-add-line" />
            Nouvelle notification
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            { label: 'Total', value: stats.total, icon: 'ri-notification-3-line', color: '#D4AF37' },
            { label: 'Envoyées', value: stats.sent, icon: 'ri-send-plane-line', color: '#22C55E' },
            { label: 'Programmées', value: stats.scheduled, icon: 'ri-calendar-check-line', color: '#F59E0B' },
            { label: 'Brouillons', value: stats.drafts, icon: 'ri-draft-line', color: '#6B7280' },
            { label: 'Messages envoyés', value: stats.totalSentCount.toLocaleString('fr-FR'), icon: 'ri-mail-send-line', color: '#4A9EFF' },
            { label: 'Taux de lecture', value: `${overallReadRate}%`, icon: 'ri-eye-line', color: '#A855F7' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{
                background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
                border: '1px solid rgba(212,175,55,0.15)',
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${stat.color}20` }}>
                <i className={`${stat.icon} text-lg`} style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>{stat.value}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <input
                type="text"
                placeholder="Rechercher une notification..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg text-sm outline-none w-64"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#FFFFFF',
                  fontFamily: 'Poppins, sans-serif',
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
            >
              <option value="all" style={selectStyle}>Tous les statuts</option>
              {notificationStatuses.map((s) => (
                <option key={s.value} value={s.value} style={selectStyle}>{s.label}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
            >
              <option value="all" style={selectStyle}>Tous les types</option>
              {notificationTypes.map((t) => (
                <option key={t.value} value={t.value} style={selectStyle}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            {(['newest', 'oldest', 'priority'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                style={{
                  background: sortBy === key ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
                  color: sortBy === key ? '#D4AF37' : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${sortBy === key ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {key === 'newest' ? 'Plus récent' : key === 'oldest' ? 'Plus ancien' : 'Priorité'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
            border: '1px solid rgba(212,175,55,0.15)',
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Notification', 'Type', 'Cible', 'Audience', 'Performance', 'Statut', 'Priorité', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => {
                  const statusStyle = getStatusStyle(n.status);
                  const typeStyle = getTypeStyle(n.type);
                  const priorityColor = getPriorityColor(n.priority);
                  const readRate = n.sentCount > 0 ? ((n.readCount / n.sentCount) * 100).toFixed(1) : '0.0';
                  return (
                    <tr
                      key={n.id}
                      className="transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      {/* Notification */}
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>
                            {n.title}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                            {n.id} · {n.author} · {n.createdAt}
                          </p>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 flex items-center justify-center">
                            <i className={`${typeStyle.icon} text-sm`} style={{ color: typeStyle.color }} />
                          </div>
                          <span className="text-sm text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                            {typeStyle.label}
                          </span>
                        </div>
                      </td>

                      {/* Cible */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          {getTargetLabel(n.target)}
                        </span>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                          {n.audienceCount.toLocaleString('fr-FR')} utilisateurs
                        </p>
                      </td>

                      {/* Audience */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                              {n.sentCount.toLocaleString('fr-FR')} / {n.audienceCount.toLocaleString('fr-FR')}
                            </span>
                            <span className="text-xs font-medium" style={{ color: '#D4AF37', fontFamily: 'Poppins, sans-serif' }}>
                              {n.sentCount > 0 ? `${((n.sentCount / n.audienceCount) * 100).toFixed(0)}%` : '—'}
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${n.audienceCount > 0 ? (n.sentCount / n.audienceCount) * 100 : 0}%`,
                                background: 'linear-gradient(90deg, #D4AF37, #F5D76E)',
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Performance */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <i className="ri-eye-line text-xs" style={{ color: 'rgba(255,255,255,0.4)' }} />
                            <span className="text-xs text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                              {n.readCount.toLocaleString('fr-FR')} lectures
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <i className="ri-percent-line text-xs" style={{ color: 'rgba(255,255,255,0.4)' }} />
                            <span className="text-xs font-medium" style={{ color: n.sentCount > 0 ? '#22C55E' : 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                              {n.sentCount > 0 ? `${readRate}%` : '—'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3">
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-medium inline-block whitespace-nowrap"
                          style={{
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            fontFamily: 'Poppins, sans-serif',
                          }}
                        >
                          {statusStyle.label}
                        </span>
                        {n.scheduledAt && (
                          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                            <i className="ri-calendar-line mr-1" />
                            {n.scheduledAt}
                          </p>
                        )}
                      </td>

                      {/* Priorité */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: priorityColor }} />
                          <span className="text-xs text-white capitalize" style={{ fontFamily: 'Poppins, sans-serif' }}>
                            {n.priority}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedNotification(n)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                            style={{ background: 'rgba(255,255,255,0.05)' }}
                            title="Voir le détail"
                          >
                            <i className="ri-eye-line text-sm" style={{ color: '#D4AF37' }} />
                          </button>
                          {n.status === 'draft' && (
                            <button
                              onClick={() => setConfirmAction({ notification: n, action: 'send' })}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                              style={{ background: 'rgba(34,197,94,0.12)' }}
                              title="Envoyer maintenant"
                            >
                              <i className="ri-send-plane-line text-sm" style={{ color: '#22C55E' }} />
                            </button>
                          )}
                          {n.status === 'scheduled' && (
                            <button
                              onClick={() => setConfirmAction({ notification: n, action: 'pause' })}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                              style={{ background: 'rgba(245,158,11,0.12)' }}
                              title="Mettre en pause"
                            >
                              <i className="ri-pause-circle-line text-sm" style={{ color: '#F59E0B' }} />
                            </button>
                          )}
                          {n.status === 'paused' && (
                            <button
                              onClick={() => setConfirmAction({ notification: n, action: 'send' })}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                              style={{ background: 'rgba(34,197,94,0.12)' }}
                              title="Réactiver et envoyer"
                            >
                              <i className="ri-play-circle-line text-sm" style={{ color: '#22C55E' }} />
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmAction({ notification: n, action: 'delete' })}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                            style={{ background: 'rgba(239,68,68,0.08)' }}
                            title="Supprimer"
                          >
                            <i className="ri-delete-bin-line text-sm" style={{ color: '#EF4444' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <i className="ri-notification-off-line text-4xl mb-3 block" style={{ color: 'rgba(255,255,255,0.15)' }} />
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                        Aucune notification trouvée
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedNotification && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setSelectedNotification(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6 space-y-5"
            style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Détails de la notification
              </h2>
              <button
                onClick={() => setSelectedNotification(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Titre</p>
                <p className="text-sm font-medium text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{selectedNotification.title}</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Contenu</p>
                <p className="text-sm text-white leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{selectedNotification.body}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Type', value: getTypeStyle(selectedNotification.type).label, icon: getTypeStyle(selectedNotification.type).icon, color: getTypeStyle(selectedNotification.type).color },
                  { label: 'Cible', value: getTargetLabel(selectedNotification.target), icon: 'ri-user-line', color: '#D4AF37' },
                  { label: 'Statut', value: getStatusStyle(selectedNotification.status).label, icon: 'ri-flag-line', color: getStatusStyle(selectedNotification.status).color },
                  { label: 'Priorité', value: selectedNotification.priority, icon: 'ri-speed-line', color: getPriorityColor(selectedNotification.priority) },
                  { label: 'Audience', value: `${selectedNotification.audienceCount.toLocaleString('fr-FR')} utilisateurs`, icon: 'ri-team-line', color: '#4A9EFF' },
                  { label: 'Créée le', value: selectedNotification.createdAt, icon: 'ri-calendar-line', color: '#6B7280' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <i className={`${item.icon} text-xs`} style={{ color: item.color }} />
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                    </div>
                    <p className="text-sm font-medium text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{item.value}</p>
                  </div>
                ))}
              </div>
              {selectedNotification.sentCount > 0 && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Performance d'envoi</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>{selectedNotification.sentCount.toLocaleString('fr-FR')}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Envoyés</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>{selectedNotification.readCount.toLocaleString('fr-FR')}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Lus</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold" style={{ color: '#22C55E', fontFamily: 'Montserrat, sans-serif' }}>
                        {((selectedNotification.readCount / selectedNotification.sentCount) * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Taux de lecture</p>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(selectedNotification.readCount / selectedNotification.sentCount) * 100}%`,
                        background: 'linear-gradient(90deg, #D4AF37, #F5D76E)',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedNotification(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
              >
                Fermer
              </button>
              {selectedNotification.status === 'draft' && (
                <button
                  onClick={() => { setSelectedNotification(null); setConfirmAction({ notification: selectedNotification, action: 'send' }); }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}
                >
                  <i className="ri-send-plane-line mr-2" />Envoyer maintenant
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Notification Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Nouvelle notification
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                  Titre *
                </label>
                <input
                  type="text"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={inputStyle}
                  placeholder="Ex: Offre spéciale du week-end"
                  maxLength={100}
                />
                <p className="text-xs mt-1 text-right" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                  {newNotification.title.length}/100
                </p>
              </div>

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                  Contenu *
                </label>
                <textarea
                  value={newNotification.body}
                  onChange={(e) => setNewNotification((prev) => ({ ...prev, body: e.target.value }))}
                  rows={4}
                  maxLength={500}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                  style={inputStyle}
                  placeholder="Décrivez le contenu de votre notification..."
                />
                <p className="text-xs mt-1 text-right" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                  {newNotification.body.length}/500
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Type</label>
                  <select
                    value={newNotification.type}
                    onChange={(e) => setNewNotification((prev) => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    {notificationTypes.map((t) => (
                      <option key={t.value} value={t.value} style={{ background: '#0A1628' }}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Priorité</label>
                  <select
                    value={newNotification.priority}
                    onChange={(e) => setNewNotification((prev) => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    {notificationPriorities.map((p) => (
                      <option key={p.value} value={p.value} style={{ background: '#0A1628' }}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Cible</label>
                <select
                  value={newNotification.target}
                  onChange={(e) => setNewNotification((prev) => ({ ...prev, target: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                  style={inputStyle}
                >
                  {notificationTargets.map((t) => (
                    <option key={t.value} value={t.value} style={{ background: '#0A1628' }}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
                  Programmation (optionnel)
                </label>
                <input
                  type="datetime-local"
                  value={newNotification.scheduledAt}
                  onChange={(e) => setNewNotification((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                  Laissez vide pour sauvegarder en brouillon
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}
              >
                Annuler
              </button>
              <button
                onClick={handleAddNotification}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}
              >
                <i className="ri-add-line mr-2" />
                {newNotification.scheduledAt ? 'Programmer' : 'Sauvegarder brouillon'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.action === 'send' ? 'Envoyer la notification' : confirmAction?.action === 'delete' ? 'Supprimer la notification' : 'Mettre en pause'}
        message={confirmAction?.action === 'send' ? `"${confirmAction?.notification.title}" sera envoyée à ${confirmAction?.notification.audienceCount.toLocaleString('fr-FR')} utilisateurs.` : confirmAction?.action === 'delete' ? `"${confirmAction?.notification.title}" sera définitivement supprimée.` : `"${confirmAction?.notification.title}" ne sera pas envoyée à l'heure prévue.`}
        confirmLabel={confirmAction?.action === 'send' ? 'Envoyer' : confirmAction?.action === 'delete' ? 'Supprimer' : 'Mettre en pause'}
        confirmColor={confirmAction?.action === 'send' ? '#22C55E' : confirmAction?.action === 'delete' ? '#EF4444' : '#F59E0B'}
        icon={confirmAction?.action === 'send' ? 'ri-send-plane-line' : confirmAction?.action === 'delete' ? 'ri-delete-bin-line' : 'ri-pause-circle-line'}
        onConfirm={handleSendNow}
        onCancel={() => setConfirmAction(null)}
      />

      <Toast toasts={toasts} onRemove={removeToast} />
    </AdminLayout>
  );
}