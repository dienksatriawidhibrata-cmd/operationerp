import { useAuth } from '../../contexts/AuthContext'
import { OpsBottomNav } from '../../components/BottomNav'
import { ActionCard, HeroCard, InlineStat, SectionPanel, SubpageShell, ToneBadge } from '../../components/ui/AppKit'

export default function SupportHub() {
  const { profile } = useAuth()

  const actions = [
    {
      to: '/ops/support/people',
      icon: 'users',
      title: 'Support People',
      description: 'Masuk ke dashboard Support SPV untuk people, trainer, dan recruitment.',
      accent: 'violet',
    },
    {
      to: '/ops/support/finance',
      icon: 'finance',
      title: 'Support Finance',
      description: 'Masuk ke dashboard Support Admin untuk approval dan monitoring finance.',
      accent: 'amber',
    },
    {
      to: '/tasks',
      icon: 'checklist',
      title: 'Tugas',
      description: 'Lihat dan tindak lanjuti task support yang sedang berjalan.',
      accent: 'primary',
    },
    {
      to: '/ops/pengumuman',
      icon: 'bell',
      title: 'Pengumuman',
      description: 'Buat dan kelola pengumuman operasional untuk seluruh tim.',
      accent: 'emerald',
    },
    {
      to: '/support/staff',
      icon: 'store',
      title: 'Manajemen Staf',
      description: 'Atur akun, role, dan status aktif pengguna aplikasi.',
      accent: 'primary',
    },
  ]

  return (
    <SubpageShell
      title="Support"
      subtitle="People, finance, task, dan administrasi support"
      eyebrow="Ops Support Hub"
      showBack={false}
      footer={<OpsBottomNav />}
    >
      <HeroCard
        eyebrow="Support Command"
        title="Satu hub untuk seluruh fungsi support"
        description="Halaman ini menyatukan dashboard support people, support finance, tugas, pengumuman, dan administrasi pengguna agar ops manager lebih mudah berpindah antar fungsi support."
        meta={(
          <>
            <ToneBadge tone="info">{profile?.full_name || 'Ops Manager'}</ToneBadge>
            <ToneBadge tone="info">Support Center</ToneBadge>
          </>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineStat label="Pilar 1" value="People" tone="primary" />
          <InlineStat label="Pilar 2" value="Finance" tone="amber" />
          <InlineStat label="Tambahan" value="Task & Admin" tone="emerald" />
        </div>
      </HeroCard>

      <div className="mt-6 space-y-6">
        <SectionPanel
          eyebrow="Main Access"
          title="Menu Support"
          description="Pilih area support yang ingin kamu buka dari hub ini."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {actions.map((action) => (
              <ActionCard key={action.to} {...action} />
            ))}
          </div>
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}
