import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { OpsBottomNav } from '../../components/BottomNav'
import { AppIcon } from '../../components/ui/AppKit'

const MENU_CARDS = [
  {
    to: '/finance',
    icon: 'finance',
    label: 'Finance Hub',
    description: 'Ringkasan jalur finance untuk approval dan monitoring toko.',
    color: 'blue',
  },
  {
    to: '/ops/laporan',
    icon: 'chart',
    label: 'Laporan Harian',
    description: 'Pantau setoran, opex, dan net sales semua toko.',
    color: 'amber',
  },
  {
    to: '/ops/opex-approval',
    icon: 'approval',
    label: 'Approval Opex',
    description: 'Tangani approval support sebelum naik ke Ops Manager.',
    color: 'emerald',
  },
  {
    to: '/finance/audit',
    icon: 'checklist',
    label: 'Audit Setoran',
    description: 'Review audit finance dan tindak lanjuti temuan setoran.',
    color: 'violet',
  },
  {
    to: '/finance/opex',
    icon: 'opex',
    label: 'Pengajuan Opex',
    description: 'Lihat daftar pengajuan dana operasional dari sisi finance.',
    color: 'blue',
  },
  {
    to: '/opex',
    icon: 'store',
    label: 'Penggunaan Opex',
    description: 'Pantau penggunaan BOH per toko dan identifikasi over budget.',
    color: 'amber',
  },
]

const CARD_COLORS = {
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-100',  icon: 'bg-violet-600',  },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-100',   icon: 'bg-amber-500',   },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-100',    icon: 'bg-blue-600',    },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'bg-emerald-500', },
}

const QUICK_ACTIONS = [
  { to: '/finance',          icon: 'finance',   label: 'Finance\nHub' },
  { to: '/ops/laporan',      icon: 'chart',     label: 'Net\nSales' },
  { to: '/ops/opex-approval',icon: 'approval',  label: 'Approval\nOpex' },
  { to: '/finance/audit',    icon: 'checklist', label: 'Audit\nSetoran' },
  { to: '/opex',             icon: 'opex',      label: 'Penggunaan\nOpex' },
]

export default function SupportFinanceDashboard() {
  const { profile, signOut } = useAuth()
  const shortName = profile?.full_name?.split(' ')[0] ?? 'Support'

  return (
    <div className="min-h-screen bg-[#fffbf0] pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 flex justify-between items-center border-b border-amber-50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-amber-500 flex items-center justify-center text-white font-black text-base shadow-md">
            <AppIcon name="finance" size={18} />
          </div>
          <div>
            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">Support Finance</p>
            <p className="font-extrabold text-gray-900 text-base leading-tight">{shortName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full uppercase tracking-wide">
            Support Admin
          </span>
          <button
            type="button"
            onClick={signOut}
            className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 hover:bg-amber-100 transition-colors"
          >
            <AppIcon name="logout" size={18} />
          </button>
        </div>
      </div>

      <div className="px-5 pt-5">
        {/* Overview */}
        <div className="bg-amber-50 p-5 rounded-[2.5rem] border border-amber-100 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-black text-amber-900 uppercase">Finance Overview</h2>
            <span className="text-[10px] font-bold text-amber-600">Support Admin</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Approval', sub: 'Opex & Setoran', icon: 'approval' },
              { label: 'Audit', sub: 'Review Finance', icon: 'checklist' },
              { label: 'Monitoring', sub: 'Net Sales & BOH', icon: 'chart' },
            ].map((item) => (
              <div key={item.label} className="bg-white p-3 rounded-2xl text-center shadow-sm">
                <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <AppIcon name={item.icon} size={16} className="text-amber-600" />
                </div>
                <p className="text-[9px] font-black text-gray-800 leading-tight">{item.label}</p>
                <p className="text-[7px] text-gray-400 mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.to} to={action.to} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-white border border-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm active:scale-95 transition-transform">
                <AppIcon name={action.icon} size={22} />
              </div>
              <span className="text-[9px] font-bold text-center leading-tight text-gray-700">
                {action.label.split('\n').map((l, i) => <span key={i}>{l}{i === 0 ? <br /> : ''}</span>)}
              </span>
            </Link>
          ))}
        </div>

        {/* Hero pair */}
        <div className="flex gap-3 mb-6">
          <Link
            to="/ops/opex-approval"
            className="flex-1 bg-gradient-to-br from-amber-500 to-amber-700 p-4 rounded-3xl text-white relative overflow-hidden shadow-md transition-transform active:scale-[0.98]"
          >
            <div className="relative z-10">
              <p className="text-[9px] font-bold opacity-80 uppercase mb-1">Prioritas</p>
              <p className="text-base font-black">Approval</p>
              <p className="text-[9px] opacity-70 mt-1">Opex yang perlu ditangani</p>
            </div>
            <AppIcon name="approval" size={42} className="absolute -right-2 -bottom-2 opacity-20" />
          </Link>
          <Link
            to="/finance/audit"
            className="flex-1 bg-white border border-amber-100 p-4 rounded-3xl shadow-sm flex flex-col justify-between hover:border-amber-300 transition-colors"
          >
            <p className="text-[9px] font-bold text-gray-400 uppercase">Audit</p>
            <p className="text-base font-black text-gray-900 leading-tight mt-1">Setoran</p>
            <div className="flex items-center gap-1 mt-2">
              <AppIcon name="checklist" size={12} className="text-amber-400" />
              <p className="text-[8px] text-amber-400 font-semibold">Review finance</p>
            </div>
          </Link>
        </div>

        {/* Menu Cards */}
        <div className="mb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Menu Support Finance</p>
          <div className="space-y-3">
            {MENU_CARDS.map((card) => {
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
        <div className="bg-gradient-to-r from-amber-600 to-amber-400 p-5 rounded-[2rem] text-white relative overflow-hidden shadow-lg mb-2">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white/20 text-[8px] font-bold px-2 py-0.5 rounded uppercase">Alur Kerja</span>
            </div>
            <h3 className="font-bold text-sm mb-1">Finance Flow</h3>
            <p className="text-[10px] opacity-90 leading-relaxed">
              Mulai dari Approval Opex → Audit Setoran → pantau Laporan Harian dan Net Sales toko.
            </p>
          </div>
          <AppIcon name="finance" size={72} className="absolute -right-4 -bottom-4 opacity-10" />
        </div>
      </div>

      <OpsBottomNav />
    </div>
  )
}
