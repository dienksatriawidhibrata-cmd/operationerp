import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

import Login from './pages/Login'
import StaffHome from './pages/staff/Home'
import CeklisHarian from './pages/staff/CeklisHarian'
import LaporanHarian from './pages/staff/LaporanHarian'
import BebanOperasional from './pages/staff/BebanOperasional'
import DMDashboard from './pages/dm/Dashboard'
import DailyVisit from './pages/dm/DailyVisit'
import ApprovalSetoran from './pages/dm/ApprovalSetoran'
import AuditSetoran from './pages/finance/AuditSetoran'

function RootRedirect() {
  const { user, profile, loading, profileError } = useAuth()

  if (loading) return <AuthScreen message="Menyiapkan sesi login..." />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <AuthScreen message={profileError || 'Menghubungkan data profil...'} />

  const role = profile.role
  if (['staff', 'asst_head_store', 'head_store'].includes(role)) return <Navigate to="/staff" replace />
  if (['district_manager', 'area_manager', 'ops_manager'].includes(role)) return <Navigate to="/dm" replace />
  if (role === 'finance_supervisor') return <Navigate to="/finance" replace />

  return <Navigate to="/login" replace />
}

function RequireAuth({ children, roles }) {
  const { user, profile, loading, profileError } = useAuth()

  if (loading) return <AuthScreen message="Menyiapkan sesi login..." />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <AuthScreen message={profileError || 'Menghubungkan data profil...'} />
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />

  return children
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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
