import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { getScopeLabel } from '../../lib/access'
import {
  AppIcon,
  HeroCard,
  InlineStat,
  SectionPanel,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'
import { DMBottomNav } from '../../components/BottomNav'

const PEOPLE_MENU = [
  {
    to: '/people/jadwal',
    icon: 'calendar',
    title: 'Input Jadwal Staff',
    desc: 'Atur jadwal semua toko dalam scope district atau area kamu.',
    color: 'bg-violet-50 border-violet-100',
    iconColor: 'text-violet-600',
  },
  {
    to: '/kpi',
    icon: 'chart',
    title: 'KPI',
    desc: 'Pantau KPI toko, head store, dan performa tim secara terpusat.',
    color: 'bg-blue-50 border-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    to: '/hr/store',
    icon: 'users',
    title: 'Rekrutmen',
    desc: 'Lihat proses kandidat dan follow up kebutuhan hiring seluruh toko bawahan.',
    color: 'bg-emerald-50 border-emerald-100',
    iconColor: 'text-emerald-600',
  },
]

export default function ManagerPeopleHub() {
  const { profile } = useAuth()
  const [branches, setBranches] = useState([])
  const [people, setPeople] = useState([])

  useEffect(() => {
    if (!profile?.role) return

    const load = async () => {
      let branchQuery = supabase.from('branches').select('id,name,district,area').eq('is_active', true)
      if (profile.role === 'district_manager') {
        branchQuery = branchQuery.in('district', profile.managed_districts || [])
      } else if (profile.role === 'area_manager') {
        branchQuery = branchQuery.in('area', profile.managed_areas || [])
      }

      const { data: branchRows } = await branchQuery.order('name')
      const branchIds = (branchRows || []).map((branch) => branch.id)
      setBranches(branchRows || [])

      if (!branchIds.length) {
        setPeople([])
        return
      }

      const { data: peopleRows } = await supabase
        .from('profiles')
        .select('id,branch_id,role,is_active')
        .in('branch_id', branchIds)
        .eq('is_active', true)

      setPeople(peopleRows || [])
    }

    load()
  }, [profile?.managed_areas, profile?.managed_districts, profile?.role])

  const stats = useMemo(() => {
    const teamRoles = ['staff', 'barista', 'kitchen', 'waitress', 'asst_head_store']
    return {
      stores: branches.length,
      headStores: people.filter((item) => item.role === 'head_store').length,
      teamMembers: people.filter((item) => teamRoles.includes(item.role)).length,
      activePeople: people.length,
    }
  }, [branches.length, people])

  const scopeLabel = getScopeLabel(profile, branches)

  return (
    <SubpageShell
      title="People"
      subtitle={scopeLabel}
      eyebrow="Manager People"
      showBack={false}
      footer={<DMBottomNav />}
    >
      <HeroCard
        eyebrow="People Management"
        title="Kelola jadwal, KPI, dan rekrutmen lintas toko"
        description="Strukturnya mengikuti halaman People milik Head Store, tetapi isinya diringkas untuk seluruh toko dalam scope AM/DM."
        meta={(
          <>
            <ToneBadge tone="info">{branches.length} toko aktif</ToneBadge>
            <ToneBadge tone="info">{stats.activePeople} orang aktif</ToneBadge>
          </>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InlineStat label="Toko" value={stats.stores} tone="primary" />
          <InlineStat label="Head Store" value={stats.headStores} tone="emerald" />
          <InlineStat label="Tim Store" value={stats.teamMembers} tone="amber" />
          <InlineStat label="Orang Aktif" value={stats.activePeople} tone="rose" />
        </div>
      </HeroCard>

      <div className="mt-6 space-y-6">
        <SectionPanel
          eyebrow="Main Access"
          title="Menu People"
          description="Semua tugas people manager dikumpulkan dalam satu hub agar bisa langsung pindah dari monitoring ke action."
        >
          <div className="space-y-3">
            {PEOPLE_MENU.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-4 rounded-[22px] border px-5 py-4 transition-opacity hover:opacity-90 ${item.color}`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ${item.iconColor}`}>
                  <AppIcon name={item.icon} size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900">{item.title}</div>
                  <p className="mt-0.5 text-xs leading-snug text-slate-500">{item.desc}</p>
                </div>
                <AppIcon name="chevronRight" size={14} className="shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}
