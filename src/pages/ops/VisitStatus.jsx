import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayWIB, visitGrade } from '../../lib/utils'
import { AUDIT_ITEMS, AUDIT_MAX_SCORE, AUDIT_SECTIONS } from '../../lib/constants'
import { DMBottomNav, OpsBottomNav } from '../../components/BottomNav'
import { isOpsLikeRole } from '../../lib/access'
import PhotoViewer from '../../components/PhotoViewer'
import {
  EmptyPanel,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'

// ── Date helpers ──────────────────────────────────────────

function prevDate(d) {
  const dt = new Date(d + 'T00:00:00Z')
  dt.setUTCDate(dt.getUTCDate() - 1)
  return dt.toISOString().slice(0, 10)
}
function nextDate(d) {
  const dt = new Date(d + 'T00:00:00Z')
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
}
function displayDate(d) {
  if (!d) return '-'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function displayDateShort(d) {
  if (!d) return '-'
  const dt = new Date(d + 'T00:00:00Z')
  return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// ── Visit history helpers ─────────────────────────────────

function computeDaysAgo(dateStr) {
  if (!dateStr) return null
  const today = new Date(todayWIB() + 'T00:00:00Z')
  const visit = new Date(dateStr + 'T00:00:00Z')
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

// ── Accordion ─────────────────────────────────────────────

function AccordionRow({ label, sublabel, statusBadge, isOpen, onToggle, loading, children }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/85 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50/60"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-[10px] font-bold text-slate-600">
          {label?.split(' ').slice(-1)[0]?.slice(0, 3).toUpperCase() || '--'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{label}</span>
          {sublabel && (
            <span className="block text-[11px] text-slate-400">{sublabel}</span>
          )}
        </span>
        {statusBadge}
        <span className={`ml-1 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
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

// ── Riwayat content (per selected manager) ────────────────

function RiwayatContent({ branches, history }) {
  if (!branches.length) {
    return <EmptyPanel title="Tidak ada toko" description="Manager ini tidak memiliki toko aktif." />
  }

  const sortedBranches = [...branches].sort((a, b) => {
    const dA = computeDaysAgo(history[a.id]?.tanggal)
    const dB = computeDaysAgo(history[b.id]?.tanggal)
    if (dA === null && dB === null) return 0
    if (dA === null) return 1
    if (dB === null) return -1
    return dA - dB
  })

  return (
    <div className="space-y-2">
      {sortedBranches.map((branch) => {
        const last = history[branch.id]
        const days = computeDaysAgo(last?.tanggal)
        const tone = daysToTone(days)

        return (
          <div key={branch.id} className="flex items-center gap-3 rounded-[18px] bg-slate-50 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-800">
                {branch.name.replace('Bagi Kopi ', '')}
              </span>
              <span className="text-[11px] text-slate-400">{branch.store_id}</span>
            </span>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <ToneBadge tone={tone}>{daysLabel(days)}</ToneBadge>
              {last?.tanggal && (
                <span className="text-[10px] text-slate-400">
                  {new Date(last.tanggal + 'T00:00:00Z').toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
                  })}
                </span>
              )}
              {last?.grade && (
                <ToneBadge tone={tone === 'ok' || tone === 'info' ? 'ok' : tone}>
                  {last.grade}
                </ToneBadge>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Visit content (per-store per-date detail) ─────────────

function ScoreChips({ value, max = 5 }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${
            value != null && i < value
              ? value >= max * 0.85 ? 'bg-emerald-500' : value >= max * 0.7 ? 'bg-amber-400' : 'bg-rose-400'
              : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  )
}

function VisitContent({ visit }) {
  if (!visit) {
    return <EmptyPanel title="Belum ada visit" description="Toko ini belum divisit pada tanggal tersebut." />
  }

  const grade = visitGrade(visit.total_score || 0)
  const scoreTone =
    (visit.total_score || 0) >= AUDIT_MAX_SCORE * 0.9 ? 'ok'
    : (visit.total_score || 0) >= AUDIT_MAX_SCORE * 0.8 ? 'info'
    : (visit.total_score || 0) >= AUDIT_MAX_SCORE * 0.6 ? 'warn'
    : 'danger'

  const scoresByKey = {}
  const photosByKey = {}
  ;(visit.visit_scores || []).forEach((s) => {
    scoresByKey[s.item_key] = s.score
    photosByKey[s.item_key] = s.photos || []
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <ToneBadge tone={scoreTone}>
          {visit.total_score}/{AUDIT_MAX_SCORE} · {grade.label}
        </ToneBadge>
        <span className="text-[11px] text-slate-400">
          oleh {visit.auditor?.full_name || '-'}
        </span>
      </div>

      {AUDIT_SECTIONS.map((section) => {
        const sectionItems = AUDIT_ITEMS.filter((item) => item.section === section.key)
        const sectionScore = sectionItems.reduce((sum, item) => sum + (scoresByKey[item.key] || 0), 0)
        const sectionMax = sectionItems.length * 5

        return (
          <div key={section.key}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.emoji} {section.label}
              </div>
              <ToneBadge
                tone={sectionScore >= sectionMax * 0.9 ? 'ok' : sectionScore >= sectionMax * 0.7 ? 'warn' : 'danger'}
              >
                {sectionScore}/{sectionMax}
              </ToneBadge>
            </div>

            <div className="space-y-2">
              {sectionItems.map((item) => {
                const score = scoresByKey[item.key]
                const photos = photosByKey[item.key] || []
                return (
                  <div key={item.key} className="rounded-[18px] bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-slate-700">{item.label}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <ScoreChips value={score} />
                        <span className="text-[11px] font-semibold text-slate-500">{score ?? '-'}/5</span>
                      </div>
                    </div>
                    {photos.length > 0 && (
                      <div className="mt-2">
                        <PhotoViewer urls={photos} emptyText="" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {(visit.foto_kondisi || []).length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Foto Kondisi Umum
          </div>
          <PhotoViewer urls={visit.foto_kondisi} emptyText="" />
        </div>
      )}

      {visit.catatan && (
        <div className="rounded-[18px] border border-amber-100 bg-amber-50 px-4 py-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            Catatan Auditor
          </div>
          <p className="text-sm leading-6 text-slate-700">{visit.catatan}</p>
        </div>
      )}

      <div className="text-[11px] text-slate-400">
        {new Date(visit.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function VisitStatus() {
  const { profile } = useAuth()
  const isOpsManager = isOpsLikeRole(profile?.role)
  const isAM = profile?.role === 'area_manager'

  const [managers, setManagers] = useState([])
  const [loadingManagers, setLoadingManagers] = useState(true)
  const [selectedManagerId, setSelectedManagerId] = useState(null)
  const [branches, setBranches] = useState([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayWIB())
  const [visitStatus, setVisitStatus] = useState({})   // branchId → true
  const [openBranch, setOpenBranch] = useState(null)
  const [visitData, setVisitData] = useState({})       // `${branchId}|${date}` → data
  const [loadingVisits, setLoadingVisits] = useState(new Set())
  const [showList, setShowList] = useState(false)

  // Riwayat per selected manager
  const [riwayatOpen, setRiwayatOpen] = useState(false)
  const [riwayatCache, setRiwayatCache] = useState({}) // managerId → { branchId: { tanggal, grade } }
  const [riwayatLoading, setRiwayatLoading] = useState(new Set())

  const today = todayWIB()

  // ── Fetch managers ────────────────────────────────────────

  useEffect(() => {
    if (!profile?.role) return
    const fetchManagers = async () => {
      setLoadingManagers(true)

      if (isAM) {
        // Step 1: get districts in this AM's areas
        const { data: branchData } = await supabase
          .from('branches')
          .select('district')
          .in('area', profile.managed_areas || [])
          .eq('is_active', true)

        const amDistricts = [...new Set((branchData || []).map((b) => b.district))]

        // Step 2: get all DMs, filter client-side to those covering these districts
        const { data: allDMs } = await supabase
          .from('profiles')
          .select('id,full_name,role,managed_districts,managed_areas')
          .eq('role', 'district_manager')
          .eq('is_active', true)
          .order('full_name')

        const filtered = (allDMs || []).filter((dm) =>
          (dm.managed_districts || []).some((d) => amDistricts.includes(d))
        )
        setManagers(filtered)
        if (filtered.length) setSelectedManagerId(filtered[0].id)
      } else {
        // ops_manager: all DMs + AMs
        const { data } = await supabase
          .from('profiles')
          .select('id,full_name,role,managed_districts,managed_areas')
          .in('role', ['district_manager', 'area_manager'])
          .eq('is_active', true)
          .order('role')
          .order('full_name')
        setManagers(data || [])
        if (data?.length) setSelectedManagerId(data[0].id)
      }

      setLoadingManagers(false)
    }
    fetchManagers()
  }, [profile?.id, profile?.role])

  // ── Fetch branches for selected manager ───────────────────

  useEffect(() => {
    if (!selectedManagerId) return
    const manager = managers.find((m) => m.id === selectedManagerId)
    if (!manager) return

    const fetchBranches = async () => {
      setLoadingBranches(true)
      setBranches([])
      let q = supabase.from('branches').select('id,name,store_id,district,area').eq('is_active', true)
      if (manager.role === 'district_manager') {
        q = q.in('district', manager.managed_districts || [])
      } else {
        q = q.in('area', manager.managed_areas || [])
      }
      const { data } = await q.order('name')
      setBranches(data || [])
      setLoadingBranches(false)
    }
    fetchBranches()
  }, [selectedManagerId, managers])

  // ── Fetch visit status for selected date ──────────────────

  useEffect(() => {
    if (!branches.length) return
    const fetchStatus = async () => {
      const ids = branches.map((b) => b.id)
      const { data } = await supabase
        .from('daily_visits')
        .select('branch_id')
        .in('branch_id', ids)
        .eq('tanggal', selectedDate)
      const map = {}
      ;(data || []).forEach(({ branch_id }) => { map[branch_id] = true })
      setVisitStatus(map)
    }
    fetchStatus()
  }, [branches, selectedDate])

  // ── Reset state when manager or date changes ──────────────

  useEffect(() => {
    setOpenBranch(null)
    setRiwayatOpen(false)
  }, [selectedManagerId, selectedDate])

  // ── Lazy-load riwayat per selected manager ────────────────

  const loadRiwayat = useCallback(async () => {
    if (!selectedManagerId || !branches.length) return
    if (riwayatCache[selectedManagerId] !== undefined || riwayatLoading.has(selectedManagerId)) return

    setRiwayatLoading((prev) => new Set([...prev, selectedManagerId]))

    const ids = branches.map((b) => b.id)
    const { data } = await supabase
      .from('daily_visits')
      .select('branch_id,tanggal,total_score,grade')
      .eq('auditor_id', selectedManagerId)
      .in('branch_id', ids)
      .order('tanggal', { ascending: false })

    const map = {}
    ;(data || []).forEach((v) => {
      if (!map[v.branch_id]) map[v.branch_id] = v
    })

    setRiwayatCache((prev) => ({ ...prev, [selectedManagerId]: map }))
    setRiwayatLoading((prev) => {
      const next = new Set(prev)
      next.delete(selectedManagerId)
      return next
    })
  }, [selectedManagerId, branches, riwayatCache, riwayatLoading])

  const toggleRiwayat = () => {
    const next = !riwayatOpen
    setRiwayatOpen(next)
    if (next) loadRiwayat()
  }

  // ── Lazy-load per-store visit detail ──────────────────────

  const loadVisit = useCallback(async (branchId) => {
    const key = `${branchId}|${selectedDate}`
    if (visitData[key] !== undefined || loadingVisits.has(key)) return

    setLoadingVisits((prev) => new Set([...prev, key]))
    let result = null
    try {
      const { data } = await supabase
        .from('daily_visits')
        .select('*, auditor:profiles!auditor_id(id,full_name), visit_scores(*)')
        .eq('branch_id', branchId)
        .eq('tanggal', selectedDate)
        .maybeSingle()
      result = data
    } catch {}

    setVisitData((prev) => ({ ...prev, [key]: result }))
    setLoadingVisits((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [selectedDate, visitData, loadingVisits])

  const toggleBranch = (branchId) => {
    if (openBranch === branchId) {
      setOpenBranch(null)
    } else {
      setOpenBranch(branchId)
      loadVisit(branchId)
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  const selectedManager = managers.find((m) => m.id === selectedManagerId)
  const shortName = (b) => b?.name?.replace('Bagi Kopi ', '') || '-'
  const getVisitData = (branchId) => visitData[`${branchId}|${selectedDate}`]
  const isVisitLoading = (branchId) => loadingVisits.has(`${branchId}|${selectedDate}`)
  const visitedCount = branches.filter((b) => visitStatus[b.id]).length

  const currentRiwayat = riwayatCache[selectedManagerId] || {}
  const isRiwayatLoading = riwayatLoading.has(selectedManagerId)
  const riwayatLoaded = riwayatCache[selectedManagerId] !== undefined

  const visitedEverCount = Object.keys(currentRiwayat).length
  const neverCount = branches.length - visitedEverCount

  const roleTag = (role) => (role === 'district_manager' ? 'DM' : 'AM')
  const managerScope = (m) =>
    m.role === 'district_manager'
      ? (m.managed_districts || []).join(', ')
      : (m.managed_areas || []).join(', ')

  const footer = (isOpsManager || isAM) && !isAM ? <OpsBottomNav /> : isAM ? <DMBottomNav /> : <OpsBottomNav />

  // ── Manager list component ────────────────────────────────

  const ManagerList = ({ onSelect }) => (
    <div className="space-y-1 overflow-y-auto">
      {loadingManagers ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      ) : managers.length === 0 ? (
        <p className="px-3 py-4 text-sm text-slate-400">Tidak ada manager ditemukan.</p>
      ) : (
        managers.map((manager) => {
          const isSelected = manager.id === selectedManagerId
          const isDM = manager.role === 'district_manager'
          return (
            <button
              key={manager.id}
              type="button"
              onClick={() => { setSelectedManagerId(manager.id); onSelect?.() }}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                isSelected ? 'bg-primary-600 text-white' : 'hover:bg-slate-100'
              }`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold ${
                isSelected
                  ? 'bg-white/20 text-white'
                  : isDM ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
              }`}>
                {roleTag(manager.role)}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                  {manager.full_name}
                </span>
                <span className={`block truncate text-[10px] ${isSelected ? 'text-primary-200' : 'text-slate-400'}`}>
                  {managerScope(manager)}
                </span>
              </span>
            </button>
          )
        })
      )}
    </div>
  )

  // ── Render ────────────────────────────────────────────────

  return (
    <SubpageShell
      title="Visit Status"
      subtitle={
        selectedManager
          ? `${selectedManager.full_name} · ${displayDateShort(selectedDate)}`
          : 'Pilih manager'
      }
      eyebrow="Monitoring Visit"
      footer={isAM ? <DMBottomNav /> : <OpsBottomNav />}
    >
      {/* Mobile: manager picker bar */}
      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm"
        >
          {selectedManager && (
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold ${
              selectedManager.role === 'district_manager'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-violet-100 text-violet-700'
            }`}>
              {roleTag(selectedManager.role)}
            </span>
          )}
          <span className="flex-1 truncate text-sm font-semibold text-slate-900">
            {selectedManager ? selectedManager.full_name : 'Pilih manager'}
          </span>
          <span className="text-slate-400">▾</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedDate(prevDate(selectedDate))}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
        >
          ‹
        </button>
        <span className="w-20 text-center text-xs font-semibold text-slate-700">
          {displayDate(selectedDate)}
        </span>
        <button
          type="button"
          onClick={() => setSelectedDate(nextDate(selectedDate))}
          disabled={selectedDate >= today}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
        >
          ›
        </button>
      </div>

      {showList && (
        <div className="mb-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-3 shadow-lg lg:hidden">
          <ManagerList onSelect={() => setShowList(false)} />
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">

        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-100 text-[9px] font-bold text-blue-700">DM</span>
              <span className="text-[11px] text-slate-400">District Manager</span>
              {isOpsManager && (
                <>
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-100 text-[9px] font-bold text-violet-700">AM</span>
                  <span className="text-[11px] text-slate-400">Area Manager</span>
                </>
              )}
            </div>
            <ManagerList />
          </div>
        </aside>

        {/* Right panel */}
        <main>
          {/* Desktop date nav */}
          <div className="mb-4 hidden items-center gap-3 lg:flex">
            <button
              type="button"
              onClick={() => setSelectedDate(prevDate(selectedDate))}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            >
              ‹
            </button>
            <span className="flex-1 text-center text-sm font-semibold text-slate-700">
              {displayDateShort(selectedDate)}
            </span>
            <button
              type="button"
              onClick={() => setSelectedDate(nextDate(selectedDate))}
              disabled={selectedDate >= today}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              ›
            </button>
          </div>

          {/* Riwayat Kunjungan accordion */}
          {selectedManager && !loadingBranches && (
            <div className="mb-4">
              <div
                className="overflow-hidden rounded-[22px] border border-white/85 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]"
              >
                <button
                  type="button"
                  onClick={toggleRiwayat}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50/60"
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-base">🗓️</span>
                  <span className="flex-1 text-sm font-semibold text-slate-900">Riwayat Kunjungan</span>
                  {riwayatLoaded && (
                    <ToneBadge tone={neverCount > 0 ? 'warn' : 'ok'}>
                      {visitedEverCount}/{branches.length} pernah divisit
                    </ToneBadge>
                  )}
                  <span className={`ml-1 text-slate-400 transition-transform ${riwayatOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>

                {riwayatOpen && (
                  <div className="border-t border-slate-100 px-4 py-4">
                    {isRiwayatLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                      </div>
                    ) : (
                      <RiwayatContent branches={branches} history={currentRiwayat} />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Visit status summary */}
          {!loadingBranches && branches.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <ToneBadge tone={visitedCount === branches.length ? 'ok' : visitedCount > 0 ? 'warn' : 'slate'}>
                {visitedCount}/{branches.length} toko divisit
              </ToneBadge>
              {visitedCount < branches.length && (
                <ToneBadge tone="danger">{branches.length - visitedCount} belum</ToneBadge>
              )}
            </div>
          )}

          {/* Store accordions */}
          {loadingBranches ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : !selectedManager ? (
            <EmptyPanel
              title="Pilih manager"
              description="Pilih district manager atau area manager dari daftar di samping."
            />
          ) : branches.length === 0 ? (
            <EmptyPanel
              title="Tidak ada toko"
              description="Manager ini tidak memiliki toko aktif dalam scope-nya."
            />
          ) : (
            <div className="space-y-3">
              {branches.map((branch) => (
                <AccordionRow
                  key={branch.id}
                  label={shortName(branch)}
                  sublabel={`${branch.store_id} · ${branch.district || branch.area || ''}`}
                  statusBadge={
                    visitStatus[branch.id]
                      ? <ToneBadge tone="ok">Divisit</ToneBadge>
                      : <ToneBadge tone="slate">Belum</ToneBadge>
                  }
                  isOpen={openBranch === branch.id}
                  onToggle={() => toggleBranch(branch.id)}
                  loading={isVisitLoading(branch.id)}
                >
                  <VisitContent visit={getVisitData(branch.id)} />
                </AccordionRow>
              ))}
            </div>
          )}
        </main>
      </div>
    </SubpageShell>
  )
}
