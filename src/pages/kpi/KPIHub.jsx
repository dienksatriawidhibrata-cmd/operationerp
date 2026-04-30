import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import { KPI_PERSONAL_INPUT_ROLES, KPI_360_ROLES } from '../../lib/access'
import { currentPeriodWIB, lastNPeriods, periodLabel, roleLabel } from '../../lib/utils'
import { AppIcon } from '../../components/ui/AppKit'

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`
}

function ScorePill({ score }) {
  const cls =
    score >= 4 ? 'bg-emerald-50 text-emerald-700'
    : score >= 3 ? 'bg-amber-50 text-amber-700'
    : 'bg-rose-50 text-rose-700'
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg ${cls}`}>{score.toFixed(2)}</span>
}

function PercentPill({ value }) {
  const n = Number(value || 0)
  const cls =
    n >= 0.8 ? 'bg-emerald-50 text-emerald-700'
    : n >= 0.6 ? 'bg-amber-50 text-amber-700'
    : 'bg-rose-50 text-rose-700'
  return <span className={`text-xs font-bold px-2 py-1 rounded-lg ${cls}`}>{formatPercent(n)}</span>
}

const RANK_STYLE = [
  { bg: '#fef3c7', color: '#d97706' },
  { bg: '#f1f5f9', color: '#64748b' },
  { bg: '#fef9c3', color: '#a16207' },
  { bg: '#f8fafc', color: '#94a3b8' },
  { bg: '#f8fafc', color: '#94a3b8' },
]

export default function KPIHub() {
  const { profile, signOut } = useAuth()
  const [period, setPeriod] = useState(currentPeriodWIB())
  const [storeStats, setStoreStats] = useState({ total: 0, average: 0, topStore: null, topRows: [] })
  const [personalRows, setPersonalRows] = useState([])
  const [review360Rows, setReview360Rows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile?.id) return
    const findLatestPeriod = async () => {
      const { data } = await supabase
        .from('kpi_monthly_reports')
        .select('bulan')
        .order('bulan', { ascending: false })
        .limit(1)
      if (data?.[0]?.bulan) {
        const latest = data[0].bulan.slice(0, 7)
        if (latest < currentPeriodWIB()) setPeriod(latest)
      }
    }
    findLatestPeriod()
  }, [profile?.id])

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) return
      setLoading(true)
      setError('')
      try {
        const [storeRes, personalRes, review360Res] = await Promise.all([
          supabase
            .from('kpi_monthly_reports')
            .select('branch_id,total_score,branch:branches(name)')
            .eq('bulan', `${period}-01`),
          supabase
            .from('kpi_personal_scores')
            .select('staff_id,score,verified_at,updated_at,staff:profiles!staff_id(full_name,role)')
            .eq('period_month', period),
          supabase
            .from('kpi_360_submissions')
            .select('id,evaluatee_id,group_type,updated_at,evaluatee:profiles!evaluatee_id(full_name,role)')
            .eq('period_month', period),
        ])

        if (storeRes.error || personalRes.error || review360Res.error) {
          throw new Error(
            storeRes.error?.message ||
            personalRes.error?.message ||
            review360Res.error?.message ||
            'Gagal memuat dashboard KPI.'
          )
        }

        const storeRows = storeRes.data || []
        const averageStoreScore = storeRows.length
          ? storeRows.reduce((sum, row) => sum + Number(row.total_score || 0), 0) / storeRows.length
          : 0
        const sortedByScore = [...storeRows].sort((a, b) => Number(b.total_score || 0) - Number(a.total_score || 0))
        setStoreStats({
          total: storeRows.length,
          average: averageStoreScore,
          topStore: sortedByScore[0] || null,
          topRows: sortedByScore.slice(0, 5),
        })

        const groupedPersonal = {}
        ;(personalRes.data || []).forEach((row) => {
          if (!groupedPersonal[row.staff_id]) {
            groupedPersonal[row.staff_id] = {
              staff_id: row.staff_id,
              scores: [],
              latest_update: row.updated_at,
              verified: !!row.verified_at,
              staff: row.staff,
            }
          }
          groupedPersonal[row.staff_id].scores.push(Number(row.score || 0))
          groupedPersonal[row.staff_id].verified =
            groupedPersonal[row.staff_id].verified || !!row.verified_at
          groupedPersonal[row.staff_id].latest_update =
            groupedPersonal[row.staff_id].latest_update > row.updated_at
              ? groupedPersonal[row.staff_id].latest_update
              : row.updated_at
        })

        setPersonalRows(
          Object.values(groupedPersonal)
            .map((row) => ({
              ...row,
              average: row.scores.length
                ? row.scores.reduce((sum, s) => sum + s, 0) / row.scores.length
                : 0,
            }))
            .sort((a, b) => b.average - a.average)
            .slice(0, 8)
        )

        const submissionIds = (review360Res.data || []).map((row) => row.id)
        let scoreRows = []
        if (submissionIds.length) {
          const { data, error: scoreError } = await supabase
            .from('kpi_360_scores')
            .select('submission_id,score')
            .in('submission_id', submissionIds)
          if (scoreError) throw new Error(scoreError.message || 'Gagal memuat skor KPI 360.')
          scoreRows = data || []
        }

        const bySubmissionId = {}
        scoreRows.forEach((row) => {
          if (!bySubmissionId[row.submission_id]) bySubmissionId[row.submission_id] = []
          bySubmissionId[row.submission_id].push(Number(row.score || 0))
        })

        const grouped360 = {}
        ;(review360Res.data || []).forEach((row) => {
          if (!grouped360[row.evaluatee_id]) {
            grouped360[row.evaluatee_id] = {
              evaluatee_id: row.evaluatee_id,
              scores: [],
              submissions: 0,
              group_type: row.group_type,
              latest_update: row.updated_at,
              evaluatee: row.evaluatee,
            }
          }
          grouped360[row.evaluatee_id].scores.push(...(bySubmissionId[row.id] || []))
          grouped360[row.evaluatee_id].submissions += 1
          grouped360[row.evaluatee_id].latest_update =
            grouped360[row.evaluatee_id].latest_update > row.updated_at
              ? grouped360[row.evaluatee_id].latest_update
              : row.updated_at
        })

        setReview360Rows(
          Object.values(grouped360)
            .map((row) => ({
              ...row,
              average: row.scores.length
                ? row.scores.reduce((sum, s) => sum + s, 0) / row.scores.length
                : 0,
            }))
            .sort((a, b) => b.average - a.average)
            .slice(0, 8)
        )
        setLoading(false)
      } catch (err) {
        setStoreStats({ total: 0, average: 0, topStore: null, topRows: [] })
        setPersonalRows([])
        setReview360Rows([])
        setError(err.message || 'Gagal memuat KPI.')
        setLoading(false)
      }
    }
    load()
  }, [period, profile?.id])

  const personalSummary = useMemo(() => {
    const average = personalRows.length
      ? personalRows.reduce((sum, row) => sum + row.average, 0) / personalRows.length
      : 0
    return {
      total: personalRows.length,
      average,
      verified: personalRows.filter((row) => row.verified).length,
    }
  }, [personalRows])

  const review360Summary = useMemo(() => {
    const average = review360Rows.length
      ? review360Rows.reduce((sum, row) => sum + row.average, 0) / review360Rows.length
      : 0
    return {
      total: review360Rows.length,
      average,
      submissions: review360Rows.reduce((sum, row) => sum + row.submissions, 0),
    }
  }, [review360Rows])

  const canInputPersonal = KPI_PERSONAL_INPUT_ROLES.includes(profile?.role)
  const canInput360 = KPI_360_ROLES.includes(profile?.role)
  const shortName = profile?.full_name?.split(' ')[0] ?? 'KPI'

  const quickActions = [
    { to: '/kpi/store',          icon: 'chart',     label: 'Analisis\nToko'    },
    { to: '/kpi/personal',       icon: 'checklist', label: 'KPI\nPersonal'     },
    { to: '/kpi/360/results',    icon: 'spark',     label: 'KPI\n360'          },
    ...(canInputPersonal ? [{ to: '/kpi/personal/input', icon: 'checklist', label: 'Input\nPersonal' }] : []),
    ...(canInput360      ? [{ to: '/kpi/360',             icon: 'spark',     label: 'Input\n360'      }] : []),
  ]

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-28">
      {/* Header */}
      <div className="p-6 flex justify-between items-center bg-white border-b border-violet-50 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center text-white shadow-lg">
            <AppIcon name="chart" size={22} />
          </div>
          <div>
            <h1 className="text-[10px] text-violet-600 font-bold uppercase tracking-widest">Performance Hub</h1>
            <p className="font-extrabold text-gray-900 text-lg">{shortName}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center text-violet-600 hover:bg-violet-100 transition-colors"
        >
          <AppIcon name="logout" size={18} />
        </button>
      </div>

      <div className="px-5 pt-6">
        {/* KPI Overview Card */}
        <div className="bg-violet-50 p-5 rounded-[2.5rem] border border-violet-100 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-black text-violet-900 uppercase">Ringkasan KPI</h2>
            <select
              className="text-[10px] font-bold text-violet-700 bg-violet-100 border-0 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {lastNPeriods(6).map((v) => (
                <option key={v} value={v}>{periodLabel(v)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">KPI Toko</p>
              <p className="text-2xl font-black text-violet-700">
                {loading ? '-' : String(storeStats.total).padStart(2, '0')}
              </p>
              <p className="text-[7px] text-gray-500 leading-tight">Toko Terbaca</p>
            </div>
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Personal</p>
              <p className="text-2xl font-black text-violet-700">
                {loading ? '-' : String(personalSummary.total).padStart(2, '0')}
              </p>
              <p className="text-[7px] text-gray-500 leading-tight">Orang Dinilai</p>
            </div>
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">KPI 360</p>
              <p className="text-2xl font-black text-violet-700">
                {loading ? '-' : String(review360Summary.total).padStart(2, '0')}
              </p>
              <p className="text-[7px] text-gray-500 leading-tight">Sudah Dinilai</p>
            </div>
          </div>

          {!loading && storeStats.topStore && (
            <div className="bg-white/60 p-3 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold text-violet-900">Top Store Periode Ini</p>
                <p className="text-xs text-violet-700 font-medium">
                  {storeStats.topStore.branch?.name?.replace('Bagi Kopi ', '') || '-'}
                </p>
              </div>
              <span className="text-xl font-black text-violet-900">
                {formatPercent(storeStats.topStore.total_score)}
              </span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div
          className="mb-6"
          style={{ display: 'grid', gridTemplateColumns: `repeat(${quickActions.length}, 1fr)`, gap: '1rem' }}
        >
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-white border border-violet-100 rounded-2xl flex items-center justify-center text-violet-600 shadow-sm active:scale-95 transition-transform">
                <AppIcon name={action.icon} size={22} />
              </div>
              <span className="text-[9px] font-bold text-center leading-tight text-gray-700 whitespace-pre-line">
                {action.label}
              </span>
            </Link>
          ))}
        </div>

        {/* Stats Row */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 bg-white p-4 rounded-3xl border-b-4 border-violet-400 shadow-sm">
            <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Avg KPI Toko</p>
            <div className="flex items-end justify-between">
              <h4 className="text-2xl font-black text-violet-900">
                {loading ? '-' : formatPercent(storeStats.average)}
              </h4>
              <span className="text-[8px] text-violet-500 font-bold mb-1">bulan ini</span>
            </div>
          </div>
          <div className="flex-1 bg-white p-4 rounded-3xl border-b-4 border-emerald-400 shadow-sm">
            <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Avg Personal</p>
            <div className="flex items-end justify-between">
              <h4 className="text-2xl font-black text-emerald-900">
                {loading ? '-' : personalSummary.average ? personalSummary.average.toFixed(2) : '-'}
              </h4>
              <span className="text-[8px] text-emerald-500 font-bold mb-1">/ 5</span>
            </div>
          </div>
          <div className="flex-1 bg-violet-600 p-4 rounded-3xl text-white shadow-lg">
            <p className="text-[9px] text-violet-100 font-bold uppercase mb-1">Avg 360</p>
            <div className="flex items-end justify-between">
              <h4 className="text-2xl font-black">
                {loading ? '-' : review360Summary.average ? review360Summary.average.toFixed(2) : '-'}
              </h4>
              <AppIcon name="spark" size={16} className="mb-1 opacity-80" />
            </div>
            <p className="text-[8px] mt-1 opacity-80">{loading ? '' : `${review360Summary.submissions} submission`}</p>
          </div>
        </div>

        {/* Loading spinner */}
        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mb-6 rounded-[22px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Ranking KPI Toko */}
        {!loading && storeStats.topRows.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-extrabold text-gray-800 text-sm">Ranking KPI Toko</h2>
              <Link to="/kpi/store" className="text-[10px] font-bold text-violet-600">
                Lihat Semua →
              </Link>
            </div>
            <div className="space-y-2">
              {storeStats.topRows.map((row, idx) => (
                <div
                  key={row.branch_id}
                  className="bg-white p-3 rounded-2xl border border-violet-50 flex items-center gap-3 shadow-sm"
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-sm"
                    style={{
                      background: RANK_STYLE[idx]?.bg ?? '#f8fafc',
                      color: RANK_STYLE[idx]?.color ?? '#94a3b8',
                    }}
                  >
                    #{idx + 1}
                  </div>
                  <p className="text-xs font-bold text-gray-800 flex-1 truncate">
                    {row.branch?.name?.replace('Bagi Kopi ', '') || '-'}
                  </p>
                  <PercentPill value={row.total_score} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPI Personal mini list */}
        {!loading && personalRows.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-extrabold text-gray-800 text-sm">KPI Personal</h2>
              <Link to="/kpi/personal" className="text-[10px] font-bold text-emerald-600">
                Lihat Semua →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {personalRows.slice(0, 4).map((row) => (
                <div
                  key={row.staff_id}
                  className="bg-white p-3 rounded-2xl border border-emerald-50 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <p className="text-[10px] font-bold text-gray-800 truncate flex-1">
                      {row.staff?.full_name?.split(' ')[0] || '-'}
                    </p>
                    <ScorePill score={row.average} />
                  </div>
                  <p className="text-[8px] text-gray-400">{roleLabel(row.staff?.role)}</p>
                  {row.verified && (
                    <p className="text-[8px] text-emerald-600 font-bold mt-1">✓ Terverifikasi</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPI 360 mini list */}
        {!loading && review360Rows.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-extrabold text-gray-800 text-sm">KPI 360</h2>
              <Link to="/kpi/360/results" className="text-[10px] font-bold text-amber-600">
                Lihat Semua →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {review360Rows.slice(0, 4).map((row) => (
                <div
                  key={row.evaluatee_id}
                  className="bg-white p-3 rounded-2xl border border-amber-50 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <p className="text-[10px] font-bold text-gray-800 truncate flex-1">
                      {row.evaluatee?.full_name?.split(' ')[0] || '-'}
                    </p>
                    <ScorePill score={row.average} />
                  </div>
                  <p className="text-[8px] text-gray-400">{roleLabel(row.evaluatee?.role)}</p>
                  <p className="text-[8px] text-amber-600 font-bold mt-1">{row.submissions} review</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Board */}
        <div className="bg-gradient-to-r from-violet-700 to-blue-500 p-5 rounded-[2rem] text-white relative overflow-hidden shadow-lg mb-6">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white/20 text-[8px] font-bold px-2 py-0.5 rounded uppercase">Info</span>
            </div>
            <h3 className="font-bold text-sm mb-1">Panduan KPI</h3>
            <p className="text-[10px] opacity-90 leading-relaxed">
              KPI Toko mengukur performa operasional cabang. KPI Personal menilai individu per periode. KPI 360 menggabungkan penilaian rekan kerja secara menyeluruh.
            </p>
          </div>
          <AppIcon name="chart" size={72} className="absolute -right-4 -bottom-4 opacity-10" />
        </div>
      </div>

      <SmartBottomNav />
    </div>
  )
}
