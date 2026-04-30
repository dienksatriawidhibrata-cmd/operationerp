import { ActionCard, HeroCard, InlineStat, SectionPanel, SubpageShell, ToneBadge } from '../../components/ui/AppKit'
import { OpsBottomNav } from '../../components/BottomNav'
import { useAuth } from '../../contexts/AuthContext'

const ACTIONS = [
  { to: '/dm/people', icon: 'users', title: 'People Hub', description: 'Buka ringkasan people lintas toko untuk jadwal, KPI, dan rekrutmen.', accent: 'primary' },
  { to: '/people/jadwal', icon: 'calendar', title: 'Jadwal Staff', description: 'Atur jadwal per toko dalam scope support people.', accent: 'violet' },
  { to: '/kpi', icon: 'chart', title: 'KPI', description: 'Pantau KPI store, head store, dan manager yang menjadi fokus pembinaan.', accent: 'amber' },
  { to: '/trainer', icon: 'users', title: 'Trainer Hub', description: 'Masuk ke modul onboarding, evaluasi, dan pendampingan staff.', accent: 'emerald' },
  { to: '/trainer/oje', icon: 'checklist', title: 'OJE', description: 'Lanjutkan evaluasi dan dokumentasi On Job Evaluation.', accent: 'primary' },
  { to: '/hr/store', icon: 'store', title: 'Rekrutmen', description: 'Pantau kebutuhan kandidat dan progres per toko.', accent: 'violet' },
]

export default function SupportPeopleDashboard() {
  const { profile } = useAuth()

  return (
    <SubpageShell
      title="Support People"
      subtitle="People, trainer, dan rekrutmen"
      eyebrow="Support Supervisor"
      showBack={false}
      footer={<OpsBottomNav />}
    >
      <HeroCard
        eyebrow="People Pillar"
        title="Fokus penuh pada pengembangan tim dan training"
        description="Dashboard ini mengumpulkan seluruh alur kerja Support SPV untuk people management, trainer, dan recruitment dalam satu tempat."
        meta={(
          <>
            <ToneBadge tone="info">{profile?.full_name || 'Support SPV'}</ToneBadge>
            <ToneBadge tone="info">People + Trainer</ToneBadge>
          </>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineStat label="Pilar" value="People" tone="primary" />
          <InlineStat label="Fokus" value="Trainer" tone="emerald" />
          <InlineStat label="Scope" value="Recruitment" tone="amber" />
        </div>
      </HeroCard>

      <div className="mt-6 space-y-6">
        <SectionPanel
          eyebrow="Main Access"
          title="Dashboard Kerja Support SPV"
          description="Semua tombol di bawah diarahkan ke modul people dan trainer yang memang menjadi ownership role ini."
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
