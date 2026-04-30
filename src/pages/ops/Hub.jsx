import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { OpsBottomNav } from '../../components/BottomNav'
import { AppIcon } from '../../components/ui/AppKit'
import LeaderboardSection from '../../components/LeaderboardSection'
import { fetchOperationalLeaderboards, EMPTY_LEADERBOARDS } from '../../lib/opsLeaderboards'
import { currentPeriodWIB, fmtRp, todayWIB } from '../../lib/utils'

function fmtSetoranDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function shiftDateStr(dateStr, days) {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

export default function OpsHub() {
  const { profile, signOut } = useAuth()
  const today = todayWIB()
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriodWIB())

  const [stats, setStats] = useState({
    pendingSetoran: 0,
    ceklisToday: 0,
    activeOrders: 0,
    totalBranches: 0,
  })
  const [setoranDate, setSetoranDate] = useState(today)
  const [setoranStats, setSetoranStats] = useState({
    totalMasuk: 0,
    sudahSetor: 0,
    pending: 0,
    belumSetor: 0,
    total: 0,
  })
  const [loadingSetoran, setLoadingSetoran] = useState(true)
  const [leaderboards, setLeaderboards] = useState(EMPTY_LEADERBOARDS)
  const [leaderboardView, setLeaderboardView] = useState('store')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    fetchOperationalLeaderboards({ supabase, period: selectedPeriod, today })
      .then(setLeaderboards)
      .catch(() => setLeaderboards(EMPTY_LEADERBOARDS))
  }, [selectedPeriod])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingSetoran(true)
      const [branchRes, depRes] = await Promise.all([
        supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('daily_deposits').select('status, cash_disetorkan').eq('tanggal', setoranDate),
      ])
      if (cancelled) return
      const total = branchRes.count ?? 0
      let totalMasuk = 0, sudahSetor = 0, pending = 0
      ;(depRes.data || []).forEach((d) => {
        if (d.status === 'approved') {
          sudahSetor += 1
          totalMasuk += Number(d.cash_disetorkan || 0)
        }
        if (d.status === 'submitted') pending += 1
      })
      const belumSetor = Math.max(total - sudahSetor - pending, 0)
      setSetoranStats({ totalMasuk, sudahSetor, pending, belumSetor, total })
      setLoadingSetoran(false)
    }
    load()
    return () => { cancelled = true }
  }, [setoranDate])

  const fetchStats = async () => {
    const [setoranRes, ceklisRes, ordersRes, branchRes] = await Promise.all([
      supabase.from('daily_deposits').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
      supabase.from('daily_checklists').select('id', { count: 'exact', head: true }).eq('tanggal', today),
      supabase.from('supply_orders').select('id', { count: 'exact', head: true }).not('status', 'in', '("completed","cancelled")'),
      supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ])

    setStats({
      pendingSetoran: setoranRes.count ?? 0,
      ceklisToday: ceklisRes.count ?? 0,
      activeOrders: ordersRes.count ?? 0,
      totalBranches: branchRes.count ?? 0,
    })
    setLoading(false)
  }

  const shortName = profile?.full_name?.split(' ')[0] ?? 'Manager'

  const isSetoranToday = setoranDate === today
  const setoranDateParam = isSetoranToday ? '' : `date=${setoranDate}`
  const setoranDetailHref = `/ops/setoran${setoranDateParam ? `?${setoranDateParam}` : ''}`
  const setoranBelumHref = `/ops/setoran?${[setoranDateParam, 'filter=belum'].filter(Boolean).join('&')}`

  const quickActions = [
    { to: '/dm/approval', icon: 'approval', label: 'Approval\nSetoran', bg: 'bg-amber-50 border-amber-100 text-amber-600' },
    { to: '/ops/opex-approval', icon: 'finance', label: 'Approval\nOpex', bg: 'bg-orange-50 border-orange-100 text-orange-600' },
    { to: '/dm', icon: 'home', label: 'DM\nDashboard', bg: 'bg-blue-50 border-blue-100 text-blue-600' },
    { to: '/kpi/personal/input', icon: 'checklist', label: 'Input\nKPI', bg: 'bg-sky-50 border-sky-100 text-sky-600' },
    { to: '/tasks', icon: 'checklist', label: 'Manajemen\nTugas', bg: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
    { to: '/sop', icon: 'checklist', label: 'Panduan\nSOP', bg: 'bg-indigo-50 border-indigo-100 text-indigo-600' },
    { to: '/ops/pengumuman', icon: 'bell', label: 'Pengumuman', bg: 'bg-amber-50 border-amber-100 text-amber-600' },
  ]

  const reportLinks = [
    { to: '/dm', icon: 'home', label: 'DM Dashboard', sub: 'Ringkasan semua toko', bg: 'bg-blue-50 border-blue-100', color: 'text-blue-600' },
    { to: '/kpi/personal/input', icon: 'checklist', label: 'Input KPI Personal', sub: 'Penilaian manager & store lead', bg: 'bg-sky-50 border-sky-100', color: 'text-sky-600' },
    { to: '/ops/laporan', icon: 'finance', label: 'Laporan Harian', sub: 'Setoran, opex, dan laporan harian', bg: 'bg-slate-100', color: 'text-slate-600' },
    { to: '/trainer', icon: 'users', label: 'Trainer Hub', sub: 'Penilaian staff', bg: 'bg-emerald-50 border-emerald-100', color: 'text-emerald-600' },
    { to: '/trainer/oje', icon: 'checklist', label: 'OJE', sub: 'On Job Evaluation', bg: 'bg-teal-50 border-teal-100', color: 'text-teal-600' },
    { to: '/ops/visit-monitor', icon: 'map', label: 'Audit Log Visit', sub: 'Skor & foto kunjungan', bg: 'bg-violet-50 border-violet-100', color: 'text-violet-600' },
    { to: '/support/staff', icon: 'users', label: 'Manajemen Staf', sub: 'Akun & akses pengguna', bg: 'bg-slate-50 border-slate-200', color: 'text-slate-600' },
    { to: '/ops/pengumuman', icon: 'bell', label: 'Pengumuman', sub: 'Buat & kelola pengumuman staff', bg: 'bg-amber-50 border-amber-100', color: 'text-amber-600' },
  ]

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-28">
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-blue-50 bg-white/80 px-6 py-4 backdrop-blur-md">
        <div>
          <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Operations Manager</h1>
          <p className="text-xl font-extrabold text-gray-900">Command Center</p>
        </div>
        <div className="flex gap-2">
          {stats.pendingSetoran > 0 && (
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <AppIcon name="bell" size={18} />
              <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
            </div>
          )}
          <button onClick={signOut} className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100">
            <AppIcon name="logout" size={18} />
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-[2rem] bg-blue-600 p-4 text-white shadow-lg shadow-blue-200 transition-transform active:scale-[0.97]">
            <p className="mb-1 text-[9px] font-bold uppercase opacity-80">Toko Aktif</p>
            <h3 className="text-xl font-black">{loading ? '...' : stats.totalBranches}</h3>
            <p className="mt-2 text-[9px] font-bold opacity-70">
              {stats.ceklisToday > 0 ? `${stats.ceklisToday} ceklis masuk` : 'Menunggu ceklis'}
            </p>
          </div>
          <div className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-sm">
            <p className="mb-1 text-[9px] font-bold uppercase text-gray-400">Setoran Pending</p>
            <h3 className={`text-xl font-black ${stats.pendingSetoran > 0 ? 'text-orange-500' : 'text-blue-900'}`}>
              {loading ? '...' : stats.pendingSetoran}
            </h3>
            <div className="mt-2 h-1.5 w-full rounded-full bg-blue-50">
              <div
                className="h-1.5 rounded-full bg-blue-600 transition-all"
                style={{ width: stats.totalBranches > 0 ? `${Math.max(0, 100 - (stats.pendingSetoran / stats.totalBranches) * 100)}%` : '100%' }}
              />
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <AppIcon name="store" size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Retail Pillar</p>
                <h3 className="text-sm font-extrabold text-slate-900">Setoran Toko</h3>
              </div>
            </div>
            <Link
              to={setoranDetailHref}
              className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-2 text-[10px] font-bold text-blue-600"
            >
              Detail
              <AppIcon name="chevronRight" size={14} />
            </Link>
          </div>

          <div className="mb-4 flex items-center justify-between rounded-2xl bg-slate-50 p-1.5">
            <button
              type="button"
              onClick={() => setSetoranDate(shiftDateStr(setoranDate, -1))}
              className="rounded-xl p-2 text-slate-500 hover:bg-white"
            >
              <AppIcon name="chevronLeft" size={16} />
            </button>
            <div className="flex items-center gap-2">
              <AppIcon name="calendar" size={14} className="text-blue-600" />
              <span className="text-xs font-bold">{fmtSetoranDate(setoranDate)}</span>
              {isSetoranToday && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[8px] font-bold text-blue-700">
                  HARI INI
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSetoranDate(shiftDateStr(setoranDate, 1))}
              disabled={isSetoranToday}
              className="rounded-xl p-2 text-slate-500 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <AppIcon name="chevronRight" size={16} />
            </button>
          </div>

          <div className="mb-4 rounded-2xl bg-blue-600 p-4 text-white shadow-lg shadow-blue-100">
            <p className="text-[10px] font-bold uppercase opacity-80">Total Masuk</p>
            <p className="text-2xl font-black">
              {loadingSetoran ? '...' : fmtRp(setoranStats.totalMasuk)}
            </p>
            <p className="mt-1 text-[10px] font-bold opacity-80">
              {loadingSetoran ? '-' : `${setoranStats.sudahSetor}/${setoranStats.total} toko sudah setor`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-orange-50 p-3">
              <p className="text-[9px] font-bold uppercase text-orange-600">Pending</p>
              <p className="text-lg font-black text-orange-600">
                {loadingSetoran ? '-' : `${setoranStats.pending} Toko`}
              </p>
            </div>
            <Link to={setoranBelumHref} className="rounded-2xl bg-rose-50 p-3 transition active:scale-95">
              <p className="text-[9px] font-bold uppercase text-rose-600">Belum Setor</p>
              <p className="text-lg font-black text-rose-600">
                {loadingSetoran ? '-' : `${setoranStats.belumSetor} Toko`}
              </p>
            </Link>
          </div>
        </div>

        <h2 className="mb-4 text-sm font-extrabold text-gray-800">Akses Cepat</h2>
        <div className="mb-6 grid grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to} className="flex flex-col items-center gap-2">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm transition-transform active:scale-95 ${action.bg}`}>
                <AppIcon name={action.icon} size={22} />
              </div>
              <span className="text-center text-[9px] font-bold leading-tight text-gray-700">
                {action.label.split('\n').map((line, index) => <span key={index}>{line}{index === 0 ? <br /> : ''}</span>)}
              </span>
            </Link>
          ))}
        </div>

        <h2 className="mb-4 text-sm font-extrabold text-gray-800">Laporan Lengkap</h2>
        <div className="mb-6 grid grid-cols-2 gap-3">
          {reportLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-3 rounded-[1.5rem] border px-4 py-3.5 transition-opacity hover:opacity-80 ${link.bg}`}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ${link.color}`}>
                <AppIcon name={link.icon} size={18} />
              </div>
              <div>
                <p className="text-xs font-black leading-tight text-gray-900">{link.label}</p>
                <p className="text-[9px] leading-tight text-gray-400">{link.sub}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mb-6">
          <LeaderboardSection
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            leaderboardView={leaderboardView}
            onViewChange={setLeaderboardView}
            leaderboards={leaderboards}
            showHeadStore={true}
          />
        </div>

        <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-5 text-white">
          <div className="relative z-10">
            <h4 className="mb-1 text-sm font-bold italic">"Efisiensi adalah kunci keberlanjutan."</h4>
            <p className="text-[10px] opacity-60">Halo {shortName} - Status sistem hari ini: terkendali.</p>
          </div>
          <AppIcon name="spark" size={80} className="absolute right-4 top-4 opacity-5" />
        </div>
      </div>

      <OpsBottomNav />
    </div>
  )
}

