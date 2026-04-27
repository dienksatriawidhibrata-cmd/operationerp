import React, { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import {
  AUDITOR_ROLES,
  FINANCE_ROLES,
  HR_ROLES,
  KPI_ALLOWED_ROLES,
  KPI_PERSONAL_VIEW_ROLES,
  KPI_PERSONAL_INPUT_ROLES,
  KPI_360_ROLES,
  MANAGER_ROLES,
  OJE_ROLES,
  SC_ROLES,
  STORE_ROLES,
  SUPPLY_CHAIN_VIEW_ROLES,
  SUPPORT_ROLES,
  TASK_ASSIGNEE_ROLES,
  TRAINER_ROLES,
} from './lib/access'

import Login from './pages/Login'

const StaffHome = lazy(() => import('./pages/staff/Home'))
const CeklisHarian = lazy(() => import('./pages/staff/CeklisHarian'))
const LaporanHarian = lazy(() => import('./pages/staff/LaporanHarian'))
const BebanOperasional = lazy(() => import('./pages/staff/BebanOperasional'))
const DMDashboard = lazy(() => import('./pages/dm/Dashboard'))
const DailyVisit = lazy(() => import('./pages/dm/DailyVisit'))
const VisitHub   = lazy(() => import('./pages/dm/VisitHub'))
const ApprovalSetoran = lazy(() => import('./pages/dm/ApprovalSetoran'))
const StoreStatus = lazy(() => import('./pages/dm/StoreStatus'))
const AuditSetoran   = lazy(() => import('./pages/finance/AuditSetoran'))
const FinanceHub     = lazy(() => import('./pages/finance/FinanceHub'))
const OpexOverview   = lazy(() => import('./pages/OpexOverview'))
const KPIHub         = lazy(() => import('./pages/kpi/KPIHub'))
const KPIReport      = lazy(() => import('./pages/kpi/KPIReport'))
const OpsHub          = lazy(() => import('./pages/ops/Hub'))
const OpsVisitStatus  = lazy(() => import('./pages/ops/VisitStatus'))
const OpsVisitMonitor = lazy(() => import('./pages/ops/VisitMonitor'))
const OpsSetoranDetail = lazy(() => import('./pages/ops/SetoranDetail'))
const TasksPage       = lazy(() => import('./pages/tasks/TasksPage'))
const TrainerDashboard = lazy(() => import('./pages/trainer/Dashboard'))
const TrainerStaffBaru = lazy(() => import('./pages/trainer/StaffBaru'))
const TrainerStaffLama = lazy(() => import('./pages/trainer/StaffLama'))
const TrainerOJE       = lazy(() => import('./pages/trainer/OJEPage'))
const SopPage          = lazy(() => import('./pages/SopPage'))
const SCDashboard    = lazy(() => import('./pages/sc/Dashboard'))
const SCNewOrder     = lazy(() => import('./pages/sc/NewOrder'))
const SCOrderDetail  = lazy(() => import('./pages/sc/OrderDetail'))
const SCPicking      = lazy(() => import('./pages/sc/PickingPage'))
const SCQC           = lazy(() => import('./pages/sc/QCPage'))
const SCDistribution = lazy(() => import('./pages/sc/DistributionPage'))
const SCSuratJalan   = lazy(() => import('./pages/sc/SuratJalan'))
const AnnouncementsPage  = lazy(() => import('./pages/ops/Announcements'))
const StaffManagement    = lazy(() => import('./pages/support/StaffManagement'))
const Preparation        = lazy(() => import('./pages/staff/Preparation'))
const KPIPersonalPage    = lazy(() => import('./pages/kpi/KPIPersonalPage'))
const KPIPersonalInput   = lazy(() => import('./pages/kpi/KPIPersonalInputPage'))
const PeerReview360Page  = lazy(() => import('./pages/kpi/PeerReview360Page'))
const KPI360ResultsPage  = lazy(() => import('./pages/kpi/KPI360ResultsPage'))

const HRHub              = lazy(() => import('./pages/hr/Hub'))
const HRBatchOJE         = lazy(() => import('./pages/hr/BatchOJE'))
const HRBatchDetail      = lazy(() => import('./pages/hr/BatchDetail'))
const HRCandidateDetail  = lazy(() => import('./pages/hr/CandidateDetail'))
const HRStoreView        = lazy(() => import('./pages/hr/StoreView'))
const HRKontrakPage      = lazy(() => import('./pages/hr/KontrakPage'))
const HROjtChecklist     = lazy(() => import('./pages/hr/OjtChecklist'))

function RootRedirect() {
  const { user, profile, loading, profileError, signOut } = useAuth()

  if (loading) return <AuthScreen message="Menyiapkan sesi login..." />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <AuthScreen message={profileError || 'Menghubungkan data profil...'} />
  if (profile.is_active === false) return <DeactivatedScreen onSignOut={signOut} />

  const role = profile.role
  if (STORE_ROLES.includes(role)) return <Navigate to="/staff" replace />
  if (AUDITOR_ROLES.includes(role)) return <Navigate to="/dm/stores" replace />
  if (['district_manager', 'area_manager'].includes(role)) return <Navigate to="/dm" replace />
  if (role === 'ops_manager' || SUPPORT_ROLES.includes(role)) return <Navigate to="/ops" replace />
  if (role === 'trainer') return <Navigate to="/trainer" replace />
  if (role === 'finance_supervisor') return <Navigate to="/finance" replace />
  if (HR_ROLES.includes(role)) return <Navigate to="/hr" replace />
  if (role === 'picking_spv') return <Navigate to="/sc/picking" replace />
  if (role === 'qc_spv') return <Navigate to="/sc/qc" replace />
  if (role === 'distribution_spv') return <Navigate to="/sc/distribution" replace />
  if (SC_ROLES.includes(role)) return <Navigate to="/sc" replace />

  return <NoRouteScreen role={role} />
}

function RequireAuth({ children, roles }) {
  const { user, profile, loading, profileError, signOut } = useAuth()

  if (loading) return <AuthScreen message="Menyiapkan sesi login..." />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <AuthScreen message={profileError || 'Menghubungkan data profil...'} />
  if (profile.is_active === false) return <DeactivatedScreen onSignOut={signOut} />
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
        <div className="text-sm font-semibold text-slate-800">Halaman belum tersedia</div>
        <div className="text-xs text-slate-500">
          Role <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{role}</span> belum memiliki halaman yang dikonfigurasi. Hubungi admin.
        </div>
        <button onClick={signOut} className="text-xs text-primary-600 font-semibold underline">Keluar</button>
      </div>
    </div>
  )
}

function DeactivatedScreen({ onSignOut }) {
  return (
    <div className="min-h-screen bg-primary-50 flex items-center justify-center px-6">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-rose-100 p-6 text-center space-y-4">
        <div className="text-4xl">🚫</div>
        <div className="text-sm font-semibold text-slate-800">Akun Dinonaktifkan</div>
        <div className="text-xs text-slate-500">Akun kamu telah dinonaktifkan oleh admin. Hubungi admin untuk informasi lebih lanjut.</div>
        <button onClick={onSignOut} className="btn-primary text-sm">Keluar</button>
      </div>
    </div>
  )
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-primary-50 flex items-center justify-center px-6">
          <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-rose-100 p-6 text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <div className="text-sm font-semibold text-slate-800">Terjadi Kesalahan</div>
            <div className="text-xs text-slate-500">
              Halaman ini mengalami error yang tidak terduga. Coba muat ulang halaman.
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false })
                window.location.reload()
              }}
              className="btn-primary text-sm"
            >
              Muat Ulang
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const ALL_MANAGER = [...MANAGER_ROLES, ...SUPPORT_ROLES]

export default function App() {
  return (
    <ErrorBoundary>
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
        <RequireAuth roles={['head_store', ...ALL_MANAGER]}>
          <LaporanHarian />
        </RequireAuth>
      } />
      <Route path="/staff/opex" element={
        <RequireAuth roles={[...STORE_ROLES, ...ALL_MANAGER]}>
          <BebanOperasional />
        </RequireAuth>
      } />
      <Route path="/staff/preparation" element={
        <RequireAuth roles={STORE_ROLES}>
          <Preparation />
        </RequireAuth>
      } />

      <Route path="/ops" element={
        <RequireAuth roles={['ops_manager', ...SUPPORT_ROLES]}>
          <OpsHub />
        </RequireAuth>
      } />
      <Route path="/ops/visits" element={
        <RequireAuth roles={['ops_manager', 'area_manager', ...SUPPORT_ROLES]}>
          <OpsVisitStatus />
        </RequireAuth>
      } />
      <Route path="/ops/visit-monitor" element={
        <RequireAuth roles={['ops_manager', ...SUPPORT_ROLES]}>
          <OpsVisitMonitor />
        </RequireAuth>
      } />

      <Route path="/dm" element={
        <RequireAuth roles={ALL_MANAGER}>
          <DMDashboard />
        </RequireAuth>
      } />
      <Route path="/dm/visits" element={
        <RequireAuth roles={ALL_MANAGER}>
          <VisitHub />
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
      <Route path="/dm/stores" element={
        <RequireAuth roles={[...ALL_MANAGER, ...AUDITOR_ROLES]}>
          <StoreStatus />
        </RequireAuth>
      } />

      <Route path="/finance" element={
        <RequireAuth roles={[...FINANCE_ROLES, 'ops_manager', ...SUPPORT_ROLES]}>
          <FinanceHub />
        </RequireAuth>
      } />
      <Route path="/dm/laporan" element={
        <RequireAuth roles={ALL_MANAGER}>
          <FinanceHub pageTitle="Laporan Harian" pageEyebrow="Retail Monitoring" showAuditAction={false} />
        </RequireAuth>
      } />
      <Route path="/ops/laporan" element={
        <RequireAuth roles={['ops_manager', ...SUPPORT_ROLES]}>
          <FinanceHub pageTitle="Laporan Harian" pageEyebrow="Ops Monitoring" showAuditAction={false} />
        </RequireAuth>
      } />
      <Route path="/ops/setoran" element={
        <RequireAuth roles={['ops_manager', ...SUPPORT_ROLES]}>
          <OpsSetoranDetail />
        </RequireAuth>
      } />
      <Route path="/finance/audit" element={
        <RequireAuth roles={[...FINANCE_ROLES, 'ops_manager', ...SUPPORT_ROLES]}>
          <AuditSetoran />
        </RequireAuth>
      } />

      <Route path="/opex" element={
        <RequireAuth roles={[...FINANCE_ROLES, ...MANAGER_ROLES, ...SUPPORT_ROLES]}>
          <OpexOverview />
        </RequireAuth>
      } />

      <Route path="/kpi" element={
        <RequireAuth roles={KPI_ALLOWED_ROLES}>
          <KPIHub />
        </RequireAuth>
      } />
      <Route path="/kpi/store" element={
        <RequireAuth roles={KPI_ALLOWED_ROLES}>
          <KPIReport />
        </RequireAuth>
      } />
      <Route path="/kpi/personal" element={
        <RequireAuth roles={KPI_PERSONAL_VIEW_ROLES}>
          <KPIPersonalPage />
        </RequireAuth>
      } />
      <Route path="/kpi/personal/input" element={
        <RequireAuth roles={KPI_PERSONAL_INPUT_ROLES}>
          <KPIPersonalInput />
        </RequireAuth>
      } />
      <Route path="/kpi/360" element={
        <RequireAuth roles={KPI_360_ROLES}>
          <PeerReview360Page />
        </RequireAuth>
      } />
      <Route path="/kpi/360/results" element={
        <RequireAuth roles={KPI_ALLOWED_ROLES}>
          <KPI360ResultsPage />
        </RequireAuth>
      } />

      <Route path="/tasks" element={
        <RequireAuth roles={[...MANAGER_ROLES, ...SUPPORT_ROLES, ...TASK_ASSIGNEE_ROLES]}>
          <TasksPage />
        </RequireAuth>
      } />

      <Route path="/sop" element={
        <RequireAuth roles={[...STORE_ROLES, ...MANAGER_ROLES, ...SUPPORT_ROLES, ...TRAINER_ROLES, ...SC_ROLES]}>
          <SopPage category="umum" />
        </RequireAuth>
      } />
      <Route path="/sop/produk" element={
        <RequireAuth roles={[...STORE_ROLES, ...MANAGER_ROLES, ...SUPPORT_ROLES, ...TRAINER_ROLES, ...SC_ROLES]}>
          <SopPage category="produk" />
        </RequireAuth>
      } />

      <Route path="/support/staff" element={
        <RequireAuth roles={['ops_manager', ...SUPPORT_ROLES]}>
          <StaffManagement />
        </RequireAuth>
      } />

      <Route path="/ops/pengumuman" element={
        <RequireAuth roles={['ops_manager', 'support_spv']}>
          <AnnouncementsPage />
        </RequireAuth>
      } />

      {/* ── HR Recruitment ── */}
      <Route path="/hr" element={
        <RequireAuth roles={[...HR_ROLES, 'ops_manager']}>
          <HRHub />
        </RequireAuth>
      } />
      <Route path="/hr/batch" element={
        <RequireAuth roles={['hr_staff', 'hr_administrator', 'ops_manager']}>
          <HRBatchOJE />
        </RequireAuth>
      } />
      <Route path="/hr/batch/:id" element={
        <RequireAuth roles={[...HR_ROLES, 'head_store', 'district_manager', 'ops_manager']}>
          <HRBatchDetail />
        </RequireAuth>
      } />
      <Route path="/hr/candidates/:id" element={
        <RequireAuth roles={[...HR_ROLES, 'head_store', 'district_manager', 'trainer', 'ops_manager']}>
          <HRCandidateDetail />
        </RequireAuth>
      } />
      <Route path="/hr/store" element={
        <RequireAuth roles={['head_store', 'district_manager', ...HR_ROLES, 'ops_manager']}>
          <HRStoreView />
        </RequireAuth>
      } />
      <Route path="/hr/kontrak" element={
        <RequireAuth roles={['hr_legal', 'hr_administrator', 'ops_manager']}>
          <HRKontrakPage />
        </RequireAuth>
      } />
      <Route path="/hr/candidates/:id/ojt" element={
        <RequireAuth roles={[...HR_ROLES, 'head_store', 'district_manager', 'trainer', 'ops_manager',
                             'staff', 'barista', 'kitchen', 'waitress', 'asst_head_store']}>
          <HROjtChecklist />
        </RequireAuth>
      } />

      {/* ── Trainer ── */}
      <Route path="/trainer" element={
        <RequireAuth roles={TRAINER_ROLES}>
          <TrainerDashboard />
        </RequireAuth>
      } />
      <Route path="/trainer/staff-baru" element={
        <RequireAuth roles={TRAINER_ROLES}>
          <TrainerStaffBaru />
        </RequireAuth>
      } />
      <Route path="/trainer/staff-lama" element={
        <RequireAuth roles={TRAINER_ROLES}>
          <TrainerStaffLama />
        </RequireAuth>
      } />
      <Route path="/trainer/oje" element={
        <RequireAuth roles={OJE_ROLES}>
          <TrainerOJE />
        </RequireAuth>
      } />

      {/* ── Supply Chain ── */}
      <Route path="/sc" element={
        <RequireAuth roles={SUPPLY_CHAIN_VIEW_ROLES}>
          <SCDashboard />
        </RequireAuth>
      } />
      <Route path="/sc/orders/new" element={
        <RequireAuth roles={['warehouse_admin','purchasing_admin','ops_manager','sc_supervisor',...SUPPORT_ROLES]}>
          <SCNewOrder />
        </RequireAuth>
      } />
      <Route path="/sc/orders/:id" element={
        <RequireAuth roles={SUPPLY_CHAIN_VIEW_ROLES}>
          <SCOrderDetail />
        </RequireAuth>
      } />
      <Route path="/sc/picking" element={
        <RequireAuth roles={['picking_spv','warehouse_admin','warehouse_spv','ops_manager','sc_supervisor',...SUPPORT_ROLES]}>
          <SCPicking />
        </RequireAuth>
      } />
      <Route path="/sc/qc" element={
        <RequireAuth roles={['qc_spv','warehouse_admin','warehouse_spv','ops_manager','sc_supervisor',...SUPPORT_ROLES]}>
          <SCQC />
        </RequireAuth>
      } />
      <Route path="/sc/distribution" element={
        <RequireAuth roles={['distribution_spv','warehouse_admin','warehouse_spv','ops_manager','sc_supervisor',...SUPPORT_ROLES]}>
          <SCDistribution />
        </RequireAuth>
      } />
      <Route path="/sc/sj" element={
        <RequireAuth roles={SUPPLY_CHAIN_VIEW_ROLES}>
          <SCSuratJalan />
        </RequireAuth>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ErrorBoundary>
  )
}
