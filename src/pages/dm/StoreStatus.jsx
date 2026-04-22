import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { CHECKLIST_ITEMS, PREPARATION_ITEMS } from '../../lib/constants'
import { todayWIB } from '../../lib/utils'
import { DMBottomNav, OpsBottomNav } from '../../components/BottomNav'
import { isOpsLikeRole } from '../../lib/access'
import PhotoViewer from '../../components/PhotoViewer'
import { EmptyPanel, SubpageShell, ToneBadge } from '../../components/ui/AppKit'

function prevDate(d) {
  const dt = new Date(`${d}T00:00:00Z`)
  dt.setUTCDate(dt.getUTCDate() - 1)
  return dt.toISOString().slice(0, 10)
}

function nextDate(d) {
  const dt = new Date(`${d}T00:00:00Z`)
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
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function displayTime(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
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

const PLATFORM_ITEMS_PAGI = [
  { key: 'toko_buka', label: 'Toko Buka' },
  { key: 'gofood_aktif', label: 'GoFood' },
  { key: 'grabfood_aktif', label: 'GrabFood' },
  { key: 'shopeefood_aktif', label: 'ShopeeFood' },
]

const PLATFORM_ITEMS_NON_PAGI = [
  { key: 'toko_close', label: 'Toko Close' },
  { key: 'gofood_close', label: 'GoFood Close' },
  { key: 'grabfood_close', label: 'GrabFood Close' },
  { key: 'shopeefood_close', label: 'ShopeeFood Close' },
]

const AREA_KEYS = CHECKLIST_ITEMS.filter((item) => item.key.endsWith('_bersih')).map((item) => ({
  key: item.key,
  label: item.label,
}))

const PREPARATION_LABELS = Object.fromEntries(PREPARATION_ITEMS.map((item) => [item.key, item.label]))

function normalizePreparationEntries(preparation) {
  const answers = preparation?.answers || {}

  return Object.entries(answers).map(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return {
        key,
        label: PREPARATION_LABELS[key] || key.replaceAll('_', ' '),
        qty: value.qty === '' || value.qty == null ? null : Number(value.qty),
        photos: Array.isArray(value.photos) ? value.photos : [],
      }
    }

    return {
      key,
      label: PREPARATION_LABELS[key] || key.replaceAll('_', ' '),
      qty: value === '' || value == null ? null : Number(value),
      photos: [],
    }
  })
}

function CeklisContent({ checklist }) {
  if (!checklist) {
    return <EmptyPanel title="Belum ada data" description="Ceklis untuk shift ini belum disubmit." />
  }

  const answers = checklist.answers || {}
  const photos = checklist.photos || {}
  const platformItems = checklist.shift === 'pagi' ? PLATFORM_ITEMS_PAGI : PLATFORM_ITEMS_NON_PAGI
  const groomingPhotos = photos.staff_grooming || []
  const allAreaPhotos = AREA_KEYS.flatMap(({ key }) => photos[key] || [])
  const allPhotos = [...(checklist.shift === 'pagi' ? groomingPhotos : []), ...allAreaPhotos]

  const areaOffsets = {}
  let runningOffset = checklist.shift === 'pagi' ? groomingPhotos.length : 0
  AREA_KEYS.forEach(({ key }) => {
    areaOffsets[key] = runningOffset
    runningOffset += (photos[key] || []).length
  })

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
            {answers[key] ? '✓' : '×'} {label}
          </span>
        ))}
        {checklist.is_late && <ToneBadge tone="warn">Terlambat</ToneBadge>}
      </div>

      {checklist.shift === 'pagi' && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Staff Grooming</div>
          <PhotoViewer urls={groomingPhotos} emptyText="Tidak ada foto grooming" allUrls={allPhotos} allOffset={0} />
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
                  {ok ? '✓' : '×'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-700">{label}</div>
                  {areaPhotos.length > 0 && (
                    <div className="mt-1.5">
                      <PhotoViewer urls={areaPhotos} emptyText="" allUrls={allPhotos} allOffset={areaOffsets[key]} />
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

      <div className="text-[11px] text-slate-400">Submit: {displayTime(checklist.submitted_at)}</div>
    </div>
  )
}

function PreparationContent({ preparation }) {
  if (!preparation) {
    return <EmptyPanel title="Belum ada preparation" description="Preparation untuk shift ini belum disubmit." />
  }

  const entries = normalizePreparationEntries(preparation)
  const filledEntries = entries.filter((entry) => entry.qty != null)
  const photoCount = filledEntries.filter((entry) => entry.photos.length > 0).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[18px] bg-slate-50 px-3 py-2.5 text-center">
          <div className="text-[10px] text-slate-400">Item</div>
          <div className="mt-1 text-sm font-bold text-slate-900">{filledEntries.length}</div>
        </div>
        <div className="rounded-[18px] bg-slate-50 px-3 py-2.5 text-center">
          <div className="text-[10px] text-slate-400">Foto</div>
          <div className="mt-1 text-sm font-bold text-emerald-700">{photoCount}</div>
        </div>
        <div className="rounded-[18px] bg-slate-50 px-3 py-2.5 text-center">
          <div className="text-[10px] text-slate-400">Submit</div>
          <div className="mt-1 text-sm font-bold text-slate-900">{displayTime(preparation.updated_at || preparation.created_at)}</div>
        </div>
      </div>

      {filledEntries.length > 0 ? (
        <div className="space-y-2">
          {filledEntries.map((entry) => (
            <div key={entry.key} className="rounded-[18px] bg-slate-50 px-3 py-3">
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${entry.photos.length > 0 ? 'text-emerald-600' : 'text-amber-500'}`}>
                  {entry.photos.length > 0 ? '✓' : '!'}
                </span>
                <div className="min-w-0 flex-1 text-xs font-medium capitalize text-slate-700">
                  {entry.label}
                </div>
                <ToneBadge tone="info">Qty {entry.qty}</ToneBadge>
              </div>

              {entry.photos.length > 0 ? (
                <div className="mt-2">
                  <PhotoViewer urls={entry.photos} emptyText="" />
                </div>
              ) : (
                <div className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-400">
                  Foto item belum ada pada data ini.
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel title="Belum ada rincian item" description="Preparation tersimpan tanpa detail jawaban." />
      )}

      {preparation.notes && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Catatan</div>
          <p className="text-sm leading-6 text-slate-600">{preparation.notes}</p>
        </div>
      )}

      {preparation.photos?.length > 0 && filledEntries.every((entry) => entry.photos.length === 0) && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Foto Lama Preparation</div>
          <PhotoViewer urls={preparation.photos} emptyText="" />
        </div>
      )}
    </div>
  )
}

const SECTIONS = [
  { key: 'ceklis_pagi', label: 'Ceklis Pagi', icon: '☀️' },
  { key: 'ceklis_middle', label: 'Ceklis Middle', icon: '⛅' },
  { key: 'ceklis_malam', label: 'Ceklis Malam', icon: '🌙' },
  { key: 'prep_pagi', label: 'Preparation Pagi', icon: '🥣' },
  { key: 'prep_middle', label: 'Preparation Middle', icon: '🥤' },
  { key: 'prep_malam', label: 'Preparation Malam', icon: '🌃' },
]

export default function StoreStatus() {
  const { profile } = useAuth()
  const [branches, setBranches] = useState([])
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(todayWIB())
  const [openSection, setOpenSection] = useState(null)
  const [dateStatus, setDateStatus] = useState({})
  const [sectionData, setSectionData] = useState({})
  const [loadingSections, setLoadingSections] = useState(new Set())
  const [showList, setShowList] = useState(false)

  const today = todayWIB()
  const isOpsManager = isOpsLikeRole(profile?.role)

  useEffect(() => {
    if (!profile?.role) return

    const fetchBranches = async () => {
      setLoadingBranches(true)
      let query = supabase.from('branches').select('id,name,store_id,district,area').eq('is_active', true)
      if (profile.role === 'district_manager') query = query.in('district', profile.managed_districts || [])
      else if (profile.role === 'area_manager') query = query.in('area', profile.managed_areas || [])
      const { data } = await query.order('name')
      setBranches(data || [])
      if (data?.length) setSelectedId((current) => current || data[0].id)
      setLoadingBranches(false)
    }

    fetchBranches()
  }, [profile?.id, profile?.managed_areas, profile?.managed_districts, profile?.role])

  useEffect(() => {
    if (!branches.length) return

    const fetchStatus = async () => {
      const ids = branches.map((branch) => branch.id)
      const [checklistsRes, preparationRes] = await Promise.all([
        supabase.from('daily_checklists').select('branch_id,shift').in('branch_id', ids).eq('tanggal', selectedDate),
        supabase.from('daily_preparation').select('branch_id,shift').in('branch_id', ids).eq('tanggal', selectedDate),
      ])

      const map = {}
      ;(checklistsRes.data || []).forEach(({ branch_id, shift }) => {
        if (!map[branch_id]) map[branch_id] = {}
        map[branch_id][shift] = true
      })
      ;(preparationRes.data || []).forEach(({ branch_id, shift }) => {
        if (!map[branch_id]) map[branch_id] = {}
        if (shift === 'pagi') map[branch_id].prepPagi = true
        if (shift === 'middle') map[branch_id].prepMiddle = true
        if (shift === 'malam') map[branch_id].prepMalam = true
      })

      setDateStatus(map)
    }

    fetchStatus()
  }, [branches, selectedDate])

  useEffect(() => {
    setOpenSection(null)
  }, [selectedDate, selectedId])

  const loadSection = useCallback(async (section) => {
    if (!selectedId) return

    const cacheKey = `${selectedId}|${selectedDate}|${section}`
    if (sectionData[cacheKey] !== undefined || loadingSections.has(cacheKey)) return

    setLoadingSections((current) => new Set([...current, cacheKey]))

    let result = null

    try {
      if (section.startsWith('ceklis_')) {
        const shift =
          section === 'ceklis_pagi' ? 'pagi' :
          section === 'ceklis_middle' ? 'middle' :
          'malam'

        const { data } = await supabase
          .from('daily_checklists')
          .select('*')
          .eq('branch_id', selectedId)
          .eq('tanggal', selectedDate)
          .eq('shift', shift)
          .maybeSingle()

        result = data
      } else {
        const shift =
          section === 'prep_pagi' ? 'pagi' :
          section === 'prep_middle' ? 'middle' :
          'malam'

        const { data } = await supabase
          .from('daily_preparation')
          .select('*')
          .eq('branch_id', selectedId)
          .eq('tanggal', selectedDate)
          .eq('shift', shift)
          .maybeSingle()

        result = data
      }
    } catch {
      result = null
    }

    setSectionData((current) => ({ ...current, [cacheKey]: result }))
    setLoadingSections((current) => {
      const next = new Set(current)
      next.delete(cacheKey)
      return next
    })
  }, [loadingSections, sectionData, selectedDate, selectedId])

  const toggleSection = (section) => {
    if (openSection === section) {
      setOpenSection(null)
      return
    }

    setOpenSection(section)
    loadSection(section)
  }

  const selectedBranch = branches.find((branch) => branch.id === selectedId)
  const shortName = (branch) => branch?.name?.replace('Bagi Kopi ', '') || '-'
  const getSectionData = (section) => sectionData[`${selectedId}|${selectedDate}|${section}`]
  const isSectionLoading = (section) => loadingSections.has(`${selectedId}|${selectedDate}|${section}`)

  const getSectionBadge = (section) => {
    const status = dateStatus[selectedId]
    if (section === 'ceklis_pagi') return status?.pagi ? <ToneBadge tone="ok">Masuk</ToneBadge> : <ToneBadge tone="danger">Belum</ToneBadge>
    if (section === 'ceklis_middle') return status?.middle ? <ToneBadge tone="ok">Masuk</ToneBadge> : <ToneBadge tone="warn">Belum</ToneBadge>
    if (section === 'ceklis_malam') return status?.malam ? <ToneBadge tone="ok">Masuk</ToneBadge> : <ToneBadge tone="slate">Belum</ToneBadge>
    if (section === 'prep_pagi') return status?.prepPagi ? <ToneBadge tone="ok">Masuk</ToneBadge> : <ToneBadge tone="danger">Belum</ToneBadge>
    if (section === 'prep_middle') return status?.prepMiddle ? <ToneBadge tone="ok">Masuk</ToneBadge> : <ToneBadge tone="warn">Belum</ToneBadge>
    if (section === 'prep_malam') return status?.prepMalam ? <ToneBadge tone="ok">Masuk</ToneBadge> : <ToneBadge tone="slate">Belum</ToneBadge>
    return null
  }

  const footer = isOpsManager ? <OpsBottomNav /> : <DMBottomNav />

  const StoreList = ({ onSelect }) => (
    <div className="flex flex-1 flex-col space-y-1 overflow-y-auto min-h-0">
      {loadingBranches ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      ) : branches.length === 0 ? (
        <p className="px-3 py-4 text-sm text-slate-400">Tidak ada toko di scope kamu.</p>
      ) : (
        branches.map((branch) => {
          const status = dateStatus[branch.id]
          const hasAny = !!(status?.pagi || status?.middle || status?.malam || status?.prepPagi || status?.prepMiddle || status?.prepMalam)
          const isSelected = branch.id === selectedId

          return (
            <button
              key={branch.id}
              type="button"
              onClick={() => {
                setSelectedId(branch.id)
                onSelect?.()
              }}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                isSelected ? 'bg-primary-600 text-white' : 'hover:bg-slate-100'
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${hasAny ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className="min-w-0 flex-1">
                <span className={`block text-xs ${isSelected ? 'text-primary-200' : 'text-slate-400'}`}>{branch.store_id}</span>
                <span className={`block truncate text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-900'}`}>{shortName(branch)}</span>
              </span>
              {isOpsManager && <span className={`text-[10px] ${isSelected ? 'text-primary-200' : 'text-slate-400'}`}>{branch.district}</span>}
            </button>
          )
        })
      )}
    </div>
  )

  return (
    <SubpageShell
      title="Status Toko"
      subtitle={selectedBranch ? `${shortName(selectedBranch)} / ${displayDateShort(selectedDate)}` : 'Pilih toko'}
      eyebrow="Monitoring Operasional"
      footer={footer}
    >
      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setShowList((current) => !current)}
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

      {showList && (
        <div className="mb-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-3 shadow-lg lg:hidden">
          <StoreList onSelect={() => setShowList(false)} />
        </div>
      )}

      <div className="lg:grid lg:h-[calc(100vh-7rem)] lg:grid-cols-[260px_1fr] lg:gap-4">
        <aside className="hidden lg:flex lg:flex-col lg:overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-slate-400">Ada input operasional</span>
              <span className="ml-2 flex h-2 w-2 rounded-full bg-rose-400" />
              <span className="text-[11px] text-slate-400">Belum ada input</span>
            </div>
            <StoreList />
          </div>
        </aside>

        <main className="lg:overflow-y-auto lg:pb-24">
          <div className="mb-4 hidden items-center gap-3 lg:flex">
            <button
              type="button"
              onClick={() => setSelectedDate(prevDate(selectedDate))}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            >
              ‹
            </button>
            <span className="flex-1 text-center text-sm font-semibold text-slate-700">{displayDateShort(selectedDate)}</span>
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
            <EmptyPanel title="Pilih toko" description="Pilih toko dari daftar di samping untuk melihat status operasional harian." />
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
                  {key.startsWith('ceklis_') ? (
                    <CeklisContent checklist={getSectionData(key)} />
                  ) : (
                    <PreparationContent preparation={getSectionData(key)} />
                  )}
                </AccordionRow>
              ))}
            </div>
          )}
        </main>
      </div>
    </SubpageShell>
  )
}
