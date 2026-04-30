import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { StaffBottomNav } from '../../components/BottomNav'
import { AppIcon, SubpageShell } from '../../components/ui/AppKit'

export default function LaporanHub() {
  const { profile } = useAuth()
  const isHeadStore = profile?.role === 'head_store'
  const branchName = profile?.branch?.name?.replace('Bagi Kopi ', '') || 'Toko'
  const menu = [
    ...(isHeadStore ? [
      {
        to: '/staff/laporan#laporan-form',
        icon: 'chart',
        title: 'Laporan Harian',
        desc: 'Isi dan revisi ringkasan operasional harian toko.',
        color: 'bg-amber-50 border-amber-100',
        iconColor: 'text-amber-600',
      },
      {
        to: '/staff/laporan#setoran-form',
        icon: 'finance',
        title: 'Setoran',
        desc: 'Submit setoran cash dan unggah bukti slip setoran.',
        color: 'bg-blue-50 border-blue-100',
        iconColor: 'text-blue-600',
      },
      {
        to: '/staff/opex',
        icon: 'opex',
        title: 'Opex',
        desc: 'Catat pengeluaran operasional harian toko.',
        color: 'bg-rose-50 border-rose-100',
        iconColor: 'text-rose-600',
      },
    ] : []),
    {
      to: '/laporan/quality-control',
      icon: 'checklist',
      title: 'Quality Control',
      desc: 'Cek stok, tanggal pembuatan, dan catatan item harian.',
      color: 'bg-emerald-50 border-emerald-100',
      iconColor: 'text-emerald-600',
      badge: 'Baru',
      badgeTone: 'bg-emerald-100 text-emerald-700',
    },
  ]

  return (
    <SubpageShell
      title="Laporan"
      subtitle={`${branchName} - Pantau menu laporan toko sesuai akses harian.`}
      eyebrow="Daily Reporting"
      showBack={false}
      footer={<StaffBottomNav />}
    >
      <div className="mt-2 space-y-3">
        {menu.map((item) => (
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
                <div className="text-sm font-bold text-slate-900">{item.title}</div>
                {item.badge && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.badgeTone}`}>
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs leading-snug text-slate-500">{item.desc}</p>
            </div>
            <AppIcon name="chevronRight" size={14} className="shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>
    </SubpageShell>
  )
}
