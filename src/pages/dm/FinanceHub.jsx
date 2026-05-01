import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { getScopeLabel } from '../../lib/access'
import { SmartBottomNav } from '../../components/BottomNav'
import { AppIcon } from '../../components/ui/AppKit'
import { fmtRp, todayWIB, yesterdayWIB } from '../../lib/utils'

function getRoleInfo(role) {
  if (role === 'ops_manager') return { label: 'Operations Manager', color: 'blue', accent: 'bg-blue-600' }
  if (role === 'area_manager') return { label: 'Area Manager', color: 'violet', accent: 'bg-violet-600' }
  return { label: 'District Manager', color: 'blue', accent: 'bg-blue-600' }
}

function getQuickActions(role) {
  if (role === 'ops_manager') {
    return [
      { to: '/ops/opex-approval',  icon: 'approval', label: 'Approval\nOpex' },
      { to: '/finance/opex',       icon: 'finance',   label: 'Pengajuan\nOpex' },
      { to: '/ops/setoran',        icon: 'finance',   label: 'Setoran' },
      { to: '/ops/laporan',        icon: 'chart',     label: 'Net\nSales' },
      { to: '/sc',                 icon: 'store',     label: 'Supply\nChain' },
    ]
  }
  return [
    { to: '/dm/opex-approval',    icon: 'approval',  label: 'Approval\nOpex' },
    { to: '/opex',                icon: 'opex',      label: 'Penggunaan\nOpex' },
    { to: '/dm/approval',         icon: 'finance',   label: 'Setoran' },
    { to: '/dm/laporan',          icon: 'chart',     label: 'Net\nSales' },
    { to: '/sc',                  icon: 'store',     label: 'Supply\nChain' },
  ]
}

function getMenuCards(role) {
  if (role === 'ops_manager') {
    return [
      {
        to: '/ops/opex-approval',
        icon: 'approval',
        label: 'Approval Opex',
        description: 'Tangani approval OPEX dari jalur support dan ops.',
        color: 'amber',
      },
      {
        to: '/finance/opex',
        icon: 'finance',
        label: 'Pengajuan Opex',
        description: 'Lihat seluruh pengajuan dana operasional yang sudah final.',
        color: 'blue',
      },
      {
        to: '/ops/setoran',
        icon: 'finance',
        label: 'Setoran Toko',
        description: 'Pantau status setoran toko dari jalur monitoring ops.',
        color: 'emerald',
      },
      {
        to: '/ops/laporan',
        icon: 'chart',
        label: 'Net Sales',
        description: 'Pantau laporan harian, OPEX, dan net sales seluruh toko.',
        color: 'violet',
      },
      {
        to: '/sc',
        icon: 'store',
        label: 'Supply Chain',
        description: 'Cek kebutuhan pembelian, picking, dan distribusi WH.',
        color: 'blue',
      },
    ]
  }

  return [
    {
      to: '/dm/opex-approval',
      icon: 'approval',
      label: 'Approval Opex',
      description: 'Review pengajuan dana operasional dari Head Store.',
      color: 'amber',
    },
    {
      to: '/opex',
      icon: 'opex',
      label: 'Penggunaan Opex',
      description: 'Pantau BOH harian per toko dan cek toko yang over budget.',
      color: 'blue',
    },
    {
      to: '/dm/approval',
      icon: 'finance',
      label: 'Setoran Toko',
      description: 'Lihat setoran yang menunggu approval dan tindak lanjuti.',
      color: 'emerald',
    },
    {
      to: '/dm/laporan',
      icon: 'chart',
      label: 'Net Sales',
      description: 'Pantau laporan harian dan net sales semua toko di scope kamu.',
      color: 'violet',
    },
    {
      to: '/sc',
      icon: 'store',
      label: 'Supply Chain',
      description: 'Cek kebutuhan pembelian, picking, dan distribusi WH.',
      color: 'blue',
    },
  ]
}

const CARD_COLORS = {
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-100',  icon: 'bg-amber-500',  text: 'text-amber-700' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-100',   icon: 'bg-blue-600',   text: 'text-blue-700' },
  emerald:{ bg: 'bg-emerald-50',border: 'border-emerald-100',icon: 'bg-emerald-500',text: 'text-emerald-700' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-100', icon: 'bg-violet-500', text: 'text-violet-700' },
}

export default function ManagerFinanceHub() {
  const { profile, signOut } = useAuth()
  const today = todayWIB()
  const yesterday = yesterdayWIB()

  const [stats, setStats] = useState({
    pendingOpex: 0,
    pendingSetoran: 0,
    opexToday: 0,
    approvedSetoran: 0,
  })
  const [loading, setLoading] = useState(true)

  const roleInfo = getRoleInfo(profile?.role)
  const scopeLabel = getScopeLabel(profile)
  const shortName = profile?.full_name?.split(' ')[0] ?? 'Manager'
  const quickActions = getQuickActions(profile?.role)
  const menuCards = getMenuCards(profile?.role)
  const isOps = profile?.role === 'ops_manager'

  useEffect(() => {
    fetchStats()
  }, [profile])

  const fetchStats = async () => {
    if (!profile) return

    try {
      const opexApprovalTable = isOps ? 'operational_expenses' : 'operational_expenses'

      const [opexRes, setoranRes, setoranApprovedRes] = await Promise.all([
        supabase
          .from('operational_expenses')
          .select('id, total, status')
          .eq('status', 'pending'),
        supabase
          .from('daily_deposits')
          .select('id, status')
          .eq('tanggal', yesterday)
          .eq('status', 'submitted'),
        supabase
          .from('daily_deposits')
          .select('id')
          .eq('tanggal', yesterday)
          .eq('status', 'approved'),
      ])

      const totalOpexPending = (opexRes.data || []).length
      const opexTodayTotal = (opexRes.data || []).reduce((sum, r) => sum + Number(r.total || 0), 0)

      setStats({
        pendingOpex: totalOpexPending,
        pendingSetoran: (setoranRes.data || []).length,
        opexToday: opexTodayTotal,
        approvedSetoran: (setoranApprovedRes.data || []).length,
      })
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f6ff] pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 flex justify-between items-center border-b border-blue-50">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-full ${roleInfo.accent} flex items-center justify-center text-white font-black text-base shadow-md`}>
            <AppIcon name="finance" size={18} />
          </div>
          <div>
            <p className={`text-[10px] text-${roleInfo.color}-600 font-bold uppercase tracking-widest`}>Finance Hub</p>
            <p className="font-extrabold text-gray-900 text-base leading-tight">{shortName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-bold text-${roleInfo.color}-600 bg-${roleInfo.color}-50 px-2.5 py-1 rounded-full uppercase tracking-wide`}>
            {scopeLabel}
          </span>
          <button
            type="button"
            onClick={signOut}
            className={`w-10 h-10 rounded-full bg-${roleInfo.color}-50 flex items-center justify-center text-${roleInfo.color}-600 hover:bg-${roleInfo.color}-100 transition-colors`}
          >
            <AppIcon name="logout" size={18} />
          </button>
        </div>
      </div>

      <div className="px-5 pt-5">
        {/* Finance Overview Card */}
        <div className={`bg-${roleInfo.color}-50 p-5 rounded-[2.5rem] border border-${roleInfo.color}-100 mb-6`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xs font-black text-${roleInfo.color}-900 uppercase`}>Finance Overview</h2>
            <span className={`text-[10px] font-bold text-${roleInfo.color}-600`}>{roleInfo.label}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Opex Pending</p>
              <p className={`text-2xl font-black text-${stats.pendingOpex > 0 ? 'amber-600' : 'emerald-600'}`}>
                {loading ? '-' : String(stats.pendingOpex).padStart(2, '0')}
              </p>
              <p className="text-[7px] text-gray-500 leading-tight">Menunggu Approval</p>
            </div>
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Setoran</p>
              <p className={`text-2xl font-black text-${stats.pendingSetoran > 0 ? 'rose-500' : 'emerald-600'}`}>
                {loading ? '-' : String(stats.pendingSetoran).padStart(2, '0')}
              </p>
              <p className="text-[7px] text-gray-500 leading-tight">Pending (kemarin)</p>
            </div>
          </div>

          <div className="bg-white/70 p-3 rounded-2xl flex items-center justify-between">
            <div>
              <p className={`text-[9px] font-bold text-${roleInfo.color}-900`}>Setoran Disetujui Kemarin</p>
              <p className={`text-xs text-${roleInfo.color}-700 font-medium`}>Status approval toko</p>
            </div>
            <div className="text-right">
              <span className={`text-xl font-black text-${roleInfo.color}-900`}>
                {loading ? '-' : stats.approvedSetoran}
              </span>
              <p className="text-[8px] text-gray-400">toko</p>
            </div>
          </div>
        </div>

        {/* Quick Action Icons */}
        <div className={`grid grid-cols-5 gap-3 mb-6`}>
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to} className="flex flex-col items-center gap-2">
              <div className={`w-14 h-14 bg-white border border-${roleInfo.color}-100 rounded-2xl flex items-center justify-center text-${roleInfo.color}-600 shadow-sm active:scale-95 transition-transform`}>
                <AppIcon name={action.icon} size={22} />
              </div>
              <span className="text-[9px] font-bold text-center leading-tight text-gray-700">
                {action.label.split('\n').map((l, i) => <span key={i}>{l}{i === 0 ? <br /> : ''}</span>)}
              </span>
            </Link>
          ))}
        </div>

        {/* Status Snapshot */}
        <div className="flex gap-3 mb-6">
          <Link
            to={isOps ? '/ops/opex-approval' : '/dm/opex-approval'}
            className={`flex-1 bg-gradient-to-br from-${roleInfo.color}-600 to-${roleInfo.color}-800 p-4 rounded-3xl text-white relative overflow-hidden shadow-md transition-transform active:scale-[0.98]`}
          >
            <div className="relative z-10">
              <p className="text-[9px] font-bold opacity-80 uppercase mb-1">Perlu Aksi</p>
              <p className="text-2xl font-black">{loading ? '-' : stats.pendingOpex + stats.pendingSetoran}</p>
              <div className="w-full bg-white/20 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-white h-1.5 rounded-full"
                  style={{ width: loading ? '0%' : stats.pendingOpex + stats.pendingSetoran > 0 ? '100%' : '0%' }}
                />
              </div>
              <p className="text-[8px] opacity-70 mt-1">Opex + Setoran pending</p>
            </div>
            <AppIcon name="finance" size={52} className="absolute -right-2 -bottom-2 opacity-10" />
          </Link>
          <Link
            to={isOps ? '/ops/laporan' : '/dm/laporan'}
            className="flex-1 bg-white border border-blue-100 p-4 rounded-3xl shadow-sm flex flex-col justify-between hover:border-blue-300 transition-colors"
          >
            <p className="text-[9px] font-bold text-gray-400 uppercase">Net Sales</p>
            <p className="text-base font-black text-gray-900 leading-tight mt-1">Laporan</p>
            <div className="flex items-center gap-1 mt-2">
              <AppIcon name="chart" size={12} className="text-blue-400" />
              <p className="text-[8px] text-blue-400 font-semibold">Lihat laporan harian</p>
            </div>
          </Link>
        </div>

        {/* Menu Cards */}
        <div className="mb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Menu Finance</p>
          <div className="space-y-3">
            {menuCards.map((card) => {
              const c = CARD_COLORS[card.color] || CARD_COLORS.blue
              return (
                <Link
                  key={card.to}
                  to={card.to}
                  className={`flex items-center gap-4 ${c.bg} border ${c.border} rounded-[1.75rem] px-4 py-4 transition-opacity hover:opacity-80 active:scale-[0.98]`}
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${c.icon} shadow-sm`}>
                    <AppIcon name={card.icon} size={20} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-gray-900 leading-tight">{card.label}</p>
                    <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{card.description}</p>
                  </div>
                  <AppIcon name="chevronRight" size={16} className="text-gray-300 shrink-0" />
                </Link>
              )
            })}
          </div>
        </div>

        {/* Info Banner */}
        <div className={`bg-gradient-to-r from-${roleInfo.color}-700 to-${roleInfo.color}-500 p-5 rounded-[2rem] text-white relative overflow-hidden shadow-lg`}>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white/20 text-[8px] font-bold px-2 py-0.5 rounded uppercase">Tips</span>
            </div>
            <h3 className="font-bold text-sm mb-1">Alur Kerja Finance</h3>
            <p className="text-[10px] opacity-90 leading-relaxed">
              Mulai dari Approval Opex → cek Setoran → pantau Net Sales. Lakukan secara rutin untuk menjaga arus kas toko tetap sehat.
            </p>
          </div>
          <AppIcon name="finance" size={72} className="absolute -right-4 -bottom-4 opacity-10" />
        </div>
      </div>

      <SmartBottomNav />
    </div>
  )
}
