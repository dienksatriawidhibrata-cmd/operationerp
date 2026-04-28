import { roleLabel } from './utils'

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

export const EMPTY_LEADERBOARDS = {
  staffTop: [], staffBottom: [],
  storesTop: [], storesBottom: [],
  headStoresTop: [], headStoresBottom: [],
  staffAll: [], headStoresAll: [], storesAll: [],
}

export async function fetchOperationalLeaderboards({ supabase, period, today, branchIds = [] }) {
  const rpcResult = await fetchOperationalLeaderboardsViaRpc({ supabase, period, today })
  if (rpcResult) return rpcResult

  return fetchOperationalLeaderboardsLegacy({ supabase, period, today, branchIds })
}

async function fetchOperationalLeaderboardsViaRpc({ supabase, period, today }) {
  const { data, error } = await supabase.rpc('get_operational_leaderboards', {
    p_period: period,
    p_today: today,
  })

  if (error) {
    const message = String(error.message || '')
    const details = String(error.details || '')
    const missingRpc = message.includes('get_operational_leaderboards') || details.includes('get_operational_leaderboards')
    const missingRelation = message.includes('does not exist') || details.includes('does not exist')

    if (missingRpc || missingRelation) return null
    throw new Error(error.message || 'Gagal memuat leaderboard operasional.')
  }

  return normalizeLeaderboards(data)
}

function normalizeLeaderboards(data) {
  if (!data || typeof data !== 'object') return EMPTY_LEADERBOARDS

  return {
    staffTop: Array.isArray(data.staffTop) ? data.staffTop : [],
    staffBottom: Array.isArray(data.staffBottom) ? data.staffBottom : [],
    storesTop: Array.isArray(data.storesTop) ? data.storesTop : [],
    storesBottom: Array.isArray(data.storesBottom) ? data.storesBottom : [],
    headStoresTop: Array.isArray(data.headStoresTop) ? data.headStoresTop : [],
    headStoresBottom: Array.isArray(data.headStoresBottom) ? data.headStoresBottom : [],
    staffAll: Array.isArray(data.staffAll) ? data.staffAll : [],
    headStoresAll: Array.isArray(data.headStoresAll) ? data.headStoresAll : [],
    storesAll: Array.isArray(data.storesAll) ? data.storesAll : [],
  }
}

async function fetchOperationalLeaderboardsLegacy({ supabase, period, today, branchIds = [] }) {
  const { startDate, endDate, daysInMonth } = getPeriodBounds(period)
  const elapsedDays = getElapsedDaysInPeriod(period, today, daysInMonth)
  const expectedChecklistDays = elapsedDays * 3
  const expectedPreparationDays = elapsedDays * 3
  const expectedHeadStoreReportDays = Math.max(elapsedDays - 1, 0)
  const expectedHeadStoreDepositDays = Math.max(elapsedDays - 1, 0)
  const expectedHeadStoreOpexDays = elapsedDays

  let branchQuery = supabase
    .from('branches')
    .select('id, name, store_id')
    .eq('is_active', true)
    .order('name')

  if (branchIds.length > 0) {
    branchQuery = branchQuery.in('id', branchIds)
  }

  const branchesRes = await branchQuery
  if (branchesRes.error) throw new Error(branchesRes.error.message || 'Gagal memuat scope leaderboard.')

  const branches = branchesRes.data || []
  const scopedBranchIds = branches.map((branch) => branch.id)
  if (!scopedBranchIds.length) {
    return EMPTY_LEADERBOARDS
  }

  const [
    storeProfilesRes,
    headStoresRes,
    checklistsRes,
    preparationRes,
    reportsRes,
    depositsRes,
    opexRes,
  ] = await Promise.all([
    supabase.from('profiles')
      .select('id, full_name, role, branch_id')
      .eq('is_active', true)
      .in('role', ['staff', 'barista', 'kitchen', 'waitress', 'asst_head_store'])
      .in('branch_id', scopedBranchIds)
      .order('full_name'),
    supabase.from('profiles')
      .select('id, full_name, branch_id')
      .eq('is_active', true)
      .eq('role', 'head_store')
      .in('branch_id', scopedBranchIds)
      .order('full_name'),
    supabase.from('daily_checklists')
      .select('branch_id, submitted_by, is_late')
      .in('branch_id', scopedBranchIds)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate),
    supabase.from('daily_preparation')
      .select('branch_id, shift, tanggal, created_at, updated_at')
      .in('branch_id', scopedBranchIds)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate),
    supabase.from('daily_reports')
      .select('branch_id, submitted_by, tanggal, submitted_at')
      .in('branch_id', scopedBranchIds)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate),
    supabase.from('daily_deposits')
      .select('branch_id, submitted_by, tanggal, submitted_at')
      .in('branch_id', scopedBranchIds)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate),
    supabase.from('operational_expenses')
      .select('branch_id, submitted_by, tanggal, created_at')
      .in('branch_id', scopedBranchIds)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate),
  ])

  const error = [
    storeProfilesRes.error,
    headStoresRes.error,
    checklistsRes.error,
    preparationRes.error,
    reportsRes.error,
    depositsRes.error,
    opexRes.error,
  ].find(Boolean)
  if (error) throw new Error(error.message || 'Gagal memuat leaderboard operasional.')

  const branchMap = Object.fromEntries(branches.map((branch) => [branch.id, branch]))
  const storeProfiles = storeProfilesRes.data || []
  const headStores = headStoresRes.data || []

  const staffBase = Object.fromEntries(
    storeProfiles.map((person) => [
      person.id,
      {
        id: person.id,
        name: person.full_name,
        role: person.role,
        branchId: person.branch_id,
        checklistCount: 0,
        checklistOnTime: 0,
      },
    ]),
  )

  const storeBase = Object.fromEntries(
    branches.map((branch) => [
      branch.id,
      {
        id: branch.id,
        name: branch.name?.replace(/^Bagi Kopi\s+/i, '') || '-',
        storeId: branch.store_id || '-',
        checklistCount: 0,
        checklistOnTime: 0,
        preparationCount: 0,
        preparationOnTime: 0,
      },
    ]),
  )

  ;(checklistsRes.data || []).forEach((row) => {
    const current = storeBase[row.branch_id]
    if (current) {
      current.checklistCount += 1
      if (!row.is_late) current.checklistOnTime += 1
    }

    const staff = staffBase[row.submitted_by]
    if (staff) {
      staff.checklistCount += 1
      if (!row.is_late) staff.checklistOnTime += 1
    }
  })

  ;(preparationRes.data || []).forEach((row) => {
    const current = storeBase[row.branch_id]
    if (!current) return
    current.preparationCount += 1
    if (isPreparationOnTime(row)) current.preparationOnTime += 1
  })

  const storeRows = Object.values(storeBase).map((row) => {
    const completionPct = pct(row.checklistCount + row.preparationCount, expectedChecklistDays + expectedPreparationDays)
    const onTimePct = pct(row.checklistOnTime + row.preparationOnTime, expectedChecklistDays + expectedPreparationDays)
    const score = weightedScore(completionPct, onTimePct)

    return {
      id: row.id,
      title: row.name,
      subtitle: `${row.storeId} · Ceklis ${row.checklistCount}/${expectedChecklistDays} · Prep ${row.preparationCount}/${expectedPreparationDays}`,
      score,
      metrics: `On time ${onTimePct}%`,
      note: `${row.checklistOnTime}/${row.checklistCount || 0} ceklis · ${row.preparationOnTime}/${row.preparationCount || 0} prep tepat waktu`,
    }
  })

  const staffRows = Object.values(staffBase).map((row) => {
    const branch = branchMap[row.branchId] || null
    const completionPct = pct(row.checklistCount, expectedChecklistDays)
    const onTimePct = pct(row.checklistOnTime, expectedChecklistDays)
    const score = weightedScore(completionPct, onTimePct)

    return {
      id: row.id,
      title: row.name,
      subtitle: `${roleLabel(row.role)} · ${branch?.store_id || '-'} · ${branch?.name?.replace(/^Bagi Kopi\s+/i, '') || '-'}`,
      score,
      metrics: `On time ${onTimePct}%`,
      note: `${row.checklistCount}/${expectedChecklistDays} checklist · ${row.checklistOnTime}/${row.checklistCount || 0} tepat waktu`,
    }
  })

  const headStoreBase = Object.fromEntries(
    headStores.map((person) => [
      person.id,
      {
        id: person.id,
        name: person.full_name,
        branchId: person.branch_id,
        reportDays: new Map(),
        depositDays: new Map(),
        opexDays: new Map(),
      },
    ]),
  )

  ;(reportsRes.data || []).forEach((row) => {
    const current = headStoreBase[row.submitted_by]
    if (!current) return
    const previous = current.reportDays.get(row.tanggal)
    const next = { submittedAt: row.submitted_at, onTime: isReportLikeOnTime(row.tanggal, row.submitted_at) }
    if (!previous || new Date(row.submitted_at) < new Date(previous.submittedAt)) {
      current.reportDays.set(row.tanggal, next)
    }
  })

  ;(depositsRes.data || []).forEach((row) => {
    const current = headStoreBase[row.submitted_by]
    if (!current) return
    const previous = current.depositDays.get(row.tanggal)
    const next = { submittedAt: row.submitted_at, onTime: isReportLikeOnTime(row.tanggal, row.submitted_at) }
    if (!previous || new Date(row.submitted_at) < new Date(previous.submittedAt)) {
      current.depositDays.set(row.tanggal, next)
    }
  })

  ;(opexRes.data || []).forEach((row) => {
    const current = headStoreBase[row.submitted_by]
    if (!current) return
    const previous = current.opexDays.get(row.tanggal)
    const next = { createdAt: row.created_at, onTime: isOpexOnTime(row.tanggal, row.created_at) }
    if (!previous || new Date(row.created_at) < new Date(previous.createdAt)) {
      current.opexDays.set(row.tanggal, next)
    }
  })

  const headStoreRows = Object.values(headStoreBase).map((row) => {
    const branch = branchMap[row.branchId] || null
    const reportCount = row.reportDays.size
    const depositCount = row.depositDays.size
    const opexCount = row.opexDays.size
    const reportOnTime = [...row.reportDays.values()].filter((item) => item.onTime).length
    const depositOnTime = [...row.depositDays.values()].filter((item) => item.onTime).length
    const opexOnTime = [...row.opexDays.values()].filter((item) => item.onTime).length
    const completionPct = pct(
      reportCount + depositCount + opexCount,
      expectedHeadStoreReportDays + expectedHeadStoreDepositDays + expectedHeadStoreOpexDays,
    )
    const onTimePct = pct(
      reportOnTime + depositOnTime + opexOnTime,
      expectedHeadStoreReportDays + expectedHeadStoreDepositDays + expectedHeadStoreOpexDays,
    )
    const score = weightedScore(completionPct, onTimePct)

    return {
      id: row.id,
      title: row.name,
      subtitle: `${branch?.store_id || '-'} · ${branch?.name?.replace(/^Bagi Kopi\s+/i, '') || '-'}`,
      score,
      metrics: `On time ${onTimePct}%`,
      note: `Laporan ${reportCount}/${expectedHeadStoreReportDays} · Setoran ${depositCount}/${expectedHeadStoreDepositDays} · Opex ${opexCount}/${expectedHeadStoreOpexDays}`,
    }
  })

  const topSort = (a, b) => (b.score - a.score) || b.metrics.localeCompare(a.metrics) || a.title.localeCompare(b.title, 'id-ID')

  return {
    staffTop: buildTopRows(staffRows),
    staffBottom: buildBottomRows(staffRows),
    storesTop: buildTopRows(storeRows),
    storesBottom: buildBottomRows(storeRows),
    headStoresTop: buildTopRows(headStoreRows),
    headStoresBottom: buildBottomRows(headStoreRows),
    staffAll: [...staffRows].sort(topSort),
    headStoresAll: [...headStoreRows].sort(topSort),
    storesAll: [...storeRows].sort(topSort),
  }
}

function buildTopRows(rows) {
  return [...rows]
    .sort((a, b) => (b.score - a.score) || b.metrics.localeCompare(a.metrics) || a.title.localeCompare(b.title, 'id-ID'))
    .slice(0, 10)
}

function buildBottomRows(rows) {
  return [...rows]
    .sort((a, b) => (a.score - b.score) || a.metrics.localeCompare(b.metrics) || a.title.localeCompare(b.title, 'id-ID'))
    .slice(0, 10)
}

function weightedScore(completionPct, onTimePct) {
  return Math.round((completionPct * 0.7) + (onTimePct * 0.3))
}

function pct(value, total) {
  if (!total || total <= 0) return 0
  return Math.round((value / total) * 100)
}

function getElapsedDaysInPeriod(period, today, daysInMonth) {
  if (!period || !today) return 0
  if (today.startsWith(period)) return Number(today.slice(8, 10))
  return daysInMonth
}

function getPeriodBounds(period) {
  const [y, m] = period.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  return {
    startDate: `${period}-01`,
    endDate: `${period}-${String(daysInMonth).padStart(2, '0')}`,
    daysInMonth,
  }
}

function toWibDate(timestamp) {
  return new Date(new Date(timestamp).getTime() + WIB_OFFSET_MS)
}

function isReportLikeOnTime(tanggal, submittedAt) {
  if (!tanggal || !submittedAt) return false
  const [year, month, day] = tanggal.split('-').map(Number)
  const deadline = new Date(Date.UTC(year, month - 1, day + 1, 7, 0, 0))
  return new Date(submittedAt) <= deadline
}

function isOpexOnTime(tanggal, createdAt) {
  if (!tanggal || !createdAt) return false
  return toWibDate(createdAt).toISOString().slice(0, 10) === tanggal
}

function isPreparationOnTime(row) {
  const timestamp = row?.updated_at || row?.created_at
  if (!row?.tanggal || !timestamp || !row?.shift) return false

  const [year, month, day] = row.tanggal.split('-').map(Number)
  const utcHourByShift = { pagi: 1, middle: 7, malam: 20 }
  const deadlineHour = utcHourByShift[row.shift]
  if (deadlineHour == null) return false

  const deadline = new Date(Date.UTC(year, month - 1, day, deadlineHour, 0, 0))
  return new Date(timestamp) <= deadline
}
