import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayWIB, yesterdayWIB, visitGrade } from '../../lib/utils'
import Badge from '../../components/Badge'
import { DMBottomNav } from '../../components/BottomNav'

const VISIT_PERIODS = [
  { key: 'day', label: 'Harian' },
  { key: 'week', label: 'Mingguan' },
  { key: 'month', label: 'Bulanan' },
]

const EMPTY_SUMMARY = {
  total: 0,
  ceklisOK: 0,
  laporanOK: 0,
  visitedCount: 0,
  pendingSetoran: 0,
}

const EMPTY_VISIT_SUMMARY = {
  label: '',
  totalVisits: 0,
  visitedCount: 0,
  unvisitedCount: 0,
  coveragePct: 0,
}

export default function DMDashboard() {
  const { profile, signOut } = useAuth()
  const today = todayWIB()
  const yesterday = yesterdayWIB()
  const [stores, setStores] = useState([])
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('toko')
  const [visitPeriod, setVisitPeriod] = useState('week')
  const [visitSummary, setVisitSummary] = useState(EMPTY_VISIT_SUMMARY)
  const [managerCoverage, setManagerCoverage] = useState([])
  const [expandedManagerId, setExpandedManagerId] = useState(null)

  const isOpsManager = profile?.role === 'ops_manager'

  useEffect(() => {
    if (profile) fetchDashboard()
  }, [profile, visitPeriod])

  const fetchDashboard = async () => {
    setLoading(true)

    let branchQuery = supabase.from('branches').select('*').eq('is_active', true)
    if (profile.role === 'district_manager') {
      branchQuery = branchQuery.in('district', profile.managed_districts || [])
    } else if (profile.role === 'area_manager') {
      branchQuery = branchQuery.in('area', profile.managed_areas || [])
    }

    const { data: branches, error: branchError } = await branchQuery.order('name')
    if (branchError || !branches || branches.length === 0) {
      setStores([])
      setVisits([])
      setSummary(EMPTY_SUMMARY)
      setVisitSummary(EMPTY_VISIT_SUMMARY)
      setManagerCoverage([])
      setLoading(false)
      return
    }

    const branchIds = branches.map((branch) => branch.id)
    const range = getVisitRange(visitPeriod, today)

    const requests = [
      supabase.from('daily_checklists').select('branch_id,shift,is_late').in('branch_id', branchIds).eq('tanggal', today),
      supabase.from('daily_reports').select('branch_id,net_sales').in('branch_id', branchIds).eq('tanggal', yesterday),
      supabase.from('daily_deposits').select('branch_id,status,selisih').in('branch_id', branchIds).eq('tanggal', yesterday),
      supabase.from('daily_visits')
        .select('id,branch_id,tanggal,total_score,max_score,auditor_id,branch:branches(name,store_id),auditor:profiles(full_name,role)')
        .in('branch_id', branchIds)
        .gte('tanggal', range.start)
        .lte('tanggal', range.end)
        .order('tanggal', { ascending: false }),
      supabase.from('daily_visits')
        .select('branch_id,tanggal,total_score,max_score')
        .eq('auditor_id', profile.id)
        .in('branch_id', branchIds)
        .order('tanggal', { ascending: false }),
    ]

    if (isOpsManager) {
      requests.push(
        supabase.from('profiles')
          .select('id,full_name,role,managed_districts,managed_areas')
          .in('role', ['district_manager', 'area_manager'])
          .eq('is_active', true)
          .order('full_name')
      )
    }

    const [
      ceklisRes,
      laporanRes,
      setoranRes,
      visitRes,
      myVisitRes,
      managerRes,
    ] = await Promise.all(requests)

    if (ceklisRes.error || laporanRes.error || setoranRes.error || visitRes.error || myVisitRes.error || managerRes?.error) {
      setStores([])
      setVisits([])
      setSummary({ ...EMPTY_SUMMARY, total: branches.length })
      setVisitSummary({
        label: range.label,
        totalVisits: 0,
        visitedCount: 0,
        unvisitedCount: branches.length,
        coveragePct: 0,
      })
      setManagerCoverage([])
      setLoading(false)
      return
    }

    const checklistsByBranch = {}
    const reportsByBranch = {}
    const depositsByBranch = {}
    const latestVisitByBranch = {}
    const myLatestVisitByBranch = {}

    ;(ceklisRes.data || []).forEach((item) => {
      if (!checklistsByBranch[item.branch_id]) checklistsByBranch[item.branch_id] = {}
      checklistsByBranch[item.branch_id][item.shift] = item
    })
    ;(laporanRes.data || []).forEach((item) => {
      reportsByBranch[item.branch_id] = item
    })
    ;(setoranRes.data || []).forEach((item) => {
      depositsByBranch[item.branch_id] = item
    })
    ;(visitRes.data || []).forEach((item) => {
      if (!latestVisitByBranch[item.branch_id]) latestVisitByBranch[item.branch_id] = item
    })
    ;(myVisitRes.data || []).forEach((item) => {
      if (!myLatestVisitByBranch[item.branch_id]) myLatestVisitByBranch[item.branch_id] = item
    })

    const enrichedStores = branches.map((branch) => ({
      ...branch,
      ceklisPagi: checklistsByBranch[branch.id]?.pagi || null,
      ceklisMalam: checklistsByBranch[branch.id]?.malam || null,
      laporan: reportsByBranch[branch.id] || null,
      setoran: depositsByBranch[branch.id] || null,
      visitPeriod: latestVisitByBranch[branch.id] || null,
      myLastVisit: myLatestVisitByBranch[branch.id] || null,
    }))

    const visitedBranchIds = new Set((visitRes.data || []).map((item) => item.branch_id))
    const visitedCount = visitedBranchIds.size
    const pendingSetoran = enrichedStores.filter((store) => store.setoran?.status === 'submitted').length

    setSummary({
      total: branches.length,
      ceklisOK: enrichedStores.filter((store) => store.ceklisPagi).length,
      laporanOK: enrichedStores.filter((store) => store.laporan).length,
      visitedCount,
      pendingSetoran,
    })

    setVisitSummary({
      label: range.label,
      totalVisits: (visitRes.data || []).length,
      visitedCount,
      unvisitedCount: Math.max(branches.length - visitedCount, 0),
      coveragePct: branches.length ? visitedCount / branches.length : 0,
    })

    if (isOpsManager) {
      setManagerCoverage(buildManagerCoverage(managerRes?.data || [], branches, visitRes.data || []))
    } else {
      setManagerCoverage([])
    }

    setStores(enrichedStores)
    setVisits(visitRes.data || [])
    setLoading(false)
  }

  const storeBadge = (store) => {
    if (!store.ceklisPagi) return { variant: 'danger', label: 'Ceklis' }
    if (!store.laporan) return { variant: 'warn', label: 'Laporan' }
    if (store.setoran?.status === 'submitted') return { variant: 'warn', label: 'Setoran' }
    if (store.setoran?.status === 'rejected') return { variant: 'danger', label: 'Rejected' }
    if (!store.setoran) return { variant: 'warn', label: 'Setoran' }
    return { variant: 'ok', label: 'OK' }
  }

  const shortName = profile?.full_name?.split(' ')[0] || '-'
  const roleName = profile?.role === 'district_manager'
    ? `DM ${(profile.managed_districts || []).join(', ')}`
    : profile?.role === 'area_manager'
      ? `AM ${(profile.managed_areas || []).join(', ')}`
      : 'Ops Manager'

  const storesWithoutVisit = stores.filter((store) => !store.visitPeriod)

  return (
    <div className="page-shell">
      <header className="bg-primary-600 text-white px-4 pt-5 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-primary-200 text-sm">{roleName}</p>
            <h1 className="text-xl font-bold mt-0.5">{shortName}</h1>
            <p className="text-primary-300 text-xs mt-1">
              {loading ? '...' : `${summary.total} toko`} · {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
          </div>
          <button onClick={signOut} className="text-primary-300 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 px-4 -mt-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <StatCard
                label="Ceklis Pagi"
                value={`${summary.ceklisOK}/${summary.total}`}
                pct={summary.total ? summary.ceklisOK / summary.total : 0}
                color={summary.ceklisOK === summary.total ? 'text-green-600' : 'text-yellow-600'}
              />
              <StatCard
                label="Laporan H-1"
                value={`${summary.laporanOK}/${summary.total}`}
                pct={summary.total ? summary.laporanOK / summary.total : 0}
                color={summary.laporanOK === summary.total ? 'text-green-600' : 'text-yellow-600'}
              />
              <StatCard
                label="Visit Periode"
                value={`${visitSummary.visitedCount}/${summary.total}`}
                pct={visitSummary.coveragePct}
                color={visitSummary.coveragePct === 1 ? 'text-green-600' : 'text-primary-600'}
              />
              <StatCard
                label="Setoran Pending"
                value={summary.pendingSetoran}
                pct={0}
                color={summary.pendingSetoran > 0 ? 'text-yellow-600' : 'text-green-600'}
              />
            </div>

            {summary.pendingSetoran > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3 flex gap-2 items-start">
                <span className="text-base flex-shrink-0">💬</span>
                <span className="text-sm text-yellow-800">
                  <strong>{summary.pendingSetoran} setoran</strong> menunggu approval.
                  <Link to="/dm/approval" className="text-primary-600 font-semibold ml-1">Review →</Link>
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <Link to="/dm/visit" className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <span className="text-2xl">🏪</span>
                <div>
                  <div className="font-semibold text-sm">Daily Visit</div>
                  <div className="text-xs text-gray-400">Audit toko</div>
                </div>
              </Link>
              <Link to="/dm/approval" className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <span className="text-2xl">✅</span>
                <div>
                  <div className="font-semibold text-sm">Approval</div>
                  <div className="text-xs text-gray-400">Setoran pending</div>
                </div>
              </Link>
            </div>

            <div className="flex bg-primary-100 rounded-xl p-1 mb-3 gap-1">
              <button
                onClick={() => setActiveTab('toko')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'toko' ? 'bg-white text-primary-700 shadow-sm' : 'text-primary-400'}`}
              >
                Status Toko
              </button>
              <button
                onClick={() => setActiveTab('kunjungan')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'kunjungan' ? 'bg-white text-primary-700 shadow-sm' : 'text-primary-400'}`}
              >
                Monitoring Visit
              </button>
            </div>

            {activeTab === 'toko' && (
              <div className="card overflow-hidden">
                {stores.map((store, index) => {
                  const badge = storeBadge(store)
                  return (
                    <div key={store.id} className={`flex items-center gap-3 px-4 py-3 ${index < stores.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0">
                        {store.store_id?.split('-')[1] || '??'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{store.name.replace('Bagi Kopi ', '')}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5 flex gap-1.5 flex-wrap">
                          <span className={store.ceklisPagi ? 'text-green-600' : 'text-red-500'}>
                            {store.ceklisPagi ? '✓' : '✕'} Ceklis
                          </span>
                          <span className={store.laporan ? 'text-green-600' : 'text-gray-400'}>
                            {store.laporan ? '✓' : '—'} Laporan
                          </span>
                          <span className={store.setoran?.status === 'approved' ? 'text-green-600' : store.setoran ? 'text-yellow-600' : 'text-gray-400'}>
                            {store.setoran?.status === 'approved' ? '✓' : store.setoran ? '⏳' : '—'} Setoran
                          </span>
                          {store.visitPeriod && (
                            <span className="text-primary-600">
                              🏪 {store.visitPeriod.total_score}/{store.visitPeriod.max_score}
                            </span>
                          )}
                        </div>
                        {!isOpsManager && (
                          <div className="text-[10px] mt-1 text-primary-600">
                            {store.myLastVisit
                              ? `Visit terakhir saya: ${formatVisitDate(store.myLastVisit.tanggal)}`
                              : 'Belum pernah saya visit'}
                          </div>
                        )}
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'kunjungan' && (
              <>
                <div className="flex bg-white rounded-xl p-1 mb-3 gap-1 border border-gray-100">
                  {VISIT_PERIODS.map((period) => (
                    <button
                      key={period.key}
                      onClick={() => setVisitPeriod(period.key)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${visitPeriod === period.key ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500'}`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>

                <div className="text-xs text-gray-500 mb-3">{visitSummary.label}</div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <VisitMetricCard label="Total Kunjungan" value={visitSummary.totalVisits} tone="text-primary-700" />
                  <VisitMetricCard label="Outlet Terkunjungi" value={`${visitSummary.visitedCount}/${summary.total}`} tone="text-green-600" />
                  <VisitMetricCard label="Outlet Belum" value={visitSummary.unvisitedCount} tone="text-red-600" />
                  <VisitMetricCard label="Coverage" value={`${Math.round(visitSummary.coveragePct * 100)}%`} tone="text-primary-600" />
                </div>

                {isOpsManager && managerCoverage.length > 0 && (
                  <>
                    <p className="section-title">Progress Per Manager</p>
                    <div className="space-y-3 mb-3">
                      {managerCoverage.map((manager) => (
                        <ManagerCoverageCard
                          key={manager.id}
                          manager={manager}
                          expanded={expandedManagerId === manager.id}
                          onToggle={() => setExpandedManagerId(expandedManagerId === manager.id ? null : manager.id)}
                        />
                      ))}
                    </div>
                  </>
                )}

                {storesWithoutVisit.length > 0 && (
                  <>
                    <p className="section-title">Toko Belum Dikunjungi</p>
                    <div className="card overflow-hidden mb-3">
                      {storesWithoutVisit.map((store, index) => (
                        <StoreVisitRow
                          key={store.id}
                          store={store}
                          subtitle={isOpsManager ? `${store.district} · ${store.area}` : store.myLastVisit ? `Visit terakhir saya: ${formatVisitDate(store.myLastVisit.tanggal)}` : 'Belum pernah saya visit'}
                          statusLabel="Belum dikunjungi"
                          statusClass="bg-red-50 text-red-600"
                          bordered={index < storesWithoutVisit.length - 1}
                        />
                      ))}
                    </div>
                  </>
                )}

                {!isOpsManager && (
                  <>
                    <p className="section-title">Riwayat Visit Saya</p>
                    <div className="card overflow-hidden mb-3">
                      {stores.map((store, index) => (
                        <StoreVisitRow
                          key={store.id}
                          store={store}
                          subtitle={store.myLastVisit ? `Visit terakhir saya: ${formatVisitDate(store.myLastVisit.tanggal)}` : 'Belum pernah saya visit'}
                          statusLabel={store.visitPeriod ? `Periode ini: ${formatVisitDate(store.visitPeriod.tanggal)}` : 'Belum ada visit di periode ini'}
                          statusClass={store.visitPeriod ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}
                          bordered={index < stores.length - 1}
                        />
                      ))}
                    </div>
                  </>
                )}

                <p className="section-title">Log Kunjungan</p>
                {visits.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-4xl mb-3">🏪</div>
                    <p className="font-medium">Belum ada kunjungan pada periode ini</p>
                    <Link to="/dm/visit" className="text-primary-600 text-sm font-semibold mt-2 block">
                      Mulai Visit →
                    </Link>
                  </div>
                ) : (
                  <div className="card overflow-hidden">
                    {visits.map((visit, index) => (
                      <VisitHistoryCard key={visit.id} visit={visit} bordered={index < visits.length - 1} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <DMBottomNav />
    </div>
  )
}

function buildManagerCoverage(managers, branches, visits) {
  return managers
    .map((manager) => {
      const managedBranches = branches.filter((branch) => canManagerAccessBranch(manager, branch))
      const managedBranchIds = new Set(managedBranches.map((branch) => branch.id))
      const managerVisits = visits.filter((visit) => visit.auditor_id === manager.id && managedBranchIds.has(visit.branch_id))
      const latestByBranch = {}

      managerVisits.forEach((visit) => {
        if (!latestByBranch[visit.branch_id]) latestByBranch[visit.branch_id] = visit
      })

      const visitedStores = managedBranches
        .filter((branch) => latestByBranch[branch.id])
        .map((branch) => ({
          id: branch.id,
          name: branch.name,
          tanggal: latestByBranch[branch.id].tanggal,
          scorePct: scorePercent(latestByBranch[branch.id]),
        }))

      const unvisitedStores = managedBranches
        .filter((branch) => !latestByBranch[branch.id])
        .map((branch) => ({
          id: branch.id,
          name: branch.name,
        }))

      const averagePct = managerVisits.length
        ? Math.round(managerVisits.reduce((sum, visit) => sum + scorePercent(visit), 0) / managerVisits.length)
        : 0

      return {
        id: manager.id,
        name: manager.full_name,
        roleLabel: manager.role === 'district_manager' ? 'District Manager' : 'Area Manager',
        scopeLabel: manager.role === 'district_manager'
          ? `Wilayah ${(manager.managed_districts || []).join(', ')}`
          : `Area ${(manager.managed_areas || []).join(', ')}`,
        totalStores: managedBranches.length,
        visitedCount: visitedStores.length,
        totalVisits: managerVisits.length,
        averagePct,
        visitedStores,
        unvisitedStores,
      }
    })
    .filter((manager) => manager.totalStores > 0)
}

function canManagerAccessBranch(manager, branch) {
  if (manager.role === 'district_manager') {
    return (manager.managed_districts || []).includes(branch.district)
  }
  if (manager.role === 'area_manager') {
    return (manager.managed_areas || []).includes(branch.area)
  }
  return false
}

function getVisitRange(period, today) {
  if (period === 'day') {
    return {
      start: today,
      end: today,
      label: `Hari ini · ${formatVisitDate(today, { day: 'numeric', month: 'long', year: 'numeric' })}`,
    }
  }

  if (period === 'month') {
    const [year, month] = today.split('-').map(Number)
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(Date.UTC(year, month, 0))
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`
    return {
      start,
      end,
      label: `Bulan ini · ${formatVisitDate(start, { month: 'long', year: 'numeric' })}`,
    }
  }

  const [year, month, day] = today.split('-').map(Number)
  const base = new Date(Date.UTC(year, month - 1, day))
  const weekDay = base.getUTCDay()
  const diff = weekDay === 0 ? 6 : weekDay - 1
  base.setUTCDate(base.getUTCDate() - diff)
  const end = new Date(base)
  end.setUTCDate(base.getUTCDate() + 6)
  const startIso = base.toISOString().split('T')[0]
  const endIso = end.toISOString().split('T')[0]

  return {
    start: startIso,
    end: endIso,
    label: `Minggu ini · ${formatVisitDate(startIso, { day: 'numeric', month: 'short' })} - ${formatVisitDate(endIso, { day: 'numeric', month: 'short', year: 'numeric' })}`,
  }
}

function formatVisitDate(date, options) {
  return new Date(date).toLocaleDateString('id-ID', options || {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function scorePercent(visit) {
  if (!visit?.max_score) return 0
  return Math.round((Number(visit.total_score || 0) / Number(visit.max_score)) * 100)
}

function StatCard({ label, value, pct, color }) {
  const width = Math.min(Math.max(pct * 100, 0), 100)

  return (
    <div className="card p-4">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function VisitMetricCard({ label, value, tone }) {
  return (
    <div className="card p-4">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}

function ManagerCoverageCard({ manager, expanded, onToggle }) {
  const coverage = manager.totalStores ? manager.visitedCount / manager.totalStores : 0
  const statusTone = coverage >= 0.8 ? 'text-green-600' : coverage > 0 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 text-left">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center font-bold flex-shrink-0">
            {(manager.name || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-gray-900">{manager.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{manager.roleLabel} · {manager.scopeLabel}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-lg font-bold ${statusTone}`}>{Math.round(coverage * 100)}%</div>
                <div className="text-xs text-gray-500">{manager.visitedCount}/{manager.totalStores} toko</div>
              </div>
            </div>
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${Math.round(coverage * 100)}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-green-600">{manager.visitedCount} toko dikunjungi</span>
              <span className="text-red-500">{manager.unvisitedStores.length} belum</span>
              <span className="text-primary-600">{manager.totalVisits} visit · avg {manager.averagePct}%</span>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50">
          {manager.unvisitedStores.length > 0 && (
            <div>
              <div className="text-xs font-bold text-red-600 mb-2">Belum dikunjungi</div>
              <div className="flex flex-wrap gap-2">
                {manager.unvisitedStores.map((store) => (
                  <span key={store.id} className="text-xs bg-white border border-red-100 text-red-600 px-2 py-1 rounded-full">
                    {store.name.replace('Bagi Kopi ', '')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {manager.visitedStores.length > 0 && (
            <div>
              <div className="text-xs font-bold text-green-700 mb-2">Sudah dikunjungi</div>
              <div className="space-y-2">
                {manager.visitedStores.map((store) => (
                  <div key={store.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
                    <div>
                      <div className="font-medium text-gray-800">{store.name.replace('Bagi Kopi ', '')}</div>
                      <div className="text-gray-500">{formatVisitDate(store.tanggal)}</div>
                    </div>
                    <div className="font-semibold text-primary-700">{store.scorePct}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StoreVisitRow({ store, subtitle, statusLabel, statusClass, bordered }) {
  return (
    <div className={`px-4 py-3 flex items-center gap-3 ${bordered ? 'border-b border-gray-50' : ''}`}>
      <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0">
        {store.store_id?.split('-')[1] || '??'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{store.name.replace('Bagi Kopi ', '')}</div>
        <div className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</div>
      </div>
      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${statusClass}`}>
        {statusLabel}
      </span>
    </div>
  )
}

function VisitHistoryCard({ visit, bordered }) {
  const grade = visitGrade(visit.total_score, visit.max_score)

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${bordered ? 'border-b border-gray-50' : ''}`}>
      <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0">
        {visit.branch?.store_id?.split('-')[1] || '??'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">
          {visit.branch?.name?.replace('Bagi Kopi ', '') || '-'}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5">
          {formatVisitDate(visit.tanggal)} · oleh {visit.auditor?.full_name?.split(' ')[0] || '-'}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-bold text-sm text-primary-700">{visit.total_score}/{visit.max_score}</div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${grade.bg} ${grade.color}`}>
          {grade.label}
        </span>
      </div>
    </div>
  )
}
