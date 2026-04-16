import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { fmtRp, fmtDateShort, todayWIB } from '../lib/utils'
import Alert from '../components/Alert'
import { DMBottomNav, FinanceBottomNav } from '../components/BottomNav'

const PERIODS = [
  { key: 'day',   label: 'Harian' },
  { key: 'week',  label: 'Mingguan' },
  { key: 'month', label: 'Bulanan' },
]

function getDateRange(period, anchorDate) {
  const [year, month, day] = anchorDate.split('-').map(Number)
  const base = new Date(Date.UTC(year, month - 1, day))

  if (period === 'day') {
    return {
      start: anchorDate,
      end: anchorDate,
      label: new Date(anchorDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    }
  }

  if (period === 'month') {
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(Date.UTC(year, month, 0))
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`
    return {
      start,
      end,
      label: new Date(anchorDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    }
  }

  // week
  const weekDay = base.getUTCDay()
  const diff = weekDay === 0 ? 6 : weekDay - 1
  base.setUTCDate(base.getUTCDate() - diff)
  const end = new Date(base)
  end.setUTCDate(base.getUTCDate() + 6)
  const startIso = base.toISOString().split('T')[0]
  const endIso   = end.toISOString().split('T')[0]
  return {
    start: startIso,
    end: endIso,
    label: `${new Date(startIso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${new Date(endIso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`,
  }
}

export default function OpexOverview() {
  const { profile, signOut } = useAuth()
  const isFinance = profile?.role === 'finance_supervisor'

  const [period, setPeriod]           = useState('month')
  const [anchorDate, setAnchorDate]   = useState(todayWIB())
  const [items, setItems]             = useState([])
  const [branches, setBranches]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  // Filters
  const [areaFilter, setAreaFilter]         = useState('all')
  const [districtFilter, setDistrictFilter] = useState('all')
  const [branchFilter, setBranchFilter]     = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // View mode: 'list' | 'by_store' | 'by_category'
  const [viewMode, setViewMode] = useState('by_store')

  useEffect(() => { fetchBranches() }, [profile?.id])
  useEffect(() => { fetchOpex() }, [period, anchorDate])

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
    const range = getDateRange(period, anchorDate)
    const { data, error: fetchErr } = await supabase
      .from('operational_expenses')
      .select('*, branch:branches(id,name,store_id,district,area)')
      .gte('tanggal', range.start)
      .lte('tanggal', range.end)
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })

    if (fetchErr) {
      setError('Gagal memuat data: ' + fetchErr.message)
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  // Derived filter options
  const areaOptions = useMemo(() =>
    Array.from(new Set(branches.map(b => b.area).filter(Boolean))).sort()
  , [branches])

  const districtOptions = useMemo(() =>
    Array.from(new Set(
      branches
        .filter(b => areaFilter === 'all' || b.area === areaFilter)
        .map(b => b.district)
        .filter(Boolean)
    )).sort()
  , [branches, areaFilter])

  const branchOptions = useMemo(() =>
    branches.filter(b => {
      if (areaFilter !== 'all' && b.area !== areaFilter) return false
      if (districtFilter !== 'all' && b.district !== districtFilter) return false
      return true
    })
  , [branches, areaFilter, districtFilter])

  const categoryOptions = useMemo(() =>
    Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort()
  , [items])

  // Reset cascade
  useEffect(() => {
    if (districtFilter !== 'all' && !districtOptions.includes(districtFilter))
      setDistrictFilter('all')
  }, [districtOptions])

  useEffect(() => {
    if (branchFilter !== 'all' && !branchOptions.some(b => b.id === branchFilter))
      setBranchFilter('all')
  }, [branchOptions])

  // Filtered items
  const filtered = useMemo(() => {
    return items.filter(item => {
      if (areaFilter !== 'all' && item.branch?.area !== areaFilter) return false
      if (districtFilter !== 'all' && item.branch?.district !== districtFilter) return false
      if (branchFilter !== 'all' && item.branch_id !== branchFilter) return false
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      return true
    })
  }, [items, areaFilter, districtFilter, branchFilter, categoryFilter])

  const totalOpex      = filtered.reduce((s, i) => s + Number(i.total || 0), 0)
  const storeCount     = new Set(filtered.map(i => i.branch_id)).size
  const range          = getDateRange(period, anchorDate)

  // Group by store
  const byStore = useMemo(() => {
    const map = {}
    filtered.forEach(item => {
      const key = item.branch_id
      if (!map[key]) map[key] = { branch: item.branch, total: 0, items: [] }
      map[key].total += Number(item.total || 0)
      map[key].items.push(item)
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filtered])

  // Group by category
  const byCategory = useMemo(() => {
    const map = {}
    filtered.forEach(item => {
      const key = item.category || 'Lainnya'
      if (!map[key]) map[key] = { category: key, total: 0, items: [] }
      map[key].total += Number(item.total || 0)
      map[key].items.push(item)
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filtered])

  const BottomNav = isFinance ? FinanceBottomNav : DMBottomNav

  return (
    <div className="page-shell">
      {/* Header */}
      <header className="bg-primary-600 text-white px-4 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-primary-200 text-xs">Ops Manager</p>
            <h1 className="text-lg font-bold mt-0.5">Beban Operasional</h1>
            <p className="text-primary-300 text-[11px] mt-1">{range.label}</p>
          </div>
          <button onClick={signOut} className="text-primary-300 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-3">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Period selector */}
        <div className="grid grid-cols-3 gap-2">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                period === p.key
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Anchor date + filters */}
        <div className="card p-3 space-y-3">
          <div>
            <label className="label">Tanggal Acuan</label>
            <input className="input" type="date" value={anchorDate}
              onChange={e => setAnchorDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Area</label>
              <select className="input" value={areaFilter} onChange={e => setAreaFilter(e.target.value)}>
                <option value="all">Semua area</option>
                {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label">District</label>
              <select className="input" value={districtFilter} onChange={e => setDistrictFilter(e.target.value)}>
                <option value="all">Semua district</option>
                {districtOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Toko</label>
              <select className="input" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                <option value="all">Semua toko</option>
                {branchOptions.map(b => (
                  <option key={b.id} value={b.id}>{b.name.replace('Bagi Kopi ', '')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Kategori</label>
              <select className="input" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">Semua kategori</option>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="card p-3 text-center">
              <div className="text-base font-bold text-primary-700">{fmtRp(totalOpex)}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Total Opex</div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-lg font-bold text-gray-800">{filtered.length}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Transaksi</div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-lg font-bold text-gray-800">{storeCount}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Toko</div>
            </div>
          </div>
        )}

        {/* View mode tabs */}
        {!loading && filtered.length > 0 && (
          <div className="flex bg-white border border-gray-100 rounded-xl overflow-hidden">
            {[
              { key: 'by_store',    label: 'Per Toko' },
              { key: 'by_category', label: 'Per Kategori' },
              { key: 'list',        label: 'Semua' },
            ].map(v => (
              <button key={v.key} onClick={() => setViewMode(v.key)}
                className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                  viewMode === v.key
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}>
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">🧾</div>
            <p className="font-medium">Tidak ada data opex</p>
            <p className="text-xs mt-1">Coba ubah filter atau periode</p>
          </div>
        ) : viewMode === 'by_store' ? (
          <ByStoreView groups={byStore} />
        ) : viewMode === 'by_category' ? (
          <ByCategoryView groups={byCategory} />
        ) : (
          <ListView items={filtered} />
        )}
      </div>

      <BottomNav />
    </div>
  )
}

// ─── Per Toko ────────────────────────────────────────────────────────────────

function ByStoreView({ groups }) {
  const [open, setOpen] = useState(null)

  return (
    <div className="space-y-2">
      {groups.map(g => {
        const isOpen = open === g.branch?.id
        const storeName = g.branch?.name?.replace('Bagi Kopi ', '') || '—'
        return (
          <div key={g.branch?.id} className="card overflow-hidden">
            <button
              onClick={() => setOpen(isOpen ? null : g.branch?.id)}
              className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-xs font-bold text-primary-700 flex-shrink-0">
                {g.branch?.store_id?.split('-')[1] || '??'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">{storeName}</div>
                <div className="text-[11px] text-gray-400">
                  {g.branch?.district || '—'} · {g.items.length} item
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-sm text-primary-700">{fmtRp(g.total)}</div>
                <svg className={`w-4 h-4 text-gray-300 ml-auto transition-transform mt-1 ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-50">
                {g.items.map((item, idx) => (
                  <OpexRow key={item.id} item={item} last={idx === g.items.length - 1} showDate />
                ))}
                <div className="flex justify-between items-center px-4 py-2.5 bg-primary-50 border-t border-primary-100">
                  <span className="text-xs font-semibold text-gray-600">Total {storeName}</span>
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
      {groups.map(g => {
        const isOpen = open === g.category
        return (
          <div key={g.category} className="card overflow-hidden">
            <button
              onClick={() => setOpen(isOpen ? null : g.category)}
              className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 text-left min-w-0">
                <div className="font-semibold text-sm text-gray-900">{g.category}</div>
                <div className="text-[11px] text-gray-400">{g.items.length} transaksi</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-sm text-primary-700">{fmtRp(g.total)}</div>
                <svg className={`w-4 h-4 text-gray-300 ml-auto transition-transform mt-1 ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-50">
                {g.items.map((item, idx) => (
                  <OpexRow key={item.id} item={item} last={idx === g.items.length - 1} showStore showDate />
                ))}
                <div className="flex justify-between items-center px-4 py-2.5 bg-primary-50 border-t border-primary-100">
                  <span className="text-xs font-semibold text-gray-600">Total {g.category}</span>
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
    <div className="card overflow-hidden">
      {items.map((item, idx) => (
        <OpexRow key={item.id} item={item} last={idx === items.length - 1} showStore showDate />
      ))}
    </div>
  )
}

// ─── Row shared component ─────────────────────────────────────────────────────

function OpexRow({ item, last, showStore = false, showDate = false }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 ${!last ? 'border-b border-gray-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">
          {item.code} — {item.item_name}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {item.qty} × {fmtRp(item.harga_satuan)}
          {item.detail && <span className="ml-1 italic">· {item.detail}</span>}
        </div>
        {(showStore || showDate) && (
          <div className="text-[10px] text-gray-400 mt-0.5">
            {showStore && (item.branch?.name?.replace('Bagi Kopi ', '') || '—')}
            {showStore && showDate && ' · '}
            {showDate && fmtDateShort(item.tanggal)}
          </div>
        )}
      </div>
      <div className="text-sm font-bold text-primary-700 flex-shrink-0">{fmtRp(item.total)}</div>
    </div>
  )
}
