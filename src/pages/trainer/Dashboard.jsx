import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { TrainerBottomNav } from '../../components/BottomNav'
import {
  AppIcon, SubpageShell, HeroCard, MetricCard, ActionCard, SectionPanel, ToneBadge,
} from '../../components/ui/AppKit'
import { todayWIB } from '../../lib/utils'

const QUADRANT_COLORS = {
  'Consistent Star': 'emerald', 'Future Star': 'emerald', 'Rough Diamond': 'primary',
  'Current Star': 'primary',    'Key Player': 'primary',  'Inconsistent Player': 'orange',
  'High Professional': 'orange','Solid Professional': 'orange', 'Talent Risk': 'rose',
}

export default function TrainerDashboard() {
  const { profile, signOut } = useAuth()
  const today = todayWIB()

  const [stats, setStats] = useState({
    totalNew: 0, lulus: 0, training: 0, pertimbangkan: 0,
    totalExisting: 0, byQuadrant: {},
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    const [newRes, existingRes] = await Promise.all([
      supabase.from('trainer_new_staff').select('status'),
      supabase.from('trainer_existing_staff').select('quadrant'),
    ])

    const newRows = newRes.data || []
    const existRows = existingRes.data || []

    const byQuadrant = {}
    existRows.forEach(r => {
      if (r.quadrant) byQuadrant[r.quadrant] = (byQuadrant[r.quadrant] || 0) + 1
    })

    setStats({
      totalNew:      newRows.length,
      lulus:         newRows.filter(r => r.status === 'Lulus Siap Ke Store').length,
      training:      newRows.filter(r => r.status === 'Training').length,
      pertimbangkan: newRows.filter(r => r.status === 'Pertimbangkan').length,
      totalExisting: existRows.length,
      byQuadrant,
    })
    setLoading(false)
  }

  const topQuadrants = Object.entries(stats.byQuadrant)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  return (
    <SubpageShell
      title="Trainer"
      subtitle="Assessment & Evaluasi Staff"
      eyebrow="Training Hub"
      showBack={false}
      action={
        <button
          onClick={signOut}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.35)] transition-colors hover:border-primary-200 hover:text-primary-700"
          aria-label="Keluar"
        >
          <AppIcon name="logout" size={18} />
        </button>
      }
      footer={<TrainerBottomNav />}
    >
      <HeroCard
        eyebrow="Selamat Datang"
        title={`Halo, ${profile?.full_name?.split(' ')[0] ?? 'Trainer'}`}
        description="Kelola penilaian staff baru (OJT) dan evaluasi 9-box staff lama dari sini."
        meta={<ToneBadge tone="info">{today}</ToneBadge>}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/15 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-blue-100">Total Assessees</div>
            <div className="mt-1.5 text-2xl font-semibold">{loading ? '—' : stats.totalNew + stats.totalExisting}</div>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-blue-100">Staff Baru Lulus</div>
            <div className="mt-1.5 text-2xl font-semibold">{loading ? '—' : stats.lulus}</div>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-blue-100">Staff Lama Dinilai</div>
            <div className="mt-1.5 text-2xl font-semibold">{loading ? '—' : stats.totalExisting}</div>
          </div>
        </div>
      </HeroCard>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Lulus Ke Store"
          value={loading ? '—' : stats.lulus}
          total={stats.totalNew}
          icon="approval"
          tone="emerald"
        />
        <MetricCard
          title="Masih Training"
          value={loading ? '—' : stats.training}
          total={stats.totalNew}
          icon="clock"
          tone="primary"
        />
        <MetricCard
          title="Pertimbangkan"
          value={loading ? '—' : stats.pertimbangkan}
          total={stats.totalNew}
          icon="warning"
          tone="orange"
        />
        <MetricCard
          title="Staff Lama Dinilai"
          value={loading ? '—' : stats.totalExisting}
          icon="checklist"
          tone="primary"
        />
      </div>

      {topQuadrants.length > 0 && (
        <SectionPanel
          eyebrow="9-Box"
          title="Distribusi Staff Lama"
          description="Jumlah staff per kuadran berdasarkan penilaian terakhir"
          className="mt-5"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {topQuadrants.map(([q, count]) => (
              <div key={q} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center">
                <div className="text-lg font-semibold text-slate-900">{count}</div>
                <div className="mt-0.5 text-xs font-medium text-slate-500">{q}</div>
              </div>
            ))}
          </div>
        </SectionPanel>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <ActionCard
          title="Penilaian Staff Baru"
          description="Input & lihat hasil OJT/assessment calon staff baru sebelum ke store."
          icon="users"
          to="/trainer/staff-baru"
          accent="primary"
        />
        <ActionCard
          title="Evaluasi Staff Lama"
          description="Matriks 9-box performance vs potential untuk staff & head store yang aktif."
          icon="matrix"
          to="/trainer/staff-lama"
          accent="emerald"
        />
      </div>
    </SubpageShell>
  )
}
