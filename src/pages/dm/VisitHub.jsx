import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { currentPeriodWIB, todayWIB, yesterdayWIB } from '../../lib/utils'
import { SmartBottomNav } from '../../components/BottomNav'
import { EmptyPanel, SectionPanel, SubpageShell, ToneBadge } from '../../components/ui/AppKit'

function computeDaysAgo(dateStr) {
  if (!dateStr) return null
  const today = new Date(`${todayWIB()}T00:00:00Z`)
  const visit = new Date(`${dateStr}T00:00:00Z`)
  return Math.floor((today - visit) / (1000 * 60 * 60 * 24))
}

function daysLabel(days) {
  if (days === null) return 'Belum pernah'
  if (days === 0) return 'Hari ini'
  if (days === 1) return '1 hari lalu'
  return `${days} hari lalu`
}

function daysToTone(days) {
  if (days === null) return 'slate'
  if (days === 0) return 'ok'
  if (days <= 7) return 'info'
  if (days <= 14) return 'warn'
  return 'danger'
}

function formatDateShort(date) {
  if (!date) return '-'
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function recommendationTone(priorityScore) {
  if (priorityScore >= 6) return 'danger'
  if (priorityScore >= 3) return 'warn'
  return 'info'
}

function RecommendationCard({ branch }) {
  return (
    <article className="rounded-[22px] border border-white/85 bg-white p-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{branch.name.replace('Bagi Kopi ', '')}</div>
          <div className="mt-1 text-xs text-slate-500">{branch.store_id} · {branch.district}</div>
        </div>
        <ToneBadge tone={recommendationTone(branch.priorityScore)}>Skor {branch.priorityScore}</ToneBadge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {branch.flags.map((flag) => (
          <ToneBadge key={`${branch.id}-${flag}`} tone="warn">{flag}</ToneBadge>
        ))}
      </div>
      <div className="mt-3 text-xs leading-5 text-slate-500">
        Visit terakhir: {branch.lastVisitDate ? formatDateShort(branch.lastVisitDate) : 'Belum pernah'} · {daysLabel(branch.daysSinceVisit)}
      </div>
    </article>
  )
}

function RiwayatContent({ branches, history }) {
  if (!branches.length) {
    return <EmptyPanel title="Tidak ada toko" description="Tidak ada toko dalam scope kamu." />
  }

  return (
    <div className="space-y-2">
      {branches.map((branch) => {
        const last = history[branch.id]
        const days = computeDaysAgo(last?.tanggal)
        return (
          <div key={branch.id} className="flex items-center gap-3 rounded-[18px] bg-slate-50 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-800">{branch.name.replace('Bagi Kopi ', '')}</span>
              <span className="text-[11px] text-slate-400">{branch.store_id}</span>
            </span>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <ToneBadge tone={daysToTone(days)}>{daysLabel(days)}</ToneBadge>
              {last?.tanggal && <span className="text-[10px] text-slate-400">{formatDateShort(last.tanggal)}</span>}
              {last?.grade && <ToneBadge tone={daysToTone(days)}>{last.grade}</ToneBadge>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AccordionRow({ label, icon, statusBadge, isOpen, onToggle, loading, children }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/85 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50/60"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-base">{icon}</span>
        <span className="flex-1 text-sm font-semibold text-slate-900">{label}</span>
        {statusBadge}
        <span className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {isOpen && (
        <div className="border-t border-slate-100 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : children}
        </div>
      )}
    </div>
  )
}

export default function VisitHub() {
  const { profile } = useAuth()
  const isAM = profile?.role === 'area_manager'
  const [branches, setBranches] = useState([])
  const [riwayatOpen, setRiwayatOpen] = useState(false)
  const [riwayatLoaded, setRiwayatLoaded] = useState(false)
  const [riwayatLoading, setRiwayatLoading] = useState(false)
  const [history, setHistory] = useState({})
  const [recommendations, setRecommendations] = useState([])
  const [loadingRecommendations, setLoadingRecommendations] = useState(true)

  useEffect(() => {
    if (!profile?.id) return

    const fetchBranches = async () => {
      let query = supabase.from('branches').select('id,name,store_id,district,area').eq('is_active', true)
      if (profile.role === 'district_manager') query = query.in('district', profile.managed_districts || [])
      else if (profile.role === 'area_manager') query = query.in('area', profile.managed_areas || [])
      const { data } = await query.order('name')
      setBranches(data || [])
    }

    fetchBranches()
  }, [profile?.id, profile?.managed_areas, profile?.managed_districts, profile?.role])

  const loadRiwayat = useCallback(async () => {
    if (riwayatLoaded || riwayatLoading || !branches.length || !profile?.id) return
    setRiwayatLoading(true)

    const ids = branches.map((branch) => branch.id)
    const { data } = await supabase
      .from('daily_visits')
      .select('branch_id,tanggal,total_score,grade')
      .eq('auditor_id', profile.id)
      .in('branch_id', ids)
      .order('tanggal', { ascending: false })

    const map = {}
    ;(data || []).forEach((row) => {
      if (!map[row.branch_id]) map[row.branch_id] = row
    })

    setHistory(map)
    setRiwayatLoaded(true)
    setRiwayatLoading(false)
  }, [branches, profile?.id, riwayatLoaded, riwayatLoading])

  useEffect(() => {
    if (!branches.length) return

    const loadRecommendations = async () => {
      setLoadingRecommendations(true)
      const ids = branches.map((branch) => branch.id)
      const reportDate = yesterdayWIB()
      const currentMonth = `${currentPeriodWIB()}-01`

      const [checklistsRes, prepRes, reportsRes, visitsRes, kpiRes] = await Promise.all([
        supabase.from('daily_checklists').select('branch_id,shift').in('branch_id', ids).eq('tanggal', todayWIB()),
        supabase.from('daily_preparation').select('branch_id,shift').in('branch_id', ids).eq('tanggal', todayWIB()),
        supabase.from('daily_reports').select('branch_id,id').in('branch_id', ids).eq('tanggal', reportDate),
        supabase.from('daily_visits').select('branch_id,tanggal').in('branch_id', ids).order('tanggal', { ascending: false }),
        supabase.from('kpi_monthly_reports').select('branch_id,total_score').in('branch_id', ids).eq('bulan', currentMonth),
      ])

      const checklistMap = {}
      ;(checklistsRes.data || []).forEach((row) => {
        if (!checklistMap[row.branch_id]) checklistMap[row.branch_id] = new Set()
        checklistMap[row.branch_id].add(row.shift)
      })

      const prepMap = {}
      ;(prepRes.data || []).forEach((row) => {
        if (!prepMap[row.branch_id]) prepMap[row.branch_id] = new Set()
        prepMap[row.branch_id].add(row.shift)
      })

      const reportMap = new Set((reportsRes.data || []).map((row) => row.branch_id))
      const visitMap = {}
      ;(visitsRes.data || []).forEach((row) => {
        if (!visitMap[row.branch_id]) visitMap[row.branch_id] = row
      })
      const kpiMap = Object.fromEntries((kpiRes.data || []).map((row) => [row.branch_id, Number(row.total_score || 0)]))

      const nextRecommendations = branches
        .map((branch) => {
          const checklistShifts = checklistMap[branch.id] || new Set()
          const prepShifts = prepMap[branch.id] || new Set()
          const flags = []
          let priorityScore = 0

          if (checklistShifts.size < 3) {
            flags.push(`Ceklis ${checklistShifts.size}/3 shift`)
            priorityScore += 2
          }
          if (prepShifts.size < 3) {
            flags.push(`Preparation ${prepShifts.size}/3 shift`)
            priorityScore += 2
          }
          if (!reportMap.has(branch.id)) {
            flags.push('Laporan harian belum masuk')
            priorityScore += 3
          }

          const kpiScore = kpiMap[branch.id]
          if (Number.isFinite(kpiScore) && kpiScore < 0.75) {
            flags.push(`KPI bulanan ${Math.round(kpiScore * 100)}%`)
            priorityScore += 2
          }

          const lastVisit = visitMap[branch.id]
          const daysSinceVisit = computeDaysAgo(lastVisit?.tanggal)
          if (daysSinceVisit == null || daysSinceVisit > 14) {
            flags.push(daysSinceVisit == null ? 'Belum pernah divisit' : `Visit terakhir ${daysSinceVisit} hari lalu`)
            priorityScore += 1
          }

          return {
            ...branch,
            flags,
            priorityScore,
            lastVisitDate: lastVisit?.tanggal || null,
            daysSinceVisit,
          }
        })
        .filter((branch) => branch.flags.length > 0)
        .sort((a, b) => b.priorityScore - a.priorityScore || (a.name || '').localeCompare(b.name || '', 'id-ID'))

      setRecommendations(nextRecommendations)
      setLoadingRecommendations(false)
    }

    loadRecommendations()
  }, [branches])

  const toggleRiwayat = () => {
    const next = !riwayatOpen
    setRiwayatOpen(next)
    if (next) loadRiwayat()
  }

  const visitedCount = useMemo(() => Object.keys(history).length, [history])
  const neverCount = branches.length - visitedCount

  return (
    <SubpageShell
      title="Visit"
      subtitle="Audit dan pantau kunjungan toko"
      eyebrow="Store Visit"
      footer={<SmartBottomNav />}
    >
      <SectionPanel eyebrow="Pilihan" title="Menu Visit">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/dm/visit"
            className="flex items-center gap-3 rounded-[22px] border border-primary-100 bg-primary-50 px-5 py-4 transition-colors hover:bg-primary-100"
          >
            <span className="text-2xl">📋</span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Lakukan Audit Visit</div>
              <div className="text-xs text-primary-600">Audit toko hari ini</div>
            </div>
          </Link>

          {isAM && (
            <Link
              to="/ops/visits"
              className="flex items-center gap-3 rounded-[22px] border border-blue-100 bg-blue-50 px-5 py-4 transition-colors hover:bg-blue-100"
            >
              <span className="text-2xl">🗺️</span>
              <div>
                <div className="text-sm font-semibold text-slate-900">Laporan Visit DM</div>
                <div className="text-xs text-blue-600">Pantau kunjungan DM bawahan</div>
              </div>
            </Link>
          )}
        </div>
      </SectionPanel>

      <div className="mt-4 space-y-4">
        <SectionPanel
          eyebrow="Rekomendasi Visit"
          title="Toko Prioritas Dikunjungi"
          description="Rekomendasi diurutkan dari ketidakpatuhan laporan harian, ceklis, preparation, dan KPI bulanan paling berisiko."
        >
          {loadingRecommendations ? (
            <div className="flex justify-center py-6">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : recommendations.length === 0 ? (
            <EmptyPanel title="Belum ada prioritas visit" description="Semua toko pada scope ini terlihat cukup patuh untuk indikator yang sedang dicek." />
          ) : (
            <div className="space-y-3">
              {recommendations.slice(0, 10).map((branch) => (
                <RecommendationCard key={branch.id} branch={branch} />
              ))}
            </div>
          )}
        </SectionPanel>

        <AccordionRow
          label="Riwayat Kunjunganku"
          icon="🗓️"
          statusBadge={
            riwayatLoaded ? (
              <ToneBadge tone={neverCount > 0 ? 'warn' : 'ok'}>{visitedCount}/{branches.length} toko</ToneBadge>
            ) : null
          }
          isOpen={riwayatOpen}
          onToggle={toggleRiwayat}
          loading={riwayatLoading}
        >
          <RiwayatContent branches={branches} history={history} />
        </AccordionRow>
      </div>
    </SubpageShell>
  )
}
