import { ActionCard, HeroCard, InlineStat, SectionPanel, SubpageShell, ToneBadge } from '../../components/ui/AppKit'
import { OpsBottomNav } from '../../components/BottomNav'
import { useAuth } from '../../contexts/AuthContext'

const ACTIONS = [
  { to: '/finance', icon: 'finance', title: 'Finance Hub', description: 'Ringkasan jalur finance untuk approval dan monitoring toko.', accent: 'primary' },
  { to: '/ops/laporan', icon: 'chart', title: 'Laporan Harian', description: 'Pantau setoran, opex, dan net sales semua toko.', accent: 'amber' },
  { to: '/ops/opex-approval', icon: 'approval', title: 'Approval Opex', description: 'Tangani approval support sebelum naik ke Ops Manager.', accent: 'emerald' },
  { to: '/finance/audit', icon: 'checklist', title: 'Audit Setoran', description: 'Review audit finance dan tindak lanjuti temuan setoran.', accent: 'violet' },
  { to: '/finance/opex', icon: 'opex', title: 'Pengajuan Opex', description: 'Lihat seluruh daftar pengajuan dana operasional dari sisi finance.', accent: 'primary' },
  { to: '/opex', icon: 'store', title: 'Penggunaan Opex', description: 'Pantau penggunaan BOH per toko dan identifikasi over budget.', accent: 'amber' },
]

export default function SupportFinanceDashboard() {
  const { profile } = useAuth()

  return (
    <SubpageShell
      title="Support Finance"
      subtitle="Monitoring dan approval finance"
      eyebrow="Support Finance"
      showBack={false}
      footer={<OpsBottomNav />}
    >
      <HeroCard
        eyebrow="Finance Pillar"
        title="Fokus penuh pada control finance operasional"
        description="Dashboard ini merangkum seluruh alur kerja Support Admin yang sekarang difokuskan ke finance dan approval operasional."
        meta={(
          <>
            <ToneBadge tone="info">{profile?.full_name || 'Support Finance'}</ToneBadge>
            <ToneBadge tone="info">Finance Only</ToneBadge>
          </>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineStat label="Pilar" value="Finance" tone="primary" />
          <InlineStat label="Fokus" value="Approval" tone="emerald" />
          <InlineStat label="Scope" value="Monitoring" tone="amber" />
        </div>
      </HeroCard>

      <div className="mt-6 space-y-6">
        <SectionPanel
          eyebrow="Main Access"
          title="Dashboard Kerja Support Finance"
          description="Semua tombol di bawah diarahkan ke modul finance yang menjadi ownership utama role ini."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ACTIONS.map((action) => (
              <ActionCard key={action.to} {...action} />
            ))}
          </div>
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}
