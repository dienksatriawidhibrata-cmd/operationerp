import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { downloadCsv, downloadXlsx, fmtDateShort, fmtRp, todayWIB } from '../lib/utils'
import { SmartBottomNav } from '../components/BottomNav'
import {
  EmptyPanel,
  InlineStat,
  SectionPanel,
  SegmentedControl,
  SoftButton,
  SubpageShell,
} from '../components/ui/AppKit'

function fmtDateLong(d) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtDateMed(d) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function rangeLabel(from, to) {
  if (from === to) return fmtDateLong(from)
  return `${fmtDateMed(from)} - ${fmtDateLong(to)}`
}

function monthStart(isoDate) {
  const [year, month] = String(isoDate || '').split('-')
  return `${year}-${month}-01`
}

function toFileSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'semua_toko'
}

const VIEW_OPTIONS = [
  { key: 'by_store', label: 'Per Toko' },
  { key: 'by_category', label: 'Per Kategori' },
  { key: 'list', label: 'Semua' },
]

const EXPORT_HEADERS = ['Tanggal', 'Toko', 'District', 'Area', 'Kode', 'Kategori', 'Item', 'Detail', 'Qty', 'Harga Satuan', 'Total']

function exportRowsFromItems(items) {
  return items.map((item) => ([
    item.tanggal,
    item.branch?.name || '',
    item.branch?.district || '',
    item.branch?.area || '',
    item.code || '',
    item.category || '',
    item.item_name || '',
    item.detail || '',
    item.qty ?? '',
    item.harga_satuan ?? '',
    item.total ?? '',
  ]))
}

export default function OpexOverview() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const today = todayWIB()
  const defaultFrom = monthStart(today)

  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || defaultFrom)
  const [dateTo, setDateTo] = useState(searchParams.get('to') || today)
  const [items, setItems] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [areaFilter, setAreaFilter] = useState(searchParams.get('area') || 'all')
  const [districtFilter, setDistrictFilter] = useState(searchParams.get('district') || 'all')
  const [branchFilter, setBranchFilter] = useState(searchParams.get('branch') || 'all')
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'all')
  const [viewMode, setViewMode] = useState(searchParams.get('view') || 'by_store')

  useEffect(() => {
    const loadBranches = async () => {
      if (!profile?.role) return

      let query = supabase
        .from('branches')
        .select('id,name,store_id,district,area')
        .eq('is_active', true)

      if (profile.role === 'district_manager') {
        query = query.in('district', profile.managed_districts || [])
      } else if (profile.role === 'area_manager') {
        query = query.in('area', profile.managed_areas || [])
      }

      const { data, error: branchError } = await query.order('name')
      if (branchError) {
        setBranches([])
        setError(branchError.message || 'Gagal memuat daftar toko.')
        return
      }

      setBranches(data || [])
    }

    loadBranches()
  }, [profile?.id, profile?.managed_areas, profile?.managed_districts, profile?.role])

  useEffect(() => {
    const loadOpex = async () => {
      if (!profile?.role) return

      const branchIds = branches.map((branch) => branch.id)
      setLoading(true)
      setError('')

      if (!branchIds.length) {
        setItems([])
        setLoading(false)
        return
      }

      const { data, error: fetchErr } = await supabase
        .from('operational_expenses')
        .select('*, branch:branches(id,name,store_id,district,area)')
        .in('branch_id', branchIds)
        .gte('tanggal', dateFrom)
        .lte('tanggal', dateTo)
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false })

      if (fetchErr) {
        setItems([])
        setError(`Gagal memuat data: ${fetchErr.message}`)
      } else {
        setItems(data || [])
      }

      setLoading(false)
    }

    loadOpex()
  }, [branches, dateFrom, dateTo, profile?.role])

  const areaOptions = useMemo(
    () => Array.from(new Set(branches.map((branch) => branch.area).filter(Boolean))).sort(),
    [branches],
  )

  const districtOptions = useMemo(
    () => Array.from(new Set(
      branches
        .filter((branch) => areaFilter === 'all' || branch.area === areaFilter)
        .map((branch) => branch.district)
        .filter(Boolean),
    )).sort(),
    [areaFilter, branches],
  )

  const branchOptions = useMemo(
    () => branches.filter((branch) => {
      if (areaFilter !== 'all' && branch.area !== areaFilter) return false
      if (districtFilter !== 'all' && branch.district !== districtFilter) return false
      return true
    }),
    [areaFilter, branches, districtFilter],
  )

  const categoryOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort(),
    [items],
  )

  useEffect(() => {
    if (districtFilter !== 'all' && !districtOptions.includes(districtFilter)) {
      setDistrictFilter('all')
    }
  }, [districtFilter, districtOptions])

  useEffect(() => {
    if (branchFilter !== 'all' && !branchOptions.some((branch) => branch.id === branchFilter)) {
      setBranchFilter('all')
    }
  }, [branchFilter, branchOptions])

  useEffect(() => {
    if (categoryFilter !== 'all' && !categoryOptions.includes(categoryFilter)) {
      setCategoryFilter('all')
    }
  }, [categoryFilter, categoryOptions])

  useEffect(() => {
    const nextParams = new URLSearchParams()
    nextParams.set('from', dateFrom)
    nextParams.set('to', dateTo)
    if (areaFilter !== 'all') nextParams.set('area', areaFilter)
    if (districtFilter !== 'all') nextParams.set('district', districtFilter)
    if (branchFilter !== 'all') nextParams.set('branch', branchFilter)
    if (categoryFilter !== 'all') nextParams.set('category', categoryFilter)
    if (viewMode !== 'by_store') nextParams.set('view', viewMode)
    setSearchParams(nextParams, { replace: true })
  }, [areaFilter, branchFilter, categoryFilter, dateFrom, dateTo, districtFilter, setSearchParams, viewMode])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (areaFilter !== 'all' && item.branch?.area !== areaFilter) return false
      if (districtFilter !== 'all' && item.branch?.district !== districtFilter) return false
      if (branchFilter !== 'all' && item.branch_id !== branchFilter) return false
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      return true
    })
  }, [areaFilter, branchFilter, categoryFilter, districtFilter, items])

  const totalOpex = filtered.reduce((sum, item) => sum + Number(item.total || 0), 0)
  const storeCount = new Set(filtered.map((item) => item.branch_id)).size

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === branchFilter) || null,
    [branchFilter, branches],
  )

  const byStore = useMemo(() => {
    const map = {}
    filtered.forEach((item) => {
      const key = item.branch_id
      if (!map[key]) map[key] = { branch: item.branch, total: 0, items: [] }
      map[key].total += Number(item.total || 0)
      map[key].items.push(item)
    })
    return Object.values(map).sort((left, right) => right.total - left.total)
  }, [filtered])

  const byCategory = useMemo(() => {
    const map = {}
    filtered.forEach((item) => {
      const key = item.category || 'Lainnya'
      if (!map[key]) map[key] = { category: key, total: 0, items: [] }
      map[key].total += Number(item.total || 0)
      map[key].items.push(item)
    })
    return Object.values(map).sort((left, right) => right.total - left.total)
  }, [filtered])

  const buildFilenameBase = (branchName) => {
    const branchPart = branchName ? `_${toFileSlug(branchName)}` : ''
    return `opex${branchPart}_${dateFrom}_${dateTo}`
  }

  const downloadItemsAsCsv = (rows, branchName) => {
    downloadCsv(
      `${buildFilenameBase(branchName)}.csv`,
      EXPORT_HEADERS,
      exportRowsFromItems(rows),
    )
  }

  const downloadItemsAsXlsx = (rows, branchName) => {
    downloadXlsx(
      `${buildFilenameBase(branchName)}.xlsx`,
      'Opex',
      EXPORT_HEADERS,
      exportRowsFromItems(rows),
    )
  }

  const actionLabel = selectedBranch?.name?.replace('Bagi Kopi ', '') || `${storeCount} toko`

  return (
    <SubpageShell
      title="Beban Operasional"
      subtitle={rangeLabel(dateFrom, dateTo)}
      eyebrow="Opex"
      footer={<SmartBottomNav />}
    >
      <SectionPanel eyebrow="Filter" title="Rentang dan Toko">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Dari</label>
              <input className="input" type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} />
            </div>
            <div>
              <label className="label">Sampai</label>
              <input className="input" type="date" value={dateTo} min={dateFrom} max={today} onChange={(event) => setDateTo(event.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Area</label>
              <select className="input" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
                <option value="all">Semua area</option>
                {areaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
            </div>
            <div>
              <label className="label">District</label>
              <select className="input" value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)}>
                <option value="all">Semua district</option>
                {districtOptions.map((district) => <option key={district} value={district}>{district}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Toko</label>
              <select className="input" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
                <option value="all">Semua toko</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name.replace('Bagi Kopi ', '')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Kategori</label>
              <select className="input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">Semua kategori</option>
                {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
          </div>
        </div>
      </SectionPanel>

      {!loading && filtered.length > 0 && (
        <SectionPanel className="mt-4" title="Ringkasan OPEX" description={`Scope aktif: ${actionLabel}`}>
          <div className="grid grid-cols-3 gap-3">
            <InlineStat label="Total Opex" value={fmtRp(totalOpex)} tone="primary" />
            <InlineStat label="Transaksi" value={filtered.length} tone="slate" />
            <InlineStat label="Toko" value={storeCount} tone="slate" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <SoftButton tone="white" icon="download" onClick={() => downloadItemsAsCsv(filtered, selectedBranch?.name)}>
              Unduh CSV
            </SoftButton>
            <SoftButton tone="white" icon="download" onClick={() => downloadItemsAsXlsx(filtered, selectedBranch?.name)}>
              Unduh XLSX
            </SoftButton>
          </div>
        </SectionPanel>
      )}

      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : error ? (
          <EmptyPanel title="Data OPEX belum bisa dimuat" description={error} />
        ) : filtered.length === 0 ? (
          <EmptyPanel
            title="Tidak ada data opex"
            description="Tidak ada pengeluaran yang cocok dengan filter yang dipilih."
          />
        ) : (
          <>
            <SegmentedControl options={VIEW_OPTIONS} value={viewMode} onChange={setViewMode} />
            <div className="mt-3">
              {viewMode === 'by_store' && (
                <ByStoreView
                  groups={byStore}
                  onDownloadCsv={downloadItemsAsCsv}
                  onDownloadXlsx={downloadItemsAsXlsx}
                />
              )}
              {viewMode === 'by_category' && <ByCategoryView groups={byCategory} />}
              {viewMode === 'list' && <ListView items={filtered} />}
            </div>
          </>
        )}
      </div>
    </SubpageShell>
  )
}

function ByStoreView({ groups, onDownloadCsv, onDownloadXlsx }) {
  const [open, setOpen] = useState(null)

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const isOpen = open === group.branch?.id
        const storeName = group.branch?.name?.replace('Bagi Kopi ', '') || '-'
        return (
          <div key={group.branch?.id} className="overflow-hidden rounded-[22px] border border-white/85 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : group.branch?.id)}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50/60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-xs font-bold text-primary-700">
                {group.branch?.store_id?.split('-')[1] || '??'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{storeName}</div>
                <div className="text-[11px] text-slate-400">
                  {group.branch?.district || '-'} · {group.items.length} item
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-primary-700">{fmtRp(group.total)}</div>
                <span className={`inline-block text-xs text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-slate-100">
                <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3">
                  <SoftButton tone="white" icon="download" onClick={() => onDownloadCsv(group.items, group.branch?.name)}>
                    CSV {storeName}
                  </SoftButton>
                  <SoftButton tone="white" icon="download" onClick={() => onDownloadXlsx(group.items, group.branch?.name)}>
                    XLSX {storeName}
                  </SoftButton>
                </div>
                {group.items.map((item, index) => (
                  <OpexRow key={item.id} item={item} last={index === group.items.length - 1} showDate />
                ))}
                <div className="flex items-center justify-between border-t border-primary-100 bg-primary-50 px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-600">Total {storeName}</span>
                  <span className="text-sm font-bold text-primary-700">{fmtRp(group.total)}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ByCategoryView({ groups }) {
  const [open, setOpen] = useState(null)

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const isOpen = open === group.category
        return (
          <div key={group.category} className="overflow-hidden rounded-[22px] border border-white/85 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : group.category)}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50/60"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{group.category}</div>
                <div className="text-[11px] text-slate-400">{group.items.length} transaksi</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-primary-700">{fmtRp(group.total)}</div>
                <span className={`inline-block text-xs text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-slate-100">
                {group.items.map((item, index) => (
                  <OpexRow key={item.id} item={item} last={index === group.items.length - 1} showStore showDate />
                ))}
                <div className="flex items-center justify-between border-t border-primary-100 bg-primary-50 px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-600">Total {group.category}</span>
                  <span className="text-sm font-bold text-primary-700">{fmtRp(group.total)}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ListView({ items }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/85 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
      {items.map((item, index) => (
        <OpexRow key={item.id} item={item} last={index === items.length - 1} showStore showDate />
      ))}
    </div>
  )
}

function OpexRow({ item, last, showStore = false, showDate = false }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 ${!last ? 'border-b border-slate-50' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900">
          {item.code} - {item.item_name}
        </div>
        <div className="mt-0.5 text-xs text-slate-400">
          {item.qty} x {fmtRp(item.harga_satuan)}
          {item.detail && <span className="ml-1 italic">· {item.detail}</span>}
        </div>
        {(showStore || showDate) && (
          <div className="mt-0.5 text-[10px] text-slate-400">
            {showStore && (item.branch?.name?.replace('Bagi Kopi ', '') || '-')}
            {showStore && showDate && ' · '}
            {showDate && fmtDateShort(item.tanggal)}
          </div>
        )}
      </div>
      <div className="shrink-0 text-sm font-bold text-primary-700">{fmtRp(item.total)}</div>
    </div>
  )
}
