import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';

interface CashDeposit {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  userEmail?: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  originType?: 'MERCHANT' | 'ADMIN';
  originName?: string;
  metadata?: {
    note?: string;
    source?: string;
    merchantId?: string;
    adminId?: string;
    approvedAt?: string;
    rejectReason?: string;
    campayInitiatedAt?: string;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };
const inputStyle = { background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' };

export default function AdminCashDepositsPage() {
  const [deposits, setDeposits] = useState<CashDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [status, setStatus] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approvalForm, setApprovalForm] = useState({ provider: '', phone: '' });
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { toasts, addToast, removeToast } = useToast();
  const limit = 20;

  const loadDeposits = useCallback(async () => {
    try {
      setLoading(true);
      const result = await adminApi.cashDeposits({ page, limit, status: status || undefined });
      setDeposits(result.deposits || []);
      setPagination(result.pagination || null);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void loadDeposits();
  }, [loadDeposits]);

  const approve = async () => {
    if (!approveId) return;
    const provider = approvalForm.provider as 'ORANGE_MONEY' | 'MTN_MOMO' | undefined;
    const phone = approvalForm.phone.trim();
    if (!provider || !phone) {
      addToast('error', 'Informations manquantes', 'Choisissez un opérateur CamPay et saisissez un numéro.');
      return;
    }
    try {
      setProcessing(approveId);
      const result = await adminApi.approveCashDeposit(approveId, provider, phone);
      setApproveId(null);
      setApprovalForm({ provider: '', phone: '' });
      addToast('success', 'CamPay initié', `Le wallet sera crédité après confirmation.${result.ussdCode ? ` Code USSD : ${result.ussdCode}` : ''}`);
      await loadDeposits();
    } catch (error: any) {
      addToast('error', 'Échec', error?.message || 'Impossible d’initier le paiement CamPay.');
    } finally {
      setProcessing(null);
    }
  };

  const reject = async () => {
    if (!rejectId) return;
    try {
      setProcessing(rejectId);
      await adminApi.rejectCashDeposit(rejectId, rejectReason || undefined);
      setRejectId(null);
      setRejectReason('');
      addToast('success', 'Dépôt rejeté', 'Le wallet du client n’a pas été crédité.');
      await loadDeposits();
    } catch (error: any) {
      addToast('error', 'Échec', error?.message || 'Impossible de rejeter ce dépôt.');
    } finally {
      setProcessing(null);
    }
  };

  const filtered = search.trim()
    ? deposits.filter(deposit => [deposit.userName, deposit.userPhone, deposit.userEmail, deposit.metadata?.note].some(value => value?.toLowerCase().includes(search.toLowerCase())))
    : deposits;
  const formatAmount = (amount: number) => `${amount.toLocaleString('fr-FR')} FCFA`;
  const formatDate = (date: string) => new Date(date).toLocaleString('fr-FR');
  const statusStyle = (value: CashDeposit['status']) => value === 'PENDING'
    ? { background: 'rgba(245,158,11,0.1)', color: '#D97706' }
    : value === 'COMPLETED'
      ? { background: 'rgba(34,197,94,0.1)', color: '#16A34A' }
      : { background: 'rgba(239,68,68,0.1)', color: '#DC2626' };
  const statusLabel = (value: CashDeposit['status']) => value === 'PENDING' ? 'En attente' : value === 'COMPLETED' ? 'Approuvé' : 'Rejeté';

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Finance', 'Dépôts Cash']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Dépôts Cash</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>Validez les espèces reçues avant de créditer le wallet du client.</p>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'En attente', value: deposits.filter(deposit => deposit.status === 'PENDING').length, icon: 'ri-time-line', color: '#D97706', bg: 'rgba(245,158,11,0.1)' },
            { label: 'Approuvés', value: deposits.filter(deposit => deposit.status === 'COMPLETED').length, icon: 'ri-checkbox-circle-line', color: '#16A34A', bg: 'rgba(34,197,94,0.1)' },
            { label: 'Rejetés', value: deposits.filter(deposit => deposit.status === 'FAILED').length, icon: 'ri-close-circle-line', color: '#DC2626', bg: 'rgba(239,68,68,0.1)' },
            { label: 'Montant affiché', value: formatAmount(deposits.reduce((sum, deposit) => sum + deposit.amount, 0)), icon: 'ri-money-dollar-circle-line', color: '#4DB049', bg: 'rgba(77,176,89,0.1)' },
          ].map(item => <div key={item.label} className="rounded-2xl p-4 flex items-center gap-4" style={cardStyle}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: item.bg }}><i className={`${item.icon} text-xl`} style={{ color: item.color }} /></div>
            <div><p className="text-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p><p className="text-lg font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>{item.value}</p></div>
          </div>)}
        </div>

        <div className="rounded-2xl p-4 flex flex-col sm:flex-row gap-3" style={cardStyle}>
          <div className="flex-1 relative"><i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#9CA3AF' }} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher par client, téléphone ou note..." className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} /></div>
          <select value={status} onChange={event => { setPage(1); setStatus(event.target.value); }} className="px-4 py-2.5 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
            <option value="">Tous les statuts</option><option value="PENDING">En attente</option><option value="COMPLETED">Approuvés</option><option value="FAILED">Rejetés</option>
          </select>
        </div>

        <div className="rounded-2xl overflow-hidden" style={cardStyle}><div className="overflow-x-auto"><table className="w-full"><thead><tr style={{ borderBottom: '1px solid #E8F2F1' }}>{['Client', 'Montant', 'Origine', 'Statut', 'Date', 'Actions'].map(label => <th key={label} className="px-5 py-3.5 text-left text-xs font-semibold" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif', background: '#F5FAF5' }}>{label}</th>)}</tr></thead><tbody>
          {loading ? <tr><td colSpan={6} className="py-16 text-center"><i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#4DB049' }} /></td></tr>
            : filtered.length === 0 ? <tr><td colSpan={6} className="py-16 text-center"><i className="ri-inbox-line text-3xl" style={{ color: '#9CA3AF' }} /><p className="mt-2 text-sm" style={{ color: '#6B7280' }}>Aucun dépôt cash trouvé</p></td></tr>
              : filtered.map(deposit => <tr key={deposit.id} style={{ borderBottom: '1px solid #F0F7F0' }}>
                <td className="px-5 py-4"><p className="text-sm font-medium" style={{ color: '#1A2B1F' }}>{deposit.userName || 'Inconnu'}</p><p className="text-xs" style={{ color: '#6B7280' }}>{deposit.userPhone || deposit.userEmail || '—'}</p></td>
                <td className="px-5 py-4"><p className="text-sm font-bold" style={{ color: '#014945' }}>{formatAmount(deposit.amount)}</p><p className="text-xs" style={{ color: '#6B7280' }}>{deposit.metadata?.note || 'Aucune note'}</p></td>
                <td className="px-5 py-4"><p className="text-xs font-medium" style={{ color: '#1A2B1F' }}>{deposit.originName || (deposit.originType === 'MERCHANT' ? 'Commerçant' : 'Administrateur')}</p><p className="text-xs" style={{ color: '#6B7280' }}>{deposit.originType === 'MERCHANT' ? 'Commerçant' : 'Administrateur'}</p></td>
                <td className="px-5 py-4"><span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium" style={statusStyle(deposit.status)}>{statusLabel(deposit.status)}</span></td>
                <td className="px-5 py-4"><p className="text-sm" style={{ color: '#1A2B1F' }}>{formatDate(deposit.createdAt)}</p></td>
                <td className="px-5 py-4">{deposit.status === 'PENDING' ? deposit.metadata?.campayInitiatedAt ? <span className="text-xs" style={{ color: '#D97706' }}>CamPay en attente</span> : <div className="flex gap-2"><button onClick={() => setApproveId(deposit.id)} disabled={processing === deposit.id} className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF' }}>{processing === deposit.id ? '...' : 'Valider via CamPay'}</button><button onClick={() => setRejectId(deposit.id)} disabled={processing === deposit.id} className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50" style={{ background: 'rgba(239,68,68,0.1)', color: '#DC2626' }}>Rejeter</button></div> : <span className="text-xs" style={{ color: deposit.status === 'COMPLETED' ? '#16A34A' : '#DC2626' }}>{deposit.status === 'COMPLETED' ? 'Wallet crédité' : deposit.metadata?.rejectReason || 'Rejeté'}</span>}</td>
              </tr>)}
        </tbody></table></div>
          {pagination && pagination.totalPages > 1 && <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid #E8F2F1' }}><p className="text-xs" style={{ color: '#6B7280' }}>Page {page} / {pagination.totalPages}</p><div className="flex gap-2"><button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40" style={inputStyle}>Précédent</button><button onClick={() => setPage(value => Math.min(pagination.totalPages, value + 1))} disabled={page >= pagination.totalPages} className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40" style={inputStyle}>Suivant</button></div></div>}
        </div>
      </div>

      {approveId && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}><div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={cardStyle}><h2 className="text-lg font-bold" style={{ color: '#014945' }}>Valider le dépôt via CamPay</h2><p className="text-sm" style={{ color: '#6B7280' }}>Une collecte CamPay doit être confirmée avant le crédit du wallet.</p><select value={approvalForm.provider} onChange={event => setApprovalForm(form => ({ ...form, provider: event.target.value }))} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}><option value="">Choisir un opérateur...</option><option value="ORANGE_MONEY">Orange Money</option><option value="MTN_MOMO">MTN MoMo</option></select><input value={approvalForm.phone} onChange={event => setApprovalForm(form => ({ ...form, phone: event.target.value }))} placeholder="Numéro mobile-money" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /><div className="flex gap-3"><button onClick={() => { setApproveId(null); setApprovalForm({ provider: '', phone: '' }); }} className="flex-1 py-2.5 rounded-lg text-sm" style={inputStyle}>Annuler</button><button onClick={approve} disabled={processing === approveId} className="flex-1 py-2.5 rounded-lg text-sm disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #4DB049, #22C55E)', color: '#FFFFFF' }}>Initier CamPay</button></div></div></div>}
      {rejectId && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}><div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={cardStyle}><h2 className="text-lg font-bold" style={{ color: '#014945' }}>Rejeter le dépôt cash</h2><textarea value={rejectReason} onChange={event => setRejectReason(event.target.value)} placeholder="Motif du rejet (optionnel)" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} rows={3} /><div className="flex gap-3"><button onClick={() => { setRejectId(null); setRejectReason(''); }} className="flex-1 py-2.5 rounded-lg text-sm" style={inputStyle}>Annuler</button><button onClick={reject} disabled={processing === rejectId} className="flex-1 py-2.5 rounded-lg text-sm disabled:opacity-50" style={{ background: '#DC2626', color: '#FFFFFF' }}>Rejeter</button></div></div></div>}
      <Toast toasts={toasts} onRemove={removeToast} />
    </AdminLayout>
  );
}
