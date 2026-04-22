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

export default function KPI360ResultsPage() {
  const { profile } = useAuth()
  const [period, setPeriod] = useState(currentPeriodWIB())
  const [groupFilter, setGroupFilter] = useState('all')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        setRows([])
        setError(submissionError.message || 'Gagal memuat hasil KPI 360.')
        setLoading(false)
        return
      }

      if (!submissions?.length) {
        setRows([])
        setLoading(false)
        return
      }

      const submissionIds = submissions.map((submission) => submission.id)
      const evaluateeIds = [...new Set(submissions.map((submission) => submission.evaluatee_id).filter(Boolean))]

      const [{ data: scores, error: scoreError }, { data: profiles, error: profileError }] = await Promise.all([
        supabase.from('kpi_360_scores').select('submission_id,item_key,score').in('submission_id', submissionIds),
        supabase.from('profiles').select('id,full_name,role').in('id', evaluateeIds),
      ])

      if (scoreError || profileError) {
        setRows([])
        setError(scoreError?.message || profileError?.message || 'Gagal memuat rekap KPI 360.')
        setLoading(false)
        return
      }

      const profileMap = Object.fromEntries((profiles || []).map((person) => [person.id, person]))
      const grouped = {}

      ;(scores || []).forEach((row) => {
        if (!grouped[row.submission_id]) grouped[row.submission_id] = []
        grouped[row.submission_id].push(Number(row.score || 0))
      })

      const aggregated = submissions.reduce((accumulator, submission) => {
        if (!accumulator[submission.evaluatee_id]) {
          accumulator[submission.evaluatee_id] = {
            evaluatee_id: submission.evaluatee_id,
            group_type: submission.group_type,
            latest_update: submission.updated_at,
            scores: [],
            submissions: 0,
          }
        }

        accumulator[submission.evaluatee_id].group_type = submission.group_type
        accumulator[submission.evaluatee_id].latest_update =
          accumulator[submission.evaluatee_id].latest_update > submission.updated_at
            ? accumulator[submission.evaluatee_id].latest_update
            : submission.updated_at
        accumulator[submission.evaluatee_id].scores.push(...(grouped[submission.id] || []))
        accumulator[submission.evaluatee_id].submissions += 1

        return accumulator
      }, {})

      const nextRows = Object.values(aggregated)
        .map((entry) => {
          const total = entry.scores.reduce((sum, value) => sum + value, 0)
          const average = entry.scores.length ? total / entry.scores.length : 0
          return {
            ...entry,
            average,
            evaluatee: profileMap[entry.evaluatee_id],
          }
        })
        .sort((a, b) => b.average - a.average)

      setRows(nextRows)
      setLoading(false)
    }

    load()
  }, [groupFilter, period, profile?.id, profile?.role])

  const topStats = useMemo(() => {
    const average = rows.length
      ? rows.reduce((sum, row) => sum + row.average, 0) / rows.length
      : 0

    return {
      total: rows.length,
      average,
      completed: rows.filter((row) => row.submissions > 0).length,
    }
  }, [rows])

  return (
    <SubpageShell
      title="Hasil KPI 360"
      subtitle="Rekap penilaian rekan kerja"
      eyebrow="KPI 360"
      footer={<SmartBottomNav />}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <SectionPanel
          eyebrow="Filter"
          title="Pilih Periode dan Grup"
          description="Halaman ini memisahkan hasil KPI 360 dari KPI Toko supaya rekap personal lebih mudah dibaca."
          actions={<SegmentedControl options={GROUP_OPTIONS} value={groupFilter} onChange={setGroupFilter} />}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="label">Periode</label>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="input"
              >
                {lastNPeriods(6).map((value) => (
                  <option key={value} value={value}>{periodLabel(value)}</option>
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
          description="Semua hasil diurutkan dari skor tertinggi agar pembacaan cepat saat review."
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
                <article
                  key={row.evaluatee_id}
                  className="rounded-[24px] border border-white/80 bg-white p-5 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.26)]"
                >
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
                </article>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}
