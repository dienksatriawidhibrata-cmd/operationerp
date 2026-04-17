import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtRp } from '../../lib/utils'
import { getScopeLabel, isManagerRole, isStoreRole, normalizeStoreName } from '../../lib/access'
import { DMBottomNav, OpsBottomNav, StaffBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel,
  HeroCard,
  InlineStat,
  SectionPanel,
  SegmentedControl,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'

const KPI_ITEM_META = {
  'Net Sales': { icon: 'chart', target: 'Sales vs target bulanan' },
  AVG: { icon: 'finance', target: 'Nilai transaksi rata-rata' },
  Large: { icon: 'spark', target: 'Large attach rate' },
  Oatside: { icon: 'spark', target: 'Add-on oatmilk' },
  'Snack Platter': { icon: 'checklist', target: 'Snack platter attach rate' },
  'Add On Telur': { icon: 'checklist', target: 'Add-on telur' },
  'B. Asik': { icon: 'spark', target: 'Bundling asik' },
  Audit: { icon: 'approval', target: 'Audit score' },
  'M. Shopper': { icon: 'approval', target: 'Mystery shopper' },
  Complain: { icon: 'warning', target: 'Komplain terkontrol' },
}

const monthFormatter = new Intl.DateTimeFormat('id-ID', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatMonthLabel(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00Z`)
  return monthFormatter.format(date)
}

function buildDmRanking(reports) {
  const grouped = reports.reduce((acc, report) => {
    if (!acc[report.dm_name]) acc[report.dm_name] = []
    acc[report.dm_name].push(report.total_score || 0)
    return acc
  }, {})

  return Object.entries(grouped)
    .map(([name, totals]) => ({
      name,
      score: totals.reduce((sum, value) => sum + value, 0) / totals.length,
      stores: totals.length,
    }))
    .sort((a, b) => b.score - a.score)
}

function buildItemKeys(reports) {
  const presentKeys = new Set()
  reports.forEach((report) => {
    Object.keys(report.item_scores || {}).forEach((key) => presentKeys.add(key))
  })

  return [
    ...Object.keys(KPI_ITEM_META).filter((key) => presentKeys.has(key)),
    ...[...presentKeys].filter((key) => !Object.prototype.hasOwnProperty.call(KPI_ITEM_META, key)),
  ]
}

function buildScoreSummary(reports, itemKeys) {
  return itemKeys.map((key) => {
    const scores = reports
      .map((report) => report.item_scores?.[key])
      .filter((score) => score != null)

    const average = scores.length
      ? scores.reduce((sum, value) => sum + value, 0) / scores.length
      : null

    return {
      key,
      average,
      distribution: [1, 2, 3, 4, 5].map((value) => scores.filter((score) => score === value).length),
      total: scores.length,
    }
  })
}

function scoreTone(score) {
  if (score == null) return 'slate'
  if (score >= 4) return 'ok'
  if (score >= 3) return 'warn'
  return 'danger'
}

function totalTone(total) {
  if (total >= 0.8) return 'ok'
  if (total >= 0.6) return 'warn'
  return 'danger'
}

function ScorePill({ value }) {
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
      value == null
        ? 'bg-slate-200 text-slate-500'
        : value >= 4
          ? 'bg-emerald-500 text-white'
          : value >= 3
            ? 'bg-amber-400 text-white'
            : 'bg-rose-500 text-white'
    }`}>
      {value ?? '-'}
    </span>
  )
}

function storeLabel(report) {
  return normalizeStoreName(report.branch?.name || report.store_name || '')
}

function formatMetricValue(key, metrics) {
  if (key === 'sales') return metrics?.actual != null ? fmtRp(metrics.actual) : '-'
  if (key === 'avg') return metrics?.actual != null ? fmtRp(metrics.actual) : '-'
  if (key === 'audit') return metrics != null ? `${Number(metrics).toFixed(1)}%` : '-'
  if (key === 'complain') return metrics ? `${metrics.count || 0} kasus` : '-'
  return '-'
}

function StoreCard({ rank, report, itemKeys, previousReport, expanded, onToggle }) {
  const salesMetric = report.metrics?.sales || null
  const avgMetric = report.metrics?.avg || null
  const auditMetric = report.metrics?.audit ?? null
  const complainMetric = report.metrics?.complain || null

  return (
    <article className={`rounded-[22px] border px-4 py-4 shadow-[0_16px_42px_-34px_rgba(15,23,42,0.28)] transition-colors ${
      expanded ? 'border-primary-200 bg-primary-50' : 'border-white/85 bg-white'
    }`}>
      <button onClick={onToggle} type="button" className="flex w-full items-center gap-3 text-left">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-bold ${
          rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
        }`}>
          {rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-950">{storeLabel(report)}</div>
          <div className="mt-1 text-xs text-slate-500">
            {report.branch?.store_id || '-'} / {report.branch?.district || '-'} / {report.dm_name}
          </div>
        </div>
        <ToneBadge tone={totalTone(report.total_score || 0)}>{((report.total_score || 0) * 100).toFixed(1)}%</ToneBadge>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-primary-100 pt-4">
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
            <InlineStat label="Net Sales" value={formatMetricValue('sales', salesMetric)} tone="primary" />
            <InlineStat label="AVG" value={formatMetricValue('avg', avgMetric)} tone="slate" />
            <InlineStat label="Audit" value={formatMetricValue('audit', auditMetric)} tone="slate" />
            <InlineStat label="Komplain" value={formatMetricValue('complain', complainMetric)} tone="slate" />
          </div>

          <div className="rounded-[20px] bg-white/90 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Skor per item</div>
            <div className="mt-3 space-y-2">
              {itemKeys.map((key) => {
                const current = report.item_scores?.[key]
                const previous = previousReport?.item_scores?.[key] ?? null
                const trend =
                  previous == null || current == null
                    ? 'netral'
                    : current > previous
                      ? 'naik'
                      : current < previous
                        ? 'turun'
                        : 'stabil'

                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800">{key}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{KPI_ITEM_META[key]?.target || 'Pantau per item'}</div>
                    </div>
                    <div className={`text-[11px] font-semibold ${
                      trend === 'naik'
                        ? 'text-emerald-600'
                        : trend === 'turun'
                          ? 'text-rose-500'
                          : 'text-slate-400'
                    }`}>
                      {trend}
                    </div>
                    <ScorePill value={current} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

export default function KPIReport() {
  const { profile } = useAuth()
  const [reports, setReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeMonth, setActiveMonth] = useState('')
  const [openStoreName, setOpenStoreName] = useState(null)
  const [dmFilter, setDmFilter] = useState('all')

  useEffect(() => {
    if (!profile?.role) return

    let mounted = true

    const loadReports = async () => {
      setLoadingReports(true)
      setLoadError('')

      const { data, error } = await supabase
        .from('kpi_monthly_reports')
        .select(`
          id,
          branch_id,
          bulan,
          dm_name,
          total_score,
          item_scores,
          metrics,
          source_updated_at,
          branch:branches (
            id,
            name,
            store_id,
            district,
            area
          )
        `)
        .order('bulan', { ascending: true })

      if (!mounted) return

      if (error) {
        setReports([])
        setLoadError(error.message || 'Tidak bisa mengambil data KPI.')
        setLoadingReports(false)
        return
      }

      setReports(data || [])
      setLoadingReports(false)
    }

    loadReports()

    return () => {
      mounted = false
    }
  }, [profile?.id, profile?.role])

  const footer = profile?.role === 'ops_manager'
    ? <OpsBottomNav />
    : isManagerRole(profile?.role)
      ? <DMBottomNav />
      : <StaffBottomNav />

  const uniqueBranches = useMemo(() => {
    const seen = new Map()
    reports.forEach((report) => {
      if (report.branch?.id && !seen.has(report.branch.id)) {
        seen.set(report.branch.id, report.branch)
      }
    })
    return [...seen.values()]
  }, [reports])

  const monthOptions = useMemo(() => {
    return [...new Set(reports.map((report) => report.bulan))]
      .sort((a, b) => new Date(a) - new Date(b))
      .map((bulan) => ({
        key: bulan,
        label: formatMonthLabel(bulan),
      }))
  }, [reports])

  useEffect(() => {
    if (!monthOptions.length) {
      setActiveMonth('')
      return
    }

    const isStillValid = monthOptions.some((option) => option.key === activeMonth)
    if (!isStillValid) {
      setActiveMonth(monthOptions[monthOptions.length - 1].key)
    }
  }, [monthOptions, activeMonth])

  const monthReports = useMemo(() => {
    return reports.filter((report) => report.bulan === activeMonth)
  }, [reports, activeMonth])

  const itemKeys = useMemo(() => buildItemKeys(monthReports), [monthReports])

  const sortedStores = useMemo(() => {
    return [...monthReports].sort((a, b) => (b.total_score || 0) - (a.total_score || 0))
  }, [monthReports])

  const dmNames = useMemo(() => {
    return [...new Set(sortedStores.map((report) => report.dm_name).filter(Boolean))].sort()
  }, [sortedStores])

  const activeDmFilter = dmNames.includes(dmFilter) ? dmFilter : 'all'

  const visibleStores = useMemo(() => {
    return activeDmFilter === 'all'
      ? sortedStores
      : sortedStores.filter((report) => report.dm_name === activeDmFilter)
  }, [sortedStores, activeDmFilter])

  const dmRanking = useMemo(() => buildDmRanking(sortedStores), [sortedStores])
  const avgTotal = sortedStores.length
    ? sortedStores.reduce((sum, report) => sum + (report.total_score || 0), 0) / sortedStores.length
    : 0
  const topStores = sortedStores.slice(0, 3)
  const bottomStores = [...sortedStores].sort((a, b) => (a.total_score || 0) - (b.total_score || 0)).slice(0, 3)
  const itemSummary = useMemo(() => buildScoreSummary(sortedStores, itemKeys), [sortedStores, itemKeys])

  const previousMonth = useMemo(() => {
    const index = monthOptions.findIndex((option) => option.key === activeMonth)
    return index > 0 ? monthOptions[index - 1].key : ''
  }, [monthOptions, activeMonth])

  const previousReportsByBranch = useMemo(() => {
    return Object.fromEntries(
      reports
        .filter((report) => report.bulan === previousMonth)
        .map((report) => [report.branch_id, report])
    )
  }, [reports, previousMonth])

  const lastUpdated = useMemo(() => {
    const values = reports.map((report) => report.source_updated_at).filter(Boolean).sort()
    return values[values.length - 1] || ''
  }, [reports])

  useEffect(() => {
    setOpenStoreName(null)
  }, [activeMonth, activeDmFilter])

  if (loadingReports) {
    return (
      <SubpageShell
        title="KPI Report"
        subtitle="Menyiapkan akses KPI..."
        eyebrow="Performance"
        footer={footer}
      >
        <div className="flex justify-center py-24">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      </SubpageShell>
    )
  }

  if (loadError) {
    return (
      <SubpageShell
        title="KPI Report"
        subtitle="Tidak bisa mengambil data KPI"
        eyebrow="Performance"
        footer={footer}
      >
        <EmptyPanel
          title="KPI belum bisa dimuat"
          description={loadError}
        />
      </SubpageShell>
    )
  }

  if (!uniqueBranches.length || !monthOptions.length || !sortedStores.length) {
    return (
      <SubpageShell
        title="KPI Report"
        subtitle="Belum ada data sesuai scope akun ini"
        eyebrow="Performance"
        footer={footer}
      >
        <EmptyPanel
          title="KPI belum tersedia"
          description="Data KPI untuk scope toko atau wilayah akun ini belum tersedia di Supabase untuk periode yang dipilih."
        />
      </SubpageShell>
    )
  }

  return (
    <SubpageShell
      title="KPI Report 2026"
      subtitle={`${formatMonthLabel(activeMonth)} / update ${lastUpdated || '-'}`}
      eyebrow="Performance"
      footer={footer}
    >
      <HeroCard
        eyebrow={getScopeLabel(profile, uniqueBranches)}
        title={`Avg KPI ${(avgTotal * 100).toFixed(1)}%`}
        description="Semua ranking, DM scorecard, dan analisis item di halaman ini mengikuti scope toko, district, atau area akun yang sedang login lewat policy Supabase."
        meta={
          <>
            <ToneBadge tone={totalTone(avgTotal)}>{sortedStores.length} toko terlihat</ToneBadge>
            <ToneBadge tone="info">{dmRanking.length} manager tercakup</ToneBadge>
            {isStoreRole(profile?.role) && <ToneBadge tone="ok">Mode toko sendiri</ToneBadge>}
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InlineStat label="Avg Score" value={`${(avgTotal * 100).toFixed(1)}%`} tone="primary" />
          <InlineStat label="Top Performer" value={storeLabel(topStores[0] || {}) || '-'} tone="emerald" />
          <InlineStat label="Perlu Perhatian" value={storeLabel(bottomStores[0] || {}) || '-'} tone={bottomStores.length ? 'rose' : 'slate'} />
          <InlineStat label="Scope" value={uniqueBranches.length} tone="slate" />
        </div>
      </HeroCard>

      <div className="mt-6 space-y-6">
        <SectionPanel
          eyebrow="Period"
          title="Pilih Bulan"
          description="KPI tampil per bulan dan tetap terfilter mengikuti scope akses user."
          actions={
            <SegmentedControl
              options={monthOptions}
              value={activeMonth}
              onChange={setActiveMonth}
            />
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {monthOptions.map((month) => {
              const reportsForMonth = reports.filter((report) => report.bulan === month.key)
              const monthAverage = reportsForMonth.length
                ? reportsForMonth.reduce((sum, report) => sum + (report.total_score || 0), 0) / reportsForMonth.length
                : 0

              return (
                <button
                  key={month.key}
                  type="button"
                  onClick={() => setActiveMonth(month.key)}
                  className={`rounded-[18px] px-4 py-4 text-left transition-colors ${
                    month.key === activeMonth ? 'bg-primary-600 text-white' : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                    month.key === activeMonth ? 'text-primary-100' : 'text-slate-400'
                  }`}>
                    {month.label}
                  </div>
                  <div className={`mt-2 text-2xl font-semibold ${month.key === activeMonth ? 'text-white' : 'text-slate-950'}`}>
                    {(monthAverage * 100).toFixed(1)}%
                  </div>
                  <div className={`mt-1 text-xs ${month.key === activeMonth ? 'text-primary-100' : 'text-slate-500'}`}>
                    {reportsForMonth.length} toko sesuai scope
                  </div>
                </button>
              )
            })}
          </div>
        </SectionPanel>

        <div className="grid gap-4 xl:grid-cols-2">
          <SectionPanel eyebrow="Top Performer" title="3 Toko Terbaik" description={`${formatMonthLabel(activeMonth)} / scope aktif`}>
            <div className="space-y-2">
              {topStores.map((report, index) => (
                <div key={`${report.branch_id}-${report.bulan}`} className="flex items-center gap-3 rounded-[20px] bg-emerald-50 px-4 py-3">
                  <div className="text-lg">{index === 0 ? '1' : index === 1 ? '2' : '3'}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">{storeLabel(report)}</div>
                    <div className="mt-1 text-xs text-slate-500">{report.dm_name}</div>
                  </div>
                  <ToneBadge tone="ok">{((report.total_score || 0) * 100).toFixed(1)}%</ToneBadge>
                </div>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel eyebrow="Needs Attention" title="3 Toko Terendah" description={`${formatMonthLabel(activeMonth)} / scope aktif`}>
            <div className="space-y-2">
              {bottomStores.map((report) => (
                <div key={`${report.branch_id}-${report.bulan}`} className="flex items-center gap-3 rounded-[20px] bg-rose-50 px-4 py-3">
                  <div className="text-lg">!</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">{storeLabel(report)}</div>
                    <div className="mt-1 text-xs text-slate-500">{report.dm_name}</div>
                  </div>
                  <ToneBadge tone="danger">{((report.total_score || 0) * 100).toFixed(1)}%</ToneBadge>
                </div>
              ))}
            </div>
          </SectionPanel>
        </div>

        <SectionPanel
          eyebrow="DM Scorecard"
          title="Ranking Manager yang Tercakup"
          description="Manager di bawah ini dihitung hanya dari toko yang memang terlihat oleh akun saat ini."
        >
          <div className="space-y-2">
            {dmRanking.map((manager, index) => (
              <div key={manager.name} className="flex items-center gap-3 rounded-[22px] bg-slate-50/85 px-4 py-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold ${
                  index === 0 ? 'bg-amber-100 text-amber-700' : 'bg-white text-slate-500'
                }`}>
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{manager.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{manager.stores} toko</div>
                </div>
                <ToneBadge tone={totalTone(manager.score)}>{(manager.score * 100).toFixed(1)}%</ToneBadge>
              </div>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Store Ranking"
          title="Ranking Toko"
          description="Klik toko untuk melihat detail KPI per item. Filter manager hanya muncul dari scope data yang kamu miliki."
          actions={
            <SegmentedControl
              options={[{ key: 'all', label: 'Semua DM' }, ...dmNames.map((name) => ({ key: name, label: name }))]}
              value={activeDmFilter}
              onChange={setDmFilter}
            />
          }
        >
          <div className="space-y-3">
            {visibleStores.map((report, index) => (
              <StoreCard
                key={`${report.branch_id}-${report.bulan}`}
                rank={index + 1}
                report={report}
                itemKeys={itemKeys}
                previousReport={previousReportsByBranch[report.branch_id]}
                expanded={openStoreName === report.branch_id}
                onToggle={() => setOpenStoreName(openStoreName === report.branch_id ? null : report.branch_id)}
              />
            ))}
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Item Analysis"
          title="Rata-rata Skor per Item"
          description="Membantu melihat item KPI mana yang paling perlu dibenahi secara lintas toko di scope kamu."
        >
          <div className="space-y-3">
            {itemSummary.map((item) => (
              <div key={item.key} className="rounded-[22px] bg-slate-50/85 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-primary-700">
                    {KPI_ITEM_META[item.key]?.icon === 'finance' ? 'Rp' : KPI_ITEM_META[item.key]?.icon === 'warning' ? '!' : KPI_ITEM_META[item.key]?.icon === 'approval' ? 'OK' : 'K'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{item.key}</div>
                    <div className="mt-1 text-xs text-slate-500">{KPI_ITEM_META[item.key]?.target || 'Pantau detail KPI'}</div>
                  </div>
                  <ToneBadge tone={scoreTone(item.average)}>{item.average == null ? '-' : `${item.average.toFixed(2)}/5`}</ToneBadge>
                </div>
                <div className="mt-4 flex h-3 gap-1">
                  {item.distribution.map((count, distributionIndex) => {
                    const width = item.total ? (count / item.total) * 100 : 0
                    const colors = ['bg-rose-500', 'bg-orange-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500']
                    return width > 0 ? (
                      <div
                        key={`${item.key}-${distributionIndex}`}
                        className={`h-full rounded-full ${colors[distributionIndex]}`}
                        style={{ width: `${width}%` }}
                        title={`Score ${distributionIndex + 1}: ${count} toko`}
                      />
                    ) : null
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                  {item.distribution.map((count, distributionIndex) => (
                    <span key={`${item.key}-label-${distributionIndex}`}>{distributionIndex + 1}={count}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}
