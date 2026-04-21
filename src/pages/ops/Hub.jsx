import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { OpsBottomNav } from '../../components/BottomNav'
import { AppIcon } from '../../components/ui/AppKit'
import { todayWIB } from '../../lib/utils'

export default function OpsHub() {
  const { profile, signOut } = useAuth()
  const today = todayWIB()

  const [stats, setStats] = useState({
    pendingSetoran: 0,
    ceklisToday: 0,
    activeOrders: 0,
    totalBranches: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    const [setoranRes, ceklisRes, ordersRes, branchRes] = await Promise.all([
      supabase.from('daily_deposits').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
      supabase.from('daily_checklists').select('id', { count: 'exact', head: true }).eq('tanggal', today),
      supabase.from('supply_orders').select('id', { count: 'exact', head: true }).not('status', 'in', '("completed","cancelled")'),
      supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ])

    setStats({
      pendingSetoran: setoranRes.count ?? 0,
      ceklisToday:   ceklisRes.count ?? 0,
      activeOrders:  ordersRes.count ?? 0,
      totalBranches: branchRes.count ?? 0,
    })
    setLoading(false)
  }

  const shortName = profile?.full_name?.split(' ')[0] ?? 'Manager'

  const pillars = [
    {
      icon: 'store',
      label: 'Retail Pillar',
      sub: `${loading ? '-' : stats.totalBranches} Toko Aktif`,
      status: stats.pendingSetoran > 0 ? 'Pending' : 'Normal',
      detail: stats.pendingSetoran > 0 ? `${stats.pendingSetoran} setoran pending` : `Ceklis masuk ${stats.ceklisToday}`,
      statusColor: stats.pendingSetoran > 0 ? 'text-orange-500' : 'text-green-500',
      bg: 'bg-orange-50 text-orange-600',
    },
    {
      icon: 'finance',
      label: 'Supply Chain',
      sub: `${loading ? '-' : stats.activeOrders} Order Aktif`,
      status: stats.activeOrders > 0 ? 'Berjalan' : 'Aman',
      detail: stats.activeOrders > 0 ? `${stats.activeOrders} order diproses` : 'Tidak ada order tertunda',
      statusColor: stats.activeOrders > 0 ? 'text-blue-500' : 'text-green-500',
      bg: 'bg-blue-50 text-blue-600',
    },
    {
      icon: 'users',
      label: 'Trainer & Dev',
      sub: 'Staff Onboarding',
      status: 'Active',
      detail: 'Lihat dashboard trainer',
      statusColor: 'text-indigo-600',
      bg: 'bg-indigo-50 text-indigo-600',
    },
  ]

  const quickActions = [
    { to: '/dm/approval', icon: 'approval', label: 'Approval\nSetoran', bg: 'bg-amber-50 border-amber-100 text-amber-600' },
    { to: '/dm', icon: 'home', label: 'DM\nDashboard', bg: 'bg-blue-50 border-blue-100 text-blue-600' },
    { to: '/kpi/personal/input', icon: 'checklist', label: 'Input\nKPI', bg: 'bg-sky-50 border-sky-100 text-sky-600' },
    { to: '/tasks', icon: 'checklist', label: 'Manajemen\nTugas', bg: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
  ]

  const reportLinks = [
    { to: '/dm', icon: 'home', label: 'DM Dashboard', sub: 'Ringkasan semua toko', bg: 'bg-blue-50 border-blue-100', color: 'text-blue-600' },
    { to: '/kpi/personal/input', icon: 'checklist', label: 'Input KPI Personal', sub: 'Penilaian manager & store lead', bg: 'bg-sky-50 border-sky-100', color: 'text-sky-600' },
    { to: '/finance', icon: 'finance', label: 'Audit Finance', sub: 'Rekap setoran & audit', bg: 'bg-slate-100', color: 'text-slate-600' },
    { to: '/trainer', icon: 'users', label: 'Trainer Hub', sub: 'Penilaian staff', bg: 'bg-emerald-50 border-emerald-100', color: 'text-emerald-600' },
    { to: '/trainer/oje', icon: 'checklist', label: 'OJE', sub: 'On Job Evaluation', bg: 'bg-teal-50 border-teal-100', color: 'text-teal-600' },
    { to: '/ops/visit-monitor', icon: 'map', label: 'Audit Log Visit', sub: 'Skor & foto kunjungan', bg: 'bg-violet-50 border-violet-100', color: 'text-violet-600' },
    { to: '/support/staff', icon: 'users', label: 'Manajemen Staf', sub: 'Akun & akses pengguna', bg: 'bg-slate-50 border-slate-200', color: 'text-slate-600' },
  ]

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-28">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-blue-50">
        <div>
          <h1 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Operations Manager</h1>
          <p className="text-xl font-extrabold text-gray-900">Command Center</p>
        </div>
        <div className="flex gap-2">
          {stats.pendingSetoran > 0 && (
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 relative">
              <AppIcon name="bell" size={18} />
              <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full" />
            </div>
          )}
          <button onClick={signOut} className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors">
            <AppIcon name="logout" size={18} />
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Global Health Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-600 p-4 rounded-[2rem] text-white shadow-lg shadow-blue-200 active:scale-[0.97] transition-transform">
            <p className="text-[9px] font-bold opacity-80 uppercase mb-1">Toko Aktif</p>
            <h3 className="text-xl font-black">{loading ? '...' : stats.totalBranches}</h3>
            <p className="text-[9px] mt-2 font-bold opacity-70">
              {stats.ceklisToday > 0 ? `${stats.ceklisToday} ceklis masuk` : 'Menunggu ceklis'}
            </p>
          </div>
          <div className="bg-white p-4 rounded-[2rem] border border-blue-100 shadow-sm">
            <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Setoran Pending</p>
            <h3 className={`text-xl font-black ${stats.pendingSetoran > 0 ? 'text-orange-500' : 'text-blue-900'}`}>
              {loading ? '...' : stats.pendingSetoran}
            </h3>
            <div className="w-full bg-blue-50 h-1.5 rounded-full mt-2">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: stats.totalBranches > 0 ? `${Math.max(0, 100 - (stats.pendingSetoran / stats.totalBranches) * 100)}%` : '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Pillar Performance */}
        <h2 className="font-extrabold text-gray-800 text-sm mb-4">Pillar Performance</h2>
        <div className="space-y-3 mb-6">
          {pillars.map((pillar) => (
            <div key={pillar.label} className="flex items-center justify-between bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${pillar.bg}`}>
                  <AppIcon name={pillar.icon} size={20} />
                </div>
                <div>
                  <p className="text-xs font-black">{pillar.label}</p>
                  <p className="text-[10px] text-gray-400">{pillar.sub}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-xs font-black ${pillar.statusColor}`}>{pillar.status}</p>
                <p className="text-[9px] text-gray-400">{pillar.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <h2 className="font-extrabold text-gray-800 text-sm mb-4">Akses Cepat</h2>
        <div className="grid grid-cols-4 gap-3 mb-6">
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to} className="flex flex-col items-center gap-2">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-sm active:scale-95 transition-transform ${action.bg}`}>
                <AppIcon name={action.icon} size={22} />
              </div>
              <span className="text-[9px] font-bold text-center leading-tight text-gray-700">
                {action.label.split('\n').map((l, i) => <span key={i}>{l}{i === 0 ? <br /> : ''}</span>)}
              </span>
            </Link>
          ))}
        </div>

        {/* Laporan Lengkap */}
        <h2 className="font-extrabold text-gray-800 text-sm mb-4">Laporan Lengkap</h2>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {reportLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-3 rounded-[1.5rem] border px-4 py-3.5 hover:opacity-80 transition-opacity ${link.bg}`}
            >
              <div className={`w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm ${link.color}`}>
                <AppIcon name={link.icon} size={18} />
              </div>
              <div>
                <p className="text-xs font-black text-gray-900 leading-tight">{link.label}</p>
                <p className="text-[9px] text-gray-400 leading-tight">{link.sub}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Notice */}
        <div className="bg-slate-900 p-5 rounded-[2.5rem] text-white relative overflow-hidden">
          <div className="relative z-10">
            <h4 className="text-sm font-bold mb-1 italic">"Efisiensi adalah kunci keberlanjutan."</h4>
            <p className="text-[10px] opacity-60">Halo {shortName} — Status sistem hari ini: terkendali.</p>
          </div>
          <AppIcon name="spark" size={80} className="absolute right-4 top-4 opacity-5" />
        </div>
      </div>

      <OpsBottomNav />
    </div>
  )
}
