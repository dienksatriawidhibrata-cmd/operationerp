import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

import Login from './pages/Login'

const StaffHome = lazy(() => import('./pages/staff/Home'))
const CeklisHarian = lazy(() => import('./pages/staff/CeklisHarian'))
const LaporanHarian = lazy(() => import('./pages/staff/LaporanHarian'))
const BebanOperasional = lazy(() => import('./pages/staff/BebanOperasional'))
const DMDashboard = lazy(() => import('./pages/dm/Dashboard'))
const DailyVisit = lazy(() => import('./pages/dm/DailyVisit'))
const ApprovalSetoran = lazy(() => import('./pages/dm/ApprovalSetoran'))
const AuditSetoran   = lazy(() => import('./pages/finance/AuditSetoran'))
const OpexOverview  = lazy(() => import('./pages/OpexOverview'))
const KPIReport     = lazy(() => import('./pages/kpi/KPIReport'))

function RootRedirect() {
  const { user, profile, loading, profileError } = useAuth()

  if (loading && !user) return <AuthScreen message="Menyiapkan sesi login..." />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <AuthScreen message={profileError || 'Menghubungkan data profil...'} />

  const role = profile.role
  if (['staff', 'asst_head_store', 'head_store'].includes(role)) return <Navigate to="/staff" replace />
  if (['district_manager', 'area_manager', 'ops_manager'].includes(role)) return <Navigate to="/dm" replace />
  if (role === 'finance_supervisor') return <Navigate to="/finance" replace />

  return <NoRouteScreen role={role} />
}

function RequireAuth({ children, roles }) {
  const { user, profile, loading, profileError } = useAuth()

  if (loading && (!user || !profile)) return <AuthScreen message="Menyiapkan sesi login..." />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <AuthScreen message={profileError || 'Menghubungkan data profil...'} />
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />

  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

function AuthScreen({ message }) {
  return (
    <div className="min-h-screen bg-primary-50 flex items-center justify-center px-6">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-primary-100 p-6 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
        <div className="text-sm font-semibold text-gray-800">Sesi masih aktif</div>
        <div className="text-xs text-gray-500 mt-2">{message}</div>
      </div>
    </div>
  )
}

function PageLoader() {
  return (
    <div className="min-h-screen bg-primary-50 flex items-center justify-center px-6">
      <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
    </div>
  )
}

function NoRouteScreen({ role }) {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen bg-primary-50 flex items-center justify-center px-6">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-primary-100 p-6 text-center space-y-4">
        <div className="text-4xl">🔒</div>
        <div className="text-sm font-semibold text-gray-800">Halaman belum tersedia</div>
        <div className="text-xs text-gray-500">
          Role <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{role}</span> belum memiliki halaman yang dikonfigurasi. Hubungi admin.
        </div>
        <button onClick={signOut} className="text-xs text-primary-600 font-semibold underline">
          Keluar
        </button>
      </div>
    </div>
  )
}

const STORE_ROLES   = ['staff', 'asst_head_store', 'head_store']
const MANAGER_ROLES = ['district_manager', 'area_manager', 'ops_manager']
const FINANCE_ROLES = ['finance_supervisor']
const ALL_MANAGER   = [...MANAGER_ROLES, 'ops_manager']

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />

      <Route path="/staff" element={
        <RequireAuth roles={[...STORE_ROLES, ...ALL_MANAGER, ...FINANCE_ROLES]}>
          <StaffHome />
        </RequireAuth>
      } />
      <Route path="/staff/ceklis" element={
        <RequireAuth roles={STORE_ROLES}>
          <CeklisHarian />
        </RequireAuth>
      } />
      <Route path="/staff/laporan" element={
        <RequireAuth roles={[...STORE_ROLES, ...ALL_MANAGER]}>
          <LaporanHarian />
        </RequireAuth>
      } />
      <Route path="/staff/opex" element={
        <RequireAuth roles={[...STORE_ROLES, ...ALL_MANAGER]}>
          <BebanOperasional />
        </RequireAuth>
      } />

      <Route path="/dm" element={
        <RequireAuth roles={ALL_MANAGER}>
          <DMDashboard />
        </RequireAuth>
      } />
      <Route path="/dm/visit" element={
        <RequireAuth roles={ALL_MANAGER}>
          <DailyVisit />
        </RequireAuth>
      } />
      <Route path="/dm/approval" element={
        <RequireAuth roles={ALL_MANAGER}>
          <ApprovalSetoran />
        </RequireAuth>
      } />

      <Route path="/finance" element={
        <RequireAuth roles={[...FINANCE_ROLES, 'ops_manager']}>
          <AuditSetoran />
        </RequireAuth>
      } />

      <Route path="/opex" element={
        <RequireAuth roles={[...FINANCE_ROLES, 'ops_manager']}>
          <OpexOverview />
        </RequireAuth>
      } />

      <Route path="/kpi" element={
        <RequireAuth roles={[...ALL_MANAGER, ...FINANCE_ROLES]}>
          <KPIReport />
        </RequireAuth>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
