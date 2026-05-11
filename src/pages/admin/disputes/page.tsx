import { useState } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import { adminDisputes as initialDisputes, fraudAlerts as initialAlerts } from '@/mocks/adminDisputes';

const priorityColors: Record<string, string> = { high: '#EF4444', medium: '#F97316', low: '#22C55E' };
const priorityLabels: Record<string, string> = { high: 'Haute', medium: 'Moyenne', low: 'Faible' };
const statusColors: Record<string, string> = { open: '#EF4444', in_progress: '#F97316', resolved: '#22C55E' };
const statusLabels: Record<string, string> = { open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu' };
const severityColors: Record<string, string> = { critical: '#EF4444', high: '#F97316', medium: '#D4AF37', low: '#22C55E' };
const typeColors: Record<string, string> = { fraud: '#EF4444', dispute: '#F97316' };
const typeLabels: Record<string, string> = { fraud: 'Fraude', dispute: 'Litige' };

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState(initialDisputes);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [activeTab, setActiveTab] = useState<'disputes' | 'fraud'>('disputes');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDispute, setSelectedDispute] = useState<typeof initialDisputes[0] | null>(null);
  const [assignModal, setAssignModal] = useState<typeof initialDisputes[0] | null>(null);
  const [assignAgent, setAssignAgent] = useState('');
  const { toasts, addToast, removeToast } = useToast();

  const agents = ['Agent Support 1', 'Agent Support 2', 'Agent Support 3', 'Agent Sécurité 1', 'Agent Sécurité 2'];

  const handleResolve = (dispute: typeof initialDisputes[0]) => {
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
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Litiges & Fraude</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Gestion des incidents de sécurité et litiges clients</p>
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
            { label: 'Alertes Fraude', value: alerts.filter(a => a.status === 'active').length, icon: 'ri-shield-cross-line', color: '#D4AF37' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: '1px solid rgba(212,175,55,0.12)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}20` }}>
                <i className={`${s.icon} text-lg`} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xl font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>{s.value}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => setActiveTab('disputes')} className="px-5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap" style={{ background: activeTab === 'disputes' ? 'linear-gradient(135deg, #D4AF37, #F5D76E)' : 'transparent', color: activeTab === 'disputes' ? '#0A1628' : 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
            <i className="ri-file-warning-line mr-2" />Litiges ({disputes.length})
          </button>
          <button onClick={() => setActiveTab('fraud')} className="px-5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap" style={{ background: activeTab === 'fraud' ? 'linear-gradient(135deg, #D4AF37, #F5D76E)' : 'transparent', color: activeTab === 'fraud' ? '#0A1628' : 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>
            <i className="ri-shield-cross-line mr-2" />Alertes Fraude ({alerts.length})
          </button>
        </div>

        {activeTab === 'disputes' ? (
          <>
            {/* Dispute Filters */}
            <div className="flex flex-wrap gap-2">
              {[{ value: 'all', label: 'Tous' }, { value: 'open', label: 'Ouverts' }, { value: 'in_progress', label: 'En cours' }, { value: 'resolved', label: 'Résolus' }].map((tab) => (
                <button key={tab.value} onClick={() => setStatusFilter(tab.value)} className="px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap" style={{ background: statusFilter === tab.value ? 'linear-gradient(135deg, #D4AF37, #F5D76E)' : 'rgba(255,255,255,0.05)', color: statusFilter === tab.value ? '#0A1628' : 'rgba(255,255,255,0.6)', border: statusFilter === tab.value ? 'none' : '1px solid rgba(255,255,255,0.08)', fontFamily: 'Poppins, sans-serif' }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Disputes List */}
            <div className="space-y-3">
              {filteredDisputes.map((dispute) => (
                <div key={dispute.id} className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.005]" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: `1px solid ${dispute.status === 'open' && dispute.priority === 'high' ? 'rgba(239,68,68,0.3)' : 'rgba(212,175,55,0.12)'}` }} onClick={() => setSelectedDispute(dispute)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${typeColors[dispute.type]}20` }}>
                        <i className={`${dispute.type === 'fraud' ? 'ri-shield-cross-line' : 'ri-file-warning-line'} text-lg`} style={{ color: typeColors[dispute.type] }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono" style={{ color: '#D4AF37' }}>{dispute.id}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${typeColors[dispute.type]}20`, color: typeColors[dispute.type] }}>{typeLabels[dispute.type]}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${priorityColors[dispute.priority]}20`, color: priorityColors[dispute.priority] }}>Priorité {priorityLabels[dispute.priority]}</span>
                        </div>
                        <p className="text-sm text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{dispute.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
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
              <div key={alert.id} className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)', border: `1px solid ${alert.severity === 'critical' ? 'rgba(239,68,68,0.4)' : 'rgba(212,175,55,0.12)'}` }}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${severityColors[alert.severity]}20` }}>
                      <i className="ri-shield-cross-line text-lg" style={{ color: severityColors[alert.severity] }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono" style={{ color: '#D4AF37' }}>{alert.id}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs uppercase font-medium" style={{ background: `${severityColors[alert.severity]}20`, color: severityColors[alert.severity] }}>{alert.severity}</span>
                        {alert.status === 'active' && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#EF4444' }} />}
                      </div>
                      <p className="text-sm text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{alert.message}</p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Il y a {alert.time}</p>
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
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-5" style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Détails du Cas</h2>
              <button onClick={() => setSelectedDispute(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${typeColors[selectedDispute.type]}20` }}>
                <i className={`${selectedDispute.type === 'fraud' ? 'ri-shield-cross-line' : 'ri-file-warning-line'} text-xl`} style={{ color: typeColors[selectedDispute.type] }} />
              </div>
              <div>
                <p className="text-white font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>{selectedDispute.id}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${typeColors[selectedDispute.type]}20`, color: typeColors[selectedDispute.type] }}>{typeLabels[selectedDispute.type]}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${statusColors[selectedDispute.status]}20`, color: statusColors[selectedDispute.status] }}>{statusLabels[selectedDispute.status]}</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{selectedDispute.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Utilisateur', value: selectedDispute.user },
                { label: 'Priorité', value: priorityLabels[selectedDispute.priority] },
                { label: 'Montant concerné', value: selectedDispute.amount > 0 ? `${selectedDispute.amount.toLocaleString('fr-FR')} FCFA` : 'N/A' },
                { label: 'Assigné à', value: selectedDispute.assignedTo || 'Non assigné' },
                { label: 'Date de création', value: selectedDispute.createdAt },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                  <p className="text-sm font-medium text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              {selectedDispute.status !== 'resolved' && (
                <button onClick={() => handleResolve(selectedDispute)} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                  <i className="ri-checkbox-circle-line mr-2" />Marquer résolu
                </button>
              )}
              <button onClick={() => { setAssignModal(selectedDispute); setSelectedDispute(null); }} className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
                <i className="ri-user-add-line mr-2" />Assigner
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Assign Agent Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setAssignModal(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5" style={{ background: '#0D1B2A', border: '1px solid rgba(212,175,55,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Assigner un Agent</h2>
              <button onClick={() => setAssignModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)' }}><i className="ri-close-line text-lg" /></button>
            </div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>Cas: <span style={{ color: '#D4AF37' }}>{assignModal.id}</span></p>
            <div className="space-y-2">
              {agents.map(agent => (
                <button key={agent} onClick={() => setAssignAgent(agent)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all cursor-pointer" style={{ background: assignAgent === agent ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${assignAgent === agent ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.06)'}`, color: assignAgent === agent ? '#D4AF37' : 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>
                  <i className="ri-customer-service-2-line" />{agent}
                  {assignAgent === agent && <i className="ri-checkbox-circle-fill ml-auto" style={{ color: '#D4AF37' }} />}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAssignModal(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}>Annuler</button>
              <button onClick={handleAssign} disabled={!assignAgent} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5D76E)', color: '#0A1628', fontFamily: 'Poppins, sans-serif' }}>
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
