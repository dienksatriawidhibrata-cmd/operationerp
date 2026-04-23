import { lastNPeriods, periodLabel } from '../lib/utils'

export default function LeaderboardSection({
  title = 'Leaderboard Operasional',
  selectedPeriod,
  onPeriodChange,
  leaderboardView,
  onViewChange,
  leaderboards,
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-gray-800">{title}</h2>
          <p className="mt-1 text-[11px] text-slate-500">Skor = 70% completion + 30% on-time terhadap total kewajiban periode.</p>
        </div>
        <TooltipBubble />
      </div>

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
        <LeaderboardTab label="Toko" active={leaderboardView === 'store'} onClick={() => onViewChange('store')} />
        <LeaderboardTab label="Staff" active={leaderboardView === 'staff'} onClick={() => onViewChange('staff')} />
        <LeaderboardTab label="Head Store" active={leaderboardView === 'head_store'} onClick={() => onViewChange('head_store')} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {leaderboardView === 'store' && (
          <>
            <LeaderboardCard
              title="Top 10 Toko"
              subtitle={`${periodLabel(selectedPeriod)} · Ceklis + Preparation`}
              tone="emerald"
              countLabel="toko"
              rows={leaderboards.storesTop}
              emptyText="Belum ada data toko untuk periode ini."
            />
            <LeaderboardCard
              title="Bottom 10 Toko"
              subtitle={`${periodLabel(selectedPeriod)} · Ceklis + Preparation`}
              tone="rose"
              countLabel="toko"
              rows={leaderboards.storesBottom}
              emptyText="Belum ada data toko untuk periode ini."
            />
          </>
        )}
        {leaderboardView === 'staff' && (
          <>
            <LeaderboardCard
              title="Top 10 Staff"
              subtitle={`${periodLabel(selectedPeriod)} · Checklist`}
              tone="emerald"
              countLabel="staff"
              rows={leaderboards.staffTop}
              emptyText="Belum ada data staff untuk periode ini."
            />
            <LeaderboardCard
              title="Bottom 10 Staff"
              subtitle={`${periodLabel(selectedPeriod)} · Checklist`}
              tone="rose"
              countLabel="staff"
              rows={leaderboards.staffBottom}
              emptyText="Belum ada data staff untuk periode ini."
            />
          </>
        )}
        {leaderboardView === 'head_store' && (
          <>
            <LeaderboardCard
              title="Top 10 Head Store"
              subtitle={`${periodLabel(selectedPeriod)} · Opex + Setoran + Laporan`}
              tone="blue"
              countLabel="head store"
              rows={leaderboards.headStoresTop}
              emptyText="Belum ada data head store untuk periode ini."
            />
            <LeaderboardCard
              title="Bottom 10 Head Store"
              subtitle={`${periodLabel(selectedPeriod)} · Opex + Setoran + Laporan`}
              tone="rose"
              countLabel="head store"
              rows={leaderboards.headStoresBottom}
              emptyText="Belum ada data head store untuk periode ini."
            />
          </>
        )}
      </div>
    </div>
  )
}

function TooltipBubble() {
  return (
    <div className="max-w-xs rounded-[1.25rem] border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] leading-5 text-sky-700">
      On-time dinilai terhadap total target periode, bukan hanya item yang sempat diisi.
    </div>
  )
}

function LeaderboardCard({ title, subtitle, tone, countLabel, rows, emptyText }) {
  const toneClasses = {
    emerald: {
      badge: 'bg-emerald-50 text-emerald-600',
      rank: 'bg-emerald-50 text-emerald-600',
      score: 'text-emerald-700',
    },
    rose: {
      badge: 'bg-rose-50 text-rose-600',
      rank: 'bg-rose-50 text-rose-600',
      score: 'text-rose-700',
    },
    blue: {
      badge: 'bg-sky-50 text-sky-600',
      rank: 'bg-sky-50 text-sky-600',
      score: 'text-sky-700',
    },
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
          {rows.map((row, index) => (
            <div key={row.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-black ${toneClasses.rank}`}>
                #{index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{row.title}</div>
                <div className="truncate text-[11px] text-slate-500">{row.subtitle}</div>
                <div className="mt-1 truncate text-[10px] font-medium text-slate-400">{row.note}</div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-black ${toneClasses.score}`}>{row.score}</div>
                <div className="text-[10px] font-semibold text-slate-400">{row.metrics}</div>
              </div>
            </div>
          ))}
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
