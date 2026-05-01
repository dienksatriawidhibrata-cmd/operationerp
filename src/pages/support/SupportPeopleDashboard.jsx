import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { OpsBottomNav } from '../../components/BottomNav'
import { AppIcon } from '../../components/ui/AppKit'

const MENU_CARDS = [
  {
    to: '/dm/people',
    icon: 'users',
    label: 'People Hub',
    description: 'Ringkasan people lintas toko untuk jadwal, KPI, dan rekrutmen.',
    color: 'blue',
  },
  {
    to: '/people/jadwal',
    icon: 'calendar',
    label: 'Jadwal Staff',
    description: 'Atur jadwal per toko dalam scope support people.',
    color: 'violet',
  },
  {
    to: '/kpi',
    icon: 'chart',
    label: 'KPI',
    description: 'Pantau KPI store, head store, dan manager yang menjadi fokus pembinaan.',
    color: 'amber',
  },
  {
    to: '/trainer',
    icon: 'users',
    label: 'Trainer Hub',
    description: 'Modul onboarding, evaluasi, dan pendampingan staff.',
    color: 'emerald',
  },
  {
    to: '/trainer/oje',
    icon: 'checklist',
    label: 'OJE',
    description: 'Lanjutkan evaluasi dan dokumentasi On Job Evaluation.',
    color: 'blue',
  },
  {
    to: '/hr/store',
    icon: 'store',
    label: 'Rekrutmen',
    description: 'Pantau kebutuhan kandidat dan progres per toko.',
    color: 'violet',
  },
]

const CARD_COLORS = {
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-100',  icon: 'bg-violet-600',  },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-100',   icon: 'bg-amber-500',   },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-100',    icon: 'bg-blue-600',    },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'bg-emerald-500', },
}

const QUICK_ACTIONS = [
  { to: '/dm/people',    icon: 'users',     label: 'People\nHub' },
  { to: '/kpi',          icon: 'chart',     label: 'KPI' },
  { to: '/trainer',      icon: 'spark',     label: 'Trainer\nHub' },
  { to: '/trainer/oje',  icon: 'checklist', label: 'OJE' },
  { to: '/hr/store',     icon: 'store',     label: 'Rekrutmen' },
]

export default function SupportPeopleDashboard() {
  const { profile, signOut } = useAuth()
  const shortName = profile?.full_name?.split(' ')[0] ?? 'Support'

  return (
    <div className="min-h-screen bg-[#f5f0ff] pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 flex justify-between items-center border-b border-violet-50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-violet-600 flex items-center justify-center text-white font-black text-base shadow-md">
            <AppIcon name="users" size={18} />
          </div>
          <div>
            <p className="text-[10px] text-violet-600 font-bold uppercase tracking-widest">Support People</p>
            <p className="font-extrabold text-gray-900 text-base leading-tight">{shortName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full uppercase tracking-wide">
            Support SPV
          </span>
          <button
            type="button"
            onClick={signOut}
            className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center text-violet-600 hover:bg-violet-100 transition-colors"
          >
            <AppIcon name="logout" size={18} />
          </button>
        </div>
      </div>

      <div className="px-5 pt-5">
        {/* Overview */}
        <div className="bg-violet-50 p-5 rounded-[2.5rem] border border-violet-100 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-black text-violet-900 uppercase">People Overview</h2>
            <span className="text-[10px] font-bold text-violet-600">Support Supervisor</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'People Hub', sub: 'Jadwal & KPI', icon: 'users' },
              { label: 'Trainer', sub: 'Onboarding & OJE', icon: 'spark' },
              { label: 'Rekrutmen', sub: 'Kandidat Toko', icon: 'store' },
            ].map((item) => (
              <div key={item.label} className="bg-white p-3 rounded-2xl text-center shadow-sm">
                <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <AppIcon name={item.icon} size={16} className="text-violet-600" />
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
              <div className="w-14 h-14 bg-white border border-violet-100 rounded-2xl flex items-center justify-center text-violet-600 shadow-sm active:scale-95 transition-transform">
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
            to="/trainer"
            className="flex-1 bg-gradient-to-br from-violet-600 to-violet-800 p-4 rounded-3xl text-white relative overflow-hidden shadow-md transition-transform active:scale-[0.98]"
          >
            <div className="relative z-10">
              <p className="text-[9px] font-bold opacity-80 uppercase mb-1">Trainer</p>
              <p className="text-base font-black">Onboarding</p>
              <p className="text-[9px] opacity-70 mt-1">OJE · Staff Baru · Lama</p>
            </div>
            <AppIcon name="spark" size={42} className="absolute -right-2 -bottom-2 opacity-20" />
          </Link>
          <Link
            to="/hr/store"
            className="flex-1 bg-white border border-violet-100 p-4 rounded-3xl shadow-sm flex flex-col justify-between hover:border-violet-300 transition-colors"
          >
            <p className="text-[9px] font-bold text-gray-400 uppercase">Rekrutmen</p>
            <p className="text-base font-black text-gray-900 leading-tight mt-1">Kandidat</p>
            <div className="flex items-center gap-1 mt-2">
              <AppIcon name="store" size={12} className="text-violet-400" />
              <p className="text-[8px] text-violet-400 font-semibold">Pantau per toko</p>
            </div>
          </Link>
        </div>

        {/* Menu Cards */}
        <div className="mb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Menu Support People</p>
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
        <div className="bg-gradient-to-r from-violet-700 to-violet-500 p-5 rounded-[2rem] text-white relative overflow-hidden shadow-lg mb-2">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white/20 text-[8px] font-bold px-2 py-0.5 rounded uppercase">Tips</span>
            </div>
            <h3 className="font-bold text-sm mb-1">Alur Kerja People</h3>
            <p className="text-[10px] opacity-90 leading-relaxed">
              Mulai dari People Hub → cek jadwal → pantau KPI → tindak lanjut via Trainer atau Rekrutmen.
            </p>
          </div>
          <AppIcon name="users" size={72} className="absolute -right-4 -bottom-4 opacity-10" />
        </div>
      </div>

      <OpsBottomNav />
    </div>
  )
}
