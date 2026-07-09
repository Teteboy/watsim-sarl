import { useEffect, useState } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import { accountingApi, type JournalEntryRow, type TrialBalanceRow } from '@/lib/api';

type Tab = 'trial' | 'journal' | 'income' | 'balance' | 'payouts';

const fmt = (n: number) => `${(n ?? 0).toLocaleString('fr-FR')} FCFA`;

const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };

export default function AdminAccountingPage() {
  const [tab, setTab] = useState<Tab>('trial');
  const [trial, setTrial] = useState<{ rows: TrialBalanceRow[]; totals: { debit: number; credit: number } } | null>(null);
  const [journal, setJournal] = useState<JournalEntryRow[]>([]);
  const [income, setIncome] = useState<Awaited<ReturnType<typeof accountingApi.incomeStatement>> | null>(null);
  const [balance, setBalance] = useState<Awaited<ReturnType<typeof accountingApi.balanceSheet>> | null>(null);
  const [journalPage, setJournalPage] = useState(1);
  const [journalTotal, setJournalTotal] = useState(0);
  const journalLimit = 20;
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const loadJournal = async (p: number) => {
    const res = await accountingApi.journal(p, journalLimit).catch(() => ({ items: [], total: 0 }));
    setJournal(res.items || []);
    setJournalTotal(res.total || 0);
    setJournalPage(p);
  };

  const exportCurrentTab = () => {
    let csv = '';
    let filename = 'watsim_comptabilite.csv';

    if (tab === 'journal' && journal.length > 0) {
      const headers = ['ID', 'Référence', 'Description', 'Date', 'Compte', 'Débit', 'Crédit', 'Mémo'];
      const rows = journal.flatMap(e => e.lines.map(l => [
        e.id, e.reference, e.description, new Date(e.postedAt).toISOString(), l.accountCode, l.debit, l.credit, l.memo || ''
      ]));
      csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      filename = 'journal.csv';
    } else if (tab === 'trial' && trial) {
      const headers = ['Code', 'Nom', 'Type', 'Débit', 'Crédit', 'Solde'];
      const rows = trial.rows.map(r => [r.code, r.name, r.type, r.debit, r.credit, r.balance]);
      csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      filename = 'balance_generale.csv';
    } else if (tab === 'income' && income) {
      const headers = ['Code', 'Nom', 'Solde'];
      const rows = [...income.income, ...income.expense].map(r => [r.code, r.name, r.balance]);
      csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      filename = 'compte_resultat.csv';
    } else if (tab === 'balance' && balance) {
      const headers = ['Code', 'Nom', 'Type', 'Solde'];
      const rows = [...balance.assets, ...balance.liabilities, ...balance.equity].map(r => [r.code, r.name, r.type, r.balance]);
      csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      filename = 'bilan.csv';
    }

    if (csv) {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'Export', `${filename} généré.`);
    } else {
      addToast('info', 'Export', 'Aucune donnée à exporter pour cet onglet.');
    }
  };

  useEffect(() => {
    if (tab === 'journal' && journal.length === 0) {
      loadJournal(1);
    }
    if (tab === 'payouts' && payoutRequests.length === 0) {
      accountingApi.listPayoutRequests({ limit: 50 }).then(res => {
        setPayoutRequests(res.items || []);
      }).catch(() => {});
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    Promise.all([
      accountingApi.trialBalance().catch(() => null),
      accountingApi.incomeStatement().catch(() => null),
      accountingApi.balanceSheet().catch(() => null),
    ])
      .then(([t, i, b]) => {
        if (cancelled) return;
        if (t) setTrial(t);
        if (i) setIncome(i);
        if (b) setBalance(b);
        // Journal loaded lazily when tab is opened
      })
      .catch(() => {
        if (cancelled) return;
        addToast('error', 'Erreur', 'Impossible de charger la comptabilité.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'trial', label: 'Balance générale', icon: 'ri-scales-3-line' },
    { key: 'journal', label: 'Journal', icon: 'ri-file-list-3-line' },
    { key: 'income', label: 'Compte de résultat', icon: 'ri-line-chart-line' },
    { key: 'balance', label: 'Bilan', icon: 'ri-building-line' },
    { key: 'payouts', label: 'Virements Marchands', icon: 'ri-bank-line' },
  ];

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Finance', 'Comptabilité OHADA']}>
      <Toast toasts={toasts} onRemove={removeToast} />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Comptabilité OHADA</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
            Plan SYSCOHADA-Révisé · Journal · Balance · États financiers
          </p>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
              style={{
                background: tab === t.key ? 'linear-gradient(135deg, #4DB049, #22C55E)' : '#F5FAF5',
                color: tab === t.key ? '#FFFFFF' : '#6B7280',
                border: `1px solid ${tab === t.key ? 'transparent' : '#E8F2F1'}`,
                fontFamily: 'Poppins, sans-serif',
              }}>
              <i className={t.icon} /> {t.label}
            </button>
          ))}
          <button onClick={exportCurrentTab} className="ml-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap flex items-center gap-1" style={{ background: '#F5FAF5', color: '#4DB049', border: '1px solid rgba(77,176,89,0.3)' }}>
            <i className="ri-download-2-line" /> Exporter
          </button>
        </div>

        {loading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {tab === 'trial' && trial && (
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #E8F2F1' }}>
                  {['Compte', 'Libellé', 'Type', 'Débit', 'Crédit', 'Solde'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trial.rows.map((r) => (
                  <tr key={r.code} style={{ borderBottom: '1px solid #F0F7F0' }}>
                    <td className="px-4 py-3 text-gray-900 text-sm font-mono">{r.code}</td>
                    <td className="px-4 py-3 text-gray-900 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>{r.name}</td>
                    <td className="px-4 py-3 text-xs uppercase" style={{ color: '#6B7280' }}>{r.type}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm font-mono">{fmt(r.debit)}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm font-mono">{fmt(r.credit)}</td>
                    <td className="px-4 py-3 text-gray-900 text-sm font-mono font-semibold">{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid rgba(77,176,89,0.3)' }}>
                  <td colSpan={3} className="px-4 py-3 text-gray-900 font-semibold text-right">Totaux</td>
                  <td className="px-4 py-3 text-gray-900 text-sm font-mono font-bold">{fmt(trial.totals.debit)}</td>
                  <td className="px-4 py-3 text-gray-900 text-sm font-mono font-bold">{fmt(trial.totals.credit)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {tab === 'journal' && (
          <div className="space-y-3">
            {journal.length === 0 && <p className="text-gray-400 text-sm">Aucune écriture.</p>}
            {journal.map((e) => (
              <div key={e.id} className="rounded-2xl p-4" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-gray-900 text-sm font-semibold">{e.description}</p>
                    <p className="text-xs font-mono text-gray-400">{e.reference} · {new Date(e.postedAt).toLocaleString('fr-FR')}</p>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {e.lines.map((l) => (
                      <tr key={l.id} style={{ borderTop: '1px solid #F0F7F0' }}>
                        <td className="py-2 text-gray-600 font-mono">{l.accountCode}</td>
                        <td className="py-2 text-gray-500">{l.memo}</td>
                        <td className="py-2 text-right text-gray-900 font-mono">{l.debit > 0 ? fmt(l.debit) : ''}</td>
                        <td className="py-2 text-right text-gray-900 font-mono">{l.credit > 0 ? fmt(l.credit) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Pagination for Journal */}
            {journalTotal > journalLimit && (
              <div className="flex justify-between items-center text-sm pt-2">
                <span className="text-gray-500">Page {journalPage} — {journalTotal} écritures</span>
                <div className="flex gap-2">
                  <button onClick={() => loadJournal(Math.max(1, journalPage - 1))} disabled={journalPage === 1} className="px-3 py-1 rounded disabled:opacity-40" style={{ background: '#F5FAF5', color: '#6B7280' }}>Précédent</button>
                  <button onClick={() => loadJournal(journalPage + 1)} disabled={journal.length < journalLimit} className="px-3 py-1 rounded disabled:opacity-40" style={{ background: '#F5FAF5', color: '#6B7280' }}>Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'income' && income && (
          <div className="grid md:grid-cols-2 gap-4">
            <Panel title="Produits (Class 7)" rows={income.income} accent="#22C55E" total={income.totals.income} />
            <Panel title="Charges (Class 6)" rows={income.expense} accent="#EF4444" total={income.totals.expense} />
            <div className="md:col-span-2 rounded-2xl p-4" style={cardStyle}>
              <p className="text-gray-500 text-sm">Résultat net</p>
              <p className="text-2xl font-bold mt-1" style={{ color: income.totals.netResult >= 0 ? '#22C55E' : '#EF4444', fontFamily: 'Montserrat, sans-serif' }}>{fmt(income.totals.netResult)}</p>
            </div>
          </div>
        )}

        {tab === 'balance' && balance && (
          <div className="grid md:grid-cols-3 gap-4">
            <Panel title="Actif" rows={balance.assets} accent="#4A9EFF" total={balance.totals.assets} />
            <Panel title="Passif" rows={balance.liabilities} accent="#F97316" total={balance.totals.liabilities} />
            <Panel title="Capitaux propres" rows={balance.equity} accent="#A855F7" total={balance.totals.equity} />
          </div>
        )}

        {tab === 'payouts' && (
          <div className="space-y-3">
            <p className="text-gray-500 text-sm">Demandes de virement des commerçants</p>
            {payoutRequests.length === 0 && <p className="text-gray-400">Aucune demande.</p>}

            {payoutRequests.map((p: any) => (
              <div key={p.id} className="p-4 rounded-2xl flex items-center justify-between" style={cardStyle}>
                <div>
                  <div className="font-medium text-gray-900">{p.merchant?.businessName} — {p.amount.toLocaleString()} FCFA</div>
                  <div className="text-xs text-gray-500">{p.provider} · {new Date(p.requestedAt).toLocaleDateString('fr-FR')}</div>
                  {p.note && <div className="text-xs text-gray-400 mt-0.5">Note : {p.note}</div>}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    p.status === 'PAID' ? 'bg-[#22C55E20] text-[#22C55E]' : 
                    p.status === 'REJECTED' ? 'bg-[#EF444420] text-[#EF4444]' : 
                    'bg-[#F59E0B20] text-[#F59E0B]'
                  }`}>
                    {p.status}
                  </span>

                  {p.status === 'PENDING' && (
                    <>
                      <button 
                        onClick={async () => {
                          await accountingApi.updatePayoutStatus(p.id, 'PAID');
                          addToast('success', 'Virement effectué', 'Le paiement a été enregistré dans le journal.');
                          const res = await accountingApi.listPayoutRequests({ limit: 50 });
                          setPayoutRequests(res.items || []);
                        }} 
                        className="text-xs px-3 py-1 rounded bg-[#22C55E] text-black hover:bg-[#16A34A]"
                      >
                        Marquer Payé
                      </button>

                      <button 
                        onClick={async () => {
                          const note = prompt('Raison du refus (optionnel) :') || '';
                          await accountingApi.updatePayoutStatus(p.id, 'REJECTED', note);
                          addToast('warning', 'Demande refusée', 'Le commerçant a été notifié.');
                          const res = await accountingApi.listPayoutRequests({ limit: 50 });
                          setPayoutRequests(res.items || []);
                        }} 
                        className="text-xs px-3 py-1 rounded bg-[#EF4444] text-white hover:bg-[#DC2626]"
                      >
                        Rejeter
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Panel({ title, rows, accent, total }: { title: string; rows: TrialBalanceRow[]; accent: string; total: number }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E8F2F1' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-900 font-semibold">{title}</h3>
        <span className="text-sm font-mono font-bold" style={{ color: accent }}>{fmt(total)}</span>
      </div>
      <div className="space-y-1">
        {rows.length === 0 && <p className="text-gray-300 text-xs">—</p>}
        {rows.map((r) => (
          <div key={r.code} className="flex justify-between text-xs">
            <span className="text-gray-500 font-mono">{r.code}</span>
            <span className="text-gray-400 truncate mx-2 flex-1">{r.name}</span>
            <span className="text-gray-900 font-mono">{fmt(r.balance)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
