import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { OpsBottomNav } from '../../components/BottomNav'
import { AppIcon } from '../../components/ui/AppKit'
import { fmtRp, todayWIB } from '../../lib/utils'

const STATUS_DEFS = {
  selesai: { label: 'Selesai', badge: 'bg-green-50 text-green-600',   bar: 'bg-green-500'  },
  selisih: { label: 'Selisih', badge: 'bg-red-50 text-red-600',       bar: 'bg-red-500'    },
  pending: { label: 'Pending', badge: 'bg-orange-50 text-orange-600', bar: 'bg-orange-500' },
  ditolak: { label: 'Ditolak', badge: 'bg-rose-50 text-rose-600',     bar: 'bg-rose-500'   },
  belum:   { label: 'Belum',   badge: 'bg-slate-100 text-slate-500',  bar: 'bg-slate-300'  },
}

const FILTER_OPTIONS = [
  { key: 'all',     label: 'Semua'   },
  { key: 'belum',   label: 'Belum'   },
  { key: 'pending', label: 'Pending' },
  { key: 'selesai', label: 'Selesai' },
  { key: 'selisih', label: 'Selisih' },
  { key: 'ditolak', label: 'Ditolak' },
]

function deriveStatus(deposit) {
  if (!deposit) return 'belum'
  if (deposit.status === 'submitted') return 'pending'
  if (deposit.status === 'rejected') return 'ditolak'
  if (deposit.status === 'approved') return Number(deposit.selisih || 0) !== 0 ? 'selisih' : 'selesai'
  return 'belum'
}

function fmtDateLong(dateStr) {
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function fmtTime(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  })
}

export default function SetoranDetail() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const today = todayWIB()

  const [selectedDate, setSelectedDate] = useState(params.get('date') || today)
  const [statusFilter, setStatusFilter] = useState(params.get('filter') || 'all')
  const [search, setSearch] = useState('')
  const [branches, setBranches] = useState([])
  const [deposits, setDeposits] = useState([])
  const [loading, setLoading] = useState(true)

  const isToday = selectedDate === today

  useEffect(() => {
    const next = new URLSearchParams()
    if (selectedDate !== today) next.set('date', selectedDate)
    if (statusFilter !== 'all') next.set('filter', statusFilter)
    setParams(next, { replace: true })
  }, [selectedDate, statusFilter, today, setParams])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const [branchRes, depRes] = await Promise.all([
        supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
        supabase.from('daily_deposits')
          .select('id, branch_id, status, cash_disetorkan, selisih, submitted_at, approved_at')
          .eq('tanggal', selectedDate),
      ])
      if (cancelled) return
      setBranches(branchRes.data || [])
      setDeposits(depRes.data || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [selectedDate])

  const rows = useMemo(() => {
    const byBranch = {}
    deposits.forEach((dep) => { byBranch[dep.branch_id] = dep })
    return branches.map((branch) => {
      const dep = byBranch[branch.id] || null
      return {
        branch_id: branch.id,
        name: branch.name,
        status: deriveStatus(dep),
        amount: dep?.cash_disetorkan,
        time: dep?.submitted_at,
      }
    })
  }, [branches, deposits])

  const stats = useMemo(() => {
    let totalMasuk = 0
    let pendingCount = 0
    let belumCount = 0
    let selesaiCount = 0
    rows.forEach((row) => {
      if (row.status === 'pending') pendingCount += 1
      if (row.status === 'belum') belumCount += 1
      if (row.status === 'selesai' || row.status === 'selisih') {
        totalMasuk += Number(row.amount || 0)
        selesaiCount += 1
      }
    })
    return { totalMasuk, pendingCount, belumCount, selesaiCount, total: rows.length }
  }, [rows])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (term && !row.name.toLowerCase().includes(term)) return false
      return true
    })
  }, [rows, search, statusFilter])

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-28 text-slate-800">
      <header className="sticky top-0 z-20 border-b border-blue-50 bg-white/80 px-5 py-4 backdrop-blur-md">
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-full bg-slate-100 p-2 text-slate-600">
            <AppIcon name="chevronLeft" size={20} />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">Retail Pillar</p>
            <h1 className="text-lg font-extrabold text-slate-900">Setoran Toko</h1>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-1.5">
          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            className="rounded-xl p-2 text-slate-500 hover:bg-white"
          >
            <AppIcon name="chevronLeft" size={18} />
          </button>
          <div className="flex items-center gap-2">
            <AppIcon name="calendar" size={16} className="text-blue-600" />
            <span className="text-sm font-bold">{fmtDateLong(selectedDate)}</span>
            {isToday && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                HARI INI
              </span>
            )}
          </div>
          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            disabled={isToday}
            className="rounded-xl p-2 text-slate-500 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <AppIcon name="chevronRight" size={18} />
          </button>
        </div>
      </header>

      <main className="space-y-6 p-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Total Masuk</p>
            <p className="text-xl font-black text-blue-600">{fmtRp(stats.totalMasuk)}</p>
            <p className="mt-1 text-[10px] font-medium text-slate-400">
              {stats.selesaiCount}/{stats.total} toko sudah setor
            </p>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Pending</p>
            <p className="text-xl font-black text-orange-500">{stats.pendingCount} Toko</p>
            <p className="mt-1 text-[10px] font-medium text-slate-400">{stats.belumCount} belum setor</p>
          </div>
        </div>

        <input
          type="text"
          placeholder="Cari nama toko..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl border-none bg-white px-4 py-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                statusFilter === opt.key
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-extrabold">Daftar Setoran</h2>
            <span className="text-[10px] font-bold text-slate-400">
              {filtered.length} / {rows.length} TOKO
            </span>
          </div>

          {loading && <p className="py-8 text-center text-sm text-slate-400">Memuat...</p>}
          {!loading && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">Tidak ada toko sesuai filter.</p>
          )}
          {!loading && filtered.map((row) => {
            const def = STATUS_DEFS[row.status]
            return (
              <div
                key={row.branch_id}
                className="flex items-center justify-between rounded-3xl border border-slate-50 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-1.5 rounded-full ${def.bar}`} />
                  <div>
                    <h3 className="text-sm font-bold">{row.name}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${def.badge}`}>
                        {def.label}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">{fmtTime(row.time)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">
                    {row.amount != null ? fmtRp(row.amount) : '-'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <OpsBottomNav />
    </div>
  )
}
