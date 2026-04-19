import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { StaffBottomNav } from '../../components/BottomNav'
import { canViewKPI, canViewSupplyChain } from '../../lib/access'
import { AppIcon } from '../../components/ui/AppKit'
import { fmtRp, todayWIB, yesterdayWIB, sisaWaktuLaporan } from '../../lib/utils'

export default function StaffHome() {
  const { profile, signOut } = useAuth()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const today = todayWIB()
  const yesterday = yesterdayWIB()

  useEffect(() => {
    if (!profile?.branch_id) {
      setLoading(false)
      return
    }
    fetchStatus()
  }, [profile])

  const fetchStatus = async () => {
    const branchId = profile.branch_id

    const [ceklisPagi, ceklisMalam, laporan, opexToday] = await Promise.all([
      supabase.from('daily_checklists')
        .select('id, is_late, submitted_at')
        .eq('branch_id', branchId).eq('tanggal', today).eq('shift', 'pagi')
        .maybeSingle(),

      supabase.from('daily_checklists')
        .select('id, is_late')
        .eq('branch_id', branchId).eq('tanggal', today).eq('shift', 'malam')
        .maybeSingle(),

      supabase.from('daily_reports')
        .select('id, submitted_at, is_late')
        .eq('branch_id', branchId).eq('tanggal', yesterday)
        .maybeSingle(),

      supabase.from('operational_expenses')
        .select('total')
        .eq('branch_id', branchId).eq('tanggal', today),
    ])

    const totalOpex = (opexToday.data || []).reduce((sum, row) => sum + Number(row.total), 0)

    setStatus({
      ceklisPagi: ceklisPagi.data,
      ceklisMalam: ceklisMalam.data,
      laporan: laporan.data,
      totalOpex,
    })
    setLoading(false)
  }

  const isStoreLevel = ['staff', 'asst_head_store', 'head_store'].includes(profile?.role)
  const isHeadStore = profile?.role === 'head_store'
  const kpiEnabled = canViewKPI(profile?.role)
  const supplyChainEnabled = canViewSupplyChain(profile?.role)
  const shortName = profile?.full_name?.split(' ')[0] || '-'
  const branchName = profile?.branch?.name || 'Bagi Kopi'

  function getGreetingLabel() {
    const hour = new Date(new Date().getTime() + 7 * 3600 * 1000).getUTCHours()
    if (hour < 11) return 'Selamat pagi'
    if (hour < 15) return 'Selamat siang'
    if (hour < 18) return 'Selamat sore'
    return 'Selamat malam'
  }

  const quickActions = [
    ...(isHeadStore || !isStoreLevel ? [{
      to: '/staff/laporan', icon: 'chart', label: 'Laporan\nHarian',
    }] : []),
    ...(kpiEnabled ? [{ to: '/kpi', icon: 'checklist', label: 'KPI\nToko' }] : []),
    ...(supplyChainEnabled ? [{ to: '/sc/sj', icon: 'finance', label: 'Terima\nBarang' }] : []),
    { to: '/staff/opex', icon: 'opex', label: 'Beban\nOperasional' },
    ...(!isStoreLevel ? [{ to: '/dm', icon: 'home', label: 'Dashboard\nManajer' }] : []),
  ]

  return (
    <div className="min-h-screen bg-[#f0f7ff] pb-28">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md px-5 py-4 flex justify-between items-center border-b border-blue-50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center border-2 border-blue-400 text-blue-700 font-bold text-base shrink-0">
            {shortName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{getGreetingLabel()}</p>
            <p className="font-bold text-gray-800 text-base leading-tight">{shortName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{profile?.role?.replace(/_/g, ' ')}</p>
            <p className="text-xs font-semibold text-gray-600">{branchName}</p>
          </div>
          <button onClick={signOut} className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors">
            <AppIcon name="logout" size={18} />
          </button>
        </div>
      </div>

      <div className="px-5 pt-5">
        {/* Branch not configured */}
        {!loading && !profile?.branch_id && (
          <div className="mb-4 p-4 rounded-3xl bg-rose-50 border border-rose-100">
            <p className="text-sm text-rose-700 font-semibold">Akun belum dikonfigurasi ke cabang manapun. Hubungi ops manager.</p>
          </div>
        )}

        {/* Ceklis Status Card */}
        <div className="bg-white p-4 rounded-[2rem] border border-blue-50 shadow-sm mb-5">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {/* Ceklis Pagi */}
            <div className="border-r border-gray-100 pr-2">
              <div className="flex items-center gap-1 text-blue-500 mb-1.5">
                <AppIcon name="spark" size={11} />
                <span className="text-[9px] font-bold uppercase tracking-widest">Pagi</span>
              </div>
              <p className="text-sm font-bold text-gray-800">Ceklis Pagi</p>
              <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2">
                <div className={`h-1.5 rounded-full transition-all ${
                  loading ? 'w-0' :
                  status?.ceklisPagi
                    ? (status.ceklisPagi.is_late ? 'bg-amber-400 w-full' : 'bg-green-500 w-full')
                    : 'w-0'
                }`} />
              </div>
              <p className="text-[9px] text-gray-400 mt-1">
                {loading ? '...' : status?.ceklisPagi ? (status.ceklisPagi.is_late ? 'Terlambat' : 'Selesai') : 'Belum'}
              </p>
            </div>

            {/* Laporan H-1 */}
            <div className="border-r border-gray-100 px-2">
              <div className="flex items-center gap-1 text-orange-400 mb-1.5">
                <AppIcon name="chart" size={11} />
                <span className="text-[9px] font-bold uppercase tracking-widest">Laporan</span>
              </div>
              <p className="text-sm font-bold text-gray-800">H-1</p>
              <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2">
                <div className={`h-1.5 rounded-full transition-all ${!loading && status?.laporan ? 'bg-orange-400 w-full' : 'w-0'}`} />
              </div>
              <p className="text-[9px] text-gray-400 mt-1">
                {loading ? '...' : status?.laporan ? 'Submitted' : 'Pending'}
              </p>
            </div>

            {/* Ceklis Malam */}
            <div className="pl-2">
              <div className="flex items-center gap-1 text-indigo-500 mb-1.5">
                <AppIcon name="checklist" size={11} />
                <span className="text-[9px] font-bold uppercase tracking-widest">Malam</span>
              </div>
              <p className="text-sm font-bold text-gray-800">Ceklis Mal.</p>
              <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2">
                <div className={`h-1.5 rounded-full transition-all ${!loading && status?.ceklisMalam ? 'bg-indigo-500 w-full' : 'w-0'}`} />
              </div>
              <p className="text-[9px] text-gray-400 mt-1">
                {loading ? '...' : status?.ceklisMalam ? 'Selesai' : 'Terbuka'}
              </p>
            </div>
          </div>

          {isStoreLevel && (
            <Link
              to="/staff/ceklis"
              className="block w-full py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm text-center hover:bg-blue-700 transition-colors active:scale-[0.98]"
            >
              Mulai Input Ceklis
            </Link>
          )}
        </div>

        {/* Quick Actions Grid */}
        <div className={`grid gap-3 mb-5 ${quickActions.length <= 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
          {quickActions.slice(0, 4).map((action) => (
            <Link key={action.to} to={action.to} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-white border border-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm active:scale-95 transition-transform">
                <AppIcon name={action.icon} size={22} />
              </div>
              <span className="text-[10px] font-bold text-center leading-tight text-gray-700">
                {action.label.split('\n').map((line, i) => (
                  <span key={i}>{line}{i === 0 && action.label.includes('\n') ? <br /> : ''}</span>
                ))}
              </span>
            </Link>
          ))}
        </div>

        {/* Status Stats Row */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-3xl text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-1 text-[10px] opacity-80 mb-1">
                <span>Opex Hari Ini</span>
              </div>
              <p className="font-bold text-base mb-2">{loading ? '...' : fmtRp(status?.totalOpex || 0)}</p>
              <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                <div className="bg-white h-1.5 w-[70%]" />
              </div>
            </div>
            <AppIcon name="opex" size={56} className="absolute -right-3 -bottom-3 opacity-10" />
          </div>
          <div className="flex-1 bg-blue-50 p-4 rounded-3xl border border-blue-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm shrink-0">
              <AppIcon name="approval" size={18} />
            </div>
            <div>
              <p className="text-[10px] text-blue-600 font-bold">Laporan H-1</p>
              <p className="text-xl font-black text-blue-900 leading-tight">
                {loading ? '-' : status?.laporan ? 'Done' : 'Open'}
              </p>
            </div>
          </div>
        </div>

        {/* Pending laporan warning */}
        {!loading && status && !status.laporan && profile?.branch_id && (isHeadStore || !isStoreLevel) && (
          <div className="mb-5 bg-gradient-to-r from-amber-600 to-amber-500 p-5 rounded-[2rem] text-white relative overflow-hidden shadow-lg">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-white/20 text-[8px] font-bold px-2 py-0.5 rounded uppercase">Reminder</span>
              </div>
              <p className="font-bold text-sm mb-1">Laporan Harian Belum Disubmit</p>
              <p className="text-[10px] opacity-90">
                Tanggal {new Date(yesterday).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}. Sisa waktu: {sisaWaktuLaporan(yesterday)}
              </p>
            </div>
            <AppIcon name="warning" size={72} className="absolute -right-4 -bottom-4 opacity-10" />
          </div>
        )}

        {/* Notice Board */}
        <div className="bg-slate-900 p-5 rounded-[2.5rem] text-white relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status Operasional</p>
            <h4 className="text-sm font-bold mb-1">{branchName}</h4>
            <p className="text-[10px] opacity-60 leading-relaxed">
              {loading
                ? 'Memuat status...'
                : `Ceklis: ${status?.ceklisPagi ? 'Pagi ✓' : 'Pagi -'} ${status?.ceklisMalam ? '· Malam ✓' : '· Malam -'} · Laporan: ${status?.laporan ? '✓' : 'Pending'}`}
            </p>
          </div>
          <AppIcon name="store" size={72} className="absolute -right-3 -bottom-3 opacity-5" />
        </div>
      </div>

      <StaffBottomNav />
    </div>
  )
}
