import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtRp, fmtDateShort, roleLabel, todayWIB } from '../../lib/utils'
import PhotoViewer from '../../components/PhotoViewer'
import Alert from '../../components/Alert'
import { FinanceBottomNav } from '../../components/BottomNav'

const TABS = [
  { key: 'pending', label: 'Belum Diaudit' },
  { key: 'audited', label: 'Sudah Audit' },
  { key: 'flagged', label: 'Flagged' },
]

const PERIODS = [
  { key: 'day', label: 'Harian' },
  { key: 'week', label: 'Mingguan' },
  { key: 'month', label: 'Bulanan' },
]

const STATUS_FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'selisih', label: 'Ada Selisih' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

export default function AuditSetoran() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState('pending')
  const [period, setPeriod] = useState('day')
  const [anchorDate, setAnchorDate] = useState(todayWIB())
  const [items, setItems] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [notesById, setNotesById] = useState({})
  const [actioningId, setActioningId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [filter, setFilter] = useState('all')
  const [areaFilter, setAreaFilter] = useState('all')
  const [districtFilter, setDistrictFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')

  useEffect(() => {
    fetchBranches()
  }, [profile?.id])

  useEffect(() => {
    fetchSetoran()
  }, [tab, period, anchorDate])

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id,name,store_id,district,area')
      .eq('is_active', true)
      .order('name')

    setBranches(data || [])
  }

  const fetchSetoran = async () => {
    setLoading(true)
    const range = getDateRange(period, anchorDate)
    const { data, error: fetchErr } = await supabase
      .from('daily_deposits')
      .select('*, branch:branches(id,name,store_id,district,area)')
      .eq('finance_status', tab)
      .in('status', ['approved', 'rejected', 'submitted'])
      .gte('tanggal', range.start)
      .lte('tanggal', range.end)
      .order('tanggal', { ascending: false })
      .order('submitted_at', { ascending: false })

    if (fetchErr) {
      setMsg({ type: 'error', text: 'Gagal memuat data: ' + fetchErr.message })
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  const areaOptions = useMemo(() => {
    return Array.from(new Set(branches.map((branch) => branch.area).filter(Boolean))).sort()
  }, [branches])

  const districtOptions = useMemo(() => {
    return Array.from(
      new Set(
        branches
          .filter((branch) => areaFilter === 'all' || branch.area === areaFilter)
          .map((branch) => branch.district)
          .filter(Boolean)
      )
    ).sort()
  }, [branches, areaFilter])

  const branchOptions = useMemo(() => {
    return branches.filter((branch) => {
      if (areaFilter !== 'all' && branch.area !== areaFilter) return false
      if (districtFilter !== 'all' && branch.district !== districtFilter) return false
      return true
    })
  }, [branches, areaFilter, districtFilter])

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

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filter === 'selisih' && Number(item.selisih) === 0) return false
      if (filter === 'approved' && item.status !== 'approved') return false
      if (filter === 'rejected' && item.status !== 'rejected') return false
      if (areaFilter !== 'all' && item.branch?.area !== areaFilter) return false
      if (districtFilter !== 'all' && item.branch?.district !== districtFilter) return false
      if (branchFilter !== 'all' && item.branch_id !== branchFilter) return false
      return true
    })
  }, [items, filter, areaFilter, districtFilter, branchFilter])

  const totalSelisih = filtered.reduce((sum, item) => sum + Math.abs(Number(item.selisih || 0)), 0)
  const selectedRange = getDateRange(period, anchorDate)

  const markAudited = async (item, flagged = false) => {
    setActioningId(item.id)
    const { error } = await supabase
      .from('daily_deposits')
      .update({
        finance_status: flagged ? 'flagged' : 'audited',
        finance_audited_by: profile.id,
        finance_audited_at: new Date().toISOString(),
        finance_notes: notesById[item.id] || null,
      })
      .eq('id', item.id)

    if (error) {
      setMsg({ type: 'error', text: 'Gagal: ' + error.message })
    } else {
      setMsg({
        type: 'ok',
        text: flagged
          ? 'Setoran diflag untuk review lebih lanjut.'
          : 'Setoran selesai diaudit.',
      })
      setSelectedId(null)
      setNotesById((current) => ({ ...current, [item.id]: '' }))
      fetchSetoran()
    }
    setActioningId(null)
  }

  const financeTitle = profile?.role === 'ops_manager'
    ? 'Finance Audit - Ops Manager'
    : roleLabel(profile?.role || 'finance_supervisor')

  return (
    <div className="page-shell">
      <header className="bg-primary-600 text-white px-4 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-primary-200 text-xs">{financeTitle}</p>
            <h1 className="text-lg font-bold mt-0.5">Audit Setoran</h1>
            <p className="text-primary-300 text-[11px] mt-1">{selectedRange.label}</p>
          </div>
          <button onClick={signOut} className="text-primary-300 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex bg-white border-b border-gray-100 px-4 gap-1 sticky top-0 z-10">
        {TABS.map((currentTab) => (
          <button
            key={currentTab.key}
            onClick={() => setTab(currentTab.key)}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors ${
              tab === currentTab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400'
            }`}
          >
            {currentTab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-3">
        {msg && <Alert variant={msg.type === 'ok' ? 'ok' : 'error'}>{msg.text}</Alert>}

        <div className="grid grid-cols-3 gap-2">
          {PERIODS.map((option) => (
            <button
              key={option.key}
              onClick={() => setPeriod(option.key)}
              className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                period === option.key
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="card p-3 space-y-3">
          <div>
            <label className="label">Tanggal Acuan</label>
            <input
              className="input"
              type="date"
              value={anchorDate}
              onChange={(event) => setAnchorDate(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Area</label>
              <select className="input" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
                <option value="all">Semua area</option>
                {areaOptions.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">District</label>
              <select className="input" value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)}>
                <option value="all">Semua district</option>
                {districtOptions.map((district) => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Toko</label>
            <select className="input" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
              <option value="all">Semua toko</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name.replace('Bagi Kopi ', '')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="flex gap-2">
            <div className="card flex-1 p-3 text-center">
              <div className="text-lg font-bold text-primary-700">{filtered.length}</div>
              <div className="text-xs text-gray-400">Total</div>
            </div>
            <div className="card flex-1 p-3 text-center">
              <div className="text-lg font-bold text-red-600">
                {filtered.filter((item) => Number(item.selisih) !== 0).length}
              </div>
              <div className="text-xs text-gray-400">Ada Selisih</div>
            </div>
            <div className="card flex-1 p-3 text-center">
              <div className="text-base font-bold text-red-600">{fmtRp(totalSelisih)}</div>
              <div className="text-xs text-gray-400">Total Selisih</div>
            </div>
          </div>
        )}

        {!loading && (
          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTERS.map((statusFilter) => (
              <button
                key={statusFilter.key}
                onClick={() => setFilter(statusFilter.key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  filter === statusFilter.key
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {statusFilter.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">-</div>
            <p className="font-medium">Tidak ada setoran di filter ini</p>
          </div>
        ) : (
          filtered.map((item) => (
            <FinanceCard
              key={item.id}
              item={item}
              expanded={selectedId === item.id}
              onToggle={() => setSelectedId(selectedId === item.id ? null : item.id)}
              onAudit={() => markAudited(item, false)}
              onFlag={() => markAudited(item, true)}
              notes={notesById[item.id] || ''}
              onNotesChange={(value) => setNotesById((current) => ({ ...current, [item.id]: value }))}
              actioning={actioningId === item.id}
              tab={tab}
            />
          ))
        )}
      </div>

      <FinanceBottomNav />
    </div>
  )
}

function FinanceCard({ item, expanded, onToggle, onAudit, onFlag, notes, onNotesChange, actioning, tab }) {
  const selisih = Number(item.selisih)

  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
        <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-xs font-bold text-primary-700 flex-shrink-0">
          {item.branch?.store_id?.split('-')[1] || '??'}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="font-semibold text-sm text-gray-900 truncate">
            {item.branch?.name?.replace('Bagi Kopi ', '') || '-'}
          </div>
          <div className="text-[11px] text-gray-400">{`${item.branch?.district || '-'} - ${item.branch?.area || '-'}`}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {`${fmtDateShort(item.tanggal)} - ${fmtRp(item.cash_disetorkan)}`}
            {selisih !== 0 && <span className="text-red-500 ml-1.5 font-semibold">Selisih {fmtRp(Math.abs(selisih))}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
            item.status === 'approved' ? 'bg-green-100 text-green-700' :
            item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            {item.status === 'approved' ? 'DM Approved' : item.status === 'rejected' ? 'DM Rejected' : 'Pending DM'}
          </span>
          <svg
            className={`w-4 h-4 text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400">Cash POS</div>
              <div className="font-bold">{fmtRp(item.cash_pos)}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400">Disetorkan</div>
              <div className="font-bold">{fmtRp(item.cash_disetorkan)}</div>
            </div>
          </div>

          {selisih !== 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <div className="text-xs text-red-500 font-semibold">Selisih Cash</div>
              <div className="text-xl font-bold text-red-700">{fmtRp(Math.abs(selisih))}</div>
              {item.alasan_selisih && (
                <div className="text-xs text-red-600 mt-1.5 bg-red-100 rounded-lg px-2 py-1.5 italic">
                  "{item.alasan_selisih}"
                </div>
              )}
            </div>
          )}

          <div>
            <p className="label mb-2">Foto Bukti Setoran</p>
            <PhotoViewer urls={item.foto_bukti || []} emptyText="Tidak ada foto bukti" />
          </div>

          <div className="text-xs text-gray-400 space-y-0.5">
            <div>Submit: {item.submitted_at ? new Date(item.submitted_at).toLocaleString('id-ID') : '-'}</div>
            {item.approved_at && item.status === 'approved' && (
              <div>Approved by DM: {new Date(item.approved_at).toLocaleString('id-ID')}</div>
            )}
            {item.approved_at && item.status === 'rejected' && (
              <div className="text-red-500">Rejected by DM: {new Date(item.approved_at).toLocaleString('id-ID')}</div>
            )}
            {item.finance_notes && <div className="mt-1 text-primary-600">Catatan audit: {item.finance_notes}</div>}
          </div>

          {tab === 'pending' && (
            <>
              <div>
                <label className="label">Catatan Audit Finance</label>
                <input
                  className="input"
                  type="text"
                  value={notes}
                  onChange={(event) => onNotesChange(event.target.value)}
                  placeholder="Catatan untuk rekap (opsional)..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onFlag}
                  disabled={actioning}
                  className="flex-1 py-2.5 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm font-semibold"
                >
                  {actioning ? '...' : 'Flag'}
                </button>
                <button
                  onClick={onAudit}
                  disabled={actioning}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold"
                >
                  {actioning ? '...' : 'Selesai Diaudit'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function getDateRange(period, anchorDate) {
  const [year, month, day] = anchorDate.split('-').map(Number)
  const base = new Date(Date.UTC(year, month - 1, day))

  if (period === 'day') {
    return {
      start: anchorDate,
      end: anchorDate,
      label: `Harian - ${formatRangeDate(anchorDate, { day: 'numeric', month: 'long', year: 'numeric' })}`,
    }
  }

  if (period === 'month') {
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(Date.UTC(year, month, 0))
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`
    return {
      start,
      end,
      label: `Bulanan - ${formatRangeDate(start, { month: 'long', year: 'numeric' })}`,
    }
  }

  const weekDay = base.getUTCDay()
  const diff = weekDay === 0 ? 6 : weekDay - 1
  base.setUTCDate(base.getUTCDate() - diff)
  const end = new Date(base)
  end.setUTCDate(base.getUTCDate() + 6)
  const startIso = base.toISOString().split('T')[0]
  const endIso = end.toISOString().split('T')[0]

  return {
    start: startIso,
    end: endIso,
    label: `Mingguan - ${formatRangeDate(startIso, { day: 'numeric', month: 'short' })} - ${formatRangeDate(endIso, { day: 'numeric', month: 'short', year: 'numeric' })}`,
  }
}

function formatRangeDate(date, options) {
  return new Date(date).toLocaleDateString('id-ID', options)
}
