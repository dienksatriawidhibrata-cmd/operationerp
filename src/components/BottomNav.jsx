import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AppIcon } from './ui/AppKit'

function NavItem({ to, icon, label, active }) {
  return (
    <Link
      to={to}
      className={`group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2.5 transition-all ${
        active
          ? 'bg-white text-primary-700 shadow-[0_16px_32px_-24px_rgba(37,99,235,0.85)]'
          : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-2xl transition-colors ${
          active ? 'bg-primary-50 text-primary-700' : 'bg-transparent'
        }`}
      >
        <AppIcon name={icon} size={18} />
      </div>
      <span className="truncate text-[10px] font-semibold tracking-[0.16em] uppercase">{label}</span>
    </Link>
  )
}

function Dock({ children }) {
  return (
    <nav className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="flex w-full max-w-[520px] items-center gap-1 rounded-[28px] border border-white/80 bg-white/88 p-2 shadow-[0_26px_70px_-40px_rgba(15,23,42,0.55)] backdrop-blur-xl">
        {children}
      </div>
    </nav>
  )
}

export function StaffBottomNav() {
  const { pathname } = useLocation()

  return (
    <Dock>
      <NavItem to="/staff" icon="home" label="Beranda" active={pathname === '/staff'} />
      <NavItem to="/staff/ceklis" icon="checklist" label="Ceklis" active={pathname.startsWith('/staff/ceklis')} />
      <NavItem to="/staff/laporan" icon="chart" label="Laporan" active={pathname.startsWith('/staff/laporan')} />
      <NavItem to="/staff/opex" icon="opex" label="Opex" active={pathname.startsWith('/staff/opex')} />
    </Dock>
  )
}

export function DMBottomNav() {
  const { pathname } = useLocation()
  const { profile } = useAuth()

  return (
    <Dock>
      <NavItem to="/dm" icon="home" label="Dashboard" active={pathname === '/dm'} />
      <NavItem to="/dm/visit" icon="map" label="Visit" active={pathname.startsWith('/dm/visit')} />
      <NavItem to="/dm/approval" icon="approval" label="Approval" active={pathname.startsWith('/dm/approval')} />
      {profile?.role === 'ops_manager' && (
        <NavItem to="/opex" icon="opex" label="Opex" active={pathname.startsWith('/opex')} />
      )}
      {profile?.role === 'ops_manager' && (
        <NavItem to="/finance" icon="finance" label="Finance" active={pathname.startsWith('/finance')} />
      )}
      {profile?.email === 'dksatriaw@gmail.com' && (
        <NavItem to="/kpi" icon="chart" label="KPI" active={pathname.startsWith('/kpi')} />
      )}
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
