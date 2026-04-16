import { useState } from 'react'
import { KPI_2026 } from '../../data/kpi2026'
import { useAuth } from '../../contexts/AuthContext'
import { fmtRp } from '../../lib/utils'
import {
  HeroCard,
  InlineStat,
  SectionPanel,
  SegmentedControl,
  SubpageShell,
  ToneBadge,
  EmptyPanel,
} from '../../components/ui/AppKit'
import { OpsBottomNav } from '../../components/BottomNav'

// ─── KPI item labels and improvement copy ────────────────────────────────────

const KPI_ITEM_META = {
  'Net Sales': {
    icon: '💰',
    target: 'Tier 2',
    improve: 'Review target harian dan aktivasi promo. Push bundling dan upselling di jam peak.',
    maintain: 'Pertahankan momentum — monitor daily agar tidak turun di akhir periode.',
  },
  'AVG': {
    icon: '🧾',
    target: 'Rp 55.000',
    improve: 'Latih staff menawarkan add-on (oatmilk, snack, telur). Dorong Large size dan bundling combo.',
    maintain: 'AVG sudah bagus. Pertahankan scripting kasir dan lanjutkan coaching upselling.',
  },
  'AVG Transactions': {
    icon: '🧾',
    target: 'Rp 55.000',
    improve: 'Latih staff menawarkan add-on (oatmilk, snack, telur). Dorong Large size dan bundling combo.',
    maintain: 'AVG sudah bagus. Pertahankan scripting kasir dan lanjutkan coaching upselling.',
  },
  'Large': {
    icon: '🥤',
    target: '≥ 65% dari total cup',
    improve: 'Staff wajib aktif menawarkan Large. Pasang reminder di kasir. Coaching roleplay tawarkan "mau large?"',
    maintain: 'Large attach rate baik. Tetap konsisten di setiap order.',
  },
  'Oatside': {
    icon: '🌾',
    target: '≥ 5% dari total minuman',
    improve: 'Sebutkan "oatmilk" secara eksplisit saat mengambil order. Edukasi customer manfaat oatmilk.',
    maintain: 'Oatmilk attach rate on track. Pertahankan habit menyebut oatmilk.',
  },
  'Snack Platter': {
    icon: '🍽️',
    target: '≥ 10% dari snack',
    improve: 'Tawarkan snack platter saat customer pesan minuman. Tampilkan visual di kasir.',
    maintain: 'Snack platter attach sudah baik.',
  },
  'Add On Telur': {
    icon: '🥚',
    target: '≥ target add-on',
    improve: 'Aktif tawarkan menu telur sebagai add-on saat order. Staff perlu hafal menu paket.',
    maintain: 'Add-on telur sudah bagus. Pertahankan habit menawarkan.',
  },
  'B. Asik': {
    icon: '🎁',
    target: '≥ 5% dari transaksi',
    improve: 'Edukasi staff dan customer soal bundling asik. Tampilkan harga bundling vs satuan.',
    maintain: 'Bundling asik on track. Teruskan promosi aktif.',
  },
  'Audit': {
    icon: '📋',
    target: '≥ 90%',
    improve: 'Review hasil audit terakhir. Fokus pada item yang sering gagal. Terapkan SOP ketat.',
    maintain: 'Audit score sudah tinggi. Jaga konsistensi SOP harian.',
  },
  'M. Shopper': {
    icon: '🕵️',
    target: 'Sempurna (5.0)',
    improve: 'Review feedback mystery shopper. Latih greeting, kebersihan, dan kecepatan layanan.',
    maintain: 'Mystery shopper score bagus. Pertahankan standar layanan.',
  },
  'Complain': {
    icon: '📣',
    target: '≤ 0.1% dari transaksi',
    improve: 'Identifikasi sumber komplain terbanyak. Coaching langsung ke staff terkait SOP handling.',
    maintain: 'Tingkat komplain rendah. Pertahankan quality control dan respon cepat.',
  },
}

function getMeta(key) {
  return KPI_ITEM_META[key] || { icon: '📊', target: '-', improve: 'Tingkatkan performa item ini.', maintain: 'Pertahankan performa.' }
}

// ─── Score tone helpers ───────────────────────────────────────────────────────

function scoreTone(score) {
  if (score === null || score === undefined) return 'slate'
  if (score >= 4) return 'ok'
  if (score === 3)  return 'warn'
  return 'danger'
}

function scoreLabel(score) {
  if (score === null) return '-'
  if (score >= 5) return '5'
  return String(score)
}

function totalTone(total) {
  if (total >= 0.80) return 'ok'
  if (total >= 0.60) return 'warn'
  return 'danger'
}

function pct(n) { return n != null ? (n * 100).toFixed(1) + '%' : '-' }
function fmtPct(n) { return n != null ? (n * 100).toFixed(2) + '%' : '-' }

// ─── Trend indicator ─────────────────────────────────────────────────────────

function trend(curr, prev) {
  if (curr == null || prev == null) return null
  if (curr > prev) return 'up'
  if (curr < prev) return 'down'
  return 'same'
}

function TrendArrow({ dir }) {
  if (!dir || dir === 'same') return <span className="text-slate-400 text-xs">–</span>
  if (dir === 'up') return <span className="text-emerald-600 text-xs font-bold">↑</span>
  return <span className="text-rose-500 text-xs font-bold">↓</span>
}

// ─── ScorePip ─────────────────────────────────────────────────────────────────

function ScorePip({ score }) {
  const tone = scoreTone(score)
  const colors = {
    ok:      'bg-emerald-500 text-white',
    warn:    'bg-amber-400 text-white',
    danger:  'bg-rose-500 text-white',
    slate:   'bg-slate-200 text-slate-500',
  }
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${colors[tone]}`}>
      {score ?? '–'}
    </span>
  )
}

// ─── Store row (collapsed) ────────────────────────────────────────────────────

function StoreRow({ store, itemKeys, rank, prevScores, prevTotal, onClick, isOpen }) {
  const t = trend(store.total, prevTotal)
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-[22px] px-4 py-4 transition-colors ${
        isOpen ? 'bg-primary-50 ring-1 ring-primary-200' : 'bg-slate-50/85 hover:bg-slate-100'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Rank */}
        <div className={`shrink-0 h-8 w-8 flex items-center justify-center rounded-xl text-xs font-bold ${
          rank === 1 ? 'bg-amber-100 text-amber-700' :
          rank === 2 ? 'bg-slate-100 text-slate-600' :
          rank === 3 ? 'bg-orange-100 text-orange-700' :
          'bg-white text-slate-500 border border-slate-100'
        }`}>
          {rank}
        </div>

        {/* Name & DM */}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">{store.store}</div>
          <div className="text-xs text-slate-400">{store.dm}</div>
        </div>

        {/* Score pips (hidden on very small screens) */}
        <div className="hidden sm:flex gap-1">
          {store.scores.map((s, i) => <ScorePip key={i} score={s} />)}
        </div>

        {/* Total + trend */}
        <div className="shrink-0 flex items-center gap-2 ml-2">
          <TrendArrow dir={t} />
          <ToneBadge tone={totalTone(store.total)}>
            {(store.total * 100).toFixed(1)}%
          </ToneBadge>
        </div>
      </div>
    </button>
  )
}

// ─── Store detail (expanded) ──────────────────────────────────────────────────

function StoreDetail({ store, itemKeys, prevStore, month, data }) {
  const focusAreas = itemKeys
    .map((key, i) => ({ key, score: store.scores[i] }))
    .filter(({ score }) => score !== null && score <= 2)

  const salesD = data.sales?.[store.store]?.[month]
  const avgD   = data.avg?.[store.store]?.[month]
  const auditD = data.audit?.[store.store]?.[month]
  const complainD = data.complain?.[store.store]?.[month]

  return (
    <div className="mt-3 space-y-4 px-1">
      {/* Item breakdown */}
      <div className="rounded-[22px] bg-white border border-slate-100 px-4 py-4 space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Item Score</div>
        <div className="space-y-2">
          {itemKeys.map((key, i) => {
            const score    = store.scores[i]
            const prevScore = prevStore?.scores[i] ?? null
            const t        = trend(score, prevScore)
            const meta     = getMeta(key)
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-5 text-center shrink-0">{meta.icon}</span>
                <span className="flex-1 text-sm text-slate-700">{key}</span>
                <TrendArrow dir={t} />
                <ScorePip score={score} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Raw metrics if available */}
      {(salesD || avgD || auditD || complainD) && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {salesD && (
            <div className="rounded-[18px] bg-slate-50 px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Net Sales</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{fmtRp(salesD.actual ?? 0)}</div>
              <div className="text-[11px] text-slate-400">Target {fmtRp(salesD.target ?? 0)}</div>
              {salesD.target > 0 && (
                <div className={`mt-1 text-[11px] font-semibold ${(salesD.actual / salesD.target) >= 1 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {pct(salesD.actual / salesD.target)} ach
                </div>
              )}
            </div>
          )}
          {avgD && (
            <div className="rounded-[18px] bg-slate-50 px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">AVG Txn</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{fmtRp(avgD.actual ?? 0)}</div>
              <div className="text-[11px] text-slate-400">Target {fmtRp(avgD.target ?? 0)}</div>
            </div>
          )}
          {auditD != null && (
            <div className="rounded-[18px] bg-slate-50 px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Audit</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{auditD.toFixed(1)}%</div>
              <div className={`text-[11px] font-semibold ${auditD >= 90 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {auditD >= 90 ? '✓ Target' : '✗ Di bawah target'}
              </div>
            </div>
          )}
          {complainD && (
            <div className="rounded-[18px] bg-slate-50 px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Komplain</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{complainD.count} kasus</div>
              <div className={`text-[11px] font-semibold ${complainD.rate <= 0.001 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {fmtPct(complainD.rate)} ({complainD.trx} txn)
              </div>
            </div>
          )}
        </div>
      )}

      {/* Focus areas */}
      {focusAreas.length > 0 && (
        <div className="rounded-[22px] border border-rose-100 bg-rose-50 px-4 py-4 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-400">
            Fokus Perbaikan Bulan Depan
          </div>
          {focusAreas.map(({ key, score }) => {
            const meta = getMeta(key)
            return (
              <div key={key} className="flex gap-3">
                <span className="shrink-0 mt-0.5">{meta.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-rose-700">
                    {key} <span className="font-normal text-rose-400">(score {score}/5)</span>
                  </div>
                  <div className="mt-0.5 text-sm text-rose-600">{meta.improve}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {focusAreas.length === 0 && (
        <div className="rounded-[22px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Semua item di atas standar. Pertahankan performa dan tingkatkan item yang masih di angka 3.
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function KPIReport() {
  const { profile } = useAuth()

  // Gate: demo for Dien only
  if (profile?.email !== 'dkwcoffeeindonesia@gmail.com') {
    return (
      <SubpageShell
        title="KPI Report"
        subtitle="Akses terbatas"
        eyebrow="Performance"
      >
        <EmptyPanel
          title="Belum tersedia"
          description="Halaman KPI Report sedang dalam tahap pengembangan dan belum aktif untuk akun ini."
        />
      </SubpageShell>
    )
  }

  const { availableMonths, monthly, sales, avg, audit, complain, lastUpdated } = KPI_2026

  const [activeMon, setActiveMon] = useState(availableMonths[availableMonths.length - 1])
  const [openStore, setOpenStore] = useState(null)
  const [dmFilter, setDmFilter]   = useState('all')

  const monData  = monthly[activeMon]
  const prevMon  = availableMonths[availableMonths.indexOf(activeMon) - 1]
  const prevData = prevMon ? monthly[prevMon] : null

  if (!monData) return null

  const { stores, dmRanking, itemKeys } = monData

  // DM options for filter
  const dmNames = [...new Set(stores.map(s => s.dm).filter(Boolean))].sort()

  const filteredStores = dmFilter === 'all'
    ? stores
    : stores.filter(s => s.dm === dmFilter)

  // Summary stats
  const avgTotal = stores.reduce((s, r) => s + r.total, 0) / stores.length
  const top3     = stores.slice(0, 3)
  const bottom3  = [...stores].sort((a, b) => a.total - b.total).slice(0, 3)

  function getPrevStore(storeName) {
    return prevData?.stores.find(s => s.store === storeName) ?? null
  }

  function toggleStore(storeName) {
    setOpenStore(prev => prev === storeName ? null : storeName)
  }

  const monthOpts = availableMonths.map(m => ({ key: m, label: m }))
  const dmOpts    = [{ key: 'all', label: 'Semua DM' }, ...dmNames.map(n => ({ key: n, label: n }))]

  return (
    <SubpageShell
      title="KPI Report 2026"
      subtitle={`Data per ${activeMon} 2026 · Updated ${lastUpdated}`}
      eyebrow="Performance Report"
      footer={<OpsBottomNav />}
    >
      {/* Hero summary */}
      <HeroCard
        eyebrow={`Bulan ${activeMon} 2026`}
        title={`Avg Store Score ${(avgTotal * 100).toFixed(1)}%`}
        description="Scorecard KPI toko berdasarkan 9 item dengan total bobot 100%. Klik setiap toko untuk melihat detail dan area perbaikan bulan depan."
        meta={
          <>
            <ToneBadge tone={avgTotal >= 0.75 ? 'ok' : avgTotal >= 0.60 ? 'warn' : 'danger'}>
              {avgTotal >= 0.75 ? 'Di atas rata-rata' : avgTotal >= 0.60 ? 'Cukup' : 'Perlu perhatian'}
            </ToneBadge>
            <ToneBadge tone="info">{stores.length} toko</ToneBadge>
            <ToneBadge tone="slate">{dmRanking.length} DM</ToneBadge>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineStat label="Avg Score" value={`${(avgTotal * 100).toFixed(1)}%`} tone="primary" />
          <InlineStat label="≥ 80% (Top)" value={stores.filter(s => s.total >= 0.80).length} tone="emerald" />
          <InlineStat label="< 60% (Risk)" value={stores.filter(s => s.total < 0.60).length} tone={stores.filter(s => s.total < 0.60).length > 0 ? 'rose' : 'slate'} />
        </div>
      </HeroCard>

      <div className="mt-6 space-y-6">

        {/* Month selector */}
        <SectionPanel
          eyebrow="Period"
          title="Pilih Bulan"
          description="Data scorecard tersedia per bulan. Klik bulan untuk melihat ranking terbaru."
          actions={
            <SegmentedControl
              options={monthOpts}
              value={activeMon}
              onChange={(m) => { setActiveMon(m); setOpenStore(null) }}
            />
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {availableMonths.map(m => {
              const md = monthly[m]
              const avg = md ? (md.stores.reduce((s, r) => s + r.total, 0) / md.stores.length * 100).toFixed(1) : '-'
              const topStore = md?.stores[0]
              return (
                <button
                  key={m}
                  onClick={() => { setActiveMon(m); setOpenStore(null) }}
                  className={`rounded-[18px] px-4 py-4 text-left transition-colors ${
                    m === activeMon
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className={`text-[11px] font-semibold uppercase tracking-widest ${m === activeMon ? 'text-primary-100' : 'text-slate-400'}`}>
                    {m} 2026
                  </div>
                  <div className={`mt-1 text-xl font-bold ${m === activeMon ? 'text-white' : 'text-slate-900'}`}>
                    {avg}%
                  </div>
                  {topStore && (
                    <div className={`mt-1 text-xs ${m === activeMon ? 'text-primary-200' : 'text-slate-500'}`}>
                      🏆 {topStore.store} ({(topStore.total * 100).toFixed(0)}%)
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </SectionPanel>

        {/* Top & Bottom */}
        <div className="grid gap-4 sm:grid-cols-2">
          <SectionPanel
            eyebrow="Top Performer"
            title="3 Toko Terbaik"
            description={`${activeMon} 2026`}
          >
            <div className="space-y-2">
              {top3.map((s, i) => (
                <div key={s.store} className="flex items-center gap-3 rounded-[18px] bg-emerald-50 px-3 py-3">
                  <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{s.store}</div>
                    <div className="text-xs text-slate-400">{s.dm}</div>
                  </div>
                  <ToneBadge tone="ok">{(s.total * 100).toFixed(1)}%</ToneBadge>
                </div>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel
            eyebrow="Needs Attention"
            title="3 Toko Terendah"
            description={`${activeMon} 2026`}
          >
            <div className="space-y-2">
              {bottom3.map((s) => (
                <div key={s.store} className="flex items-center gap-3 rounded-[18px] bg-rose-50 px-3 py-3">
                  <span className="text-lg">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{s.store}</div>
                    <div className="text-xs text-slate-400">{s.dm}</div>
                  </div>
                  <ToneBadge tone="danger">{(s.total * 100).toFixed(1)}%</ToneBadge>
                </div>
              ))}
            </div>
          </SectionPanel>
        </div>

        {/* DM Ranking */}
        <SectionPanel
          eyebrow="DM Scorecard"
          title="Ranking District Manager"
          description="Score DM dihitung dari rata-rata tertimbang semua toko yang dikelola."
          actions={<ToneBadge tone="info">{dmRanking.length} DM</ToneBadge>}
        >
          <div className="space-y-2">
            {dmRanking.map((dm, i) => (
              <div key={dm.name} className="flex items-center gap-3 rounded-[22px] bg-slate-50/85 px-4 py-3">
                <div className={`shrink-0 h-8 w-8 flex items-center justify-center rounded-xl text-xs font-bold ${
                  i === 0 ? 'bg-amber-100 text-amber-700' :
                  i === 1 ? 'bg-slate-200 text-slate-600' :
                  i === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-white text-slate-400 border border-slate-100'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">{dm.name}</div>
                  <div className="text-xs text-slate-400">
                    {stores.filter(s => s.dm === dm.name).length} toko
                  </div>
                </div>

                {/* Mini score bar */}
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${dm.score >= 0.75 ? 'bg-emerald-500' : dm.score >= 0.60 ? 'bg-amber-400' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(100, dm.score * 100)}%` }}
                    />
                  </div>
                </div>

                <ToneBadge tone={dm.score >= 0.75 ? 'ok' : dm.score >= 0.60 ? 'warn' : 'danger'}>
                  {(dm.score * 100).toFixed(1)}%
                </ToneBadge>
              </div>
            ))}
          </div>
        </SectionPanel>

        {/* Store leaderboard */}
        <SectionPanel
          eyebrow="Store Ranking"
          title="Ranking Semua Toko"
          description="Klik toko untuk melihat breakdown per item dan rekomendasi perbaikan bulan depan."
          actions={
            <SegmentedControl
              options={dmOpts}
              value={dmFilter}
              onChange={setDmFilter}
            />
          }
        >
          {/* Item key legend */}
          <div className="mb-4 hidden sm:flex flex-wrap gap-2">
            {itemKeys.map((key, i) => {
              const meta = getMeta(key)
              return (
                <span key={i} className="text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-1">
                  {meta.icon} {key}
                </span>
              )
            })}
          </div>

          <div className="space-y-2">
            {filteredStores.map((store, idx) => {
              const globalRank = stores.indexOf(store) + 1
              const prevStore  = getPrevStore(store.store)
              const isOpen     = openStore === store.store
              return (
                <div key={store.store}>
                  <StoreRow
                    store={store}
                    itemKeys={itemKeys}
                    rank={globalRank}
                    prevScores={prevStore?.scores ?? null}
                    prevTotal={prevStore?.total ?? null}
                    onClick={() => toggleStore(store.store)}
                    isOpen={isOpen}
                  />
                  {isOpen && (
                    <StoreDetail
                      store={store}
                      itemKeys={itemKeys}
                      prevStore={prevStore}
                      month={activeMon}
                      data={{ sales, avg, audit, complain }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </SectionPanel>

        {/* Item heatmap summary */}
        <SectionPanel
          eyebrow="Item Analysis"
          title="Analisis per Item KPI"
          description="Rata-rata skor tiap item di seluruh toko. Item dengan rata-rata rendah perlu perhatian sistemik."
        >
          <div className="space-y-3">
            {itemKeys.map((key, i) => {
              const validScores = stores.map(s => s.scores[i]).filter(v => v !== null)
              const avgScore = validScores.length > 0
                ? validScores.reduce((a, b) => a + b, 0) / validScores.length
                : null
              const meta  = getMeta(key)
              const tone  = avgScore >= 4 ? 'ok' : avgScore >= 3 ? 'warn' : 'danger'
              const dist  = [1,2,3,4,5].map(v => validScores.filter(s => s === v).length)
              const total = validScores.length

              return (
                <div key={key} className="rounded-[22px] bg-slate-50/85 px-4 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">{meta.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900">{key}</div>
                      <div className="text-xs text-slate-400">Target: {meta.target}</div>
                    </div>
                    {avgScore != null && (
                      <ToneBadge tone={tone}>
                        avg {avgScore.toFixed(2)}/5
                      </ToneBadge>
                    )}
                  </div>

                  {/* Score distribution bar */}
                  <div className="flex gap-1 h-3">
                    {dist.map((count, vi) => {
                      const w = total > 0 ? (count / total) * 100 : 0
                      const colors = ['bg-rose-500', 'bg-orange-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500']
                      return w > 0 ? (
                        <div
                          key={vi}
                          className={`h-full rounded-full ${colors[vi]} relative group`}
                          style={{ width: `${w}%` }}
                          title={`Score ${vi+1}: ${count} toko`}
                        />
                      ) : null
                    })}
                  </div>
                  <div className="mt-1 flex gap-2 flex-wrap">
                    {dist.map((count, vi) => count > 0 && (
                      <span key={vi} className="text-[10px] text-slate-400">
                        {vi+1}={count}
                      </span>
                    ))}
                  </div>

                  {avgScore !== null && avgScore < 3 && (
                    <div className="mt-3 text-xs text-rose-600 bg-rose-50 rounded-xl px-3 py-2">
                      ⚠️ {meta.improve}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </SectionPanel>

      </div>
    </SubpageShell>
  )
}
