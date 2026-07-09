import { useEffect, useState } from 'react';
import MerchantLayout from '@/components/feature/MerchantLayout';
import Toast, { useToast } from '@/components/base/Toast';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { merchantApi } from '@/lib/api';
import { mapBnpl, type BackendBnplPurchase, type Paginated } from '@/lib/api-adapters';
import { cardStyle, inputStyle, labelStyle, headingStyle, tableHeaderStyle, tableRowStyle, statusBadgeStyle, tableRowHoverClass } from '@/styles/admin-theme';

type Order = any; // live data from merchantApi.orders (bnpl mapped)

function bnplToOrder(b: BackendBnplPurchase): Order {
  const ui = mapBnpl(b);
  const statusMap: Record<string, Order['status']> = {
    pending: 'pending', active: 'processing', overdue: 'processing', completed: 'completed',
  };
  return {
    id: b.id,
    customer: ui.user,
    phone: '',
    product: ui.product,
    quantity: 1,
    amount: ui.totalAmount,
    paymentMethod: 'BNPL',
    status: statusMap[ui.status] ?? 'pending',
    date: ui.startDate,
    deliveryDate: null,
    city: '',
  } as Order;
}

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  completed: { label: 'Livré', color: '#22C55E', icon: 'ri-checkbox-circle-line' },
  processing: { label: 'En cours', color: '#4DB049', icon: 'ri-loader-4-line' },
  shipped: { label: 'Expédié', color: '#4A9EFF', icon: 'ri-truck-line' },
  pending: { label: 'En attente', color: '#F97316', icon: 'ri-time-line' },
  cancelled: { label: 'Annulé', color: '#EF4444', icon: 'ri-close-circle-line' },
};

const paymentConfig: Record<string, { color: string; icon: string }> = {
  BNPL: { color: '#A855F7', icon: 'ri-bank-card-line' },
  Wallet: { color: '#22C55E', icon: 'ri-wallet-3-line' },
};

export default function MerchantOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    merchantApi.orders({ limit: 100 })
      .then((res) => {
        const data = res as Paginated<BackendBnplPurchase>;
        if (Array.isArray(data.items) && data.items.length > 0) {
          setOrders(data.items.map(bnplToOrder));
        }
      })
      .catch(() => null);
  }, []);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<Order | null>(null);
  const [showContributeModal, setShowContributeModal] = useState<Order | null>(null);
  const [contributeForm, setContributeForm] = useState({ amount: '', note: '' });
  const [contributeLoading, setContributeLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const tabs = [
    { key: 'all', label: 'Toutes', count: orders.length },
    { key: 'pending', label: 'En attente', count: orders.filter(o => o.status === 'pending').length },
    { key: 'processing', label: 'En cours', count: orders.filter(o => o.status === 'processing').length },
    { key: 'shipped', label: 'Expédiées', count: orders.filter(o => o.status === 'shipped').length },
    { key: 'completed', label: 'Livrées', count: orders.filter(o => o.status === 'completed').length },
    { key: 'cancelled', label: 'Annulées', count: orders.filter(o => o.status === 'cancelled').length },
  ];

  const filtered = orders.filter(o => {
    const matchSearch = o.id.toLowerCase().includes(search.toLowerCase()) || o.customer.toLowerCase().includes(search.toLowerCase()) || o.product.toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === 'all' || o.status === activeTab;
    return matchSearch && matchTab;
  });

  const updateStatus = (id: string, newStatus: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    const o = orders.find(x => x.id === id);
    const sc = statusConfig[newStatus];
    addToast('success', 'Statut mis à jour', `Commande ${o?.id} → ${sc.label}`);
    setSelectedOrder(null);
  };

  const confirmCancel = () => {
    if (!cancelConfirm) return;
    setOrders(prev => prev.map(o => o.id === cancelConfirm.id ? { ...o, status: 'cancelled' } : o));
    addToast('warning', 'Commande annulée', `La commande ${cancelConfirm.id} a été annulée.`);
    setCancelConfirm(null);
    setSelectedOrder(null);
  };

  const handleContributeToInstallment = async () => {
    if (!showContributeModal) return;
    const amount = Number(contributeForm.amount);
    if (!amount || amount === 0) {
      addToast('error', 'Montant invalide', 'Veuillez saisir un montant.');
      return;
    }
    setContributeLoading(true);
    try {
      // For BNPL orders, the order ID is the BNPL purchase ID
      // We need to get the actual installment ID from the backend
      const instalmentId = showContributeModal.id; // This should be the actual installment ID
      await merchantApi.contributeToInstallment(instalmentId, amount, contributeForm.note || undefined);
      addToast('success', 'Contribution effectuée', `${amount} FCFA ont été ajoutés à l'échéance.`);
      setShowContributeModal(null);
      setContributeForm({ amount: '', note: '' });
      // Reload the data
      merchantApi.orders({ limit: 100 })
        .then((res) => {
          const data = res as Paginated<BackendBnplPurchase>;
          if (Array.isArray(data.items) && data.items.length > 0) {
            setOrders(data.items.map(bnplToOrder));
          }
        })
        .catch(() => null);
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Opération échouée.');
    } finally {
      setContributeLoading(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['ID', 'Client', 'Produit', 'Montant', 'Paiement', 'Statut', 'Date'],
      ...filtered.map(o => [o.id, o.customer, o.product, o.amount, o.paymentMethod, o.status, o.date]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'commandes-watsim.csv';
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Export réussi', `${filtered.length} commandes exportées.`);
  };

  const totalRevenue = filtered.filter(o => o.status === 'completed').reduce((s, o) => s + o.amount, 0);
  const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

  return (
    <MerchantLayout breadcrumb={['Merchant', 'Commandes']}>
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total commandes', value: orders.length, icon: 'ri-file-list-3-line', color: '#4DB049' },
          { label: 'En attente', value: orders.filter(o => o.status === 'pending').length, icon: 'ri-time-line', color: '#F97316' },
          { label: 'Livrées', value: orders.filter(o => o.status === 'completed').length, icon: 'ri-checkbox-circle-line', color: '#22C55E' },
          { label: 'Revenus livrés', value: `${fmt(orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.amount, 0))} FCFA`, icon: 'ri-money-dollar-circle-line', color: '#A855F7' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={cardStyle}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <i className={`${s.icon} text-base`} style={{ color: s.color }} />
              </div>
              <div>
                <p className="font-bold text-lg text-watsim-primaryDark font-montserrat">{s.value}</p>
                <p className="text-xs text-watsim-textMuted font-poppins">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all font-poppins"
            style={{
              background: activeTab === tab.key ? 'rgba(77,176,89,0.15)' : '#F5FAF5',
              color: activeTab === tab.key ? '#4DB049' : '#6B7280',
              border: `1px solid ${activeTab === tab.key ? '#4DB049' : '#E8F2F1'}`,
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: activeTab === tab.key ? 'rgba(77,176,89,0.2)' : '#E8F2F1', color: activeTab === tab.key ? '#4DB049' : '#9CA3AF' }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div
        className="rounded-2xl p-4 mb-4 flex flex-col md:flex-row gap-3 items-start md:items-center"
        style={cardStyle}
      >
        <div className="relative flex-1 w-full">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par ID, client, produit..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none font-poppins"
            style={inputStyle}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-watsim-textMuted font-poppins">
            {filtered.length} commande{filtered.length > 1 ? 's' : ''} · {fmt(totalRevenue)} FCFA
          </span>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105 font-poppins"
            style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1' }}
          >
            <i className="ri-download-2-line" />
            Exporter
          </button>
        </div>
      </div>

      {/* Orders table */}
      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={tableHeaderStyle}>
                {['Commande', 'Client', 'Produit', 'Montant', 'Paiement', 'Ville', 'Date', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-wider text-watsim-primary font-poppins">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => {
                const sc = statusConfig[order.status];
                const pc = paymentConfig[order.paymentMethod];
                return (
                  <tr key={order.id} className={`transition-colors cursor-pointer ${tableRowHoverClass}`} style={tableRowStyle} onClick={() => setSelectedOrder(order)}>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-semibold text-watsim-primaryDark">{order.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-watsim-textPrimary font-poppins">{order.customer}</p>
                      <p className="text-xs text-gray-400 font-poppins">{order.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-watsim-textMuted font-poppins">{order.product}</td>
                    <td className="px-4 py-3 font-semibold text-sm text-watsim-primaryDark font-montserrat">
                      {order.amount.toLocaleString()} FCFA
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-poppins" style={{ color: pc.color }}>
                        <i className={`${pc.icon} text-xs`} />
                        {order.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-watsim-textMuted font-poppins">{order.city}</td>
                    <td className="px-4 py-3 text-sm text-watsim-textMuted font-poppins">{order.date}</td>
                    <td className="px-4 py-3">
                      <span
                        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full w-fit font-poppins"
                        style={statusBadgeStyle(sc.color)}
                      >
                        <i className={`${sc.icon} text-xs`} />
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {order.status === 'pending' && (
                          <button
                            onClick={() => updateStatus(order.id, 'processing')}
                            className="text-xs px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap transition-all hover:scale-105 font-poppins"
                            style={{ background: 'rgba(77,176,89,0.15)', color: '#4DB049' }}
                          >
                            Traiter
                          </button>
                        )}
                        {order.status === 'processing' && (
                          <button
                            onClick={() => updateStatus(order.id, 'shipped')}
                            className="text-xs px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap transition-all hover:scale-105"
                            style={{ background: 'rgba(74,158,255,0.15)', color: '#4A9EFF', fontFamily: 'Poppins, sans-serif' }}
                          >
                            Expédier
                          </button>
                        )}
                        {order.paymentMethod === 'BNPL' && (order.status === 'processing' || order.status === 'pending') && (
                          <button
                            onClick={() => { setShowContributeModal(order); setContributeForm({ amount: '', note: '' }); }}
                            className="text-xs px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap transition-all hover:scale-105 font-poppins"
                            style={{ background: 'rgba(77,176,89,0.15)', color: '#4DB049' }}
                            title="Contribuer à l'échéance"
                          >
                            <i className="ri-add-circle-line" />
                          </button>
                        )}
                        {order.status === 'shipped' && (
                          <button
                            onClick={() => updateStatus(order.id, 'completed')}
                            className="text-xs px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap transition-all hover:scale-105"
                            style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontFamily: 'Poppins, sans-serif' }}
                          >
                            Livré
                          </button>
                        )}
                        {(order.status === 'pending' || order.status === 'processing') && (
                          <button
                            onClick={() => setCancelConfirm(order)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors hover:bg-gray-100"
                            style={{ color: '#EF4444' }}
                          >
                            <i className="ri-close-line text-sm" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <i className="ri-file-list-3-line text-4xl mb-3 block" style={{ color: '#E8F2F1' }} />
            <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Aucune commande trouvée</p>
          </div>
        )}
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setSelectedOrder(null)}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Commande {selectedOrder.id}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>{selectedOrder.date}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer hover:bg-gray-100" style={{ color: '#6B7280' }}>
                <i className="ri-close-line" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Client', value: selectedOrder.customer },
                { label: 'Téléphone', value: selectedOrder.phone },
                { label: 'Produit', value: selectedOrder.product },
                { label: 'Quantité', value: `${selectedOrder.quantity}` },
                { label: 'Montant', value: `${selectedOrder.amount.toLocaleString()} FCFA` },
                { label: 'Paiement', value: selectedOrder.paymentMethod },
                { label: 'Ville', value: selectedOrder.city },
                { label: 'Livraison', value: selectedOrder.deliveryDate || 'Non définie' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
                  <p className="text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                  <p className="text-sm font-medium" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(77,176,89,0.08)', border: '1px solid rgba(77,176,89,0.15)' }}>
              <span className="text-sm" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Statut actuel</span>
              <span
                className="text-sm px-3 py-1 rounded-full font-medium"
                style={{ background: `${statusConfig[selectedOrder.status].color}15`, color: statusConfig[selectedOrder.status].color, fontFamily: 'Poppins, sans-serif' }}
              >
                {statusConfig[selectedOrder.status].label}
              </span>
            </div>

            <div className="flex gap-3 pt-1">
              {selectedOrder.status === 'pending' && (
                <button onClick={() => updateStatus(selectedOrder.id, 'processing')} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(77,176,89,0.15)', color: '#4DB049', border: '1px solid rgba(77,176,89,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                  Traiter la commande
                </button>
              )}
              {selectedOrder.status === 'processing' && (
                <button onClick={() => updateStatus(selectedOrder.id, 'shipped')} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(74,158,255,0.15)', color: '#4A9EFF', border: '1px solid rgba(74,158,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                  Marquer expédiée
                </button>
              )}
              {selectedOrder.status === 'shipped' && (
                <button onClick={() => updateStatus(selectedOrder.id, 'completed')} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                  Confirmer livraison
                </button>
              )}
              {(selectedOrder.status === 'pending' || selectedOrder.status === 'processing') && (
                <button onClick={() => setCancelConfirm(selectedOrder)} className="py-2.5 px-4 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)', fontFamily: 'Poppins, sans-serif' }}>
                  Annuler
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!cancelConfirm}
        title="Annuler la commande"
        message={`Annuler la commande ${cancelConfirm?.id} de ${cancelConfirm?.customer} ?`}
        confirmLabel="Annuler la commande"
        confirmColor="#EF4444"
        icon="ri-close-circle-line"
        onConfirm={confirmCancel}
        onCancel={() => setCancelConfirm(null)}
      />

      {/* Contribute to Installment Modal */}
      {showContributeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowContributeModal(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5" style={cardStyle} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Contribuer à l'échéance</h2>
              <button onClick={() => setShowContributeModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="p-3 rounded-xl" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
              <p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{showContributeModal.product}</p>
              <p className="text-sm font-medium mt-0.5" style={{ color: '#014945', fontFamily: 'Poppins, sans-serif' }}>{showContributeModal.customer}</p>
              <p className="text-xs mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Montant total: {showContributeModal.amount.toLocaleString()} FCFA</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Montant (FCFA)</label>
                <input
                  type="number"
                  value={contributeForm.amount}
                  onChange={e => setContributeForm({ ...contributeForm, amount: e.target.value })}
                  placeholder="Entrez le montant"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Note (optionnel)</label>
                <input
                  type="text"
                  value={contributeForm.note}
                  onChange={e => setContributeForm({ ...contributeForm, note: e.target.value })}
                  placeholder="Note de transaction"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowContributeModal(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}>
                Annuler
              </button>
              <button onClick={handleContributeToInstallment} disabled={contributeLoading} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#ffffff', fontFamily: 'Poppins, sans-serif' }}>
                {contributeLoading ? <><i className="ri-loader-4-line animate-spin mr-2" />Traitement…</> : <><i className="ri-check-line mr-2" />Confirmer</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </MerchantLayout>
  );
}
