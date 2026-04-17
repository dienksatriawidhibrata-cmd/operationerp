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

const PERIOD_MODE_OPTIONS = [
  { key: 'month', label: 'Bulanan' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'semester', label: 'Semester' },
  { key: 'year', label: 'Tahunan' },
]

const PERIOD_MODE_LABELS = {
  month: 'bulanan',
  quarter: 'quarter',
  semester: 'semester',
  year: 'tahunan',
}

function parseMonthValue(value) {
  if (!value) return null
  return new Date(`${value}T00:00:00Z`)
}

function formatMonthLabel(value) {
  if (!value) return '-'
  const date = parseMonthValue(value)
  return monthFormatter.format(date)
}

function averageNumbers(values) {
  const normalized = values
    .map((value) => {
      if (value == null || value === '') return null
      const numeric = Number(value)
      return Number.isFinite(numeric) ? numeric : null
    })
    .filter((value) => value != null)

  if (!normalized.length) return null
  return normalized.reduce((sum, value) => sum + value, 0) / normalized.length
}

function sumNumbers(values) {
  const normalized = values
    .map((value) => {
      if (value == null || value === '') return null
      const numeric = Number(value)
      return Number.isFinite(numeric) ? numeric : null
    })
    .filter((value) => value != null)

  if (!normalized.length) return null
  return normalized.reduce((sum, value) => sum + value, 0)
}

function formatScoreValue(value) {
  if (value == null) return '-'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '-'
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1)
}

function bucketScore(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return Math.min(5, Math.max(1, Math.round(numeric)))
}

function getPeriodMeta(bulan, mode) {
  const date = parseMonthValue(bulan)
  if (!date) return null

  const year = date.getUTCFullYear()
  const monthIndex = date.getUTCMonth()

  if (mode === 'month') {
    return {
      key: bulan,
      label: formatMonthLabel(bulan),
      sortValue: date.getTime(),
      expectedMonths: 1,
    }
  }

  if (mode === 'quarter') {
    const quarter = Math.floor(monthIndex / 3) + 1
    return {
      key: `${year}-Q${quarter}`,
      label: `Q${quarter} ${year}`,
      sortValue: Date.UTC(year, (quarter - 1) * 3, 1),
      expectedMonths: 3,
    }
  }

  if (mode === 'semester') {
    const semester = monthIndex < 6 ? 1 : 2
    return {
      key: `${year}-S${semester}`,
      label: `S${semester} ${year}`,
      sortValue: Date.UTC(year, semester === 1 ? 0 : 6, 1),
      expectedMonths: 6,
    }
  }

  return {
    key: `${year}`,
    label: String(year),
    sortValue: Date.UTC(year, 0, 1),
    expectedMonths: 12,
  }
}

function buildPeriodOptions(reports, mode) {
  const grouped = new Map()

  reports.forEach((report) => {
    const meta = getPeriodMeta(report.bulan, mode)
    if (!meta) return

    if (!grouped.has(meta.key)) {
      grouped.set(meta.key, { ...meta, months: new Set() })
    }

    grouped.get(meta.key).months.add(report.bulan)
  })

  return [...grouped.values()]
    .map((option) => {
      const months = [...option.months].sort((a, b) => parseMonthValue(a) - parseMonthValue(b))
      const monthCount = months.length
      const isPartial = monthCount < option.expectedMonths

      return {
        key: option.key,
        label: option.label,
        sortValue: option.sortValue,
        months,
        monthCount,
        expectedMonths: option.expectedMonths,
        isPartial,
        coverageLabel:
          mode === 'month'
            ? formatMonthLabel(months[0])
            : isPartial
              ? `${monthCount}/${option.expectedMonths} bulan`
              : `${monthCount} bulan`,
      }
    })
    .sort((a, b) => a.sortValue - b.sortValue)
}

function aggregateTargetActualMetric(entries, strategy = 'sum') {
  if (!entries.length) return null

  const aggregate = strategy === 'average' ? averageNumbers : sumNumbers
  const target = aggregate(entries.map((entry) => entry?.target))
  const actual = aggregate(entries.map((entry) => entry?.actual))

  if (target == null && actual == null) return null
  return { target, actual }
}

function aggregateRatioMetric(entries, denominatorKey, numeratorKey, extraKeys = [], precision = 4) {
  if (!entries.length) return null

  const denominator = sumNumbers(entries.map((entry) => entry?.[denominatorKey]))
  const numerator = sumNumbers(entries.map((entry) => entry?.[numeratorKey]))

  if (denominator == null && numerator == null) return null

  const aggregated = {
    [denominatorKey]: denominator || 0,
    [numeratorKey]: numerator || 0,
  }

  extraKeys.forEach((key) => {
    aggregated[key] = sumNumbers(entries.map((entry) => entry?.[key])) || 0
  })

  aggregated.rate = denominator ? +((numerator || 0) / denominator).toFixed(precision) : 0

  return aggregated
}

function aggregateMetrics(metricRows) {
  return {
    sales: aggregateTargetActualMetric(metricRows.map((metrics) => metrics?.sales).filter(Boolean), 'sum'),
    avg: aggregateTargetActualMetric(metricRows.map((metrics) => metrics?.avg).filter(Boolean), 'average'),
    audit: averageNumbers(metricRows.map((metrics) => metrics?.audit)),
    mysteryShopper: averageNumbers(metricRows.map((metrics) => metrics?.mysteryShopper)),
    large: aggregateRatioMetric(metricRows.map((metrics) => metrics?.large).filter(Boolean), 'total', 'large', ['small']),
    oatside: aggregateRatioMetric(metricRows.map((metrics) => metrics?.oatside).filter(Boolean), 'drinks', 'oat'),
    bundling: aggregateRatioMetric(metricRows.map((metrics) => metrics?.bundling).filter(Boolean), 'total', 'asik'),
    complain: aggregateRatioMetric(metricRows.map((metrics) => metrics?.complain).filter(Boolean), 'trx', 'count', [], 6),
    retention: aggregateRatioMetric(metricRows.map((metrics) => metrics?.retention).filter(Boolean), 'total', 'resign'),
    hpp: aggregateRatioMetric(metricRows.map((metrics) => metrics?.hpp).filter(Boolean), 'gross', 'hpp'),
  }
}

function aggregateReportsForPeriod(reports, periodOption) {
  const grouped = new Map()

  reports.forEach((report) => {
    if (!grouped.has(report.branch_id)) {
      grouped.set(report.branch_id, [])
    }
    grouped.get(report.branch_id).push(report)
  })

  return [...grouped.values()].map((branchReports) => {
    const orderedReports = [...branchReports].sort((a, b) => parseMonthValue(a.bulan) - parseMonthValue(b.bulan))
    const latestReport = orderedReports[orderedReports.length - 1]
    const itemKeys = buildItemKeys(orderedReports)

    const updatedValues = orderedReports.map((report) => report.source_updated_at).filter(Boolean).sort()

    return {
      ...latestReport,
      total_score: averageNumbers(orderedReports.map((report) => report.total_score)) || 0,
      item_scores: Object.fromEntries(
        itemKeys.map((key) => [key, averageNumbers(orderedReports.map((report) => report.item_scores?.[key]))])
      ),
      metrics: aggregateMetrics(orderedReports.map((report) => report.metrics || {})),
      source_updated_at: updatedValues[updatedValues.length - 1] || latestReport.source_updated_at,
      period_key: periodOption.key,
      period_label: periodOption.label,
      period_months: orderedReports.map((report) => report.bulan),
      month_count: orderedReports.length,
    }
  })
}

function buildDmRanking(reports) {
  const grouped = reports.reduce((acc, report) => {
    if (!acc[report.dm_name]) acc[report.dm_name] = []
    acc[report.dm_name].push(Number(report.total_score) || 0)
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

    const average = averageNumbers(scores)

    return {
      key,
      average,
      distribution: [1, 2, 3, 4, 5].map((value) => scores.filter((score) => bucketScore(score) === value).length),
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
    <span className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2 py-1 text-[11px] font-bold ${
      value == null
        ? 'bg-slate-200 text-slate-500'
        : value >= 4
          ? 'bg-emerald-500 text-white'
          : value >= 3
            ? 'bg-amber-400 text-white'
            : 'bg-rose-500 text-white'
    }`}>
      {formatScoreValue(value)}
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

function pct(value, target) {
  if (!target || value == null) return null
  return value / target
}

function MetricRow({ label, value, target, format = 'rp' }) {
  const ratio = pct(value, target)
  const tone = ratio == null ? 'slate' : ratio >= 1 ? 'ok' : ratio >= 0.9 ? 'warn' : 'danger'
  const formatted =
    format === 'rp' ? (value != null ? fmtRp(value) : '-') :
    format === 'pct' ? (value != null ? `${(value * 100).toFixed(1)}%` : '-') :
    format === 'score' ? (value != null ? value.toFixed(1) : '-') :
    (value != null ? String(value) : '-')
  const targetFmt =
    format === 'rp' ? (target != null ? fmtRp(target) : null) :
    format === 'pct' ? (target != null ? `${(target * 100).toFixed(1)}%` : null) :
    null

  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-white/90 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-0.5 text-sm font-semibold text-slate-900">{formatted}</div>
        {targetFmt && <div className="mt-0.5 text-[11px] text-slate-400">Target: {targetFmt}</div>}
      </div>
      {ratio != null && (
        <ToneBadge tone={tone}>{(ratio * 100).toFixed(0)}%</ToneBadge>
      )}
    </div>
  )
}

function StoreDetailView({
  report,
  previousReport,
  itemKeys,
  periodMode,
  periodOptions,
  activePeriodKey,
  onPeriodChange,
  onPeriodModeChange,
  reportsByPeriodKey,
}) {
  const m = report.metrics || {}
  const sales = m.sales
  const avg = m.avg
  const audit = m.audit
  const ms = m.mysteryShopper
  const large = m.large
  const oatside = m.oatside
  const bundling = m.bundling
  const complain = m.complain

  return (
    <div className="space-y-6">
      <SectionPanel
        eyebrow="Period"
        title="Pilih Periode"
        description="Skor quarter, semester, dan tahunan dihitung dari rata-rata skor bulanan pada bulan yang sudah tersedia."
        actions={
          <SegmentedControl
            options={PERIOD_MODE_OPTIONS}
            value={periodMode}
            onChange={onPeriodModeChange}
          />
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {periodOptions.map((period) => {
            const periodReport = reportsByPeriodKey[period.key] || null

            return (
            <button
              key={period.key}
              type="button"
              onClick={() => onPeriodChange(period.key)}
              className={`rounded-[18px] px-4 py-4 text-left transition-colors ${
                period.key === activePeriodKey ? 'bg-primary-600 text-white' : 'bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                period.key === activePeriodKey ? 'text-primary-100' : 'text-slate-400'
              }`}>{period.label}</div>
              <div className={`mt-2 text-2xl font-semibold ${period.key === activePeriodKey ? 'text-white' : 'text-slate-950'}`}>
                {periodReport ? `${((periodReport.total_score || 0) * 100).toFixed(1)}%` : '-'}
              </div>
              {periodMode !== 'month' && (
                <div className={`mt-1 text-xs ${period.key === activePeriodKey ? 'text-primary-100' : 'text-slate-500'}`}>
                  {period.coverageLabel}
                </div>
              )}
            </button>
            )
          })}
        </div>
      </SectionPanel>

      <SectionPanel eyebrow="Metrics" title="Pencapaian Detail">
        <div className="space-y-2">
          <MetricRow label="Net Sales" value={sales?.actual} target={sales?.target} format="rp" />
          <MetricRow label="AVG Transaksi" value={avg?.actual} target={avg?.target} format="rp" />
          {audit != null && (
            <MetricRow label="Audit Score" value={audit / 100} target={0.9} format="pct" />
          )}
          {ms != null && (
            <MetricRow label="Mystery Shopper" value={ms} target={5} format="score" />
          )}
          {large != null && (
            <MetricRow label="Large Attach Rate" value={large.rate} target={0.65} format="pct" />
          )}
          {oatside != null && (
            <MetricRow label="Oatside Attach Rate" value={oatside.rate} target={0.05} format="pct" />
          )}
          {bundling != null && (
            <MetricRow label="Bundling Asik Rate" value={bundling.rate} target={0.05} format="pct" />
          )}
          {complain != null && (
            <div className="flex items-center gap-3 rounded-[18px] bg-white/90 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-500">Komplain</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">{complain.count || 0} kasus</div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {complain.trx ? `${((complain.count / complain.trx) * 100).toFixed(3)}% dari ${complain.trx.toLocaleString('id-ID')} trx` : ''}
                </div>
              </div>
              <ToneBadge tone={complain.count === 0 ? 'ok' : complain.count <= 3 ? 'warn' : 'danger'}>
                {complain.count === 0 ? 'Bersih' : `${complain.count} kasus`}
              </ToneBadge>
            </div>
          )}
        </div>
      </SectionPanel>

      <SectionPanel eyebrow="Skor KPI" title="Penilaian per Item">
        <div className="space-y-2">
          {itemKeys.map((key) => {
            const current = report.item_scores?.[key]
            const previous = previousReport?.item_scores?.[key] ?? null
            const trend =
              previous == null || current == null ? 'netral' :
              current > previous ? 'naik' :
              current < previous ? 'turun' : 'stabil'
            return (
              <div key={key} className="flex items-center gap-3 rounded-[18px] bg-white/90 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800">{key}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{KPI_ITEM_META[key]?.target || 'Pantau per item'}</div>
                </div>
                <div className={`text-[11px] font-semibold ${
                  trend === 'naik' ? 'text-emerald-600' : trend === 'turun' ? 'text-rose-500' : 'text-slate-400'
                }`}>{trend}</div>
                <ScorePill value={current} />
              </div>
            )
          })}
        </div>
      </SectionPanel>
    </div>
  )
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
  const [periodMode, setPeriodMode] = useState('month')
  const [activePeriodKey, setActivePeriodKey] = useState('')
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

  const periodOptions = useMemo(() => buildPeriodOptions(reports, periodMode), [reports, periodMode])
  const resolvedActivePeriodKey = useMemo(() => {
    if (!periodOptions.length) return ''
    return periodOptions.some((option) => option.key === activePeriodKey)
      ? activePeriodKey
      : periodOptions[periodOptions.length - 1].key
  }, [periodOptions, activePeriodKey])

  useEffect(() => {
    if (activePeriodKey !== resolvedActivePeriodKey) {
      setActivePeriodKey(resolvedActivePeriodKey)
    }
  }, [activePeriodKey, resolvedActivePeriodKey])

  const reportsByPeriodKey = useMemo(() => {
    return Object.fromEntries(
      periodOptions.map((option) => [
        option.key,
        aggregateReportsForPeriod(
          reports.filter((report) => option.months.includes(report.bulan)),
          option
        ),
      ])
    )
  }, [reports, periodOptions])

  const activePeriodOption = useMemo(() => {
    return periodOptions.find((option) => option.key === resolvedActivePeriodKey) || null
  }, [periodOptions, resolvedActivePeriodKey])

  const activePeriodReports = useMemo(() => {
    return reportsByPeriodKey[resolvedActivePeriodKey] || []
  }, [reportsByPeriodKey, resolvedActivePeriodKey])

  const itemKeys = useMemo(() => buildItemKeys(activePeriodReports), [activePeriodReports])

  const sortedStores = useMemo(() => {
    return [...activePeriodReports].sort((a, b) => (Number(b.total_score) || 0) - (Number(a.total_score) || 0))
  }, [activePeriodReports])

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
  const periodStatsByKey = useMemo(() => {
    return Object.fromEntries(
      periodOptions.map((option) => {
        const optionReports = reportsByPeriodKey[option.key] || []
        const averageTotal = optionReports.length
          ? optionReports.reduce((sum, report) => sum + (Number(report.total_score) || 0), 0) / optionReports.length
          : 0

        return [
          option.key,
          {
            averageTotal,
            stores: optionReports.length,
          },
        ]
      })
    )
  }, [periodOptions, reportsByPeriodKey])

  const storeReportsByPeriodKey = useMemo(() => {
    return Object.fromEntries(
      periodOptions.map((option) => [
        option.key,
        (reportsByPeriodKey[option.key] || [])[0] || null,
      ])
    )
  }, [periodOptions, reportsByPeriodKey])

  const avgTotal = sortedStores.length
    ? sortedStores.reduce((sum, report) => sum + (Number(report.total_score) || 0), 0) / sortedStores.length
    : 0
  const topStores = sortedStores.slice(0, 3)
  const bottomStores = [...sortedStores].sort((a, b) => (Number(a.total_score) || 0) - (Number(b.total_score) || 0)).slice(0, 3)
  const itemSummary = useMemo(() => buildScoreSummary(sortedStores, itemKeys), [sortedStores, itemKeys])

  const previousPeriodKey = useMemo(() => {
    const index = periodOptions.findIndex((option) => option.key === resolvedActivePeriodKey)
    return index > 0 ? periodOptions[index - 1].key : ''
  }, [periodOptions, resolvedActivePeriodKey])

  const previousReportsByBranch = useMemo(() => {
    return Object.fromEntries(
      (reportsByPeriodKey[previousPeriodKey] || [])
        .map((report) => [report.branch_id, report])
    )
  }, [reportsByPeriodKey, previousPeriodKey])

  const lastUpdated = useMemo(() => {
    const values = reports.map((report) => report.source_updated_at).filter(Boolean).sort()
    return values[values.length - 1] || ''
  }, [reports])

  useEffect(() => {
    setOpenStoreName(null)
  }, [resolvedActivePeriodKey, activeDmFilter, periodMode])

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

  if (!uniqueBranches.length || !periodOptions.length || !sortedStores.length) {
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

  const myReport = isStoreRole(profile?.role) ? sortedStores[0] || null : null
  const myPreviousReport = myReport ? previousReportsByBranch[myReport.branch_id] || null : null
  const activePeriodLabel = activePeriodOption?.label || '-'
  const activePeriodSubtitle =
    activePeriodOption && periodMode !== 'month'
      ? `${activePeriodLabel} / ${activePeriodOption.coverageLabel}`
      : activePeriodLabel

  return (
    <SubpageShell
      title="KPI Report 2026"
      subtitle={`${activePeriodSubtitle} / update ${lastUpdated || '-'}`}
      eyebrow="Performance"
      footer={footer}
    >
      <HeroCard
        eyebrow={getScopeLabel(profile, uniqueBranches)}
        title={`KPI ${((myReport || sortedStores[0] || { total_score: avgTotal }).total_score * 100).toFixed(1)}%`}
        description={
          isStoreRole(profile?.role)
            ? 'Skor dan detail KPI toko kamu mengikuti periode aktif. Klik kartu periode di bawah untuk melihat progress bulanan, quarter, semester, atau tahunan.'
            : 'Semua ranking, DM scorecard, dan analisis item di halaman ini mengikuti scope toko, district, atau area akun yang sedang login lewat policy Supabase dan periode yang sedang dipilih.'
        }
        meta={
          <>
            <ToneBadge tone={totalTone(myReport?.total_score || avgTotal)}>
              {isStoreRole(profile?.role) ? activePeriodLabel : `${sortedStores.length} toko`}
            </ToneBadge>
            {!isStoreRole(profile?.role) && <ToneBadge tone="info">{dmRanking.length} manager tercakup</ToneBadge>}
          </>
        }
      >
        {isStoreRole(profile?.role) ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <InlineStat label="Score Periode" value={`${((myReport?.total_score || 0) * 100).toFixed(1)}%`} tone="primary" />
            <InlineStat label="Net Sales" value={formatMetricValue('sales', myReport?.metrics?.sales)} tone="slate" />
            <InlineStat label="Audit" value={formatMetricValue('audit', myReport?.metrics?.audit)} tone="slate" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InlineStat label="Avg Score" value={`${(avgTotal * 100).toFixed(1)}%`} tone="primary" />
            <InlineStat label="Top Performer" value={storeLabel(topStores[0] || {}) || '-'} tone="emerald" />
            <InlineStat label="Perlu Perhatian" value={storeLabel(bottomStores[0] || {}) || '-'} tone={bottomStores.length ? 'rose' : 'slate'} />
            <InlineStat label="Scope" value={uniqueBranches.length} tone="slate" />
          </div>
        )}
      </HeroCard>

      <div className="mt-6 space-y-6">
        {isStoreRole(profile?.role) && myReport ? (
          <StoreDetailView
            report={myReport}
            previousReport={myPreviousReport}
            itemKeys={itemKeys}
            periodMode={periodMode}
            periodOptions={periodOptions}
            activePeriodKey={resolvedActivePeriodKey}
            onPeriodChange={setActivePeriodKey}
            onPeriodModeChange={setPeriodMode}
            reportsByPeriodKey={storeReportsByPeriodKey}
          />
        ) : null}

        {!isStoreRole(profile?.role) && (
        <>
        <SectionPanel
          eyebrow="Period"
          title="Pilih Periode"
          description={`KPI tampil per ${PERIOD_MODE_LABELS[periodMode] || 'periode'} dan tetap terfilter mengikuti scope akses user. Untuk quarter, semester, dan tahunan, skor dihitung dari rata-rata skor bulanan yang tersedia.`}
          actions={
            <SegmentedControl
              options={PERIOD_MODE_OPTIONS}
              value={periodMode}
              onChange={setPeriodMode}
            />
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {periodOptions.map((period) => {
              const periodStats = periodStatsByKey[period.key] || { averageTotal: 0, stores: 0 }

              return (
                <button
                  key={period.key}
                  type="button"
                  onClick={() => setActivePeriodKey(period.key)}
                  className={`rounded-[18px] px-4 py-4 text-left transition-colors ${
                    period.key === resolvedActivePeriodKey ? 'bg-primary-600 text-white' : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                    period.key === resolvedActivePeriodKey ? 'text-primary-100' : 'text-slate-400'
                  }`}>
                    {period.label}
                  </div>
                  <div className={`mt-2 text-2xl font-semibold ${period.key === resolvedActivePeriodKey ? 'text-white' : 'text-slate-950'}`}>
                    {(periodStats.averageTotal * 100).toFixed(1)}%
                  </div>
                  <div className={`mt-1 text-xs ${period.key === resolvedActivePeriodKey ? 'text-primary-100' : 'text-slate-500'}`}>
                    {periodStats.stores} toko sesuai scope{periodMode !== 'month' ? ` / ${period.coverageLabel}` : ''}
                  </div>
                </button>
              )
            })}
          </div>
        </SectionPanel>

        <div className="grid gap-4 xl:grid-cols-2">
          <SectionPanel eyebrow="Top Performer" title="3 Toko Terbaik" description={`${activePeriodLabel} / scope aktif`}>
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

          <SectionPanel eyebrow="Needs Attention" title="3 Toko Terendah" description={`${activePeriodLabel} / scope aktif`}>
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
          description="Klik toko untuk melihat detail KPI per item pada periode aktif. Filter manager hanya muncul dari scope data yang kamu miliki."
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
          description={
            periodMode === 'month'
              ? 'Membantu melihat item KPI mana yang paling perlu dibenahi secara lintas toko di scope kamu.'
              : 'Untuk periode non-bulanan, skor item per toko dirata-ratakan dari skor bulanan lalu dipetakan ke bucket terdekat untuk distribusinya.'
          }
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
        </>
        )}
      </div>
    </SubpageShell>
  )
}
