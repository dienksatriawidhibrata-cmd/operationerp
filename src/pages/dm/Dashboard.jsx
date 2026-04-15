import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtRp, todayWIB, yesterdayWIB, visitGrade } from '../../lib/utils'
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
} from '../../lib/notifications'
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

const EMPTY_OPEX_SUMMARY = {
  tracked: 0,
  withinBudget: 0,
  overBudget: 0,
  pendingReport: 0,
}

const BOH_CATEGORY = 'Beban Operasional Harian'
const BROWSER_NOTIFICATION_LIMIT = 4
const REFETCH_INTERVAL_MS = 5 * 60 * 1000

export default function DMDashboard() {
  const { profile, signOut } = useAuth()
  const today = todayWIB()
  const yesterday = yesterdayWIB()
  const [stores, setStores] = useState([])
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [visits, setVisits] = useState([])
  const [alerts, setAlerts] = useState([])
  const [activities, setActivities] = useState([])
  const [opexRows, setOpexRows] = useState([])
  const [opexSummary, setOpexSummary] = useState(EMPTY_OPEX_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('toko')
  const [visitPeriod, setVisitPeriod] = useState('week')
  const [visitSummary, setVisitSummary] = useState(EMPTY_VISIT_SUMMARY)
  const [managerCoverage, setManagerCoverage] = useState([])
  const [expandedManagerId, setExpandedManagerId] = useState(null)
  const [notifPermission, setNotifPermission] = useState(getBrowserNotificationPermission())

  const isOpsManager = profile?.role === 'ops_manager'
  const accessibleBranchIdsRef = useRef(new Set())
  const dashboardRefreshRef = useRef(() => {})
  const refreshTimeoutRef = useRef(null)
  const bootstrappedBrowserNotificationsRef = useRef(false)
  const notifiedBrowserKeysRef = useRef(new Set())

  useEffect(() => {
    if (profile) {
      fetchDashboard()
    }
  }, [profile, visitPeriod])

  useEffect(() => {
    dashboardRefreshRef.current = () => fetchDashboard()
  })

  useEffect(() => {
    if (!profile?.id) return undefined

    const watchedTables = [
      'daily_checklists',
      'daily_reports',
      'daily_deposits',
      'operational_expenses',
    ]

    const channel = supabase.channel(`dashboard-notifications-${profile.id}`)

    watchedTables.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          const branchId = payload.new?.branch_id || payload.old?.branch_id
          if (branchId && !accessibleBranchIdsRef.current.has(branchId)) return
          queueDashboardRefresh()
        }
      )
    })

    channel.subscribe()

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        dashboardRefreshRef.current()
      }
    }, REFETCH_INTERVAL_MS)

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current)
      }
      window.clearInterval(intervalId)
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

  const queueDashboardRefresh = () => {
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current)
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      dashboardRefreshRef.current()
    }, 700)
  }

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
      accessibleBranchIdsRef.current = new Set()
      setStores([])
      setVisits([])
      setAlerts([])
      setActivities([])
      setOpexRows([])
      setSummary(EMPTY_SUMMARY)
      setVisitSummary(EMPTY_VISIT_SUMMARY)
      setOpexSummary(EMPTY_OPEX_SUMMARY)
      setManagerCoverage([])
      setLoading(false)
      return
    }

    const branchIds = branches.map((branch) => branch.id)
    const branchMap = Object.fromEntries(branches.map((branch) => [branch.id, branch]))
    accessibleBranchIdsRef.current = new Set(branchIds)
    const range = getVisitRange(visitPeriod, today)

    const requests = [
      supabase
        .from('daily_checklists')
        .select('id,branch_id,shift,is_late,submitted_at')
        .in('branch_id', branchIds)
        .eq('tanggal', today),
      supabase
        .from('daily_reports')
        .select('id,branch_id,net_sales,submitted_at')
        .in('branch_id', branchIds)
        .eq('tanggal', yesterday),
      supabase
        .from('daily_deposits')
        .select('id,branch_id,status,selisih,submitted_at,approved_at,rejection_reason')
        .in('branch_id', branchIds)
        .eq('tanggal', yesterday),
      supabase
        .from('operational_expenses')
        .select('id,branch_id,tanggal,category,total,item_name,created_at')
        .in('branch_id', branchIds)
        .in('tanggal', [today, yesterday])
        .order('created_at', { ascending: false }),
      supabase
        .from('daily_visits')
        .select('id,branch_id,tanggal,total_score,max_score,auditor_id,branch:branches(name,store_id),auditor:profiles(full_name,role)')
        .in('branch_id', branchIds)
        .gte('tanggal', range.start)
        .lte('tanggal', range.end)
        .order('tanggal', { ascending: false }),
      supabase
        .from('daily_visits')
        .select('branch_id,tanggal,total_score,max_score')
        .eq('auditor_id', profile.id)
        .in('branch_id', branchIds)
        .order('tanggal', { ascending: false }),
    ]

    if (isOpsManager) {
      requests.push(
        supabase
          .from('profiles')
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
      opexRes,
      visitRes,
      myVisitRes,
      managerRes,
    ] = await Promise.all(requests)

    if (
      ceklisRes.error ||
      laporanRes.error ||
      setoranRes.error ||
      opexRes.error ||
      visitRes.error ||
      myVisitRes.error ||
      managerRes?.error
    ) {
      setStores([])
      setVisits([])
      setAlerts([])
      setActivities([])
      setOpexRows([])
      setSummary({ ...EMPTY_SUMMARY, total: branches.length })
      setVisitSummary({
        label: range.label,
        totalVisits: 0,
        visitedCount: 0,
        unvisitedCount: branches.length,
        coveragePct: 0,
      })
      setOpexSummary(EMPTY_OPEX_SUMMARY)
      setManagerCoverage([])
      setLoading(false)
      return
    }

    const checklistsByBranch = {}
    const reportsByBranch = {}
    const depositsByBranch = {}
    const latestVisitByBranch = {}
    const myLatestVisitByBranch = {}
    const expensesByBranchDate = {}

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
    ;(opexRes.data || []).forEach((expense) => {
      const key = `${expense.branch_id}:${expense.tanggal}`
      if (!expensesByBranchDate[key]) expensesByBranchDate[key] = []
      expensesByBranchDate[key].push(expense)
    })

    const enrichedStores = branches.map((branch) => {
      const todayExpenses = expensesByBranchDate[`${branch.id}:${today}`] || []
      const yesterdayExpenses = expensesByBranchDate[`${branch.id}:${yesterday}`] || []
      const bohYesterday = yesterdayExpenses
        .filter((expense) => expense.category === BOH_CATEGORY)
        .reduce((sum, expense) => sum + Number(expense.total || 0), 0)
      const report = reportsByBranch[branch.id] || null
      const netSales = Number(report?.net_sales || 0)
      const bohRatio = netSales > 0 ? bohYesterday / netSales : null

      return {
        ...branch,
        ceklisPagi: checklistsByBranch[branch.id]?.pagi || null,
        ceklisMalam: checklistsByBranch[branch.id]?.malam || null,
        laporan: report,
        setoran: depositsByBranch[branch.id] || null,
        visitPeriod: latestVisitByBranch[branch.id] || null,
        myLastVisit: myLatestVisitByBranch[branch.id] || null,
        opexTodayCount: todayExpenses.length,
        opexTodayTotal: todayExpenses.reduce((sum, expense) => sum + Number(expense.total || 0), 0),
        bohYesterday,
        bohRatio,
      }
    })

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

    const nextAlerts = buildAlerts(enrichedStores, today, yesterday)
    const nextActivities = buildActivities({
      branchMap,
      checklists: ceklisRes.data || [],
      reports: laporanRes.data || [],
      deposits: setoranRes.data || [],
      expenses: opexRes.data || [],
    })
    const nextOpexRows = buildOpexRows(enrichedStores)

    setStores(enrichedStores)
    setVisits(visitRes.data || [])
    setAlerts(nextAlerts)
    setActivities(nextActivities)
    setOpexRows(nextOpexRows)
    setOpexSummary({
      tracked: nextOpexRows.length,
      withinBudget: nextOpexRows.filter((row) => row.status === 'within').length,
      overBudget: nextOpexRows.filter((row) => row.status === 'over').length,
      pendingReport: nextOpexRows.filter((row) => row.status === 'pending').length,
    })
    setLoading(false)

    syncBrowserNotifications(
      buildBrowserNotificationCandidates(nextAlerts, nextActivities),
      notifPermission
    )
  }

  const syncBrowserNotifications = (candidates, permission) => {
    if (!bootstrappedBrowserNotificationsRef.current) {
      candidates.forEach((candidate) => {
        notifiedBrowserKeysRef.current.add(candidate.key)
      })
      bootstrappedBrowserNotificationsRef.current = true
      return
    }

    if (permission !== 'granted') return

    candidates.slice(0, BROWSER_NOTIFICATION_LIMIT).forEach((candidate) => {
      if (notifiedBrowserKeysRef.current.has(candidate.key)) return

      showBrowserNotification(candidate.title, {
        body: candidate.body,
        tag: candidate.key,
      })
      notifiedBrowserKeysRef.current.add(candidate.key)
    })
  }

  const enableBrowserNotifications = async () => {
    const result = await requestBrowserNotificationPermission()
    setNotifPermission(result)
  }

  const storeBadge = (store) => {
    if (!store.ceklisPagi) return { variant: 'danger', label: 'Ceklis' }
    if (!store.laporan) return { variant: 'warn', label: 'Laporan' }
    if (store.setoran?.status === 'submitted') return { variant: 'warn', label: 'Setoran' }
    if (store.setoran?.status === 'rejected') return { variant: 'danger', label: 'Rejected' }
    if (!store.setoran) return { variant: 'warn', label: 'Setoran' }
    if (store.bohRatio != null && store.bohRatio > 0.03) return { variant: 'danger', label: 'BOH > 3%' }
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
            {notifPermission !== 'granted' && (
              <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-primary-700">Aktifkan notifikasi browser</div>
                  <div className="text-xs text-primary-500 mt-1">
                    Event baru dan reminder penting akan muncul otomatis saat dashboard terbuka.
                  </div>
                </div>
                {notifPermission === 'unsupported' ? (
                  <span className="text-xs font-semibold text-gray-500">Browser tidak mendukung</span>
                ) : (
                  <button onClick={enableBrowserNotifications} className="px-3 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold">
                    Aktifkan
                  </button>
                )}
              </div>
            )}

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
                <span className="text-sm text-yellow-800">
                  <strong>{summary.pendingSetoran} setoran</strong> menunggu approval.
                  <Link to="/dm/approval" className="text-primary-600 font-semibold ml-1">Review {'->'}</Link>
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <Link to="/dm/visit" className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <span className="text-2xl">Visit</span>
                <div>
                  <div className="font-semibold text-sm">Daily Visit</div>
                  <div className="text-xs text-gray-400">Audit toko</div>
                </div>
              </Link>
              <Link to="/dm/approval" className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <span className="text-2xl">Approval</span>
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
              <>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <VisitMetricCard label="BOH Aman" value={opexSummary.withinBudget} tone="text-green-600" />
                  <VisitMetricCard label="BOH > 3%" value={opexSummary.overBudget} tone="text-red-600" />
                  <VisitMetricCard label="Menunggu Laporan" value={opexSummary.pendingReport} tone="text-yellow-600" />
                </div>

                <p className="section-title">Notifikasi Prioritas</p>
                <div className="card overflow-hidden mb-3">
                  {alerts.length === 0 ? (
                    <div className="px-4 py-5 text-sm text-gray-500 text-center">Semua toko dalam kondisi aman saat ini.</div>
                  ) : (
                    alerts.map((alert, index) => (
                      <NotificationRow
                        key={alert.id}
                        item={alert}
                        bordered={index < alerts.length - 1}
                      />
                    ))
                  )}
                </div>

                <p className="section-title">Aktivitas Terbaru</p>
                <div className="card overflow-hidden mb-3">
                  {activities.length === 0 ? (
                    <div className="px-4 py-5 text-sm text-gray-500 text-center">Belum ada aktivitas terbaru.</div>
                  ) : (
                    activities.map((item, index) => (
                      <NotificationRow
                        key={item.id}
                        item={item}
                        bordered={index < activities.length - 1}
                      />
                    ))
                  )}
                </div>

                <p className="section-title">Kontrol BOH vs Net Sales H-1</p>
                <div className="card overflow-hidden mb-3">
                  {opexRows.length === 0 ? (
                    <div className="px-4 py-5 text-sm text-gray-500 text-center">Belum ada data BOH yang bisa dibandingkan.</div>
                  ) : (
                    opexRows.map((row, index) => (
                      <OpexBudgetRow
                        key={row.id}
                        row={row}
                        bordered={index < opexRows.length - 1}
                      />
                    ))
                  )}
                </div>

                <p className="section-title">Status Toko</p>
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
                              {store.ceklisPagi ? 'OK' : 'Miss'} Ceklis
                            </span>
                            <span className={store.laporan ? 'text-green-600' : 'text-gray-400'}>
                              {store.laporan ? 'OK' : '-'} Laporan
                            </span>
                            <span className={store.setoran?.status === 'approved' ? 'text-green-600' : store.setoran ? 'text-yellow-600' : 'text-gray-400'}>
                              {store.setoran?.status === 'approved' ? 'OK' : store.setoran ? 'Pending' : '-'} Setoran
                            </span>
                            <span className={store.opexTodayCount > 0 ? 'text-primary-600' : 'text-gray-400'}>
                              {store.opexTodayCount > 0 ? `${store.opexTodayCount} OPEX` : 'Belum OPEX'}
                            </span>
                            {store.bohRatio != null && (
                              <span className={store.bohRatio > 0.03 ? 'text-red-500' : 'text-green-600'}>
                                BOH {formatRatio(store.bohRatio)}
                              </span>
                            )}
                            {store.visitPeriod && (
                              <span className="text-primary-600">
                                Visit {store.visitPeriod.total_score}/{store.visitPeriod.max_score}
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
              </>
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
                    <div className="text-4xl mb-3">Visit</div>
                    <p className="font-medium">Belum ada kunjungan pada periode ini</p>
                    <Link to="/dm/visit" className="text-primary-600 text-sm font-semibold mt-2 block">
                      Mulai Visit {'->'}
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

function buildAlerts(stores, today, yesterday) {
  const items = []

  stores.forEach((store) => {
    const shortName = store.name.replace('Bagi Kopi ', '')

    if (!store.ceklisPagi) {
      items.push({
        id: `missing-ceklis-${today}-${store.id}`,
        level: 'danger',
        title: `${shortName} belum isi ceklis pagi`,
        subtitle: `Pantau checklist tanggal ${formatVisitDate(today, { day: 'numeric', month: 'short' })}`,
        timeLabel: 'Perlu follow up',
      })
    }

    if (!store.laporan) {
      items.push({
        id: `missing-report-${yesterday}-${store.id}`,
        level: 'warn',
        title: `${shortName} belum kirim laporan harian`,
        subtitle: `Laporan operasional ${formatVisitDate(yesterday, { day: 'numeric', month: 'short' })} belum ada`,
        timeLabel: 'Perlu follow up',
      })
    }

    if (!store.setoran) {
      items.push({
        id: `missing-deposit-${yesterday}-${store.id}`,
        level: 'warn',
        title: `${shortName} belum submit setoran`,
        subtitle: `Setoran tanggal ${formatVisitDate(yesterday, { day: 'numeric', month: 'short' })} belum masuk`,
        timeLabel: 'Perlu follow up',
      })
    }

    if (store.opexTodayCount === 0) {
      items.push({
        id: `missing-opex-${today}-${store.id}`,
        level: 'info',
        title: `${shortName} belum input OPEX hari ini`,
        subtitle: 'Belum ada pengeluaran yang tercatat untuk hari ini',
        timeLabel: 'Pantau',
      })
    }

    if (store.setoran?.status === 'submitted') {
      items.push({
        id: `pending-deposit-${store.setoran.id}`,
        level: 'info',
        title: `${shortName} menunggu approval setoran`,
        subtitle: `${Number(store.setoran.selisih || 0) === 0 ? 'Tanpa selisih' : `Selisih ${fmtRp(Math.abs(Number(store.setoran.selisih || 0)))}`}`,
        timeLabel: formatRelativeTime(store.setoran.submitted_at),
      })
    }

    if (store.bohRatio != null && store.bohRatio > 0.03) {
      items.push({
        id: `budget-over-${yesterday}-${store.id}`,
        level: 'danger',
        title: `${shortName} melewati budget BOH`,
        subtitle: `BOH ${fmtRp(store.bohYesterday)} vs net sales ${fmtRp(store.laporan?.net_sales || 0)} (${formatRatio(store.bohRatio)})`,
        timeLabel: 'Over budget',
      })
    }
  })

  return items
    .sort((left, right) => compareAlertLevel(left.level, right.level))
    .slice(0, 12)
}

function buildActivities({ branchMap, checklists, reports, deposits, expenses }) {
  const items = []

  checklists.forEach((item) => {
    const branch = branchMap[item.branch_id]
    if (!branch || !item.submitted_at) return

    items.push({
      id: `activity-checklist-${item.id}`,
      level: 'ok',
      title: `${branch.name.replace('Bagi Kopi ', '')} sudah isi ceklis ${item.shift}`,
      subtitle: item.is_late ? 'Tercatat terlambat dari deadline' : 'Checklist tercatat tepat waktu',
      timeLabel: formatRelativeTime(item.submitted_at),
      timestamp: item.submitted_at,
    })
  })

  reports.forEach((item) => {
    const branch = branchMap[item.branch_id]
    if (!branch || !item.submitted_at) return

    items.push({
      id: `activity-report-${item.id}`,
      level: 'ok',
      title: `${branch.name.replace('Bagi Kopi ', '')} sudah kirim laporan harian`,
      subtitle: `Net sales ${fmtRp(item.net_sales)}`,
      timeLabel: formatRelativeTime(item.submitted_at),
      timestamp: item.submitted_at,
    })
  })

  deposits.forEach((item) => {
    const branch = branchMap[item.branch_id]
    if (!branch) return

    const eventTime = item.status === 'submitted' ? item.submitted_at : item.approved_at
    if (!eventTime) return

    const statusLabel = item.status === 'approved'
      ? 'setoran diapprove'
      : item.status === 'rejected'
        ? 'setoran direject'
        : 'sudah submit setoran'

    items.push({
      id: `activity-deposit-${item.id}-${item.status}`,
      level: item.status === 'rejected' ? 'danger' : 'ok',
      title: `${branch.name.replace('Bagi Kopi ', '')} ${statusLabel}`,
      subtitle: item.status === 'rejected' && item.rejection_reason
        ? item.rejection_reason
        : 'Update status setoran tercatat',
      timeLabel: formatRelativeTime(eventTime),
      timestamp: eventTime,
    })
  })

  expenses.forEach((expense) => {
    const branch = branchMap[expense.branch_id]
    if (!branch || !expense.created_at) return

    items.push({
      id: `activity-expense-${expense.id}`,
      level: 'info',
      title: `${branch.name.replace('Bagi Kopi ', '')} menambah OPEX`,
      subtitle: `${expense.item_name} · ${expense.category} · ${fmtRp(expense.total)}`,
      timeLabel: formatRelativeTime(expense.created_at),
      timestamp: expense.created_at,
    })
  })

  return items
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
    .slice(0, 12)
}

function buildOpexRows(stores) {
  return stores
    .map((store) => {
      const netSales = Number(store.laporan?.net_sales || 0)

      if (!store.laporan) {
        return {
          id: store.id,
          name: store.name,
          status: 'pending',
          bohAmount: Number(store.bohYesterday || 0),
          netSales: 0,
          ratio: null,
          note: 'Laporan harian H-1 belum ada',
        }
      }

      if (netSales <= 0) {
        return {
          id: store.id,
          name: store.name,
          status: store.bohYesterday > 0 ? 'over' : 'within',
          bohAmount: Number(store.bohYesterday || 0),
          netSales,
          ratio: store.bohYesterday > 0 ? 1 : 0,
          note: 'Net sales 0 atau belum valid',
        }
      }

      const ratio = Number(store.bohRatio || 0)
      return {
        id: store.id,
        name: store.name,
        status: ratio > 0.03 ? 'over' : 'within',
        bohAmount: Number(store.bohYesterday || 0),
        netSales,
        ratio,
        note: ratio > 0.03 ? 'Melewati batas maksimal 3%' : 'Masih dalam batas maksimal 3%',
      }
    })
    .sort((left, right) => {
      const leftScore = left.ratio == null ? -1 : left.ratio
      const rightScore = right.ratio == null ? -1 : right.ratio
      return rightScore - leftScore
    })
}

function buildBrowserNotificationCandidates(alerts, activities) {
  const highPriorityAlerts = alerts
    .filter((item) => item.level === 'danger' || item.level === 'warn')
    .map((item) => ({
      key: item.id,
      title: item.title,
      body: item.subtitle,
    }))

  const freshActivities = activities
    .slice(0, 6)
    .map((item) => ({
      key: item.id,
      title: item.title,
      body: item.subtitle,
    }))

  return [...highPriorityAlerts, ...freshActivities]
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

function formatRelativeTime(dateString) {
  if (!dateString) return '-'

  const diffMs = Date.now() - new Date(dateString).getTime()
  const diffMinutes = Math.max(Math.round(diffMs / 60000), 0)

  if (diffMinutes < 1) return 'Baru saja'
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} jam lalu`

  return formatVisitDate(dateString)
}

function formatRatio(ratio) {
  if (ratio == null || Number.isNaN(ratio)) return '-'
  return `${(ratio * 100).toFixed(2)}%`
}

function compareAlertLevel(left, right) {
  const rank = { danger: 0, warn: 1, info: 2, ok: 3 }
  return (rank[left] ?? 9) - (rank[right] ?? 9)
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

function NotificationRow({ item, bordered }) {
  const toneMap = {
    danger: 'bg-red-50 text-red-600',
    warn: 'bg-yellow-50 text-yellow-700',
    info: 'bg-primary-50 text-primary-600',
    ok: 'bg-green-50 text-green-700',
  }

  return (
    <div className={`px-4 py-3 flex items-start gap-3 ${bordered ? 'border-b border-gray-50' : ''}`}>
      <span className={`text-[10px] font-bold px-2 py-1 rounded-full mt-0.5 flex-shrink-0 ${toneMap[item.level] || toneMap.info}`}>
        {item.level === 'danger' ? 'Urgent' : item.level === 'warn' ? 'Perlu cek' : item.level === 'ok' ? 'Update' : 'Info'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">{item.title}</div>
        <div className="text-xs text-gray-500 mt-1">{item.subtitle}</div>
      </div>
      <div className="text-[10px] text-gray-400 flex-shrink-0 text-right">{item.timeLabel}</div>
    </div>
  )
}

function OpexBudgetRow({ row, bordered }) {
  const statusClass = row.status === 'over'
    ? 'bg-red-50 text-red-600'
    : row.status === 'pending'
      ? 'bg-yellow-50 text-yellow-700'
      : 'bg-green-50 text-green-700'

  const statusLabel = row.status === 'over'
    ? 'Over 3%'
    : row.status === 'pending'
      ? 'Pending'
      : 'Aman'

  return (
    <div className={`px-4 py-3 ${bordered ? 'border-b border-gray-50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{row.name.replace('Bagi Kopi ', '')}</div>
          <div className="text-xs text-gray-500 mt-1">{row.note}</div>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <div className="text-gray-400">BOH H-1</div>
          <div className="font-semibold text-gray-900 mt-1">{fmtRp(row.bohAmount)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <div className="text-gray-400">Net Sales H-1</div>
          <div className="font-semibold text-gray-900 mt-1">{fmtRp(row.netSales)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <div className="text-gray-400">Rasio</div>
          <div className={`font-semibold mt-1 ${row.status === 'over' ? 'text-red-600' : row.status === 'pending' ? 'text-yellow-700' : 'text-green-600'}`}>
            {row.ratio == null ? '-' : formatRatio(row.ratio)}
          </div>
        </div>
      </div>
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
