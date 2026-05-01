import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { OpsBottomNav } from '../../components/BottomNav'
import { AppIcon } from '../../components/ui/AppKit'

const MENU_CARDS = [
  {
    to: '/ops/support/people',
    icon: 'users',
    label: 'Support People',
    description: 'Dashboard Support SPV untuk people, trainer & recruitment.',
    color: 'violet',
  },
  {
    to: '/ops/support/finance',
    icon: 'finance',
    label: 'Support Finance',
    description: 'Dashboard Support Admin untuk approval & monitoring finance.',
    color: 'amber',
  },
  {
    to: '/tasks',
    icon: 'checklist',
    label: 'Tugas',
    description: 'Lihat dan tindak lanjuti task support yang sedang berjalan.',
    color: 'blue',
  },
  {
    to: '/ops/pengumuman',
    icon: 'bell',
    label: 'Pengumuman',
    description: 'Buat dan kelola pengumuman operasional untuk seluruh tim.',
    color: 'emerald',
  },
  {
    to: '/support/staff',
    icon: 'store',
    label: 'Manajemen Staf',
    description: 'Atur akun, role, dan status aktif pengguna aplikasi.',
    color: 'blue',
  },
]

const CARD_COLORS = {
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-100',  icon: 'bg-violet-600',  text: 'text-violet-700' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-100',   icon: 'bg-amber-500',   text: 'text-amber-700' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-100',    icon: 'bg-blue-600',    text: 'text-blue-700' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'bg-emerald-500', text: 'text-emerald-700' },
}

const QUICK_ACTIONS = [
  { to: '/ops/support/people', icon: 'users',     label: 'Support\nPeople' },
  { to: '/ops/support/finance',icon: 'finance',   label: 'Support\nFinance' },
  { to: '/tasks',              icon: 'checklist', label: 'Tugas' },
  { to: '/ops/pengumuman',     icon: 'bell',      label: 'Pengumuman' },
  { to: '/support/staff',      icon: 'store',     label: 'Staf\nManagement' },
]

export default function SupportHub() {
  const { profile, signOut } = useAuth()
  const shortName = profile?.full_name?.split(' ')[0] ?? 'Ops'

  return (
    <div className="min-h-screen bg-[#f0f6ff] pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 flex justify-between items-center border-b border-blue-50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center text-white font-black text-base shadow-md">
            <AppIcon name="users" size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Support Hub</p>
            <p className="font-extrabold text-gray-900 text-base leading-tight">{shortName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wide">
            Ops Manager
          </span>
          <button
            type="button"
            onClick={signOut}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <AppIcon name="logout" size={18} />
          </button>
        </div>
      </div>

      <div className="px-5 pt-5">
        {/* Overview Card */}
        <div className="bg-slate-900 p-5 rounded-[2.5rem] mb-6 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Support Command</p>
            <h2 className="text-base font-black text-white mb-1">Satu hub semua fungsi support</h2>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              People · Finance · Task · Admin
            </p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: 'People', sub: 'Trainer & HR', color: 'bg-violet-500' },
              { label: 'Finance', sub: 'Approval & Audit', color: 'bg-amber-500' },
              { label: 'Admin', sub: 'Tugas & Staf', color: 'bg-blue-500' },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 rounded-2xl p-3 text-center">
                <div className={`w-2 h-2 rounded-full ${item.color} mx-auto mb-2`} />
                <p className="text-[10px] font-black text-white">{item.label}</p>
                <p className="text-[8px] text-slate-400 mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>
          <AppIcon name="users" size={72} className="absolute -right-4 -bottom-4 opacity-5" />
        </div>

        {/* Quick Action Icons */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.to} to={action.to} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-600 shadow-sm active:scale-95 transition-transform">
                <AppIcon name={action.icon} size={22} />
              </div>
              <span className="text-[9px] font-bold text-center leading-tight text-gray-700">
                {action.label.split('\n').map((l, i) => <span key={i}>{l}{i === 0 ? <br /> : ''}</span>)}
              </span>
            </Link>
          ))}
        </div>

        {/* Two main pillars highlighted */}
        <div className="flex gap-3 mb-6">
          <Link
            to="/ops/support/people"
            className="flex-1 bg-gradient-to-br from-violet-600 to-violet-800 p-4 rounded-3xl text-white relative overflow-hidden shadow-md transition-transform active:scale-[0.98]"
          >
            <div className="relative z-10">
              <p className="text-[9px] font-bold opacity-80 uppercase mb-1">Pilar 1</p>
              <p className="text-base font-black">People</p>
              <p className="text-[9px] opacity-70 mt-1">Trainer · HR · Rekrutmen</p>
            </div>
            <AppIcon name="users" size={42} className="absolute -right-2 -bottom-2 opacity-20" />
          </Link>
          <Link
            to="/ops/support/finance"
            className="flex-1 bg-gradient-to-br from-amber-500 to-amber-700 p-4 rounded-3xl text-white relative overflow-hidden shadow-md transition-transform active:scale-[0.98]"
          >
            <div className="relative z-10">
              <p className="text-[9px] font-bold opacity-80 uppercase mb-1">Pilar 2</p>
              <p className="text-base font-black">Finance</p>
              <p className="text-[9px] opacity-70 mt-1">Approval · Audit · Opex</p>
            </div>
            <AppIcon name="finance" size={42} className="absolute -right-2 -bottom-2 opacity-20" />
          </Link>
        </div>

        {/* Menu Cards */}
        <div className="mb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Menu Support</p>
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
      </div>

      <OpsBottomNav />
    </div>
  )
}
