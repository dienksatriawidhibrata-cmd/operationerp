import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { todayWIB, visitGrade } from '../../lib/utils'
import { AUDIT_ITEMS, AUDIT_MAX_SCORE, AUDIT_SECTIONS } from '../../lib/constants'
import { OpsBottomNav } from '../../components/BottomNav'
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
        <span className="flex-1 min-w-0">
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

// ── Visit content ─────────────────────────────────────────

function ScoreChips({ value, max = 5 }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${
            value != null && i < value
              ? value >= max * 0.85
                ? 'bg-emerald-500'
                : value >= max * 0.7
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
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
  const scoreTone = (visit.total_score || 0) >= (AUDIT_MAX_SCORE * 0.9)
    ? 'ok'
    : (visit.total_score || 0) >= (AUDIT_MAX_SCORE * 0.8)
      ? 'info'
      : (visit.total_score || 0) >= (AUDIT_MAX_SCORE * 0.6)
        ? 'warn'
        : 'danger'

  const scoresByKey = {}
  const photosByKey = {}
  ;(visit.visit_scores || []).forEach((s) => {
    scoresByKey[s.item_key] = s.score
    photosByKey[s.item_key] = s.photos || []
  })

  return (
    <div className="space-y-5">
      {/* Score header */}
      <div className="flex flex-wrap items-center gap-2">
        <ToneBadge tone={scoreTone}>
          {visit.total_score}/{AUDIT_MAX_SCORE} · {grade.label}
        </ToneBadge>
        <span className="text-[11px] text-slate-400">
          oleh {visit.auditor?.full_name || '-'}
        </span>
      </div>

      {/* Sections with photos */}
      {AUDIT_SECTIONS.map((section) => {
        const sectionItems = AUDIT_ITEMS.filter((item) => item.section === section.key)
        const itemsWithPhotos = sectionItems.filter((item) => (photosByKey[item.key] || []).length > 0)
        const sectionScore = sectionItems.reduce((sum, item) => sum + (scoresByKey[item.key] || 0), 0)
        const sectionMax = sectionItems.length * 5

        return (
          <div key={section.key}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.emoji} {section.label}
              </div>
              <ToneBadge
                tone={
                  sectionScore >= sectionMax * 0.9
                    ? 'ok'
                    : sectionScore >= sectionMax * 0.7
                      ? 'warn'
                      : 'danger'
                }
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
                        <span className="text-[11px] font-semibold text-slate-500">
                          {score ?? '-'}/5
                        </span>
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

              {itemsWithPhotos.length === 0 && (
                <p className="px-1 text-xs italic text-slate-400">Tidak ada foto untuk bagian ini.</p>
              )}
            </div>
          </div>
        )
      })}

      {/* Foto kondisi umum */}
      {(visit.foto_kondisi || []).length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Foto Kondisi Umum
          </div>
          <PhotoViewer urls={visit.foto_kondisi} emptyText="" />
        </div>
      )}

      {/* Catatan */}
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
  const [showList, setShowList] = useState(false)      // mobile manager list toggle

  const today = todayWIB()

  // ── Fetch managers ────────────────────────────────────────

  useEffect(() => {
    const fetchManagers = async () => {
      setLoadingManagers(true)
      const { data } = await supabase
        .from('profiles')
        .select('id,full_name,role,managed_districts,managed_areas')
        .in('role', ['district_manager', 'area_manager'])
        .eq('is_active', true)
        .order('role')
        .order('full_name')
      setManagers(data || [])
      if (data?.length) setSelectedManagerId(data[0].id)
      setLoadingManagers(false)
    }
    fetchManagers()
  }, [])

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

  // ── Reset open accordion when manager or date changes ─────

  useEffect(() => {
    setOpenBranch(null)
  }, [selectedManagerId, selectedDate])

  // ── Lazy-load visit detail ────────────────────────────────

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

  const roleTag = (role) =>
    role === 'district_manager' ? 'DM' : 'AM'

  const managerScope = (m) =>
    m.role === 'district_manager'
      ? (m.managed_districts || []).join(', ')
      : (m.managed_areas || []).join(', ')

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
                  : isDM
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-violet-100 text-violet-700'
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
      footer={<OpsBottomNav />}
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

        {/* Date nav */}
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

      {/* Mobile: manager list overlay */}
      {showList && (
        <div className="mb-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-3 shadow-lg lg:hidden">
          <ManagerList onSelect={() => setShowList(false)} />
        </div>
      )}

      {/* Desktop + mobile content layout */}
      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">

        {/* Desktop: left sidebar manager list */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center gap-3 px-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-100 text-[9px] font-bold text-blue-700">DM</span>
              <span className="text-[11px] text-slate-400">District Manager</span>
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-md bg-violet-100 text-[9px] font-bold text-violet-700">AM</span>
              <span className="text-[11px] text-slate-400">Area Manager</span>
            </div>
            <ManagerList />
          </div>
        </aside>

        {/* Right: detail panel */}
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

          {/* Visit summary badge */}
          {!loadingBranches && branches.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <ToneBadge
                tone={
                  visitedCount === branches.length
                    ? 'ok'
                    : visitedCount > 0
                      ? 'warn'
                      : 'slate'
                }
              >
                {visitedCount}/{branches.length} toko divisit
              </ToneBadge>
              {visitedCount < branches.length && (
                <ToneBadge tone="danger">{branches.length - visitedCount} belum</ToneBadge>
              )}
            </div>
          )}

          {/* Branches */}
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
