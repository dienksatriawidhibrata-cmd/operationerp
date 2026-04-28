import { lastNPeriods, periodLabel } from '../lib/utils'

const STAFF_ROLES = ['staff', 'barista', 'kitchen', 'waitress', 'asst_head_store']
const HEAD_STORE_HIDDEN_ROLES = ['staff', 'barista', 'kitchen', 'waitress']

// ── MyRankCard ────────────────────────────────────────────────────────────────

function rankTone(rank, total) {
  if (!total) return 'text-white'
  const pct = rank / total
  if (pct <= 0.25) return 'text-emerald-300'
  if (pct <= 0.5)  return 'text-blue-200'
  if (pct <= 0.75) return 'text-amber-300'
  return 'text-rose-300'
}

function MyRankCard({ profile, leaderboards, period }) {
  const role = profile?.role
  const staffAll     = leaderboards.staffAll     || []
  const headStoresAll = leaderboards.headStoresAll || []
  const storesAll    = leaderboards.storesAll    || []

  const storeIdx = profile?.branch_id ? storesAll.findIndex(r => r.id === profile.branch_id) : -1
  const storeRank = storeIdx >= 0 ? { rank: storeIdx + 1, total: storesAll.length, data: storesAll[storeIdx] } : null

  let personal = null
  if (STAFF_ROLES.includes(role)) {
    const idx = staffAll.findIndex(r => r.id === profile?.id)
    if (idx >= 0) personal = { rank: idx + 1, total: staffAll.length, data: staffAll[idx], label: 'Peringkat Staff' }
  } else if (role === 'head_store') {
    const idx = headStoresAll.findIndex(r => r.id === profile?.id)
    if (idx >= 0) personal = { rank: idx + 1, total: headStoresAll.length, data: headStoresAll[idx], label: 'Peringkat Head Store' }
  }

  if (!personal && !storeRank) return null

  const pLabel = period ? periodLabel(period) : ''

  return (
    <div className="rounded-[2rem] bg-gradient-to-br from-slate-800 to-blue-900 p-4 text-white shadow-lg shadow-slate-200">
      <p className="mb-3 text-[9px] font-bold uppercase tracking-widest opacity-60">Peringkat Kamu · {pLabel}</p>
      <div className={`grid gap-3 ${personal && storeRank ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {personal && (
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[9px] font-bold uppercase opacity-60">{personal.label}</p>
            <p className={`text-3xl font-black ${rankTone(personal.rank, personal.total)}`}>
              #{personal.rank}
            </p>
            <p className="mt-0.5 text-[10px] opacity-70">dari {personal.total} orang</p>
            <div className="mt-2 space-y-0.5 text-[9px] opacity-60">
              <p>Skor {personal.data?.score ?? '-'}</p>
              <p>{personal.data?.metrics ?? ''}</p>
            </div>
          </div>
        )}
        {storeRank && (
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[9px] font-bold uppercase opacity-60">Peringkat Toko</p>
            <p className={`text-3xl font-black ${rankTone(storeRank.rank, storeRank.total)}`}>
              #{storeRank.rank}
            </p>
            <p className="mt-0.5 text-[10px] opacity-70">dari {storeRank.total} toko</p>
            <div className="mt-2 space-y-0.5 text-[9px] opacity-60">
              <p>Skor {storeRank.data?.score ?? '-'}</p>
              <p className="truncate">{storeRank.data?.title ?? ''}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── LeaderboardSection ────────────────────────────────────────────────────────

export default function LeaderboardSection({
  title = 'Leaderboard Operasional',
  selectedPeriod,
  onPeriodChange,
  leaderboardView,
  onViewChange,
  leaderboards,
  profile = null,
  showHeadStore = true,
}) {
  const effectiveView = !showHeadStore && leaderboardView === 'head_store' ? 'store' : leaderboardView

  const tabs = [
    { key: 'store',      label: 'Toko' },
    { key: 'staff',      label: 'Staff' },
    ...(showHeadStore ? [{ key: 'head_store', label: 'Head Store' }] : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-gray-800">{title}</h2>
          <p className="mt-1 text-[11px] text-slate-500">Skor = 70% completion + 30% on-time terhadap total kewajiban periode.</p>
        </div>
        <TooltipBubble />
      </div>

      {profile && (
        <MyRankCard profile={profile} leaderboards={leaderboards} period={selectedPeriod} />
      )}

      <div>
        <select
          value={selectedPeriod}
          onChange={(event) => onPeriodChange(event.target.value)}
          className="w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
        >
          {lastNPeriods(6).map((period) => (
            <option key={period} value={period}>{periodLabel(period)}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 rounded-[1.25rem] bg-white p-1 shadow-sm">
        {tabs.map(tab => (
          <LeaderboardTab
            key={tab.key}
            label={tab.label}
            active={effectiveView === tab.key}
            onClick={() => onViewChange(tab.key)}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {effectiveView === 'store' && (
          <>
            <LeaderboardCard
              title="Top 10 Toko"
              subtitle={`${periodLabel(selectedPeriod)} · Ceklis + Preparation`}
              tone="emerald"
              countLabel="toko"
              rows={leaderboards.storesTop}
              emptyText="Belum ada data toko untuk periode ini."
              highlightId={profile?.branch_id}
            />
            <LeaderboardCard
              title="Bottom 10 Toko"
              subtitle={`${periodLabel(selectedPeriod)} · Ceklis + Preparation`}
              tone="rose"
              countLabel="toko"
              rows={leaderboards.storesBottom}
              emptyText="Belum ada data toko untuk periode ini."
              highlightId={profile?.branch_id}
            />
          </>
        )}
        {effectiveView === 'staff' && (
          <>
            <LeaderboardCard
              title="Top 10 Staff"
              subtitle={`${periodLabel(selectedPeriod)} · Checklist`}
              tone="emerald"
              countLabel="staff"
              rows={leaderboards.staffTop}
              emptyText="Belum ada data staff untuk periode ini."
              highlightId={profile?.id}
            />
            <LeaderboardCard
              title="Bottom 10 Staff"
              subtitle={`${periodLabel(selectedPeriod)} · Checklist`}
              tone="rose"
              countLabel="staff"
              rows={leaderboards.staffBottom}
              emptyText="Belum ada data staff untuk periode ini."
              highlightId={profile?.id}
            />
          </>
        )}
        {effectiveView === 'head_store' && (
          <>
            <LeaderboardCard
              title="Top 10 Head Store"
              subtitle={`${periodLabel(selectedPeriod)} · Opex + Setoran + Laporan`}
              tone="blue"
              countLabel="head store"
              rows={leaderboards.headStoresTop}
              emptyText="Belum ada data head store untuk periode ini."
              highlightId={profile?.id}
            />
            <LeaderboardCard
              title="Bottom 10 Head Store"
              subtitle={`${periodLabel(selectedPeriod)} · Opex + Setoran + Laporan`}
              tone="rose"
              countLabel="head store"
              rows={leaderboards.headStoresBottom}
              emptyText="Belum ada data head store untuk periode ini."
              highlightId={profile?.id}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TooltipBubble() {
  return (
    <div className="max-w-xs rounded-[1.25rem] border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] leading-5 text-sky-700">
      On-time dinilai terhadap total target periode, bukan hanya item yang sempat diisi.
    </div>
  )
}

function LeaderboardCard({ title, subtitle, tone, countLabel, rows, emptyText, highlightId }) {
  const toneClasses = {
    emerald: { badge: 'bg-emerald-50 text-emerald-600', rank: 'bg-emerald-50 text-emerald-600', score: 'text-emerald-700' },
    rose:    { badge: 'bg-rose-50 text-rose-600',       rank: 'bg-rose-50 text-rose-600',       score: 'text-rose-700' },
    blue:    { badge: 'bg-sky-50 text-sky-600',         rank: 'bg-sky-50 text-sky-600',         score: 'text-sky-700' },
  }[tone]

  return (
    <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-slate-900">{title}</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{subtitle}</div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${toneClasses.badge}`}>
          {rows.length} {countLabel}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">{emptyText}</div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const isMe = highlightId && row.id === highlightId
            return (
              <div
                key={row.id}
                className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${isMe ? 'bg-blue-50 ring-2 ring-blue-200' : 'bg-slate-50'}`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-black ${isMe ? 'bg-blue-600 text-white' : toneClasses.rank}`}>
                  #{index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm font-semibold ${isMe ? 'text-blue-900' : 'text-slate-900'}`}>
                    {row.title}{isMe ? ' ← Kamu' : ''}
                  </div>
                  <div className="truncate text-[11px] text-slate-500">{row.subtitle}</div>
                  <div className="mt-1 truncate text-[10px] font-medium text-slate-400">{row.note}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-black ${isMe ? 'text-blue-700' : toneClasses.score}`}>{row.score}</div>
                  <div className="text-[10px] font-semibold text-slate-400">{row.metrics}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LeaderboardTab({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-[1rem] px-3 py-2 text-sm font-bold transition-colors ${
        active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )
}
