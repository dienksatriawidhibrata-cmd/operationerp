import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel,
  SectionPanel,
  SegmentedControl,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'
import { currentPeriodWIB, lastNPeriods, periodLabel, roleLabel } from '../../lib/utils'

const GROUP_OPTIONS = [
  { key: 'all', label: 'Semua' },
  { key: 'store', label: 'Grup Toko' },
  { key: 'manager', label: 'Grup Manager' },
]

function scoreTone(score) {
  if (score >= 4) return 'ok'
  if (score >= 3) return 'warn'
  return 'danger'
}

function ScoreBar({ value, max = 5 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-1.5 rounded-full bg-primary-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-bold text-slate-700">{value.toFixed(1)}</span>
    </div>
  )
}

function PersonDetail({ row, itemMap }) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadDetail = async () => {
    if (detail) { setOpen((v) => !v); return }
    setLoading(true)
    const { data: subs } = await supabase
      .from('kpi_360_submissions')
      .select('id, catatan, evaluator_id')
      .eq('evaluatee_id', row.evaluatee_id)
      .eq('period_month', row.period_month)

    if (!subs?.length) { setDetail({ submissions: [] }); setOpen(true); setLoading(false); return }

    const subIds = subs.map((s) => s.id)
    const evaluatorIds = [...new Set(subs.map((s) => s.evaluator_id).filter(Boolean))]

    const [{ data: scores }, { data: evaluators }] = await Promise.all([
      supabase.from('kpi_360_scores').select('submission_id, item_key, score').in('submission_id', subIds),
      supabase.from('profiles').select('id, full_name, role').in('id', evaluatorIds),
    ])

    const evaluatorMap = Object.fromEntries((evaluators || []).map((e) => [e.id, e]))
    const scoresBySubmission = {}
    ;(scores || []).forEach((sc) => {
      if (!scoresBySubmission[sc.submission_id]) scoresBySubmission[sc.submission_id] = []
      scoresBySubmission[sc.submission_id].push(sc)
    })

    // Rata-rata per item (anonim — tidak tampilkan evaluator individual)
    const itemTotals = {}
    const itemCounts = {}
    ;(scores || []).forEach((sc) => {
      if (!itemTotals[sc.item_key]) { itemTotals[sc.item_key] = 0; itemCounts[sc.item_key] = 0 }
      itemTotals[sc.item_key] += Number(sc.score)
      itemCounts[sc.item_key] += 1
    })
    const itemAverages = Object.entries(itemTotals).map(([key, total]) => ({
      item_key: key,
      avg: total / itemCounts[key],
    }))

    // Catatan dari tiap submission (bisa anonim atau tidak, tergantung kebijakan)
    const catatanList = subs
      .map((s) => ({ catatan: s.catatan, evaluator: evaluatorMap[s.evaluator_id] }))
      .filter((s) => s.catatan)

    setDetail({ itemAverages, catatanList, totalSubmissions: subs.length })
    setOpen(true)
    setLoading(false)
  }

  return (
    <article className="rounded-[24px] border border-white/80 bg-white p-5 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.26)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {row.group_type === 'manager' ? 'Grup Manager' : 'Grup Toko'}
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-950">
            {row.evaluatee?.full_name || 'Tanpa nama'}
          </div>
          <div className="mt-1 text-sm text-slate-500">{roleLabel(row.evaluatee?.role)}</div>
        </div>
        <ToneBadge tone={scoreTone(row.average)}>
          {row.average.toFixed(2)} / 5
        </ToneBadge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-[20px] bg-slate-50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Submission</div>
          <div className="mt-2 text-xl font-semibold text-slate-950">{row.submissions}</div>
        </div>
        <div className="rounded-[20px] bg-slate-50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Update Terakhir</div>
          <div className="mt-2 text-sm font-semibold text-slate-950">
            {row.latest_update
              ? new Date(row.latest_update).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
              : '-'}
          </div>
        </div>
      </div>

      {/* Tombol drill-down */}
      <button
        type="button"
        onClick={loadDetail}
        className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
      >
        {loading ? 'Memuat...' : open ? 'Sembunyikan Detail ↑' : 'Lihat Detail Per Item ↓'}
      </button>

      {open && detail && (
        <div className="mt-4 space-y-3">
          {/* Skor per item */}
          {(detail.itemAverages || []).length > 0 && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Rata-rata Skor per Item ({detail.totalSubmissions} penilai)
              </div>
              <div className="space-y-2">
                {detail.itemAverages
                  .sort((a, b) => b.avg - a.avg)
                  .map(({ item_key, avg }) => (
                    <div key={item_key}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[11px] text-slate-600">
                          {itemMap[`${row.group_type}:${item_key}`] || item_key}
                        </span>
                        <span className="text-xs font-bold text-primary-700">{avg.toFixed(2)}</span>
                      </div>
                      <ScoreBar value={avg} />
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Catatan */}
          {(detail.catatanList || []).length > 0 && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 mb-2">
                Catatan ({detail.catatanList.length})
              </div>
              <div className="space-y-2">
                {detail.catatanList.map((c, i) => (
                  <div key={i} className="rounded-xl bg-white border border-blue-100 px-3 py-2 text-xs text-slate-700">
                    {c.catatan}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(detail.itemAverages || []).length === 0 && (detail.catatanList || []).length === 0 && (
            <div className="text-xs text-center italic text-slate-400 py-2">Tidak ada detail item atau catatan.</div>
          )}
        </div>
      )}
    </article>
  )
}

export default function KPI360ResultsPage() {
  const { profile } = useAuth()
  const [period, setPeriod] = useState(currentPeriodWIB())
  const [groupFilter, setGroupFilter] = useState('all')
  const [rows, setRows] = useState([])
  const [itemMap, setItemMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Load item names untuk semua group_type
  useEffect(() => {
    supabase.from('kpi_360_items').select('group_type, item_key, item_name').then(({ data }) => {
      if (data) {
        const map = {}
        data.forEach((item) => { map[`${item.group_type}:${item.item_key}`] = item.item_name })
        setItemMap(map)
      }
    })
  }, [])

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) return
      setLoading(true)
      setError('')

      let submissionQuery = supabase
        .from('kpi_360_submissions')
        .select('id,evaluatee_id,group_type,period_month,updated_at')
        .eq('period_month', period)

      if (groupFilter !== 'all') {
        submissionQuery = submissionQuery.eq('group_type', groupFilter)
      }

      if (['staff', 'barista', 'kitchen', 'waitress', 'asst_head_store'].includes(profile.role)) {
        submissionQuery = submissionQuery.eq('evaluatee_id', profile.id)
      }

      const { data: submissions, error: submissionError } = await submissionQuery.order('updated_at', { ascending: false })
      if (submissionError) {
        setRows([]); setError(submissionError.message || 'Gagal memuat hasil KPI 360.'); setLoading(false); return
      }
      if (!submissions?.length) { setRows([]); setLoading(false); return }

      const submissionIds = submissions.map((s) => s.id)
      const evaluateeIds = [...new Set(submissions.map((s) => s.evaluatee_id).filter(Boolean))]

      const [{ data: scores, error: scoreError }, { data: profiles, error: profileError }] = await Promise.all([
        supabase.from('kpi_360_scores').select('submission_id,item_key,score').in('submission_id', submissionIds),
        supabase.from('profiles').select('id,full_name,role').in('id', evaluateeIds),
      ])

      if (scoreError || profileError) {
        setRows([]); setError(scoreError?.message || profileError?.message || 'Gagal memuat rekap KPI 360.'); setLoading(false); return
      }

      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
      const grouped = {}
      ;(scores || []).forEach((row) => {
        if (!grouped[row.submission_id]) grouped[row.submission_id] = []
        grouped[row.submission_id].push(Number(row.score || 0))
      })

      const aggregated = submissions.reduce((acc, sub) => {
        if (!acc[sub.evaluatee_id]) {
          acc[sub.evaluatee_id] = {
            evaluatee_id: sub.evaluatee_id,
            group_type: sub.group_type,
            period_month: sub.period_month,
            latest_update: sub.updated_at,
            scores: [],
            submissions: 0,
          }
        }
        acc[sub.evaluatee_id].group_type = sub.group_type
        acc[sub.evaluatee_id].latest_update =
          acc[sub.evaluatee_id].latest_update > sub.updated_at
            ? acc[sub.evaluatee_id].latest_update
            : sub.updated_at
        acc[sub.evaluatee_id].scores.push(...(grouped[sub.id] || []))
        acc[sub.evaluatee_id].submissions += 1
        return acc
      }, {})

      const nextRows = Object.values(aggregated)
        .map((entry) => {
          const total = entry.scores.reduce((sum, v) => sum + v, 0)
          const average = entry.scores.length ? total / entry.scores.length : 0
          return { ...entry, average, evaluatee: profileMap[entry.evaluatee_id] }
        })
        .sort((a, b) => b.average - a.average)

      setRows(nextRows)
      setLoading(false)
    }
    load()
  }, [groupFilter, period, profile?.id, profile?.role])

  const topStats = useMemo(() => {
    const average = rows.length ? rows.reduce((sum, r) => sum + r.average, 0) / rows.length : 0
    return { total: rows.length, average, completed: rows.filter((r) => r.submissions > 0).length }
  }, [rows])

  return (
    <SubpageShell title="Hasil KPI 360" subtitle="Rekap penilaian rekan kerja" eyebrow="KPI 360" footer={<SmartBottomNav />}>
      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-32">
        <SectionPanel
          eyebrow="Filter"
          title="Pilih Periode dan Grup"
          description="Klik 'Lihat Detail Per Item' pada tiap kartu untuk melihat breakdown skor dan catatan."
          actions={<SegmentedControl options={GROUP_OPTIONS} value={groupFilter} onChange={setGroupFilter} />}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="label">Periode</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="input"
              >
                {lastNPeriods(6).map((v) => (
                  <option key={v} value={v}>{periodLabel(v)}</option>
                ))}
              </select>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Orang Dinilai</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{topStats.total}</div>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Rata-rata Skor</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{topStats.average ? topStats.average.toFixed(2) : '-'}</div>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Results"
          title={`Hasil 360 ${periodLabel(period)}`}
          description="Klik 'Lihat Detail Per Item' untuk breakdown skor dan catatan per orang."
        >
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : error ? (
            <EmptyPanel title="Hasil KPI 360 belum bisa dimuat" description={error} />
          ) : rows.length === 0 ? (
            <EmptyPanel title="Belum ada hasil 360" description="Penilaian 360 untuk filter ini belum tersedia." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {rows.map((row) => (
                <PersonDetail key={row.evaluatee_id} row={row} itemMap={itemMap} />
              ))}
            </div>
          )}
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}
