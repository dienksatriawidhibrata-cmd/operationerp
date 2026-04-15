import { Link, useLocation } from 'react-router-dom'

function NavItem({ to, icon, label, active }) {
  return (
    <Link
      to={to}
      className={`flex-1 flex flex-col items-center gap-1 py-2 transition-colors
        ${active ? 'text-primary-600' : 'text-gray-400'}`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[9px] font-semibold tracking-wide">{label}</span>
    </Link>
  )
}

export function StaffBottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 flex shadow-lg z-20">
      <NavItem to="/staff"        icon="🏠" label="Beranda"  active={pathname === '/staff'} />
      <NavItem to="/staff/ceklis" icon="✅" label="Ceklis"   active={pathname.startsWith('/staff/ceklis')} />
      <NavItem to="/staff/laporan" icon="📊" label="Laporan" active={pathname.startsWith('/staff/laporan')} />
      <NavItem to="/staff/opex"   icon="🧾" label="Opex"    active={pathname.startsWith('/staff/opex')} />
    </nav>
  )
}

export function DMBottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 flex shadow-lg z-20">
      <NavItem to="/dm"          icon="🏠" label="Dashboard" active={pathname === '/dm'} />
      <NavItem to="/dm/visit"    icon="🏪" label="Visit"     active={pathname.startsWith('/dm/visit')} />
      <NavItem to="/dm/approval" icon="✅" label="Approval"  active={pathname.startsWith('/dm/approval')} />
      <NavItem to="/finance"     icon="💰" label="Finance"   active={pathname.startsWith('/finance')} />
    </nav>
  )
}

export function FinanceBottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 flex shadow-lg z-20">
      <NavItem to="/finance" icon="💰" label="Audit Setoran" active={pathname === '/finance'} />
    </nav>
  )
}
