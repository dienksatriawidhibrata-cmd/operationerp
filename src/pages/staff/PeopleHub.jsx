import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { StaffBottomNav } from '../../components/BottomNav'
import { AppIcon, SubpageShell } from '../../components/ui/AppKit'

const MENU = [
  {
    to: '/people/jadwal',
    icon: 'checklist',
    title: 'Jadwal Shift',
    desc: 'Buat dan kelola jadwal mingguan tim toko.',
    color: 'bg-violet-50 border-violet-100',
    iconColor: 'text-violet-600',
    badge: 'Baru',
    badgeTone: 'bg-violet-100 text-violet-700',
  },
  {
    to: '/kpi',
    icon: 'chart',
    title: 'KPI',
    desc: 'Input, lihat, dan evaluasi KPI tim toko.',
    color: 'bg-blue-50 border-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    to: '/hr/store',
    icon: 'users',
    title: 'Rekrutmen',
    desc: 'Pantau status kandidat dan proses rekrutmen toko.',
    color: 'bg-emerald-50 border-emerald-100',
    iconColor: 'text-emerald-600',
  },
]

export default function PeopleHub() {
  const { profile } = useAuth()
  const branchName = profile?.branch?.name?.replace('Bagi Kopi ', '') || 'Toko'

  return (
    <SubpageShell
      title="People"
      subtitle={`${branchName} — Kelola tim dan jadwal toko.`}
      eyebrow="People Management"
      showBack={false}
      footer={<StaffBottomNav />}
    >
      <div className="space-y-3 mt-2">
        {MENU.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center gap-4 rounded-[22px] border px-5 py-4 transition-opacity active:opacity-70 ${item.color}`}
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ${item.iconColor}`}>
              <AppIcon name={item.icon} size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{item.title}</span>
                {item.badge && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.badgeTone}`}>
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500 leading-snug">{item.desc}</p>
            </div>
            <AppIcon name="chevronRight" size={14} className="shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>
    </SubpageShell>
  )
}
