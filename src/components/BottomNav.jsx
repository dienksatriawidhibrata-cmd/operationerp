import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { AppIcon } from './ui/AppKit'
import { isManagerRole, isOpsLikeRole, isStoreRole, isFinanceRole, canAccessTasks, HR_ROLES } from '../lib/access'

function NavItem({ to, icon, label, active, badgeCount = 0 }) {
  return (
    <Link
      to={to}
      className={`group flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[20px] px-1.5 py-2 transition-all sm:gap-1 sm:px-2 sm:py-2.5 ${
        active
          ? 'bg-white text-primary-700 shadow-[0_16px_32px_-24px_rgba(37,99,235,0.85)]'
          : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <div
        className={`relative flex h-8 w-8 items-center justify-center rounded-2xl transition-colors sm:h-9 sm:w-9 ${
          active ? 'bg-primary-50 text-primary-700' : 'bg-transparent'
        }`}
      >
        <AppIcon name={icon} size={17} />
        {badgeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </div>
      <span className="truncate text-[10px] font-semibold tracking-[0.04em] sm:text-[11px] sm:tracking-[0.06em]">{label}</span>
    </Link>
  )
}

function Dock({ children }) {
  return (
    <nav className="fixed inset-x-0 bottom-3 z-30 flex justify-center px-4">
      <div className="flex w-full max-w-[520px] items-center gap-1 rounded-[24px] border border-white/80 bg-white/88 p-1.5 shadow-[0_26px_70px_-40px_rgba(15,23,42,0.55)] backdrop-blur-xl sm:rounded-[28px] sm:p-2">
        {children}
      </div>
    </nav>
  )
}

function useIssuedSuratJalanCount() {
  const { profile } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!profile?.branch_id || !isStoreRole(profile.role)) {
      setCount(0)
      return
    }

    let active = true

    const fetchCount = async () => {
      const { count: nextCount, error } = await supabase
        .from('surat_jalan')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', profile.branch_id)
        .eq('status', 'issued')

      if (!active || error) return
      setCount(nextCount || 0)
    }

    fetchCount()

    const channel = supabase
      .channel(`nav-sj-issued-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'surat_jalan', filter: `branch_id=eq.${profile.branch_id}` },
        fetchCount
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [profile?.branch_id, profile?.id, profile?.role])

  return count
}

function usePendingTaskCount() {
  const { profile } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!profile?.id || !canAccessTasks(profile.role)) {
      setCount(0)
      return
    }

    let active = true

    const fetchCount = async () => {
      let query = supabase
        .from('dm_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('is_done', false)

      if (!isOpsLikeRole(profile.role)) {
        query = query.eq('assigned_to', profile.id)
      }

      const { count: nextCount, error } = await query
      if (!active || error) return
      setCount(nextCount || 0)
    }

    fetchCount()

    const taskFilter = isOpsLikeRole(profile.role)
      ? undefined
      : `assigned_to=eq.${profile.id}`

    const channel = supabase
      .channel(`nav-tasks-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dm_tasks', filter: taskFilter },
        fetchCount
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [profile?.id, profile?.role])

  return count
}

export function StaffBottomNav() {
  const { pathname } = useLocation()
  const { profile } = useAuth()
  const isHeadStore = profile?.role === 'head_store'
  const issuedSjCount = useIssuedSuratJalanCount()

  if (isHeadStore) {
    const peopleActive = pathname.startsWith('/people') || pathname.startsWith('/kpi') || pathname.startsWith('/hr')
    return (
      <Dock>
        <NavItem to="/staff"         icon="home"    label="Dashboard"     active={pathname === '/staff'} />
        <NavItem to="/staff/laporan" icon="chart"   label="Laporan"       active={pathname.startsWith('/staff/laporan')} />
        <NavItem to="/sc/sj"         icon="finance" label="Terima Barang" active={pathname.startsWith('/sc')} badgeCount={issuedSjCount} />
        <NavItem to="/people"        icon="users"   label="People"        active={peopleActive} />
        <NavItem to="/sop"           icon="book"    label="SOP"           active={pathname.startsWith('/sop')} />
      </Dock>
    )
  }

  return (
    <Dock>
      <NavItem to="/staff" icon="home"    label="Dashboard"     active={pathname === '/staff'} />
      <NavItem to="/kpi"   icon="chart"   label="KPI"           active={pathname.startsWith('/kpi')} />
      <NavItem to="/sc/sj" icon="finance" label="Terima Barang" active={pathname.startsWith('/sc')} badgeCount={issuedSjCount} />
      <NavItem to="/sop"   icon="book"    label="SOP"           active={pathname.startsWith('/sop')} />
    </Dock>
  )
}

export function DMBottomNav() {
  const { pathname } = useLocation()

  return (
    <Dock>
      <NavItem to="/dm"         icon="home"      label="Dashboard"     active={pathname === '/dm'} />
      <NavItem to="/dm/stores"  icon="checklist" label="Toko"          active={pathname.startsWith('/dm/stores')} />
      <NavItem to="/dm/laporan" icon="finance"   label="Laporan Harian" active={pathname.startsWith('/dm/laporan') || pathname.startsWith('/ops/laporan') || pathname.startsWith('/finance')} />
      <NavItem to="/kpi"        icon="chart"     label="KPI"           active={pathname.startsWith('/kpi')} />
      <NavItem to="/sop"        icon="book"      label="SOP"           active={pathname.startsWith('/sop')} />
    </Dock>
  )
}

export function SCBottomNav() {
  const { pathname } = useLocation()
  const { profile }  = useAuth()

  const role = profile?.role
  const isWarehouse  = ['warehouse_admin','warehouse_spv','sc_supervisor','ops_manager','purchasing_admin','support_spv','support_admin'].includes(role)
  const isPicking    = role === 'picking_spv'
  const isQC         = role === 'qc_spv'
  const isDist       = role === 'distribution_spv'

  return (
    <Dock>
      <NavItem to="/sc" icon="home" label="Dashboard" active={pathname === '/sc'} />
      {isWarehouse && (
        <NavItem to="/sc/orders/new" icon="opex" label="Order" active={pathname.startsWith('/sc/orders/new')} />
      )}
      {(isPicking || isWarehouse) && (
        <NavItem to="/sc/picking" icon="checklist" label="Picking" active={pathname === '/sc/picking'} />
      )}
      {(isQC || isWarehouse) && (
        <NavItem to="/sc/qc" icon="checklist" label="QC" active={pathname === '/sc/qc'} />
      )}
      {(isDist || isWarehouse) && (
        <NavItem to="/sc/distribution" icon="map" label="Distribusi" active={pathname === '/sc/distribution'} />
      )}
      {isWarehouse && (
        <NavItem to="/sc/sj" icon="finance" label="SJ" active={pathname.startsWith('/sc/sj')} />
      )}
      <NavItem to="/sop" icon="book" label="SOP" active={pathname.startsWith('/sop')} />
    </Dock>
  )
}

export function TrainerBottomNav() {
  const { pathname } = useLocation()
  const taskCount = usePendingTaskCount()

  return (
    <Dock>
      <NavItem to="/trainer"            icon="home"      label="Dashboard" active={pathname === '/trainer'} />
      <NavItem to="/trainer/staff-baru" icon="users"     label="Staff Baru" active={pathname.startsWith('/trainer/staff-baru')} />
      <NavItem to="/trainer/staff-lama" icon="matrix"    label="Staff Lama" active={pathname.startsWith('/trainer/staff-lama')} />
      <NavItem to="/trainer/oje"        icon="checklist" label="OJE"        active={pathname.startsWith('/trainer/oje')} />
      <NavItem to="/tasks"              icon="approval"  label="Tugas"      active={pathname.startsWith('/tasks')} badgeCount={taskCount} />
      <NavItem to="/hr/store"           icon="users"     label="Rekrutmen"  active={pathname.startsWith('/hr')} />
    </Dock>
  )
}

export function FinanceBottomNav() {
  const { pathname } = useLocation()

  return (
    <Dock>
      <NavItem to="/finance"       icon="finance"  label="Finance" active={pathname === '/finance' || pathname.startsWith('/opex')} />
      <NavItem to="/finance/audit" icon="approval" label="Audit"   active={pathname.startsWith('/finance/audit')} />
      <NavItem to="/sop"           icon="book"     label="SOP"     active={pathname.startsWith('/sop')} />
    </Dock>
  )
}

export function OpsBottomNav() {
  const { pathname } = useLocation()
  const taskCount = usePendingTaskCount()

  const dashActive = pathname === '/ops'
  const retailActive = pathname.startsWith('/dm') || pathname.startsWith('/kpi') ||
    pathname.startsWith('/opex') || pathname.startsWith('/ops/visits') || pathname.startsWith('/finance') || pathname.startsWith('/ops/laporan')
  const scActive = pathname.startsWith('/sc')
  const trainerActive = pathname.startsWith('/trainer')
  const supportActive = pathname.startsWith('/tasks')

  return (
    <Dock>
      <NavItem to="/ops"     icon="home"      label="Dashboard"     active={dashActive} />
      <NavItem to="/dm"      icon="store"     label="Retail"        active={retailActive} />
      <NavItem to="/sc"      icon="finance"   label="Supply Chain"  active={scActive} />
      <NavItem to="/trainer" icon="users"     label="Trainer"       active={trainerActive} />
      <NavItem to="/tasks"   icon="checklist" label="Support"       active={supportActive} badgeCount={taskCount} />
    </Dock>
  )
}

export function AuditorBottomNav() {
  const { pathname } = useLocation()
  return (
    <Dock>
      <NavItem to="/dm/stores" icon="store" label="Status Toko" active={pathname.startsWith('/dm/stores')} />
      <NavItem to="/sop"       icon="book"  label="SOP"         active={pathname.startsWith('/sop')} />
    </Dock>
  )
}

export function HRBottomNav() {
  const { pathname } = useLocation()
  const { profile } = useAuth()
  const role = profile?.role

  const showBatch   = ['hr_staff','hr_administrator'].includes(role)
  const showKontrak = ['hr_legal','hr_administrator'].includes(role)

  return (
    <Dock>
      <NavItem to="/hr"          icon="home"      label="Dashboard"  active={pathname === '/hr'} />
      {showBatch && (
        <NavItem to="/hr/batch"  icon="checklist" label="Batch OJE"  active={pathname.startsWith('/hr/batch')} />
      )}
      <NavItem to="/hr/store"    icon="store"     label="Per Toko"   active={pathname.startsWith('/hr/store')} />
      {showKontrak && (
        <NavItem to="/hr/kontrak" icon="approval" label="Kontrak"    active={pathname.startsWith('/hr/kontrak')} />
      )}
    </Dock>
  )
}

export function SmartBottomNav() {
  const { profile } = useAuth()
  const role = profile?.role
  if (isOpsLikeRole(role))       return <OpsBottomNav />
  if (isManagerRole(role))       return <DMBottomNav />
  if (isStoreRole(role))         return <StaffBottomNav />
  if (role === 'trainer')        return <TrainerBottomNav />
  if (isFinanceRole(role))       return <FinanceBottomNav />
  if (role === 'auditor')        return <AuditorBottomNav />
  if (HR_ROLES.includes(role))   return <HRBottomNav />
  return <SCBottomNav />
}
