import { useState, useEffect } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import { adminApi } from '@/lib/api';

const priorityColors: Record<string, string> = { high: '#EF4444', medium: '#F97316', low: '#22C55E' };
const priorityLabels: Record<string, string> = { high: 'Haute', medium: 'Moyenne', low: 'Faible' };
const statusColors: Record<string, string> = { open: '#EF4444', in_progress: '#F97316', resolved: '#22C55E' };
const statusLabels: Record<string, string> = { open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu' };
const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };
const severityColors: Record<string, string> = { critical: '#EF4444', high: '#F97316', medium: '#4DB049', low: '#22C55E' };
const typeColors: Record<string, string> = { fraud: '#EF4444', dispute: '#F97316' };
const typeLabels: Record<string, string> = { fraud: 'Fraude', dispute: 'Litige' };

// Types
interface Dispute {
  id: string;
  type: 'fraud' | 'dispute';
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved';
  description: string;
  user: string;
  userId: string;
  createdAt: string;
  amount: number;
  assignedTo?: string | null;
}

interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'acknowledged' | 'resolved';
  message: string;
  time: string;
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'disputes' | 'fraud'>('disputes');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [assignModal, setAssignModal] = useState<Dispute | null>(null);
  const [assignAgent, setAssignAgent] = useState('');
  const { toasts, addToast, removeToast } = useToast();

  // Load disputes and fraud alerts from API
  useEffect(() => {
    const loadData = async () => {
      try {
        const [disputesData, alertsData] = await Promise.all([
          adminApi.disputes().catch(() => []),
          adminApi.fraudAlerts().catch(() => []),
        ]);
        setDisputes(disputesData || []);
        setAlerts(alertsData || []);
      } catch (err) {
        addToast('error', 'Erreur', 'Impossible de charger les données.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [addToast]);

  const agents = ['Agent Support 1', 'Agent Support 2', 'Agent Support 3', 'Agent Sécurité 1', 'Agent Sécurité 2'];

  const handleResolve = (dispute: Dispute) => {
    setDisputes(prev => prev.map(d => d.id === dispute.id ? { ...d, status: 'resolved' } : d));
    setSelectedDispute(null);
    addToast('success', 'Cas résolu', `Le litige ${dispute.id} a été marqué comme résolu.`);
  };

  const handleAssign = () => {
    if (!assignModal || !assignAgent) return;
    setDisputes(prev => prev.map(d => d.id === assignModal.id ? { ...d, assignedTo: assignAgent, status: 'in_progress' } : d));
    setAssignModal(null);
    setAssignAgent('');
    addToast('info', 'Cas assigné', `${assignModal.id} assigné à ${assignAgent}.`);
  };

  const handleAcknowledgeFraud = (alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'acknowledged' } : a));
    addToast('info', 'Alerte prise en compte', `L’alerte ${alertId} a été marquée comme prise en compte.`);
  };

  const filteredDisputes = disputes.filter((d) => {
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchStatus;
  });

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Système', 'Litiges & Fraude']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Litiges & Fraude</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Gestion des incidents de sécurité et litiges clients</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', fontFamily: 'Poppins, sans-serif' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#EF4444' }} />
              {disputes.filter(d => d.status === 'open').length} cas ouverts
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Cas Ouverts', value: disputes.filter(d => d.status === 'open').length, icon: 'ri-alert-line', color: '#EF4444' },
            { label: 'En Traitement', value: disputes.filter(d => d.status === 'in_progress').length, icon: 'ri-time-line', color: '#F97316' },
            { label: 'Résolus (30j)', value: disputes.filter(d => d.status === 'resolved').length, icon: 'ri-checkbox-circle-line', color: '#22C55E' },
            { label: 'Alertes Fraude', value: alerts.filter(a => a.status === 'active').length, icon: 'ri-shield-cross-line', color: '#4DB049' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3" style={cardStyle}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}20` }}>
                <i className={`${s.icon} text-lg`} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{s.value}</p>
                <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
          <button onClick={() => setActiveTab('disputes')} className="px-5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap" style={{ background: activeTab === 'disputes' ? 'linear-gradient(135deg, #4DB049, #22C55E)' : 'transparent', color: activeTab === 'disputes' ? '#FFFFFF' : '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
            <i className="ri-file-warning-line mr-2" />Litiges ({disputes.length})
          </button>
          <button onClick={() => setActiveTab('fraud')} className="px-5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap" style={{ background: activeTab === 'fraud' ? 'linear-gradient(135deg, #4DB049, #22C55E)' : 'transparent', color: activeTab === 'fraud' ? '#FFFFFF' : '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
            <i className="ri-shield-cross-line mr-2" />Alertes Fraude ({alerts.length})
          </button>
        </div>

        {activeTab === 'disputes' ? (
          <>
            {/* Dispute Filters */}
            <div className="flex flex-wrap gap-2">
              {[{ value: 'all', label: 'Tous' }, { value: 'open', label: 'Ouverts' }, { value: 'in_progress', label: 'En cours' }, { value: 'resolved', label: 'Résolus' }].map((tab) => (
                <button key={tab.value} onClick={() => setStatusFilter(tab.value)} className="px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap" style={{ background: statusFilter === tab.value ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#F5FAF5', color: statusFilter === tab.value ? '#FFFFFF' : '#6B7280', border: statusFilter === tab.value ? 'none' : '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Disputes List */}
            <div className="space-y-3">
              {filteredDisputes.map((dispute) => (
                <div key={dispute.id} className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.005]" style={{ ...cardStyle, border: `1px solid ${dispute.status === 'open' && dispute.priority === 'high' ? 'rgba(239,68,68,0.3)' : '#E8F2F1'}` }} onClick={() => setSelectedDispute(dispute)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${typeColors[dispute.type]}20` }}>
                        <i className={`${dispute.type === 'fraud' ? 'ri-shield-cross-line' : 'ri-file-warning-line'} text-lg`} style={{ color: typeColors[dispute.type] }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono" style={{ color: '#4DB049' }}>{dispute.id}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${typeColors[dispute.type]}20`, color: typeColors[dispute.type] }}>{typeLabels[dispute.type]}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${priorityColors[dispute.priority]}20`, color: priorityColors[dispute.priority] }}>Priorité {priorityLabels[dispute.priority]}</span>
                        </div>
                        <p className="text-sm text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{dispute.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                          <span><i className="ri-user-line mr-1" />{dispute.user}</span>
                          <span><i className="ri-time-line mr-1" />{dispute.createdAt}</span>
                          {dispute.assignedTo && <span><i className="ri-customer-service-2-line mr-1" />{dispute.assignedTo}</span>}
                          {dispute.amount > 0 && <span><i className="ri-money-cny-circle-line mr-1" />{dispute.amount.toLocaleString('fr-FR')} FCFA</span>}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0" style={{ background: `${statusColors[dispute.status]}20`, color: statusColors[dispute.status] }}>{statusLabels[dispute.status]}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Fraud Alerts */
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-2xl p-5" style={{ ...cardStyle, border: `1px solid ${alert.severity === 'critical' ? 'rgba(239,68,68,0.4)' : '#E8F2F1'}` }}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${severityColors[alert.severity]}20` }}>
                      <i className="ri-shield-cross-line text-lg" style={{ color: severityColors[alert.severity] }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono" style={{ color: '#4DB049' }}>{alert.id}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs uppercase font-medium" style={{ background: `${severityColors[alert.severity]}20`, color: severityColors[alert.severity] }}>{alert.severity}</span>
                        {alert.status === 'active' && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#EF4444' }} />}
                      </div>
                      <p className="text-sm text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{alert.message}</p>
                      <p className="text-xs mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Il y a {alert.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {alert.status === 'active' && (
                      <button onClick={() => handleAcknowledgeFraud(alert.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                        Traiter
                      </button>
                    )}
                    <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: alert.status === 'active' ? 'rgba(239,68,68,0.15)' : alert.status === 'acknowledged' ? 'rgba(249,115,22,0.15)' : 'rgba(34,197,94,0.15)', color: alert.status === 'active' ? '#EF4444' : alert.status === 'acknowledged' ? '#F97316' : '#22C55E' }}>
                      {alert.status === 'active' ? 'Actif' : alert.status === 'acknowledged' ? 'Pris en compte' : 'Résolu'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dispute Detail Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setSelectedDispute(null)}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-5" style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Détails du Cas</h2>
              <button onClick={() => setSelectedDispute(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${typeColors[selectedDispute.type]}20` }}>
                <i className={`${selectedDispute.type === 'fraud' ? 'ri-shield-cross-line' : 'ri-file-warning-line'} text-xl`} style={{ color: typeColors[selectedDispute.type] }} />
              </div>
              <div>
                <p className="font-semibold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>{selectedDispute.id}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${typeColors[selectedDispute.type]}20`, color: typeColors[selectedDispute.type] }}>{typeLabels[selectedDispute.type]}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${statusColors[selectedDispute.status]}20`, color: statusColors[selectedDispute.status] }}>{statusLabels[selectedDispute.status]}</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-4" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
              <p className="text-sm text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{selectedDispute.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Utilisateur', value: selectedDispute.user },
                { label: 'Priorité', value: priorityLabels[selectedDispute.priority] },
                { label: 'Montant concerné', value: selectedDispute.amount > 0 ? `${selectedDispute.amount.toLocaleString('fr-FR')} FCFA` : 'N/A' },
                { label: 'Assigné à', value: selectedDispute.assignedTo || 'Non assigné' },
                { label: 'Date de création', value: selectedDispute.createdAt },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                  <p className="text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                  <p className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              {selectedDispute.status !== 'resolved' && (
                <button onClick={() => handleResolve(selectedDispute)} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                  <i className="ri-checkbox-circle-line mr-2" />Marquer résolu
                </button>
              )}
              <button onClick={() => { setAssignModal(selectedDispute); setSelectedDispute(null); }} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-user-add-line mr-2" />Assigner
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Assign Agent Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setAssignModal(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5" style={cardStyle} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Assigner un Agent</h2>
              <button onClick={() => setAssignModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}><i className="ri-close-line text-lg" /></button>
            </div>
            <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Cas: <span style={{ color: '#4DB049' }}>{assignModal.id}</span></p>
            <div className="space-y-2">
              {agents.map(agent => (
                <button key={agent} onClick={() => setAssignAgent(agent)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all cursor-pointer" style={{ background: assignAgent === agent ? 'rgba(77,176,89,0.15)' : '#F5FAF5', border: `1px solid ${assignAgent === agent ? 'rgba(77,176,89,0.4)' : '#E8F2F1'}`, color: assignAgent === agent ? '#4DB049' : '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                  <i className="ri-customer-service-2-line" />{agent}
                  {assignAgent === agent && <i className="ri-checkbox-circle-fill ml-auto" style={{ color: '#4DB049' }} />}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAssignModal(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleAssign} disabled={!assignAgent} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-user-add-line mr-2" />Assigner
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </AdminLayout>
  );
}
