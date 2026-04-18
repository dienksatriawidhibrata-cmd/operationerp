import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AppIcon } from './ui/AppKit'

function NavItem({ to, icon, label, active }) {
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
        className={`flex h-8 w-8 items-center justify-center rounded-2xl transition-colors sm:h-9 sm:w-9 ${
          active ? 'bg-primary-50 text-primary-700' : 'bg-transparent'
        }`}
      >
        <AppIcon name={icon} size={17} />
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

export function StaffBottomNav() {
  const { pathname } = useLocation()

  return (
    <Dock>
      <NavItem to="/staff/ceklis" icon="checklist" label="Ceklis" active={pathname.startsWith('/staff/ceklis')} />
      <NavItem to="/sc/sj" icon="finance" label="Terima Barang" active={pathname.startsWith('/sc')} />
      <NavItem to="/kpi" icon="chart" label="KPI" active={pathname.startsWith('/kpi')} />
    </Dock>
  )
}

export function DMBottomNav() {
  const { pathname } = useLocation()

  return (
    <Dock>
      <NavItem to="/dm" icon="home" label="Dashboard" active={pathname === '/dm'} />
      <NavItem to="/dm/stores" icon="checklist" label="Toko" active={pathname.startsWith('/dm/stores')} />
      <NavItem to="/dm/visits" icon="map" label="Visit" active={pathname.startsWith('/dm/visit') || pathname.startsWith('/ops/visits')} />
      <NavItem to="/dm/approval" icon="approval" label="Approval" active={pathname.startsWith('/dm/approval')} />
      <NavItem to="/kpi" icon="chart" label="KPI" active={pathname.startsWith('/kpi')} />
    </Dock>
  )
}

export function SCBottomNav() {
  const { pathname } = useLocation()
  const { profile }  = useAuth()

  const role = profile?.role
  const isWarehouse  = ['warehouse_admin','warehouse_spv','sc_supervisor','ops_manager','purchasing_admin'].includes(role)
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
    </Dock>
  )
}

export function TrainerBottomNav() {
  const { pathname } = useLocation()

  return (
    <Dock>
      <NavItem to="/trainer"            icon="home"     label="Dashboard" active={pathname === '/trainer'} />
      <NavItem to="/trainer/staff-baru" icon="users"    label="Staff Baru" active={pathname.startsWith('/trainer/staff-baru')} />
      <NavItem to="/trainer/staff-lama" icon="matrix"   label="Staff Lama" active={pathname.startsWith('/trainer/staff-lama')} />
    </Dock>
  )
}

export function FinanceBottomNav() {
  const { pathname } = useLocation()

  return (
    <Dock>
      <NavItem to="/finance" icon="finance" label="Audit" active={pathname === '/finance'} />
      <NavItem to="/opex" icon="opex" label="Opex" active={pathname.startsWith('/opex')} />
    </Dock>
  )
}

export function OpsBottomNav() {
  const { pathname } = useLocation()

  const tokoActive = (pathname === '/ops' || pathname.startsWith('/dm/approval')) && !pathname.startsWith('/ops/visits')
  const statusActive = pathname.startsWith('/dm/stores')
  const visitActive = pathname.startsWith('/ops/visits')
  const scActive = pathname.startsWith('/sc')
  const perfActive = pathname.startsWith('/kpi') || pathname.startsWith('/opex')

  return (
    <Dock>
      <NavItem to="/ops" icon="home" label="Hub" active={tokoActive} />
      <NavItem to="/dm/stores" icon="checklist" label="Status" active={statusActive} />
      <NavItem to="/ops/visits" icon="map" label="Visit" active={visitActive} />
      <NavItem to="/sc" icon="checklist" label="Supply Chain" active={scActive} />
      <NavItem to="/kpi" icon="chart" label="KPI" active={perfActive} />
    </Dock>
  )
}
