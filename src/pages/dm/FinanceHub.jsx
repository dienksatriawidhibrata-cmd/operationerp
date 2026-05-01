import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getScopeLabel } from '../../lib/access'
import {
  ActionCard,
  HeroCard,
  SectionPanel,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'
import { SmartBottomNav } from '../../components/BottomNav'

function getFinanceActions(role) {
  if (role === 'ops_manager') {
    return [
      {
        to: '/ops/opex-approval',
        icon: 'approval',
        title: 'Approval Opex',
        description: 'Tangani approval OPEX yang sudah naik ke jalur support dan ops.',
        accent: 'amber',
      },
      {
        to: '/finance/opex',
        icon: 'finance',
        title: 'Pengajuan Opex',
        description: 'Lihat seluruh daftar pengajuan dana operasional yang sudah final.',
        accent: 'primary',
      },
      {
        to: '/ops/setoran',
        icon: 'finance',
        title: 'Setoran',
        description: 'Pantau status setoran toko dari jalur monitoring ops.',
        accent: 'emerald',
      },
      {
        to: '/ops/laporan',
        icon: 'chart',
        title: 'Net Sales',
        description: 'Pantau laporan harian, OPEX, dan net sales seluruh toko.',
        accent: 'violet',
      },
      {
        to: '/sc',
        icon: 'store',
        title: 'Pembelian WH',
        description: 'Buka monitoring supply chain untuk cek kebutuhan pembelian, picking, dan distribusi.',
        accent: 'primary',
      },
    ]
  }

  return [
    {
      to: '/dm/opex-approval',
      icon: 'approval',
      title: 'Pengajuan Opex',
      description: 'Review pengajuan dana operasional dari Head Store dan lanjutkan approval.',
      accent: 'amber',
    },
    {
      to: '/opex',
      icon: 'opex',
      title: 'Penggunaan Opex',
      description: 'Pantau pemakaian BOH harian per toko dan cek toko yang over budget.',
      accent: 'primary',
    },
    {
      to: '/dm/approval',
      icon: 'finance',
      title: 'Setoran',
      description: 'Lihat setoran yang menunggu approval dan tindak lanjuti toko yang belum submit.',
      accent: 'emerald',
    },
    {
      to: '/dm/laporan',
      icon: 'chart',
      title: 'Net Sales',
      description: 'Pantau laporan harian dan net sales semua toko dalam scope kamu.',
      accent: 'violet',
    },
    {
      to: '/sc',
      icon: 'store',
      title: 'Pembelian WH',
      description: 'Buka monitoring supply chain untuk cek kebutuhan pembelian, picking, dan distribusi.',
      accent: 'primary',
    },
  ]
}

export default function ManagerFinanceHub() {
  const { profile } = useAuth()
  const scopeLabel = getScopeLabel(profile)
  const roleLabel = profile?.role === 'ops_manager'
    ? 'Operations Manager'
    : profile?.role === 'area_manager'
      ? 'Area Manager'
      : 'District Manager'
  const financeActions = getFinanceActions(profile?.role)

  return (
    <SubpageShell
      title="Finance"
      subtitle={scopeLabel}
      eyebrow="Manager Finance"
      showBack={false}
      footer={<SmartBottomNav />}
    >
      <HeroCard
        eyebrow="Finance Control"
        title="Pantau uang masuk, uang keluar, dan kebutuhan toko"
        description="Halaman ini dirancang seperti hub laporan: semua pintu masuk finance DM/AM dikumpulkan jadi satu supaya approval dan monitoring lebih cepat."
        meta={(
          <>
            <ToneBadge tone="info">{roleLabel}</ToneBadge>
            <ToneBadge tone="info">{scopeLabel}</ToneBadge>
          </>
        )}
      />

      <div className="mt-6 space-y-6">
        <SectionPanel
          eyebrow="Quick Access"
          title="Menu Finance"
          description="Masuk ke tiap alur kerja finance tanpa perlu bolak-balik ke halaman lain."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {financeActions.map((action) => (
              <ActionCard key={action.to} {...action} />
            ))}
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Ringkas"
          title="Alur kerja yang paling sering dipakai"
          description="Urutan ini mengikuti ritme kerja manager saat memantau toko."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {financeActions.map((action, index) => (
              <Link
                key={action.to}
                to={action.to}
                className="rounded-[22px] border border-slate-100 bg-slate-50/80 px-4 py-4 transition-colors hover:border-primary-200 hover:bg-white"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Step {index + 1}</div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{action.title}</div>
                <div className="mt-1 text-sm leading-5 text-slate-500">{action.description}</div>
              </Link>
            ))}
          </div>
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}
