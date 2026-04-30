import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayWIB, yesterdayWIB } from '../../lib/utils'
import {
  ActionCard,
  EmptyPanel,
  HeroCard,
  InlineStat,
  SectionPanel,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'
import { DMBottomNav } from '../../components/BottomNav'

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
}

export default function ManagerTaskHub() {
  const { profile } = useAuth()
  const [summary, setSummary] = useState({
    tasks: 0,
    approvals: 0,
    opexApprovals: 0,
    announcements: 0,
  })
  const [announcements, setAnnouncements] = useState([])

  useEffect(() => {
    if (!profile?.id) return

    const load = async () => {
      const yesterday = yesterdayWIB()
      const [taskRes, depositRes, opexRes, announcementRes] = await Promise.all([
        supabase.from('dm_tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', profile.id).eq('is_done', false),
        supabase.from('daily_deposits').select('id', { count: 'exact', head: true }).eq('tanggal', yesterday).eq('status', 'submitted'),
        supabase
          .from('opex_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', profile.role === 'district_manager' ? 'submitted' : 'dm_approved'),
        supabase
          .from('announcements')
          .select('id,title,body,published_at', { count: 'exact' })
          .eq('is_active', true)
          .order('published_at', { ascending: false })
          .limit(4),
      ])

      setSummary({
        tasks: taskRes.count || 0,
        approvals: depositRes.count || 0,
        opexApprovals: opexRes.count || 0,
        announcements: announcementRes.count || 0,
      })
      setAnnouncements(announcementRes.data || [])
    }

    load()
  }, [profile?.id, profile?.role])

  const actions = [
    { to: '/tasks', icon: 'checklist', title: 'To Do Saya', description: 'Buka daftar tugas yang sedang berjalan.', accent: 'primary' },
    { to: '/dm/approval', icon: 'approval', title: 'Approval Setoran', description: 'Tindak lanjuti setoran yang masih pending.', accent: 'amber' },
    { to: '/dm/opex-approval', icon: 'finance', title: 'Approval Opex', description: 'Review approval pengajuan dana operasional.', accent: 'emerald' },
    { to: '/dm/visits', icon: 'map', title: 'Daily Visit', description: 'Lanjutkan kunjungan dan audit store hari ini.', accent: 'violet' },
  ]

  return (
    <SubpageShell
      title="Tugas"
      subtitle="To do, pengumuman, dan pemberitahuan manager"
      eyebrow="Manager Task Center"
      showBack={false}
      footer={<DMBottomNav />}
    >
      <HeroCard
        eyebrow="Action Center"
        title="Semua follow up penting ada di satu tempat"
        description="Tab ini menggabungkan to do, approval, dan pengumuman supaya DM/AM tidak perlu mencari task di banyak halaman."
        meta={(
          <>
            <ToneBadge tone="info">{profile?.role === 'area_manager' ? 'Area Manager' : 'District Manager'}</ToneBadge>
            <ToneBadge tone="info">{todayWIB()}</ToneBadge>
          </>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InlineStat label="To Do Aktif" value={summary.tasks} tone="primary" />
          <InlineStat label="Approval Setoran" value={summary.approvals} tone={summary.approvals > 0 ? 'amber' : 'emerald'} />
          <InlineStat label="Approval Opex" value={summary.opexApprovals} tone={summary.opexApprovals > 0 ? 'amber' : 'emerald'} />
          <InlineStat label="Pengumuman" value={summary.announcements} tone="rose" />
        </div>
      </HeroCard>

      <div className="mt-6 space-y-6">
        <SectionPanel
          eyebrow="Quick Access"
          title="Tugas Harian Manager"
          description="Tombol cepat untuk seluruh pekerjaan yang paling sering dikerjakan AM/DM."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {actions.map((action) => (
              <ActionCard key={action.to} {...action} />
            ))}
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Pengumuman"
          title="Pemberitahuan Terbaru"
          description="Pengumuman aktif dari tim ops akan muncul di sini."
        >
          {announcements.length === 0 ? (
            <EmptyPanel
              title="Belum ada pengumuman aktif"
              description="Saat tim ops membuat pengumuman, ringkasannya akan muncul di tab ini."
            />
          ) : (
            <div className="space-y-3">
              {announcements.map((item) => (
                <article key={item.id} className="rounded-[20px] border border-slate-100 bg-slate-50/80 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-950">{item.title}</div>
                    <ToneBadge tone="info">{formatDateTime(item.published_at)}</ToneBadge>
                  </div>
                  {item.body && (
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.body}</p>
                  )}
                </article>
              ))}
            </div>
          )}

          <div className="mt-4">
            <Link
              to="/tasks"
              className="inline-flex items-center rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              Buka Daftar Tugas
            </Link>
          </div>
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}
