import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { fmtRp, fmtDateShort, todayWIB, downloadCsv } from '../lib/utils'
import { SmartBottomNav } from '../components/BottomNav'
import {
  EmptyPanel, InlineStat, SectionPanel, SegmentedControl, SoftButton, SubpageShell, ToneBadge,
} from '../components/ui/AppKit'

function fmtDateLong(d) {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtDateMed(d) {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}
function rangeLabel(from, to) {
  if (from === to) return fmtDateLong(from)
  return `${fmtDateMed(from)} – ${fmtDateLong(to)}`
}
function monthStart(isoDate) {
  const [y, m] = isoDate.split('-')
  return `${y}-${m}-01`
}

const VIEW_OPTIONS = [
  { key: 'by_store',    label: 'Per Toko' },
  { key: 'by_category', label: 'Per Kategori' },
  { key: 'list',        label: 'Semua' },
]

export default function OpexOverview() {
  const { profile } = useAuth()
  const isFinance = profile?.role === 'finance_supervisor'

  const [dateFrom, setDateFrom]       = useState(monthStart(todayWIB()))
  const [dateTo, setDateTo]           = useState(todayWIB())
  const [items, setItems]             = useState([])
  const [branches, setBranches]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  const [areaFilter, setAreaFilter]         = useState('all')
  const [districtFilter, setDistrictFilter] = useState('all')
  const [branchFilter, setBranchFilter]     = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [viewMode, setViewMode]             = useState('by_store')

  useEffect(() => { fetchBranches() }, [profile?.id])
  useEffect(() => { fetchOpex() }, [dateFrom, dateTo])

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id,name,store_id,district,area')
      .eq('is_active', true)
      .order('name')
    setBranches(data || [])
  }

  const fetchOpex = async () => {
    setLoading(true)
    setError('')
    const { data, error: fetchErr } = await supabase
      .from('operational_expenses')
      .select('*, branch:branches(id,name,store_id,district,area)')
      .gte('tanggal', dateFrom)
      .lte('tanggal', dateTo)
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })
    if (fetchErr) {
      setError('Gagal memuat data: ' + fetchErr.message)
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  const areaOptions = useMemo(() =>
    Array.from(new Set(branches.map((b) => b.area).filter(Boolean))).sort()
  , [branches])

  const districtOptions = useMemo(() =>
    Array.from(new Set(
      branches
        .filter((b) => areaFilter === 'all' || b.area === areaFilter)
        .map((b) => b.district)
        .filter(Boolean)
    )).sort()
  , [branches, areaFilter])

  const branchOptions = useMemo(() =>
    branches.filter((b) => {
      if (areaFilter !== 'all' && b.area !== areaFilter) return false
      if (districtFilter !== 'all' && b.district !== districtFilter) return false
      return true
    })
  , [branches, areaFilter, districtFilter])

  const categoryOptions = useMemo(() =>
    Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort()
  , [items])

  useEffect(() => {
    if (districtFilter !== 'all' && !districtOptions.includes(districtFilter))
      setDistrictFilter('all')
  }, [districtOptions])

  useEffect(() => {
    if (branchFilter !== 'all' && !branchOptions.some((b) => b.id === branchFilter))
      setBranchFilter('all')
  }, [branchOptions])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (areaFilter !== 'all' && item.branch?.area !== areaFilter) return false
      if (districtFilter !== 'all' && item.branch?.district !== districtFilter) return false
      if (branchFilter !== 'all' && item.branch_id !== branchFilter) return false
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      return true
    })
  }, [items, areaFilter, districtFilter, branchFilter, categoryFilter])

  const totalOpex  = filtered.reduce((s, i) => s + Number(i.total || 0), 0)
  const storeCount = new Set(filtered.map((i) => i.branch_id)).size

  const byStore = useMemo(() => {
    const map = {}
    filtered.forEach((item) => {
      const key = item.branch_id
      if (!map[key]) map[key] = { branch: item.branch, total: 0, items: [] }
      map[key].total += Number(item.total || 0)
      map[key].items.push(item)
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filtered])

  const byCategory = useMemo(() => {
    const map = {}
    filtered.forEach((item) => {
      const key = item.category || 'Lainnya'
      if (!map[key]) map[key] = { category: key, total: 0, items: [] }
      map[key].total += Number(item.total || 0)
      map[key].items.push(item)
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filtered])

  const handleDownload = () => {
    downloadCsv(
      `opex_${dateFrom}_${dateTo}.csv`,
      ['Tanggal', 'Toko', 'District', 'Area', 'Kode', 'Kategori', 'Item', 'Detail', 'Qty', 'Harga Satuan', 'Total'],
      filtered.map((item) => [
        item.tanggal, item.branch?.name || '', item.branch?.district || '', item.branch?.area || '',
        item.code, item.category, item.item_name, item.detail || '',
        item.qty, item.harga_satuan, item.total,
      ])
    )
  }

  const BottomNav = SmartBottomNav

  return (
    <SubpageShell
      title="Beban Operasional"
      subtitle={rangeLabel(dateFrom, dateTo)}
      eyebrow="Opex"
      footer={<BottomNav />}
    >
      {/* Date + filters */}
      <SectionPanel eyebrow="Filter" title="Rentang & Toko">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Dari</label>
              <input className="input" type="date" value={dateFrom} max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Sampai</label>
              <input className="input" type="date" value={dateTo} min={dateFrom} max={todayWIB()}
                onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Area</label>
              <select className="input" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                <option value="all">Semua area</option>
                {areaOptions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label">District</label>
              <select className="input" value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
                <option value="all">Semua district</option>
                {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Toko</label>
              <select className="input" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                <option value="all">Semua toko</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>{b.name.replace('Bagi Kopi ', '')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Kategori</label>
              <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">Semua kategori</option>
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </SectionPanel>

      {/* Summary */}
      {!loading && filtered.length > 0 && (
        <SectionPanel className="mt-4">
          <div className="grid grid-cols-3 gap-3">
            <InlineStat label="Total Opex"   value={fmtRp(totalOpex)}    tone="primary" />
            <InlineStat label="Transaksi"    value={filtered.length}     tone="slate" />
            <InlineStat label="Toko"         value={storeCount}          tone="slate" />
          </div>
          <div className="mt-3">
            <SoftButton tone="white" icon="download" onClick={handleDownload}>
              Unduh CSV ({filtered.length} baris)
            </SoftButton>
          </div>
        </SectionPanel>
      )}

      {/* Content */}
      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyPanel
            title="Tidak ada data opex"
            description="Tidak ada pengeluaran yang cocok dengan filter yang dipilih."
          />
        ) : (
          <>
            <SegmentedControl
              options={VIEW_OPTIONS}
              value={viewMode}
              onChange={setViewMode}
            />
            <div className="mt-3">
              {viewMode === 'by_store'    && <ByStoreView    groups={byStore} />}
              {viewMode === 'by_category' && <ByCategoryView groups={byCategory} />}
              {viewMode === 'list'        && <ListView       items={filtered} />}
            </div>
          </>
        )}
      </div>
    </SubpageShell>
  )
}

// ─── Per Toko ─────────────────────────────────────────────────────────────────

function ByStoreView({ groups }) {
  const [open, setOpen] = useState(null)

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const isOpen = open === g.branch?.id
        const storeName = g.branch?.name?.replace('Bagi Kopi ', '') || '—'
        return (
          <div key={g.branch?.id} className="overflow-hidden rounded-[22px] border border-white/85 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : g.branch?.id)}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50/60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-xs font-bold text-primary-700">
                {g.branch?.store_id?.split('-')[1] || '??'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{storeName}</div>
                <div className="text-[11px] text-slate-400">
                  {g.branch?.district || '—'} · {g.items.length} item
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-primary-700">{fmtRp(g.total)}</div>
                <span className={`text-xs text-slate-400 transition-transform inline-block ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-slate-100">
                {g.items.map((item, idx) => (
                  <OpexRow key={item.id} item={item} last={idx === g.items.length - 1} showDate />
                ))}
                <div className="flex items-center justify-between border-t border-primary-100 bg-primary-50 px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-600">Total {storeName}</span>
                  <span className="text-sm font-bold text-primary-700">{fmtRp(g.total)}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Per Kategori ─────────────────────────────────────────────────────────────

function ByCategoryView({ groups }) {
  const [open, setOpen] = useState(null)

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const isOpen = open === g.category
        return (
          <div key={g.category} className="overflow-hidden rounded-[22px] border border-white/85 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : g.category)}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50/60"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{g.category}</div>
                <div className="text-[11px] text-slate-400">{g.items.length} transaksi</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-primary-700">{fmtRp(g.total)}</div>
                <span className={`text-xs text-slate-400 transition-transform inline-block ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-slate-100">
                {g.items.map((item, idx) => (
                  <OpexRow key={item.id} item={item} last={idx === g.items.length - 1} showStore showDate />
                ))}
                <div className="flex items-center justify-between border-t border-primary-100 bg-primary-50 px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-600">Total {g.category}</span>
                  <span className="text-sm font-bold text-primary-700">{fmtRp(g.total)}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── List (flat) ──────────────────────────────────────────────────────────────

function ListView({ items }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/85 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
      {items.map((item, idx) => (
        <OpexRow key={item.id} item={item} last={idx === items.length - 1} showStore showDate />
      ))}
    </div>
  )
}

// ─── Row shared component ─────────────────────────────────────────────────────

function OpexRow({ item, last, showStore = false, showDate = false }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 ${!last ? 'border-b border-slate-50' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900">
          {item.code} — {item.item_name}
        </div>
        <div className="mt-0.5 text-xs text-slate-400">
          {item.qty} × {fmtRp(item.harga_satuan)}
          {item.detail && <span className="ml-1 italic">· {item.detail}</span>}
        </div>
        {(showStore || showDate) && (
          <div className="mt-0.5 text-[10px] text-slate-400">
            {showStore && (item.branch?.name?.replace('Bagi Kopi ', '') || '—')}
            {showStore && showDate && ' · '}
            {showDate && fmtDateShort(item.tanggal)}
          </div>
        )}
      </div>
      <div className="shrink-0 text-sm font-bold text-primary-700">{fmtRp(item.total)}</div>
    </div>
  )
}
