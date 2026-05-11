import { useState } from 'react';
import { recentUsers } from '@/mocks/dashboard';

const kycBadge: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  verified: { label: 'Vérifié', color: '#22C55E', bg: 'rgba(34,197,94,0.12)', icon: 'ri-checkbox-circle-line' },
  pending: { label: 'En attente', color: '#F97316', bg: 'rgba(249,115,22,0.12)', icon: 'ri-time-line' },
  rejected: { label: 'Rejeté', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: 'ri-close-circle-line' },
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? '#22C55E' : score >= 50 ? '#F97316' : '#EF4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-xs font-medium w-7 text-right" style={{ color, fontFamily: 'Montserrat, sans-serif' }}>
        {score}
      </span>
    </div>
  );
}

export default function UsersTable() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = recentUsers.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || u.kycStatus === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #152238 0%, #0D1B2A 100%)',
        border: '1px solid rgba(212,175,55,0.15)',
      }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-white/10">
        <h3 className="text-white font-semibold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Utilisateurs Récents
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg outline-none cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(212,175,55,0.2)',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            <option value="all" style={{ background: '#0D1B2A' }}>Tous les statuts</option>
            <option value="verified" style={{ background: '#0D1B2A' }}>Vérifiés</option>
            <option value="pending" style={{ background: '#0D1B2A' }}>En attente</option>
            <option value="rejected" style={{ background: '#0D1B2A' }}>Rejetés</option>
          </select>

          {/* Search */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.2)' }}
          >
            <i className="ri-search-line text-white/40 text-sm" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none w-32 placeholder-white/30 text-white"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            />
          </div>

          {/* Export */}
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
            style={{
              background: 'rgba(212,175,55,0.15)',
              border: '1px solid rgba(212,175,55,0.3)',
              color: '#D4AF37',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            <i className="ri-download-2-line text-sm" />
            Exporter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Utilisateur', 'Téléphone', 'Statut KYC', 'Score Crédit', 'Plafond', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="text-left px-5 py-3 text-xs uppercase tracking-widest"
                  style={{ color: '#D4AF37', fontFamily: 'Poppins, sans-serif', letterSpacing: '0.08em' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((user, idx) => {
              const badge = kycBadge[user.kycStatus];
              return (
                <tr
                  key={user.id}
                  className="transition-all duration-150 hover:bg-white/[0.03] group"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  {/* User */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{
                          background: `hsl(${(idx * 47) % 360}, 60%, 25%)`,
                          color: `hsl(${(idx * 47) % 360}, 80%, 70%)`,
                          fontFamily: 'Montserrat, sans-serif',
                        }}
                      >
                        {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          {user.name}
                        </p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Poppins, sans-serif' }}>
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="px-5 py-3.5">
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif' }}>
                      {user.phone}
                    </span>
                  </td>

                  {/* KYC */}
                  <td className="px-5 py-3.5">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: badge.bg, color: badge.color, fontFamily: 'Poppins, sans-serif' }}
                    >
                      <i className={`${badge.icon} text-xs`} />
                      {badge.label}
                    </span>
                  </td>

                  {/* Score */}
                  <td className="px-5 py-3.5 min-w-[120px]">
                    <ScoreBar score={user.creditScore} />
                  </td>

                  {/* Limit */}
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-medium" style={{ color: '#D4AF37', fontFamily: 'Montserrat, sans-serif' }}>
                      {user.creditLimit.toLocaleString('fr-FR')} FCFA
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                        <i className="ri-eye-line text-sm" style={{ color: 'rgba(255,255,255,0.5)' }} />
                      </button>
                      <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                        <i className="ri-edit-line text-sm" style={{ color: 'rgba(255,255,255,0.5)' }} />
                      </button>
                      <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                        <i className="ri-more-2-fill text-sm" style={{ color: 'rgba(255,255,255,0.5)' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Poppins, sans-serif' }}>
          Affichage de {filtered.length} sur {recentUsers.length} utilisateurs
        </span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, '...', 12].map((p, i) => (
            <button
              key={i}
              className="w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors cursor-pointer"
              style={{
                background: p === 1 ? 'rgba(212,175,55,0.2)' : 'transparent',
                color: p === 1 ? '#D4AF37' : 'rgba(255,255,255,0.4)',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {p}
            </button>
          ))}
          <button className="w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors cursor-pointer" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <i className="ri-arrow-right-s-line" />
          </button>
        </div>
      </div>
    </div>
  );
}
