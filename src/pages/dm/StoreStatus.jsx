import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtRp, todayWIB } from '../../lib/utils'
import { CHECKLIST_ITEMS } from '../../lib/constants'
import { DMBottomNav, OpsBottomNav } from '../../components/BottomNav'
import PhotoViewer from '../../components/PhotoViewer'
import {
  EmptyPanel,
  SectionPanel,
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
function displayTime(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
}

// ── Accordion ─────────────────────────────────────────────

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

// ── Checklist content ─────────────────────────────────────

const PLATFORM_ITEMS_PAGI = [
  { key: 'toko_buka', label: 'Toko Buka' },
  { key: 'gofood_aktif', label: 'GoFood' },
  { key: 'grabfood_aktif', label: 'GrabFood' },
  { key: 'shopeefood_aktif', label: 'ShopeeFood' },
]
const PLATFORM_ITEMS_MALAM = [
  { key: 'toko_close', label: 'Toko Close' },
  { key: 'gofood_close', label: 'GoFood Close' },
  { key: 'grabfood_close', label: 'GrabFood Close' },
  { key: 'shopeefood_close', label: 'ShopeeFood Close' },
]
const AREA_KEYS = CHECKLIST_ITEMS.filter((item) => item.key.endsWith('_bersih')).map((item) => ({
  key: item.key,
  label: item.label,
}))

function CeklisContent({ checklist }) {
  if (!checklist) {
    return <EmptyPanel title="Belum ada data" description="Ceklis untuk shift ini belum disubmit." />
  }

  const answers = checklist.answers || {}
  const photos = checklist.photos || {}
  const platformItems = checklist.shift === 'pagi' ? PLATFORM_ITEMS_PAGI : PLATFORM_ITEMS_MALAM

  const allAreaPhotos = AREA_KEYS.flatMap(({ key }) => photos[key] || [])
  const groomingPhotos = photos.staff_grooming || []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {platformItems.map(({ key, label }) => (
          <span
            key={key}
            className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold ${
              answers[key] ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
            }`}
          >
            {answers[key] ? '✓' : '✗'} {label}
          </span>
        ))}
        {checklist.is_late && (
          <span className="inline-flex items-center rounded-xl bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
            Terlambat
          </span>
        )}
      </div>

      {checklist.shift === 'pagi' && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Staff Grooming</div>
          <PhotoViewer urls={groomingPhotos} emptyText="Tidak ada foto grooming" />
        </div>
      )}

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Foto Area</div>
        <div className="space-y-2">
          {AREA_KEYS.map(({ key, label }) => {
            const areaPhotos = photos[key] || []
            const ok = !!answers[key]
            return (
              <div key={key} className="flex items-start gap-3 rounded-[18px] bg-slate-50 px-3 py-2.5">
                <span className={`mt-0.5 text-sm font-semibold ${ok ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {ok ? '✓' : '✗'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-700">{label}</div>
                  {areaPhotos.length > 0 && (
                    <div className="mt-1.5">
                      <PhotoViewer urls={areaPhotos} emptyText="" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {checklist.item_oos?.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Item Out of Stock</div>
          <div className="flex flex-wrap gap-1.5">
            {checklist.item_oos.map((item) => (
              <ToneBadge key={item} tone="warn">{item}</ToneBadge>
            ))}
          </div>
        </div>
      )}

      {checklist.notes && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Catatan Shift</div>
          <p className="text-sm leading-6 text-slate-600">{checklist.notes}</p>
        </div>
      )}

      <div className="text-[11px] text-slate-400">
        Submit: {displayTime(checklist.submitted_at)}
      </div>
    </div>
  )
}

// ── Setoran content ───────────────────────────────────────

function SetoranContent({ setoran }) {
  if (!setoran) {
    return <EmptyPanel title="Belum ada setoran" description="Setoran untuk tanggal ini belum disubmit." />
  }

  const statusTone = setoran.status === 'approved' ? 'ok' : setoran.status === 'submitted' ? 'warn' : setoran.status === 'rejected' ? 'danger' : 'slate'
  const statusLabel = { approved: 'Approved', submitted: 'Pending', rejected: 'Ditolak', draft: 'Draft' }[setoran.status] || setoran.status

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ToneBadge tone={statusTone}>{statusLabel}</ToneBadge>
        <span className="text-[11px] text-slate-400">{displayTime(setoran.submitted_at)}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Cash POS', value: fmtRp(setoran.cash_pos) },
          { label: 'Disetorkan', value: fmtRp(setoran.cash_disetorkan) },
          { label: 'Selisih', value: fmtRp(setoran.selisih), tone: Number(setoran.selisih) === 0 ? 'ok' : 'danger' },
        ].map(({ label, value, tone }) => (
          <div key={label} className="rounded-[18px] bg-slate-50 px-3 py-2.5 text-center">
            <div className="text-[10px] text-slate-400">{label}</div>
            <div className={`mt-1 text-xs font-bold ${tone === 'ok' ? 'text-emerald-700' : tone === 'danger' ? 'text-rose-600' : 'text-slate-900'}`}>{value}</div>
          </div>
        ))}
      </div>

      {setoran.alasan_selisih && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Alasan Selisih</div>
          <p className="text-sm text-slate-600">{setoran.alasan_selisih}</p>
        </div>
      )}

      {setoran.foto_bukti?.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Foto Bukti</div>
          <PhotoViewer urls={setoran.foto_bukti} emptyText="" />
        </div>
      )}

      {setoran.rejection_reason && (
        <div className="rounded-[18px] bg-rose-50 px-3 py-2.5">
          <div className="text-xs font-semibold text-rose-700">Alasan Tolak</div>
          <p className="mt-1 text-sm text-rose-600">{setoran.rejection_reason}</p>
        </div>
      )}
    </div>
  )
}

// ── OPEX content ──────────────────────────────────────────

function OpexContent({ expenses }) {
  if (!expenses || expenses.length === 0) {
    return <EmptyPanel title="Tidak ada OPEX" description="Belum ada pengeluaran operasional pada tanggal ini." />
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.total || 0), 0)

  return (
    <div className="space-y-3">
      <div className="text-right text-sm font-semibold text-slate-700">
        Total: {fmtRp(total)}
      </div>
      {expenses.map((exp) => (
        <div key={exp.id} className="rounded-[18px] bg-slate-50 px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-500">{exp.category}</div>
              <div className="mt-0.5 text-sm font-medium text-slate-900">{exp.item_name}</div>
              {exp.detail && <div className="mt-0.5 text-xs text-slate-400">{exp.detail}</div>}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-slate-400">{exp.qty} × {fmtRp(exp.harga_satuan)}</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">{fmtRp(exp.total)}</div>
            </div>
          </div>
          {exp.foto_bukti?.length > 0 && (
            <div className="mt-2">
              <PhotoViewer urls={exp.foto_bukti} emptyText="" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Laporan content ───────────────────────────────────────

function LaporanContent({ laporan }) {
  if (!laporan) {
    return <EmptyPanel title="Belum ada laporan" description="Laporan harian untuk tanggal ini belum disubmit." />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Net Sales', value: fmtRp(laporan.net_sales) },
          { label: 'Avg Spend', value: fmtRp(laporan.avg_spend) },
          { label: 'Kunjungan', value: laporan.jumlah_kunjungan },
          { label: 'Staff', value: laporan.jumlah_staff },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-[18px] bg-slate-50 px-3 py-2.5 text-center">
            <div className="text-[10px] text-slate-400">{label}</div>
            <div className="mt-1 text-sm font-bold text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      {laporan.notes && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Catatan</div>
          <p className="text-sm leading-6 text-slate-600">{laporan.notes}</p>
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>Submit: {displayTime(laporan.submitted_at)}</span>
        {laporan.is_late && <ToneBadge tone="warn">Terlambat</ToneBadge>}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

const SECTIONS = [
  { key: 'ceklis_pagi', label: 'Ceklis Pagi', icon: '☀️' },
  { key: 'ceklis_malam', label: 'Ceklis Malam', icon: '🌙' },
  { key: 'setoran', label: 'Setoran', icon: '💰' },
  { key: 'opex', label: 'OPEX', icon: '🧾' },
  { key: 'laporan', label: 'Laporan Harian', icon: '📋' },
]

export default function StoreStatus() {
  const { profile } = useAuth()
  const [branches, setBranches] = useState([])
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(todayWIB())
  const [openSection, setOpenSection] = useState(null)
  const [dateStatus, setDateStatus] = useState({})   // branchId → { pagi: bool, malam: bool }
  const [sectionData, setSectionData] = useState({}) // `${branchId}|${date}|${section}` → data
  const [loadingSections, setLoadingSections] = useState(new Set())
  const [showList, setShowList] = useState(false)    // mobile store list toggle

  const today = todayWIB()
  const isOpsManager = profile?.role === 'ops_manager'

  // ── Fetch branches ────────────────────────────────────────

  useEffect(() => {
    if (!profile?.role) return
    const fetchBranches = async () => {
      setLoadingBranches(true)
      let q = supabase.from('branches').select('id,name,store_id,district,area').eq('is_active', true)
      if (profile.role === 'district_manager') q = q.in('district', profile.managed_districts || [])
      else if (profile.role === 'area_manager') q = q.in('area', profile.managed_areas || [])
      const { data } = await q.order('name')
      setBranches(data || [])
      if (data?.length) setSelectedId(data[0].id)
      setLoadingBranches(false)
    }
    fetchBranches()
  }, [profile?.id, profile?.role])

  // ── Fetch ceklis status for selected date ─────────────────

  useEffect(() => {
    if (!branches.length) return
    const fetchStatus = async () => {
      const ids = branches.map((b) => b.id)
      const { data } = await supabase
        .from('daily_checklists')
        .select('branch_id,shift')
        .in('branch_id', ids)
        .eq('tanggal', selectedDate)
      const map = {}
      ;(data || []).forEach(({ branch_id, shift }) => {
        if (!map[branch_id]) map[branch_id] = {}
        map[branch_id][shift] = true
      })
      setDateStatus(map)
    }
    fetchStatus()
  }, [selectedDate, branches])

  // ── Reset section cache when branch or date changes ───────

  useEffect(() => {
    setOpenSection(null)
  }, [selectedId, selectedDate])

  // ── Lazy-load section data ────────────────────────────────

  const loadSection = useCallback(async (section) => {
    if (!selectedId) return
    const key = `${selectedId}|${selectedDate}|${section}`
    if (sectionData[key] !== undefined || loadingSections.has(key)) return

    setLoadingSections((prev) => new Set([...prev, key]))

    let result = null
    try {
      if (section === 'ceklis_pagi' || section === 'ceklis_malam') {
        const shift = section === 'ceklis_pagi' ? 'pagi' : 'malam'
        const { data } = await supabase
          .from('daily_checklists')
          .select('*')
          .eq('branch_id', selectedId)
          .eq('tanggal', selectedDate)
          .eq('shift', shift)
          .maybeSingle()
        result = data
      } else if (section === 'setoran') {
        const { data } = await supabase
          .from('daily_deposits')
          .select('*')
          .eq('branch_id', selectedId)
          .eq('tanggal', selectedDate)
          .maybeSingle()
        result = data
      } else if (section === 'opex') {
        const { data } = await supabase
          .from('operational_expenses')
          .select('*')
          .eq('branch_id', selectedId)
          .eq('tanggal', selectedDate)
          .order('created_at')
        result = data || []
      } else if (section === 'laporan') {
        const { data } = await supabase
          .from('daily_reports')
          .select('*')
          .eq('branch_id', selectedId)
          .eq('tanggal', selectedDate)
          .maybeSingle()
        result = data
      }
    } catch {}

    setSectionData((prev) => ({ ...prev, [key]: result }))
    setLoadingSections((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [selectedId, selectedDate, sectionData, loadingSections])

  const toggleSection = (section) => {
    if (openSection === section) {
      setOpenSection(null)
    } else {
      setOpenSection(section)
      loadSection(section)
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  const selectedBranch = branches.find((b) => b.id === selectedId)
  const shortName = (b) => b?.name?.replace('Bagi Kopi ', '') || '-'

  const getSectionData = (section) => {
    const key = `${selectedId}|${selectedDate}|${section}`
    return sectionData[key]
  }
  const isSectionLoading = (section) => {
    const key = `${selectedId}|${selectedDate}|${section}`
    return loadingSections.has(key)
  }

  const getSectionBadge = (section) => {
    const s = dateStatus[selectedId]
    if (section === 'ceklis_pagi') {
      return s?.pagi
        ? <ToneBadge tone="ok">Masuk</ToneBadge>
        : <ToneBadge tone="danger">Belum</ToneBadge>
    }
    if (section === 'ceklis_malam') {
      return s?.malam
        ? <ToneBadge tone="ok">Masuk</ToneBadge>
        : <ToneBadge tone="slate">Belum</ToneBadge>
    }
    return null
  }

  const footer = isOpsManager ? <OpsBottomNav /> : <DMBottomNav />

  // ── Store list component ──────────────────────────────────

  const StoreList = ({ onSelect }) => (
    <div className="space-y-1 overflow-y-auto">
      {loadingBranches ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      ) : branches.length === 0 ? (
        <p className="px-3 py-4 text-sm text-slate-400">Tidak ada toko di scope kamu.</p>
      ) : (
        branches.map((branch) => {
          const status = dateStatus[branch.id]
          const hasPagi = !!status?.pagi
          const isSelected = branch.id === selectedId
          return (
            <button
              key={branch.id}
              type="button"
              onClick={() => { setSelectedId(branch.id); onSelect?.() }}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                isSelected ? 'bg-primary-600 text-white' : 'hover:bg-slate-100'
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${hasPagi ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className="min-w-0 flex-1">
                <span className={`block text-xs ${isSelected ? 'text-primary-200' : 'text-slate-400'}`}>
                  {branch.store_id}
                </span>
                <span className={`block truncate text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                  {shortName(branch)}
                </span>
              </span>
              {isOpsManager && (
                <span className={`text-[10px] ${isSelected ? 'text-primary-200' : 'text-slate-400'}`}>
                  {branch.district}
                </span>
              )}
            </button>
          )
        })
      )}
    </div>
  )

  // ── Render ────────────────────────────────────────────────

  return (
    <SubpageShell
      title="Status Toko"
      subtitle={selectedBranch ? `${shortName(selectedBranch)} / ${displayDateShort(selectedDate)}` : 'Pilih toko'}
      eyebrow="Monitoring"
      footer={footer}
    >
      {/* Mobile: store picker bar */}
      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm"
        >
          {selectedBranch && (
            <span className={`h-2 w-2 shrink-0 rounded-full ${dateStatus[selectedId]?.pagi ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          )}
          <span className="flex-1 truncate text-sm font-semibold text-slate-900">
            {selectedBranch ? `${selectedBranch.store_id} - ${shortName(selectedBranch)}` : 'Pilih toko'}
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
        <span className="w-20 text-center text-xs font-semibold text-slate-700">{displayDate(selectedDate)}</span>
        <button
          type="button"
          onClick={() => setSelectedDate(nextDate(selectedDate))}
          disabled={selectedDate >= today}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
        >
          ›
        </button>
      </div>

      {/* Mobile: store list overlay */}
      {showList && (
        <div className="mb-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-3 shadow-lg lg:hidden">
          <StoreList onSelect={() => setShowList(false)} />
        </div>
      )}

      {/* Desktop + mobile content layout */}
      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">

        {/* Desktop: left sidebar store list */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-slate-400">Ceklis pagi masuk</span>
              <span className="ml-2 flex h-2 w-2 rounded-full bg-rose-400" />
              <span className="text-[11px] text-slate-400">Belum</span>
            </div>
            <StoreList />
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

          {!selectedBranch ? (
            <EmptyPanel title="Pilih toko" description="Pilih toko dari daftar di atas untuk melihat status harian." />
          ) : (
            <div className="space-y-3">
              {SECTIONS.map(({ key, label, icon }) => (
                <AccordionRow
                  key={key}
                  label={label}
                  icon={icon}
                  statusBadge={getSectionBadge(key)}
                  isOpen={openSection === key}
                  onToggle={() => toggleSection(key)}
                  loading={isSectionLoading(key)}
                >
                  {key === 'ceklis_pagi' && <CeklisContent checklist={getSectionData(key)} />}
                  {key === 'ceklis_malam' && <CeklisContent checklist={getSectionData(key)} />}
                  {key === 'setoran' && <SetoranContent setoran={getSectionData(key)} />}
                  {key === 'opex' && <OpexContent expenses={getSectionData(key)} />}
                  {key === 'laporan' && <LaporanContent laporan={getSectionData(key)} />}
                </AccordionRow>
              ))}
            </div>
          )}
        </main>
      </div>
    </SubpageShell>
  )
}
