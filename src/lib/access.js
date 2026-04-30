export const STORE_ROLES = ['staff', 'barista', 'kitchen', 'waitress', 'asst_head_store', 'head_store']
export const AUDITOR_ROLES = ['auditor']
export const MANAGER_ROLES = ['district_manager', 'area_manager', 'ops_manager']
export const SUPPORT_ROLES = ['support_spv', 'support_admin']
export const SUPPORT_PEOPLE_ROLES = ['support_spv']
export const SUPPORT_FINANCE_ROLES = ['support_admin']
export const SUPER_ADMIN_ROLES = ['super_administrator']
export const FINANCE_ROLES = ['finance_supervisor']
export const SC_ROLES = ['purchasing_admin', 'warehouse_admin', 'picking_spv', 'qc_spv', 'distribution_spv', 'warehouse_spv', 'sc_supervisor']
export const TRAINER_ROLES = ['trainer', 'ops_manager', ...SUPPORT_PEOPLE_ROLES]
export const OJE_ROLES = ['trainer', 'ops_manager', ...SUPPORT_PEOPLE_ROLES, 'head_store', 'district_manager', 'area_manager']
export const HR_ROLES = ['hr_staff', 'hr_spv', 'hr_legal', 'hr_administrator']

export const KPI_ALLOWED_ROLES = [...STORE_ROLES, ...MANAGER_ROLES, ...SUPPORT_PEOPLE_ROLES]
export const KPI_PERSONAL_VIEW_ROLES = [...STORE_ROLES, ...MANAGER_ROLES, ...SUPPORT_PEOPLE_ROLES, 'trainer']
export const KPI_PERSONAL_INPUT_ROLES = ['head_store', 'district_manager', 'area_manager', 'ops_manager', 'support_spv']
export const KPI_360_ROLES = [...STORE_ROLES, 'district_manager', 'area_manager']
export const TASK_ASSIGNEE_ROLES = ['trainer', 'head_store', 'asst_head_store']
export const SUPPLY_CHAIN_VIEW_ROLES = [...STORE_ROLES, ...MANAGER_ROLES, ...SUPPORT_ROLES, ...SC_ROLES]
export const SUPPLY_CHAIN_ORDER_WRITE_ROLES = ['warehouse_admin', 'warehouse_spv', 'purchasing_admin', 'ops_manager', 'sc_supervisor', ...SUPPORT_ROLES]
export const SURAT_JALAN_ISSUE_ROLES = ['warehouse_admin', 'warehouse_spv', 'ops_manager', 'sc_supervisor', ...SUPPORT_ROLES]
export const SURAT_JALAN_SHIP_ROLES = ['warehouse_admin', 'warehouse_spv', 'distribution_spv', 'ops_manager', 'sc_supervisor', ...SUPPORT_ROLES]
export const KPI_PERSONAL_STORE_TARGET_ROLES = ['staff', 'barista', 'kitchen', 'waitress', 'asst_head_store']
export const KPI_PERSONAL_MANAGER_TARGET_ROLES = ['head_store', 'district_manager']
export const KPI_PERSONAL_TARGET_ROLES = [...KPI_PERSONAL_STORE_TARGET_ROLES, ...KPI_PERSONAL_MANAGER_TARGET_ROLES]

export function isStoreRole(role) {
  return STORE_ROLES.includes(role)
}

export function isManagerRole(role) {
  return MANAGER_ROLES.includes(role)
}

export function isSupportRole(role) {
  return SUPPORT_ROLES.includes(role)
}

export function isSupportPeopleRole(role) {
  return SUPPORT_PEOPLE_ROLES.includes(role)
}

export function isSupportFinanceRole(role) {
  return SUPPORT_FINANCE_ROLES.includes(role)
}

export function isOpsLikeRole(role) {
  return role === 'ops_manager' || SUPPORT_ROLES.includes(role)
}

export function isFinanceRole(role) {
  return FINANCE_ROLES.includes(role)
}

export function isSupplyChainRole(role) {
  return SC_ROLES.includes(role)
}

export function canViewKPI(role) {
  return KPI_ALLOWED_ROLES.includes(role)
}

export function getKpiVerificationRole(targetRole) {
  if (KPI_PERSONAL_STORE_TARGET_ROLES.includes(targetRole)) return 'district_manager'
  if (targetRole === 'head_store') return 'area_manager'
  if (targetRole === 'district_manager') return 'ops_manager'
  return null
}

export function canEvaluateKpiTarget(evaluatorRole, targetRole, options = {}) {
  const hasAreaManager = options.hasAreaManager !== false

  if (KPI_PERSONAL_STORE_TARGET_ROLES.includes(targetRole)) {
    return evaluatorRole === 'head_store'
  }

  if (targetRole === 'head_store') {
    return evaluatorRole === 'district_manager' || evaluatorRole === 'support_spv'
  }

  if (targetRole === 'district_manager') {
    if (evaluatorRole === 'support_spv') return true
    if (hasAreaManager) return evaluatorRole === 'area_manager'
    return evaluatorRole === 'ops_manager'
  }

  return false
}

export function canVerifyKpiTarget(verifierRole, targetRole) {
  const expectedRole = getKpiVerificationRole(targetRole)
  return verifierRole === expectedRole
}

export function canViewSupplyChain(role) {
  return SUPPLY_CHAIN_VIEW_ROLES.includes(role)
}

export function canCreateSupplyOrder(role) {
  return SUPPLY_CHAIN_ORDER_WRITE_ROLES.includes(role)
}

export function canIssueSuratJalan(role) {
  return SURAT_JALAN_ISSUE_ROLES.includes(role)
}

export function canMarkSuratJalanShipped(role) {
  return SURAT_JALAN_SHIP_ROLES.includes(role)
}

export function canMarkSuratJalanDelivered(role) {
  return isStoreRole(role) || canMarkSuratJalanShipped(role)
}

export function canAccessTasks(role) {
  return MANAGER_ROLES.includes(role) || SUPPORT_ROLES.includes(role) || TASK_ASSIGNEE_ROLES.includes(role)
}

export function normalizeStoreName(name = '') {
  return String(name)
    .replace(/^Bagi Kopi\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function getScopedBranches(branches = [], profile) {
  if (!profile?.role) return []

  if (isStoreRole(profile.role)) {
    return branches.filter((branch) => branch.id === profile.branch_id)
  }

  if (profile.role === 'district_manager') {
    const districts = new Set(profile.managed_districts || [])
    return branches.filter((branch) => districts.has(branch.district))
  }

  if (profile.role === 'area_manager') {
    const areas = new Set(profile.managed_areas || [])
    return branches.filter((branch) => areas.has(branch.area))
  }

  if (isOpsLikeRole(profile.role) || isSupplyChainRole(profile.role)) {
    return branches
  }

  return []
}

export function getScopeLabel(profile, branches = []) {
  if (!profile?.role) return '-'

  if (isStoreRole(profile.role)) {
    return branches[0]?.name || profile.branch?.name || 'Toko sendiri'
  }

  if (profile.role === 'district_manager') {
    return `District ${(profile.managed_districts || []).join(', ') || '-'}`
  }

  if (profile.role === 'area_manager') {
    return `Area ${(profile.managed_areas || []).join(', ') || '-'}`
  }

  if (isOpsLikeRole(profile.role)) {
    return `${branches.length} toko aktif`
  }

  if (isSupplyChainRole(profile.role)) {
    return 'Supply Chain'
  }

  if (isFinanceRole(profile.role)) {
    return 'Finance'
  }

  return profile.role
}
