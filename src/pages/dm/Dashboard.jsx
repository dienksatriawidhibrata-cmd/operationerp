import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtRp, todayWIB, yesterdayWIB, visitGrade } from '../../lib/utils'
import { canViewKPI, canViewSupplyChain, isOpsLikeRole } from '../../lib/access'
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
} from '../../lib/notifications'
import { DMBottomNav, OpsBottomNav } from '../../components/BottomNav'
import PhotoViewer from '../../components/PhotoViewer'
import TaskWidget from '../../components/TaskWidget'
import {
  ActionCard,
  AppCanvas,
  AppIcon,
  EmptyPanel,
  HeroCard,
  InlineStat,
  MetricCard,
  SectionPanel,
  SegmentedControl,
  ShellHeader,
  SoftButton,
  ToneBadge,
} from '../../components/ui/AppKit'

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

function buildHeroSummary(stores) {
  if (!stores.length) return 'Data toko sedang dimuat...'

  const total = stores.length
  const sName = (s) => s.name?.replace('Bagi Kopi ', '') || s.store_id || '?'
  const fmt = (list) => {
    if (list.length <= 3) return list.join(', ')
    return `${list.slice(0, 3).join(', ')} +${list.length - 3} lainnya`
  }

  const parts = []

  // Ceklis pagi
  const belumPagi = stores.filter((s) => !s.ceklisPagi).map(sName)
  const terlambatPagi = stores.filter((s) => s.ceklisPagi?.is_late).map(sName)

  if (belumPagi.length === 0) {
    parts.push('Seluruh toko sudah mengerjakan ceklis pagi.')
  } else if (belumPagi.length === total) {
    parts.push('Belum ada toko yang submit ceklis pagi.')
  } else {
    parts.push(`${belumPagi.length} dari ${total} toko belum ceklis pagi (${fmt(belumPagi)}).`)
  }
  if (terlambatPagi.length > 0) {
    parts.push(`${terlambatPagi.length} toko terlambat submit (${fmt(terlambatPagi)}).`)
  }

  // Ceklis malam — hanya tampil kalau sebagian sudah masuk (artinya malam sudah dimulai)
  const sudahMalam = stores.filter((s) => s.ceklisMalam).length
  if (sudahMalam > 0) {
    const belumMalam = stores.filter((s) => !s.ceklisMalam).map(sName)
    if (belumMalam.length === 0) {
      parts.push('Ceklis malam semua toko sudah masuk.')
    } else {
      parts.push(`${belumMalam.length} toko belum ceklis malam (${fmt(belumMalam)}).`)
    }
  }

  // Setoran kemarin
  const belumSetoran = stores.filter((s) => !s.setoran).map(sName)
  const pendingSetoran = stores.filter((s) => s.setoran?.status === 'submitted').map(sName)

  if (belumSetoran.length === total) {
    parts.push('Belum ada toko yang submit setoran kemarin.')
  } else if (belumSetoran.length > 0) {
    parts.push(`${belumSetoran.length} dari ${total} toko belum setoran (${fmt(belumSetoran)}).`)
  }
  if (pendingSetoran.length > 0) {
    parts.push(`${pendingSetoran.length} setoran menunggu approval (${fmt(pendingSetoran)}).`)
  }
  if (belumSetoran.length === 0 && pendingSetoran.length === 0) {
    parts.push('Setoran semua toko sudah diproses.')
  }

  // OPEX hari ini
  const totalOpex = stores.reduce((sum, s) => sum + (s.opexTodayTotal || 0), 0)
  const storesWithOpex = stores.filter((s) => s.opexTodayCount > 0).length
  if (totalOpex === 0) {
    parts.push('Belum ada pengeluaran tercatat hari ini.')
  } else {
    parts.push(`Total pengeluaran hari ini ${fmtRp(totalOpex)} dari ${storesWithOpex} toko.`)
  }

  return parts.join(' ')
}
const BROWSER_NOTIFICATION_LIMIT = 4
const REFETCH_INTERVAL_MS = 5 * 60 * 1000
const SALES_SAFETY_FACTOR = 0.925
const BOH_SECTION_STORAGE_KEY = 'dm_boh_section_visible'
const STORE_SECTION_STORAGE_KEY = 'dm_store_section_visible'


function readSectionPreference() {
  if (typeof window === 'undefined') return true

  try {
    const saved = window.localStorage.getItem(BOH_SECTION_STORAGE_KEY)
    return saved ? saved === 'true' : true
  } catch {
    return true
  }
}

function readStoreSectionPreference() {
  if (typeof window === 'undefined') return true

  try {
    const saved = window.localStorage.getItem(STORE_SECTION_STORAGE_KEY)
    return saved ? saved === 'true' : true
  } catch {
    return true
  }
}

function DashSection({ icon, label, badge, open, onToggle, children }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/85 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50/60"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-base">{icon}</span>
        <span className="flex-1 text-sm font-semibold text-slate-900">{label}</span>
        {badge}
        <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-6">
          {children}
        </div>
      )}
    </div>
  )
}

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
  const [availableMonths, setAvailableMonths] = useState([])
  const [budgetMonth, setBudgetMonth] = useState(getMonthKey(today))
  const [loading, setLoading] = useState(true)
  const [showBudgetSection, setShowBudgetSection] = useState(readSectionPreference)
  const [showStoreSection, setShowStoreSection] = useState(readStoreSectionPreference)
  const [selectedBudgetDetail, setSelectedBudgetDetail] = useState(null)
  const [activeTab, setActiveTab] = useState('toko')
  const [visitPeriod, setVisitPeriod] = useState('week')
  const [visitSummary, setVisitSummary] = useState(EMPTY_VISIT_SUMMARY)
  const [managerCoverage, setManagerCoverage] = useState([])
  const [managerDailyStatus, setManagerDailyStatus] = useState([])
  const [expandedManagerId, setExpandedManagerId] = useState(null)
  const [notifPermission, setNotifPermission] = useState(getBrowserNotificationPermission())
  const [tokoOpen, setTokoOpen] = useState(false)
  const [visitOpen, setVisitOpen] = useState(false)

  const isOpsManager = isOpsLikeRole(profile?.role)
  const kpiEnabled = canViewKPI(profile?.role)
  const supplyChainEnabled = canViewSupplyChain(profile?.role)
  const accessibleBranchIdsRef = useRef(new Set())
  const dashboardRefreshRef = useRef(() => {})
  const refreshTimeoutRef = useRef(null)
  const bootstrappedBrowserNotificationsRef = useRef(false)
  const notifiedBrowserKeysRef = useRef(new Set())
  // Prevents the budgetMonth auto-correction inside fetchDashboard from
  // triggering a second fetch via the useEffect dependency on budgetMonth.
  const suppressBudgetMonthRefetchRef = useRef(false)

  useEffect(() => {
    if (!profile) return
    // Skip the extra fetch triggered by auto-correcting budgetMonth inside fetchDashboard
    if (suppressBudgetMonthRefetchRef.current) {
      suppressBudgetMonthRefetchRef.current = false
      return
    }
    fetchDashboard()
  }, [profile?.id, visitPeriod, budgetMonth])

  useEffect(() => {
    dashboardRefreshRef.current = () => fetchDashboard()
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(BOH_SECTION_STORAGE_KEY, String(showBudgetSection))
  }, [showBudgetSection])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORE_SECTION_STORAGE_KEY, String(showStoreSection))
  }, [showStoreSection])

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
    const shouldBlockScreen = stores.length === 0
    if (shouldBlockScreen) {
      setLoading(true)
    }
    const monthWindowStart = getMonthStart(addMonths(today, -5))

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
      setManagerDailyStatus([])
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
        .select('id,branch_id,shift,is_late,submitted_at,photos,answers,notes,item_oos')
        .in('branch_id', branchIds)
        .eq('tanggal', today),
      supabase
        .from('daily_preparation')
        .select('id,branch_id,shift')
        .in('branch_id', branchIds)
        .eq('tanggal', today),
      supabase
        .from('daily_reports')
        .select('id,branch_id,tanggal,net_sales,submitted_at')
        .in('branch_id', branchIds)
        .gte('tanggal', monthWindowStart)
        .lte('tanggal', today),
      supabase
        .from('daily_deposits')
        .select('id,branch_id,status,selisih,submitted_at,approved_at,rejection_reason')
        .in('branch_id', branchIds)
        .eq('tanggal', yesterday),
      supabase
        .from('operational_expenses')
        .select('id,branch_id,tanggal,category,total,item_name,created_at')
        .in('branch_id', branchIds)
        .gte('tanggal', monthWindowStart)
        .lte('tanggal', today)
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
      requests.push(
        supabase
          .from('daily_visits')
          .select('id,branch_id,tanggal,total_score,max_score,auditor_id')
          .in('branch_id', branchIds)
          .eq('tanggal', today)
          .order('created_at', { ascending: false })
      )
    }

    const [
      ceklisRes,
      prepRes,
      laporanRes,
      setoranRes,
      opexRes,
      visitRes,
      myVisitRes,
      managerRes,
      managerTodayVisitRes,
    ] = await Promise.all(requests)

    if (
      ceklisRes.error ||
      prepRes.error ||
      laporanRes.error ||
      setoranRes.error ||
      opexRes.error ||
      visitRes.error ||
      myVisitRes.error ||
      managerRes?.error ||
      managerTodayVisitRes?.error
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
      setManagerDailyStatus([])
      setLoading(false)
      return
    }

    const checklistsByBranch = {}
    const reportsByBranchDay = {}
    const reportsByBranchMonth = {}
    const depositsByBranch = {}
    const latestVisitByBranch = {}
    const myLatestVisitByBranch = {}
    const expensesByBranchDate = {}

    const prepByBranch = {}
    ;(ceklisRes.data || []).forEach((item) => {
      if (!checklistsByBranch[item.branch_id]) checklistsByBranch[item.branch_id] = {}
      checklistsByBranch[item.branch_id][item.shift] = item
    })
    ;(prepRes.data || []).forEach((item) => {
      if (!prepByBranch[item.branch_id]) prepByBranch[item.branch_id] = {}
      prepByBranch[item.branch_id][item.shift] = true
    })
    ;(laporanRes.data || []).forEach((item) => {
      if (item.tanggal === yesterday) {
        reportsByBranchDay[item.branch_id] = item
      }
      const monthKey = getMonthKey(item.tanggal)
      if (!reportsByBranchMonth[item.branch_id]) reportsByBranchMonth[item.branch_id] = {}
      if (!reportsByBranchMonth[item.branch_id][monthKey]) {
        reportsByBranchMonth[item.branch_id][monthKey] = {
          netSales: 0,
          filledDays: 0,
          lastSubmittedAt: item.submitted_at,
        }
      }

      reportsByBranchMonth[item.branch_id][monthKey].netSales += Number(item.net_sales || 0)
      reportsByBranchMonth[item.branch_id][monthKey].filledDays += 1
      reportsByBranchMonth[item.branch_id][monthKey].lastSubmittedAt = item.submitted_at
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
      const monthlyReports = reportsByBranchMonth[branch.id] || {}
      const monthlyBudget = buildMonthlyBudget(monthlyReports, expensesByBranchDate, branch.id)
      const selectedBudget =
        monthlyBudget[budgetMonth] ||
        monthlyBudget[getMonthKey(today)] ||
        monthlyBudget[Object.keys(monthlyBudget).sort().reverse()[0]] ||
        null

      return {
        ...branch,
        ceklisPagi: checklistsByBranch[branch.id]?.pagi || null,
        ceklisMiddle: checklistsByBranch[branch.id]?.middle || null,
        ceklisMalam: checklistsByBranch[branch.id]?.malam || null,
        prepPagi: prepByBranch[branch.id]?.pagi || false,
        prepMiddle: prepByBranch[branch.id]?.middle || false,
        prepMalam: prepByBranch[branch.id]?.malam || false,
        laporan: reportsByBranchDay[branch.id] || null,
        setoran: depositsByBranch[branch.id] || null,
        visitPeriod: latestVisitByBranch[branch.id] || null,
        myLastVisit: myLatestVisitByBranch[branch.id] || null,
        opexTodayCount: todayExpenses.length,
        opexTodayTotal: todayExpenses.reduce((sum, expense) => sum + Number(expense.total || 0), 0),
        monthlyBudget,
        selectedBudget,
      }
    })

    const months = buildAvailableMonths(reportsByBranchMonth, expensesByBranchDate, today)
    setAvailableMonths(months)
    if (!months.find((month) => month.key === budgetMonth) && months[0]) {
      suppressBudgetMonthRefetchRef.current = true
      setBudgetMonth(months[0].key)
    }

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
      setManagerDailyStatus(buildManagerDailyStatus(managerRes?.data || [], branches, managerTodayVisitRes?.data || []))
    } else {
      setManagerCoverage([])
      setManagerDailyStatus([])
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
    if (!store.ceklisPagi) return { tone: 'danger', label: 'Ceklis pagi belum masuk' }
    if (!store.laporan) return { tone: 'warn', label: 'Laporan harian tertahan' }
    if (store.setoran?.status === 'submitted') return { tone: 'warn', label: 'Menunggu approval setoran' }
    if (store.setoran?.status === 'rejected') return { tone: 'danger', label: 'Setoran ditolak' }
    if (!store.setoran) return { tone: 'warn', label: 'Belum submit setoran' }
    if (store.selectedBudget?.actualRatio != null && store.selectedBudget.actualRatio > 0.03) {
      return { tone: 'danger', label: 'BOH melewati batas 3%' }
    }
    return { tone: 'ok', label: 'Operasional aman' }
  }

  const shortName = profile?.full_name?.split(' ')[0] || '-'
  const roleName = profile?.role === 'district_manager'
    ? `DM ${(profile.managed_districts || []).join(', ')}`
    : profile?.role === 'area_manager'
      ? `AM ${(profile.managed_areas || []).join(', ')}`
      : 'Ops Manager'

  const storesWithoutVisit = stores.filter((store) => !store.visitPeriod)
  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const criticalAlertCount = alerts.filter((item) => ['danger', 'warn'].includes(item.level)).length
  const healthyStoreCount = stores.filter((store) => storeBadge(store).tone === 'ok').length
  const pendingStoreIssues = stores.length - healthyStoreCount
  const visitCoveragePct = Math.round((visitSummary.coveragePct || 0) * 100)
  const overviewCards = [
    {
      title: 'Ceklis Pagi',
      value: summary.ceklisOK,
      total: summary.total,
      note: summary.total === summary.ceklisOK ? 'Semua toko sudah mengirim ceklis pagi.' : `${summary.total - summary.ceklisOK} toko masih perlu diingatkan.`,
      icon: 'checklist',
      tone: 'orange',
    },
    {
      title: 'Laporan H-1',
      value: summary.laporanOK,
      total: summary.total,
      note: summary.laporanOK === summary.total ? 'Semua laporan harian sudah masuk.' : `${summary.total - summary.laporanOK} laporan masih tertahan.`,
      icon: 'chart',
      tone: 'primary',
    },
    {
      title: 'Visit Periode',
      value: visitSummary.visitedCount,
      total: summary.total,
      note: `${visitSummary.totalVisits} kunjungan tercatat untuk periode ${visitSummary.label || 'aktif'}.`,
      icon: 'map',
      tone: 'violet',
    },
    {
      title: 'Setoran Pending',
      value: summary.pendingSetoran,
      note: summary.pendingSetoran > 0 ? 'Masih ada approval yang perlu ditindaklanjuti.' : 'Tidak ada antrean approval setoran.',
      icon: 'finance',
      tone: summary.pendingSetoran > 0 ? 'rose' : 'emerald',
    },
  ]
  const snapshotStats = [
    { label: 'Outlet Aman', value: healthyStoreCount, tone: 'emerald' },
    { label: 'Butuh Follow Up', value: pendingStoreIssues, tone: pendingStoreIssues > 0 ? 'amber' : 'slate' },
    { label: 'Coverage Visit', value: `${visitCoveragePct}%`, tone: visitCoveragePct >= 80 ? 'emerald' : 'primary' },
    { label: 'BOH Over Budget', value: opexSummary.overBudget, tone: opexSummary.overBudget > 0 ? 'rose' : 'slate' },
  ]
  const insightItems = [
    {
      icon: criticalAlertCount > 0 ? 'warning' : 'spark',
      title: criticalAlertCount > 0 ? `${criticalAlertCount} alert prioritas menunggu follow up` : 'Tidak ada alert prioritas saat ini',
      body: criticalAlertCount > 0
        ? 'Fokuskan tindak lanjut ke toko yang belum isi ceklis, laporan, atau masih tertahan setorannya.'
        : 'Kondisi operasional inti relatif aman. Kamu bisa lanjut cek performa visit dan BOH.',
      tone: criticalAlertCount > 0 ? 'danger' : 'ok',
    },
    {
      icon: 'chart',
      title: `${opexSummary.withinBudget} toko masih di jalur BOH`,
      body: opexSummary.overBudget > 0
        ? `${opexSummary.overBudget} toko sedang melewati ambang 3% dan perlu dipantau lebih dekat.`
        : 'Tidak ada toko yang melewati ambang BOH 3% pada bulan aktif.',
      tone: opexSummary.overBudget > 0 ? 'warn' : 'info',
    },
    {
      icon: 'map',
      title: `${visitSummary.visitedCount} dari ${summary.total} outlet sudah tersentuh visit`,
      body: isOpsManager
        ? 'Gunakan monitoring per manager untuk melihat siapa yang masih tertinggal coverage-nya.'
        : 'Pantau daftar toko yang belum kamu kunjungi agar coverage periode ini cepat naik.',
      tone: visitCoveragePct >= 80 ? 'ok' : 'info',
    },
  ]

  return (
    <AppCanvas>
      {/* Compact Sticky Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-blue-50 px-5 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shrink-0">
            <AppIcon name="users" size={20} />
          </div>
          <div>
            <h1 className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">{roleName}</h1>
            <p className="font-extrabold text-gray-900 text-lg leading-tight">{shortName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {notifPermission !== 'granted' && (
            <button onClick={enableBrowserNotifications} className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 relative">
              <AppIcon name="bell" size={18} />
              {criticalAlertCount > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full" />}
            </button>
          )}
          <button onClick={signOut} className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors">
            <AppIcon name="logout" size={18} />
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 pb-36 pt-5 sm:px-6 lg:px-8 lg:pb-32">

        {/* Store Status Overview */}
        <div className="bg-gradient-to-br from-white to-blue-50/50 p-5 rounded-[2.5rem] border border-blue-100 shadow-sm mb-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-bold text-blue-900 uppercase">Status Ceklis Toko (Hari Ini)</h2>
            <span className="text-[10px] text-gray-500 font-medium">{loading ? '...' : `${summary.total} Toko`}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-5 sm:grid-cols-6">
            {[
              { label: 'Ceklis Pagi', val: stores.filter((store) => store.ceklisPagi).length, color: '#22c55e' },
              { label: 'Ceklis Middle', val: stores.filter((store) => store.ceklisMiddle).length, color: '#7c3aed' },
              { label: 'Ceklis Malam', val: stores.filter((store) => store.ceklisMalam).length, color: '#6366f1' },
              { label: 'Prep Pagi', val: stores.filter((store) => store.prepPagi).length, color: '#10b981' },
              { label: 'Prep Middle', val: stores.filter((store) => store.prepMiddle).length, color: '#0d9488' },
              { label: 'Prep Malam', val: stores.filter((store) => store.prepMalam).length, color: '#0891b2' },
            ].map((item, i) => {
              const offset = loading || summary.total === 0 ? 150 : 150 - (item.val / summary.total) * 150
              return (
                <div key={item.label} className={`text-center ${(i === 1 || i === 3) ? 'sm:border-l sm:border-blue-100' : ''}`}>
                  <p className="text-[9px] font-bold text-gray-400 mb-2 uppercase">{item.label}</p>
                  <div className="relative inline-flex items-center justify-center">
                    <svg className="w-14 h-14" style={{ transform: 'rotate(-90deg)' }}>
                      <circle strokeWidth="4" stroke="#e5e7eb" fill="transparent" r="24" cx="28" cy="28" />
                      <circle strokeWidth="4" strokeDasharray="150" strokeDashoffset={offset} strokeLinecap="round" stroke={item.color} fill="transparent" r="24" cx="28" cy="28" />
                    </svg>
                    <span className="absolute text-xs font-bold">{loading ? '-' : `${item.val}/${summary.total}`}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <Link to="/dm/stores" className="flex w-full py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
            <AppIcon name="checklist" size={16} />
            Detail Kepatuhan Toko
          </Link>
        </div>

        {isOpsManager && managerDailyStatus.length > 0 && (
          <div className="bg-gradient-to-br from-white to-blue-50/50 p-5 rounded-[2.5rem] border border-blue-100 shadow-sm mb-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-bold text-blue-900 uppercase">Status Visit Manager (Hari Ini)</h2>
              <span className="text-[10px] text-gray-500 font-medium">{managerDailyStatus.filter((item) => item.submittedCount > 0).length}/{managerDailyStatus.length} submit</span>
            </div>

            <div className="space-y-3 mb-5">
              {managerDailyStatus.map((manager) => (
                <div key={manager.id} className="flex items-center gap-3 rounded-[1.5rem] border border-blue-100 bg-white px-4 py-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[10px] font-black text-white ${manager.role === 'area_manager' ? 'bg-violet-500' : 'bg-blue-600'}`}>
                    {managerInitials(manager.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-900">{manager.full_name}</div>
                    <div className="text-[10px] text-slate-400">{manager.roleLabel}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-sm font-black ${manager.submittedCount > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {manager.submittedCount}/{manager.dailyTarget}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {manager.submittedCount > 0 ? 'visit hari ini sudah' : 'hari ini belum visit'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Link to="/ops/visit-monitor" className="flex w-full py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
              <AppIcon name="map" size={16} />
              Detail Visit Manager
            </Link>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { to: '/staff/laporan', icon: 'chart', label: 'Laporan\nHarian' },
            { to: '/kpi/personal/input', icon: 'checklist', label: 'Input\nKPI' },
            { to: '/dm/approval', icon: 'approval', label: 'Approval\nSetoran', badge: summary.pendingSetoran > 0 },
            { to: '/dm/visits', icon: 'map', label: 'Daily\nVisit' },
          ].map((action) => (
            <Link key={action.to} to={action.to} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-white border border-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm active:scale-95 transition-transform relative">
                <AppIcon name={action.icon} size={22} />
                {action.badge && <span className="absolute -top-1 -right-1 bg-red-500 w-3 h-3 rounded-full border border-white" />}
              </div>
              <span className="text-[9px] font-bold text-center leading-tight text-gray-700">
                {action.label.split('\n').map((l, i) => <span key={i}>{l}{i === 0 ? <br /> : ''}</span>)}
              </span>
            </Link>
          ))}
        </div>

        {/* Performance Snapshot */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 bg-white p-4 rounded-3xl border border-blue-100 shadow-sm">
            <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Ceklis Hari Ini</p>
            <div className="flex items-end justify-between">
              <h4 className="text-xl font-black text-blue-900">
                {loading || summary.total === 0 ? '-' : `${Math.round(summary.ceklisOK / summary.total * 100)}%`}
              </h4>
              <span className="text-[8px] text-green-500 font-bold mb-1">{summary.ceklisOK}/{summary.total}</span>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2">
              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: summary.total > 0 ? `${(summary.ceklisOK / summary.total) * 100}%` : '0%' }} />
            </div>
          </div>
          <div className="flex-1 bg-blue-600 p-4 rounded-3xl shadow-lg text-white">
            <p className="text-[9px] text-blue-100 font-bold uppercase mb-1">Coverage Visit</p>
            <div className="flex items-end justify-between">
              <h4 className="text-xl font-black">{visitCoveragePct}%</h4>
              <AppIcon name="map" size={16} className="mb-1 opacity-80" />
            </div>
            <p className="text-[8px] mt-1 opacity-80">{visitSummary.visitedCount}/{summary.total} toko</p>
          </div>
        </div>

        {criticalAlertCount > 0 && (
          <div className="bg-gradient-to-r from-blue-700 to-blue-500 p-5 rounded-[2rem] text-white relative overflow-hidden shadow-lg mb-5">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-yellow-400 text-blue-900 text-[8px] font-black px-2 py-0.5 rounded uppercase">Urgent</span>
                <span className="text-[9px] font-bold opacity-80">{todayLabel}</span>
              </div>
              <h3 className="font-bold text-sm mb-1">{criticalAlertCount} Alert Prioritas</h3>
              <p className="text-[10px] opacity-90 leading-relaxed line-clamp-2">{buildHeroSummary(stores)}</p>
            </div>
            <AppIcon name="warning" size={72} className="absolute -right-4 -bottom-4 opacity-10" />
          </div>
        )}

        <TaskWidget profile={profile} />

        <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Snapshot Cards */}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {overviewCards.map((card) => (
                <button
                  key={card.title}
                  onClick={() => card.title === 'Visit Periode' ? setActiveTab('kunjungan') : setActiveTab('toko')}
                  className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm text-left active:scale-[0.97] transition-transform"
                >
                  <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">{card.title}</p>
                  <p className="text-xl font-black text-blue-900">
                    {card.value}{card.total != null ? <span className="text-sm text-gray-400 font-semibold">/{card.total}</span> : ''}
                  </p>
                </button>
              ))}
            </div>

            {/* SOP Links */}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {[
                { to: '/dm/visits', icon: 'map', label: 'SOP Visit', sub: 'Daily audit toko', bg: 'bg-blue-50 border-blue-100 text-blue-600' },
                { to: '/dm/approval', icon: 'approval', label: 'Approval', sub: 'Setoran harian', bg: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
                { to: '/kpi/personal/input', icon: 'checklist', label: 'Input KPI', sub: 'Penilaian bulanan tim', bg: 'bg-sky-50 border-sky-100 text-sky-600' },
                ...(kpiEnabled ? [{ to: '/kpi', icon: 'chart', label: 'KPI Report', sub: 'Performa wilayah', bg: 'bg-primary-50 border-primary-100 text-primary-600' }] : []),
                ...(supplyChainEnabled ? [{ to: '/sc', icon: 'finance', label: 'Supply Chain', sub: 'Order & pengiriman', bg: 'bg-violet-50 border-violet-100 text-violet-600' }] : []),
            ...(isOpsManager ? [{ to: '/ops/laporan', icon: 'finance', label: 'Laporan Harian', sub: 'Setoran, opex, dan laporan', bg: 'bg-amber-50 border-amber-100 text-amber-600' }] : []),
            ...(isOpsManager ? [{ to: '/finance/audit', icon: 'approval', label: 'Audit Finance', sub: 'Review setoran finance', bg: 'bg-primary-50 border-primary-100 text-primary-600' }] : []),
              ].map((link) => (
                <Link key={link.to} to={link.to} className={`flex items-center gap-3 rounded-[1.5rem] border px-4 py-3 hover:opacity-80 transition-opacity ${link.bg}`}>
                  <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
                    <AppIcon name={link.icon} size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-900 leading-tight">{link.label}</p>
                    <p className="text-[9px] text-gray-500 leading-tight">{link.sub}</p>
                  </div>
                </Link>
              ))}
            </div>

            <DashSection
              icon="🏪"
              label="Status Toko"
              badge={
                criticalAlertCount > 0
                  ? <ToneBadge tone="danger">{criticalAlertCount} alert</ToneBadge>
                  : <ToneBadge tone="ok">{healthyStoreCount}/{stores.length} aman</ToneBadge>
              }
              open={tokoOpen}
              onToggle={() => setTokoOpen(v => !v)}
            >
            <>
                <div className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <InlineStat label="BOH Aman" value={opexSummary.withinBudget} tone="emerald" />
                    <InlineStat label="BOH > 3%" value={opexSummary.overBudget} tone="rose" />
                    <InlineStat label="Menunggu Laporan" value={opexSummary.pendingReport} tone="amber" />
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <SectionPanel
                      eyebrow="Urgensi"
                      title="Notifikasi Prioritas"
                      description="Daftar toko yang paling perlu follow up sekarang."
                      className="border-slate-100 bg-slate-50/70 shadow-none"
                      actions={<ToneBadge tone={criticalAlertCount > 0 ? 'danger' : 'ok'}>{criticalAlertCount > 0 ? `${criticalAlertCount} prioritas` : 'Aman'}</ToneBadge>}
                    >
                      {alerts.length === 0 ? (
                        <EmptyPanel
                          title="Semua toko dalam kondisi aman"
                          description="Saat ini tidak ada alert yang perlu kamu kejar. Kamu bisa cek aktivitas terbaru atau buka monitoring visit."
                        />
                      ) : (
                        <div className="space-y-3">
                          {alerts.map((alert) => (
                            <FeedCard key={alert.id} item={alert} />
                          ))}
                        </div>
                      )}
                    </SectionPanel>

                    <SectionPanel
                      eyebrow="Pulse"
                      title="Aktivitas Terbaru"
                      description="Semua update penting yang baru masuk dari toko."
                      className="border-slate-100 bg-slate-50/70 shadow-none"
                      actions={<ToneBadge tone="info">{activities.length} event</ToneBadge>}
                    >
                      {activities.length === 0 ? (
                        <EmptyPanel
                          title="Belum ada aktivitas terbaru"
                          description="Saat data baru masuk dari toko, update checklists, laporan, setoran, dan OPEX akan muncul di sini."
                        />
                      ) : (
                        <div className="space-y-3">
                          {activities.map((item) => (
                            <FeedCard key={item.id} item={item} />
                          ))}
                        </div>
                      )}
                    </SectionPanel>
                  </div>

                  <SectionPanel
                    eyebrow="Kontrol Biaya"
                    title="BOH vs Net Sales Bulanan"
                    description="Pantau rasio BOH per toko sekaligus proyeksi aman 3% untuk bulan yang dipilih."
                    actions={
                      <div className="flex flex-wrap items-center gap-2">
                        {availableMonths.length > 0 && (
                          <select
                            value={budgetMonth}
                            onChange={(event) => setBudgetMonth(event.target.value)}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                          >
                            {availableMonths.map((month) => (
                              <option key={month.key} value={month.key}>
                                {month.label}
                              </option>
                            ))}
                          </select>
                        )}
                        <SoftButton tone="white" icon={showBudgetSection ? 'chevronDown' : 'chevronRight'} onClick={() => setShowBudgetSection((current) => !current)}>
                          {showBudgetSection ? 'Sembunyikan' : 'Tampilkan'}
                        </SoftButton>
                      </div>
                    }
                  >
                    {showBudgetSection ? (
                      opexRows.length === 0 ? (
                        <EmptyPanel
                          title="Belum ada data BOH yang bisa dibandingkan"
                          description="Begitu laporan harian dan pengeluaran masuk, kontrol BOH bulanan akan otomatis muncul di sini."
                        />
                      ) : (
                        <div className="space-y-3">
                          {opexRows.map((row) => (
                            <BudgetRowCard key={row.id} row={row} onOpenDetail={() => setSelectedBudgetDetail(row)} />
                          ))}
                        </div>
                      )
                    ) : (
                      <EmptyPanel
                        title="Panel BOH sedang diringkas"
                        description="Tekan tampilkan untuk membuka daftar BOH semua toko dan masuk ke detail bila kamu butuh drilldown."
                        actionLabel="Tampilkan BOH"
                        onAction={() => setShowBudgetSection(true)}
                      />
                    )}
                  </SectionPanel>

                  <SectionPanel
                    eyebrow="Kesehatan Outlet"
                    title="Status Toko"
                    description="Snapshot operasional per outlet, lengkap dengan visit terakhir dan sinyal masalah utama."
                    actions={
                      <SoftButton tone="white" icon={showStoreSection ? 'chevronDown' : 'chevronRight'} onClick={() => setShowStoreSection((current) => !current)}>
                        {showStoreSection ? 'Sembunyikan' : 'Tampilkan'}
                      </SoftButton>
                    }
                  >
                    {showStoreSection ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {stores.map((store) => (
                          <StoreHealthCard
                            key={store.id}
                            store={store}
                            isOpsManager={isOpsManager}
                            badge={storeBadge(store)}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyPanel
                        title="Panel status toko sedang diringkas"
                        description="Tekan tampilkan kalau kamu mau membuka seluruh daftar kondisi toko tanpa meninggalkan dashboard."
                        actionLabel="Tampilkan Status"
                        onAction={() => setShowStoreSection(true)}
                      />
                    )}
                  </SectionPanel>
                </div>
            </>
            </DashSection>

            <DashSection
              icon="🗺️"
              label="Monitoring Visit"
              badge={<ToneBadge tone={visitCoveragePct >= 80 ? 'ok' : visitCoveragePct > 0 ? 'warn' : 'slate'}>{visitSummary.visitedCount}/{summary.total} · {visitCoveragePct}%</ToneBadge>}
              open={visitOpen}
              onToggle={() => setVisitOpen(v => !v)}
            >
            <>
              <div className="space-y-6">
                <SectionPanel
                  eyebrow="Visit Analytics"
                  title={`Coverage ${visitSummary.label || 'Aktif'}`}
                  description="Ringkasan kunjungan outlet selama periode yang dipilih."
                  className="border-slate-100 bg-slate-50/70 shadow-none"
                  actions={
                    <SegmentedControl
                      options={VISIT_PERIODS}
                      value={visitPeriod}
                      onChange={setVisitPeriod}
                    />
                  }
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <InlineStat label="Total Kunjungan" value={visitSummary.totalVisits} tone="primary" />
                    <InlineStat label="Terkunjungi" value={`${visitSummary.visitedCount}/${summary.total}`} tone="emerald" />
                    <InlineStat label="Belum Dikunjungi" value={visitSummary.unvisitedCount} tone={visitSummary.unvisitedCount > 0 ? 'rose' : 'slate'} />
                    <InlineStat label="Coverage" value={`${visitCoveragePct}%`} tone={visitCoveragePct >= 80 ? 'emerald' : 'primary'} />
                  </div>
                </SectionPanel>

                {isOpsManager && managerCoverage.length > 0 && (
                  <SectionPanel
                    eyebrow="Team Performance"
                    title="Progress Per Manager"
                    description="Pantau coverage visit tiap District Manager dan Area Manager."
                    className="border-slate-100 bg-slate-50/70 shadow-none"
                    actions={<ToneBadge tone="info">{managerCoverage.length} manager</ToneBadge>}
                  >
                    <div className="space-y-3">
                      {managerCoverage.map((manager) => (
                        <CoverageManagerCard
                          key={manager.id}
                          manager={manager}
                          expanded={expandedManagerId === manager.id}
                          onToggle={() => setExpandedManagerId(expandedManagerId === manager.id ? null : manager.id)}
                        />
                      ))}
                    </div>
                  </SectionPanel>
                )}

                {storesWithoutVisit.length > 0 && (
                  <SectionPanel
                    eyebrow="Gap Alert"
                    title="Toko Belum Dikunjungi"
                    description="Outlet berikut belum punya visit di periode ini."
                    className="border-slate-100 bg-slate-50/70 shadow-none"
                    actions={<ToneBadge tone="danger">{storesWithoutVisit.length} outlet</ToneBadge>}
                  >
                    <div className="space-y-2">
                      {storesWithoutVisit.map((store) => (
                        <StoreVisitRow
                          key={store.id}
                          store={store}
                          subtitle={isOpsManager ? `${store.district} · ${store.area}` : store.myLastVisit ? `Visit terakhir saya: ${formatVisitDate(store.myLastVisit.tanggal)}` : 'Belum pernah saya visit'}
                          statusLabel="Belum dikunjungi"
                          statusTone="danger"
                        />
                      ))}
                    </div>
                  </SectionPanel>
                )}

                {!isOpsManager && (
                  <SectionPanel
                    eyebrow="My Coverage"
                    title="Riwayat Visit Saya"
                    description="Status kunjungan semua toko dalam scope kamu."
                    className="border-slate-100 bg-slate-50/70 shadow-none"
                  >
                    <div className="space-y-2">
                      {stores.map((store) => (
                        <StoreVisitRow
                          key={store.id}
                          store={store}
                          subtitle={store.myLastVisit ? `Visit terakhir saya: ${formatVisitDate(store.myLastVisit.tanggal)}` : 'Belum pernah saya visit'}
                          statusLabel={store.visitPeriod ? `Periode ini: ${formatVisitDate(store.visitPeriod.tanggal)}` : 'Belum ada visit'}
                          statusTone={store.visitPeriod ? 'ok' : 'slate'}
                        />
                      ))}
                    </div>
                  </SectionPanel>
                )}

                <SectionPanel
                  eyebrow="Activity Log"
                  title="Log Kunjungan"
                  description="Semua kunjungan tercatat selama periode aktif, diurutkan terbaru."
                  className="border-slate-100 bg-slate-50/70 shadow-none"
                  actions={<ToneBadge tone="info">{visits.length} visit</ToneBadge>}
                >
                  {visits.length === 0 ? (
                    <EmptyPanel
                      title="Belum ada kunjungan pada periode ini"
                      description="Mulai isi audit toko dari halaman Daily Visit untuk mencatat kunjungan."
                    />
                  ) : (
                    <div className="space-y-3">
                      {visits.map((visit) => (
                        <VisitHistoryRow key={visit.id} visit={visit} />
                      ))}
                    </div>
                  )}
                </SectionPanel>
              </div>
            </>
            </DashSection>
          </>
        )}
      </div>
      </main>

      {selectedBudgetDetail && (
        <BudgetDetailSheet
          row={selectedBudgetDetail}
          onClose={() => setSelectedBudgetDetail(null)}
        />
      )}

      {isOpsManager ? <OpsBottomNav /> : <DMBottomNav />}
    </AppCanvas>
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

function buildManagerDailyStatus(managers, branches, visits) {
  return managers
    .map((manager) => {
      const managedBranches = branches.filter((branch) => canManagerAccessBranch(manager, branch))
      const managedBranchIds = new Set(managedBranches.map((branch) => branch.id))
      const managerVisits = visits.filter((visit) => visit.auditor_id === manager.id && managedBranchIds.has(visit.branch_id))

      return {
        id: manager.id,
        full_name: manager.full_name,
        role: manager.role,
        roleLabel: roleLabel(manager.role),
        dailyTarget: 1,
        submittedCount: managerVisits.length > 0 ? 1 : 0,
        visitsToday: managerVisits.length,
        managedStoreCount: managedBranches.length,
      }
    })
    .filter((manager) => manager.managedStoreCount > 0)
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'district_manager' ? -1 : 1
      return a.full_name.localeCompare(b.full_name, 'id-ID')
    })
}

function managerInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '--'
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

    if (store.selectedBudget?.actualRatio != null && store.selectedBudget.actualRatio > 0.03) {
      items.push({
        id: `budget-over-${store.selectedBudget.monthKey}-${store.id}`,
        level: 'danger',
        title: `${shortName} melewati budget BOH`,
        subtitle: `BOH ${fmtRp(store.selectedBudget.bohTotal)} vs net sales ${fmtRp(store.selectedBudget.actualNetSales)} (${formatRatio(store.selectedBudget.actualRatio)})`,
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
      const budget = store.selectedBudget

      if (!budget) {
        return {
          id: store.id,
          name: store.name,
          status: 'pending',
          monthKey: null,
          bohAmount: 0,
          netSales: 0,
          ratio: null,
          estimatedNetSales: 0,
          projectedRatio: null,
          budgetCap: 0,
          note: 'Belum ada data bulanan yang bisa dihitung',
        }
      }

      if (budget.filledDays === 0 || budget.actualNetSales <= 0) {
        return {
          id: store.id,
          name: store.name,
          monthKey: budget.monthKey,
          status: budget.bohTotal > 0 ? 'over' : 'pending',
          bohAmount: budget.bohTotal,
          netSales: budget.actualNetSales,
          ratio: budget.bohTotal > 0 ? 1 : null,
          estimatedNetSales: budget.estimatedNetSales,
          projectedRatio: budget.projectedRatio,
          budgetCap: budget.estimatedBudgetCap,
          note: 'Net sales bulan ini belum cukup untuk dibandingkan',
        }
      }

      return {
        id: store.id,
        name: store.name,
        monthKey: budget.monthKey,
        status: budget.actualRatio > 0.03 ? 'over' : 'within',
        bohAmount: budget.bohTotal,
        netSales: budget.actualNetSales,
        ratio: budget.actualRatio,
        estimatedNetSales: budget.estimatedNetSales,
        projectedRatio: budget.projectedRatio,
        budgetCap: budget.estimatedBudgetCap,
        note: budget.actualRatio > 0.03 ? 'Melewati batas maksimal 3%' : 'Masih dalam batas maksimal 3%',
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

function buildMonthlyBudget(monthlyReports, expensesByBranchDate, branchId) {
  const reportMonths = Object.keys(monthlyReports || {})
  const expenseMonths = Object.keys(expensesByBranchDate || {})
    .filter((key) => key.startsWith(`${branchId}:`))
    .map((key) => key.split(':')[1])
    .filter((date) => {
      const expenses = expensesByBranchDate[`${branchId}:${date}`] || []
      return expenses.some((expense) => expense.category === BOH_CATEGORY)
    })
    .map((date) => getMonthKey(date))

  const months = Array.from(new Set([...reportMonths, ...expenseMonths]))
  const budgetMap = {}

  months.forEach((monthKey) => {
    const report = monthlyReports[monthKey] || { netSales: 0, filledDays: 0 }
    const daysInMonth = getDaysInMonth(monthKey)
    const monthlyDates = Object.keys(expensesByBranchDate || {}).filter((key) => key.startsWith(`${branchId}:${monthKey}`))
    const bohTotal = monthlyDates.reduce((sum, key) => {
      const expenses = expensesByBranchDate[key] || []
      return sum + expenses
        .filter((expense) => expense.category === BOH_CATEGORY)
        .reduce((innerSum, expense) => innerSum + Number(expense.total || 0), 0)
    }, 0)
    const actualNetSales = Number(report.netSales || 0)
    const estimatedNetSales = report.filledDays > 0
      ? Math.round((actualNetSales / report.filledDays) * daysInMonth * SALES_SAFETY_FACTOR)
      : 0

    budgetMap[monthKey] = {
      monthKey,
      bohTotal,
      actualNetSales,
      filledDays: report.filledDays || 0,
      daysInMonth,
      actualRatio: actualNetSales > 0 ? bohTotal / actualNetSales : null,
      estimatedNetSales,
      projectedRatio: estimatedNetSales > 0 ? bohTotal / estimatedNetSales : null,
      estimatedBudgetCap: estimatedNetSales > 0 ? estimatedNetSales * 0.03 : 0,
    }
  })

  return budgetMap
}

function buildAvailableMonths(reportsByBranchMonth, expensesByBranchDate, today) {
  const reportMonths = Object.values(reportsByBranchMonth || {}).flatMap((months) => Object.keys(months || {}))
  const expenseMonths = Object.keys(expensesByBranchDate || {}).map((key) => getMonthKey(key.split(':')[1]))
  const monthKeys = Array.from(new Set([getMonthKey(today), ...reportMonths, ...expenseMonths]))
    .sort()
    .reverse()

  return monthKeys.map((monthKey) => ({
    key: monthKey,
    label: formatMonthKey(monthKey),
  }))
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

function getMonthKey(dateString) {
  return String(dateString).slice(0, 7)
}

function getMonthStart(dateString) {
  return `${getMonthKey(dateString)}-01`
}

function addMonths(dateString, offset) {
  const [year, month] = getMonthKey(dateString).split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function getDaysInMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function formatMonthKey(monthKey) {
  return new Date(`${monthKey}-01`).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })
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

function FeedCard({ item }) {
  const tone = item.level === 'danger'
    ? 'danger'
    : item.level === 'warn'
      ? 'warn'
      : item.level === 'ok'
        ? 'ok'
        : 'info'

  const icon = item.level === 'danger'
    ? 'warning'
    : item.level === 'warn'
      ? 'bell'
      : item.level === 'ok'
        ? 'checklist'
        : 'spark'

  return (
    <article className="rounded-[24px] border border-white/85 bg-white px-4 py-4 shadow-[0_16px_42px_-34px_rgba(15,23,42,0.35)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <AppIcon name={icon} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">{item.title}</div>
              <div className="mt-1 text-sm leading-6 text-slate-500">{item.subtitle}</div>
            </div>
            <ToneBadge tone={tone}>{item.timeLabel}</ToneBadge>
          </div>
        </div>
      </div>
    </article>
  )
}

function InsightCard({ item }) {
  const tone = item.tone === 'danger'
    ? 'danger'
    : item.tone === 'warn'
      ? 'warn'
      : item.tone === 'ok'
        ? 'ok'
        : 'info'

  const accent = tone === 'danger'
    ? 'bg-rose-50 text-rose-700'
    : tone === 'warn'
      ? 'bg-amber-50 text-amber-700'
      : tone === 'ok'
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-primary-50 text-primary-700'

  return (
    <article className="rounded-[24px] border border-white/80 bg-white px-5 py-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.3)]">
      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${accent}`}>
        <AppIcon name={item.icon} size={20} />
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-950">{item.title}</div>
          <div className="mt-2 text-sm leading-6 text-slate-500">{item.body}</div>
        </div>
        <ToneBadge tone={tone}>{tone === 'danger' ? 'Prioritas' : tone === 'warn' ? 'Pantau' : 'Insight'}</ToneBadge>
      </div>
    </article>
  )
}

const PLATFORM_KEYS = ['toko_buka', 'gofood_aktif', 'grabfood_aktif', 'shopeefood_aktif']
const PLATFORM_LABELS = { toko_buka: 'Toko', gofood_aktif: 'GoFood', grabfood_aktif: 'GrabFood', shopeefood_aktif: 'ShopeeFood' }
const AREA_PHOTO_KEYS = ['staff_grooming', 'bar_bersih', 'kitchen_bersih', 'indoor_ns_bersih', 'outdoor_bersih']

function ChecklistPreview({ checklist }) {
  const answers = checklist.answers || {}
  const photos = checklist.photos || {}
  const notes = checklist.notes || ''
  const oos = checklist.item_oos || []

  const previewUrls = AREA_PHOTO_KEYS
    .flatMap((key) => photos[key] || [])
    .slice(0, 4)

  const platformStatus = PLATFORM_KEYS.map((key) => ({
    label: PLATFORM_LABELS[key],
    ok: !!answers[key],
  }))

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1">
        {platformStatus.map(({ label, ok }) => (
          <span
            key={label}
            className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}
          >
            {ok ? '✓' : '✗'} {label}
          </span>
        ))}
      </div>
      {previewUrls.length > 0 && (
        <PhotoViewer urls={previewUrls} emptyText="" />
      )}
      {oos.length > 0 && (
        <div className="text-[11px] text-amber-700">
          OOS: {oos.join(', ')}
        </div>
      )}
      {notes && (
        <div className="line-clamp-2 text-[11px] text-slate-500">{notes}</div>
      )}
    </div>
  )
}

function StoreHealthCard({ store, isOpsManager, badge }) {
  const visitScore = store.visitPeriod ? scorePercent(store.visitPeriod) : null
  const budgetRatio = store.selectedBudget?.actualRatio ?? store.selectedBudget?.projectedRatio ?? null
  const shortName = store.name.replace('Bagi Kopi ', '')
  const setoranTone = store.setoran?.status === 'approved'
    ? 'ok'
    : store.setoran?.status === 'submitted'
      ? 'warn'
      : store.setoran?.status === 'rejected'
        ? 'danger'
        : 'slate'

  const setoranLabel = store.setoran?.status === 'approved'
    ? 'Setoran approved'
    : store.setoran?.status === 'submitted'
      ? 'Setoran pending'
      : store.setoran?.status === 'rejected'
        ? 'Setoran rejected'
        : 'Setoran belum masuk'

  return (
    <article className="rounded-[22px] border border-white/85 bg-white p-4 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.28)] sm:rounded-[24px] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <span className="text-sm font-bold">{store.store_id?.replace('BK-', '') || '--'}</span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold text-slate-950">{shortName}</div>
              <div className="mt-1 text-sm text-slate-500">
                {isOpsManager ? `${store.district} / ${store.area}` : badge.label}
              </div>
            </div>
          </div>
        </div>
        <ToneBadge tone={badge.tone}>{badge.label}</ToneBadge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 px-3.5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2">Ceklis Harian</div>
          <div className="flex gap-2">
            {[
              { label: 'Pagi', ok: !!store.ceklisPagi, late: store.ceklisPagi?.is_late },
              { label: 'Middle', ok: !!store.ceklisMiddle, late: store.ceklisMiddle?.is_late },
              { label: 'Malam', ok: !!store.ceklisMalam, late: store.ceklisMalam?.is_late },
            ].map((s) => (
              <div key={s.label} className={`flex-1 rounded-xl px-2 py-1.5 text-center ${s.ok ? (s.late ? 'bg-amber-100' : 'bg-emerald-100') : 'bg-slate-100'}`}>
                <div className={`text-[9px] font-bold ${s.ok ? (s.late ? 'text-amber-700' : 'text-emerald-700') : 'text-slate-400'}`}>{s.label}</div>
                <div className={`text-[8px] font-semibold mt-0.5 ${s.ok ? (s.late ? 'text-amber-600' : 'text-emerald-600') : 'text-slate-400'}`}>
                  {s.ok ? (s.late ? 'Terlambat' : '✓') : '–'}
                </div>
              </div>
            ))}
          </div>
          {store.ceklisPagi && <ChecklistPreview checklist={store.ceklisPagi} />}
        </div>
        <div className="rounded-2xl bg-slate-50 px-3.5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2">Preparation</div>
          <div className="flex gap-2">
            {[
              { label: 'Pagi', ok: store.prepPagi },
              { label: 'Middle', ok: store.prepMiddle },
              { label: 'Malam', ok: store.prepMalam },
            ].map((s) => (
              <div key={s.label} className={`flex-1 rounded-xl px-2 py-1.5 text-center ${s.ok ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                <div className={`text-[9px] font-bold ${s.ok ? 'text-emerald-700' : 'text-slate-400'}`}>{s.label}</div>
                <div className={`text-[8px] font-semibold mt-0.5 ${s.ok ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {s.ok ? '✓' : '–'}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3.5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Laporan H-1</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{store.laporan ? fmtRp(store.laporan.net_sales || 0) : 'Belum masuk'}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3.5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Visit Periode</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">
            {store.visitPeriod ? `${formatVisitDate(store.visitPeriod.tanggal)} - ${visitScore}%` : 'Belum ada visit'}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3.5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">BOH Bulan Aktif</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">
            {budgetRatio == null ? 'Belum cukup data' : formatRatio(budgetRatio)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ToneBadge tone={store.ceklisPagi ? 'ok' : 'danger'}>{store.ceklisPagi ? 'Ceklis Pagi ✓' : 'Ceklis Pagi –'}</ToneBadge>
        <ToneBadge tone={store.ceklisMiddle ? 'ok' : 'slate'}>{store.ceklisMiddle ? 'Middle ✓' : 'Middle –'}</ToneBadge>
        <ToneBadge tone={store.ceklisMalam ? 'ok' : 'slate'}>{store.ceklisMalam ? 'Malam ✓' : 'Malam –'}</ToneBadge>
        <ToneBadge tone={store.laporan ? 'ok' : 'warn'}>{store.laporan ? 'Laporan masuk' : 'Laporan tertahan'}</ToneBadge>
        <ToneBadge tone={setoranTone}>{setoranLabel}</ToneBadge>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
        <div>
          {store.myLastVisit
            ? `Visit terakhir saya: ${formatVisitDate(store.myLastVisit.tanggal)}`
            : 'Belum pernah saya visit'}
        </div>
        {store.selectedBudget?.estimatedBudgetCap > 0 && (
          <div className="font-medium text-slate-700">
            Budget 3%: {fmtRp(store.selectedBudget.estimatedBudgetCap)}
          </div>
        )}
      </div>
    </article>
  )
}

function OpexBudgetRow({ row, onOpenDetail }) {
  const tone = row.status === 'over' ? 'danger' : row.status === 'pending' ? 'warn' : 'ok'
  const statusLabel = row.status === 'over' ? 'Over 3%' : row.status === 'pending' ? 'Pending' : 'Aman'

  return (
    <article className="rounded-[22px] border border-white/85 bg-white p-4 shadow-[0_16px_42px_-34px_rgba(15,23,42,0.28)] sm:rounded-[24px] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-slate-950">{row.name.replace('Bagi Kopi ', '')}</div>
          <div className="mt-1 text-sm text-slate-500">
            {row.monthKey ? `${formatMonthKey(row.monthKey)} · ${row.note}` : row.note}
          </div>
        </div>
        <ToneBadge tone={tone}>{statusLabel}</ToneBadge>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
        <div className="rounded-[20px] bg-slate-50 px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Total BOH</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{fmtRp(row.bohAmount)}</div>
        </div>
        <div className="rounded-[20px] bg-slate-50 px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Net Sales</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{fmtRp(row.netSales)}</div>
        </div>
        <div className="rounded-[20px] bg-slate-50 px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Rasio</div>
          <div className={`mt-2 text-sm font-semibold ${row.status === 'over' ? 'text-rose-600' : row.status === 'pending' ? 'text-amber-700' : 'text-emerald-700'}`}>
            {row.ratio == null ? '-' : formatRatio(row.ratio)}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="text-sm text-slate-500">
          Estimasi {fmtRp(row.estimatedNetSales)} · budget {fmtRp(row.budgetCap)}
        </div>
        <button
          onClick={onOpenDetail}
          className="rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700"
        >
          Detail
        </button>
      </div>
    </article>
  )
}

function BudgetDetailModal({ row, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 px-4 py-6 backdrop-blur-[2px]">
      <div className="w-full max-w-[480px] overflow-hidden rounded-[32px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Detail BOH</div>
            <div className="mt-1 text-lg font-semibold text-slate-950">{row.name.replace('Bagi Kopi ', '')}</div>
            <div className="mt-1 text-sm text-slate-500">
              {row.monthKey ? formatMonthKey(row.monthKey) : 'Belum ada periode'} · {row.note}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 hover:border-primary-200 hover:text-primary-700"
          >
            ×
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <InlineStat label="Total BOH" value={fmtRp(row.bohAmount)} tone="slate" />
            <InlineStat label="Net Sales Input" value={fmtRp(row.netSales)} tone="slate" />
            <InlineStat label="Rasio Aktual" value={row.ratio == null ? '-' : formatRatio(row.ratio)} tone={row.status === 'over' ? 'rose' : 'emerald'} />
            <InlineStat label="Estimasi Sales" value={fmtRp(row.estimatedNetSales)} tone="primary" />
            <InlineStat label="Budget BOH 3%" value={fmtRp(row.budgetCap)} tone="primary" />
            <InlineStat label="Rasio Estimasi" value={row.projectedRatio == null ? '-' : formatRatio(row.projectedRatio)} tone="primary" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ManagerCoverageCard({ manager, expanded, onToggle }) {
  const coverage = manager.totalStores ? manager.visitedCount / manager.totalStores : 0
  const coverageTone = coverage >= 0.8 ? 'ok' : coverage > 0 ? 'warn' : 'danger'

  return (
    <article className="rounded-[24px] border border-white/85 bg-white shadow-[0_18px_55px_-38px_rgba(15,23,42,0.3)]">
      <button onClick={onToggle} className="w-full px-4 py-4 text-left transition-colors hover:bg-slate-50/50 sm:px-5 sm:py-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 text-sm font-bold sm:h-12 sm:w-12">
            {(manager.name || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-950">{manager.name}</div>
                <div className="mt-1 text-sm text-slate-500">{manager.roleLabel} · {manager.scopeLabel}</div>
              </div>
              <div className="shrink-0 text-right">
                <ToneBadge tone={coverageTone}>{Math.round(coverage * 100)}%</ToneBadge>
                <div className="mt-2 text-sm text-slate-500">{manager.visitedCount}/{manager.totalStores} toko</div>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${Math.round(coverage * 100)}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ToneBadge tone="ok">{manager.visitedCount} dikunjungi</ToneBadge>
              {manager.unvisitedStores.length > 0 && (
                <ToneBadge tone="danger">{manager.unvisitedStores.length} belum</ToneBadge>
              )}
              <ToneBadge tone="primary">{manager.totalVisits} visit · avg {manager.averagePct}%</ToneBadge>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4 sm:px-5 sm:py-5">
          {manager.unvisitedStores.length > 0 && (
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">Belum dikunjungi</div>
              <div className="flex flex-wrap gap-2">
                {manager.unvisitedStores.map((store) => (
                  <ToneBadge key={store.id} tone="danger">{store.name.replace('Bagi Kopi ', '')}</ToneBadge>
                ))}
              </div>
            </div>
          )}
          {manager.visitedStores.length > 0 && (
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600">Sudah dikunjungi</div>
              <div className="space-y-2">
                {manager.visitedStores.map((store) => (
                  <div key={store.id} className="flex items-center justify-between rounded-[20px] bg-slate-50 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{store.name.replace('Bagi Kopi ', '')}</div>
                      <div className="mt-1 text-sm text-slate-500">{formatVisitDate(store.tanggal)}</div>
                    </div>
                    <ToneBadge tone="primary">{store.scorePct}%</ToneBadge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function StoreVisitRow({ store, subtitle, statusLabel, statusTone }) {
  const safeSubtitle = String(subtitle || '')
    .replaceAll('Â·', '/')
    .replaceAll('·', '/')
    .replaceAll('Ã—', 'x')

  return (
    <div className="flex items-center gap-4 rounded-[22px] bg-slate-50/85 px-4 py-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 text-sm font-bold">
        {store.store_id?.split('-')[1] || '??'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-950">{store.name.replace('Bagi Kopi ', '')}</div>
        <div className="mt-1 truncate text-sm text-slate-500">{safeSubtitle}</div>
      </div>
      <ToneBadge tone={statusTone || 'slate'}>{statusLabel}</ToneBadge>
    </div>
  )
}

function VisitHistoryCard({ visit }) {
  const grade = visitGrade(visit.total_score, visit.max_score)
  const pct = visit.max_score ? Math.round((Number(visit.total_score) / Number(visit.max_score)) * 100) : 0
  const tone = pct >= 85 ? 'ok' : pct >= 70 ? 'warn' : 'danger'

  return (
    <article className="flex items-center gap-4 rounded-[22px] bg-slate-50/85 px-4 py-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 text-sm font-bold">
        {visit.branch?.store_id?.split('-')[1] || '??'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-950">
          {visit.branch?.name?.replace('Bagi Kopi ', '') || '-'}
        </div>
        <div className="mt-1 text-sm text-slate-500">
          {formatVisitDate(visit.tanggal)} · oleh {visit.auditor?.full_name?.split(' ')[0] || '-'}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold text-primary-700">{visit.total_score}/{visit.max_score}</div>
        <ToneBadge tone={tone}>{grade.label}</ToneBadge>
      </div>
    </article>
  )
}

function BudgetRowCard({ row, onOpenDetail }) {
  const tone = row.status === 'over' ? 'danger' : row.status === 'pending' ? 'warn' : 'ok'
  const statusLabel = row.status === 'over' ? 'Over 3%' : row.status === 'pending' ? 'Pending' : 'Aman'
  const periodLabel = row.monthKey ? `${formatMonthKey(row.monthKey)} / ${row.note}` : row.note

  return (
    <article className="rounded-[22px] border border-white/85 bg-white p-4 shadow-[0_16px_42px_-34px_rgba(15,23,42,0.28)] sm:rounded-[24px] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-slate-950">{row.name.replace('Bagi Kopi ', '')}</div>
          <div className="mt-1 text-sm text-slate-500">{periodLabel}</div>
        </div>
        <ToneBadge tone={tone}>{statusLabel}</ToneBadge>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
        <div className="rounded-[20px] bg-slate-50 px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Total BOH</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{fmtRp(row.bohAmount)}</div>
        </div>
        <div className="rounded-[20px] bg-slate-50 px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Net Sales</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{fmtRp(row.netSales)}</div>
        </div>
        <div className="rounded-[20px] bg-slate-50 px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Rasio</div>
          <div className={`mt-2 text-sm font-semibold ${row.status === 'over' ? 'text-rose-600' : row.status === 'pending' ? 'text-amber-700' : 'text-emerald-700'}`}>
            {row.ratio == null ? '-' : formatRatio(row.ratio)}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="text-sm text-slate-500">
          Estimasi {fmtRp(row.estimatedNetSales)} / budget {fmtRp(row.budgetCap)}
        </div>
        <button
          onClick={onOpenDetail}
          className="rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700"
        >
          Detail
        </button>
      </div>
    </article>
  )
}

function BudgetDetailSheet({ row, onClose }) {
  const periodLabel = `${row.monthKey ? formatMonthKey(row.monthKey) : 'Belum ada periode'} / ${row.note}`

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 px-4 py-6 backdrop-blur-[2px]">
      <div className="w-full max-w-[480px] overflow-hidden rounded-[32px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Detail BOH</div>
            <div className="mt-1 text-lg font-semibold text-slate-950">{row.name.replace('Bagi Kopi ', '')}</div>
            <div className="mt-1 text-sm text-slate-500">{periodLabel}</div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 hover:border-primary-200 hover:text-primary-700"
          >
            x
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <InlineStat label="Total BOH" value={fmtRp(row.bohAmount)} tone="slate" />
            <InlineStat label="Net Sales Input" value={fmtRp(row.netSales)} tone="slate" />
            <InlineStat label="Rasio Aktual" value={row.ratio == null ? '-' : formatRatio(row.ratio)} tone={row.status === 'over' ? 'rose' : 'emerald'} />
            <InlineStat label="Estimasi Sales" value={fmtRp(row.estimatedNetSales)} tone="primary" />
            <InlineStat label="Budget BOH 3%" value={fmtRp(row.budgetCap)} tone="primary" />
            <InlineStat label="Rasio Estimasi" value={row.projectedRatio == null ? '-' : formatRatio(row.projectedRatio)} tone="primary" />
          </div>
        </div>
      </div>
    </div>
  )
}

function CoverageManagerCard({ manager, expanded, onToggle }) {
  const coverage = manager.totalStores ? manager.visitedCount / manager.totalStores : 0
  const coverageTone = coverage >= 0.8 ? 'ok' : coverage > 0 ? 'warn' : 'danger'

  return (
    <article className="rounded-[24px] border border-white/85 bg-white shadow-[0_18px_55px_-38px_rgba(15,23,42,0.3)]">
      <button onClick={onToggle} className="w-full px-4 py-4 text-left transition-colors hover:bg-slate-50/50 sm:px-5 sm:py-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 text-sm font-bold sm:h-12 sm:w-12">
            {(manager.name || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-950">{manager.name}</div>
                <div className="mt-1 text-sm text-slate-500">{manager.roleLabel} / {manager.scopeLabel}</div>
              </div>
              <div className="shrink-0 text-right">
                <ToneBadge tone={coverageTone}>{Math.round(coverage * 100)}%</ToneBadge>
                <div className="mt-2 text-sm text-slate-500">{manager.visitedCount}/{manager.totalStores} toko</div>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${Math.round(coverage * 100)}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ToneBadge tone="ok">{manager.visitedCount} dikunjungi</ToneBadge>
              {manager.unvisitedStores.length > 0 && (
                <ToneBadge tone="danger">{manager.unvisitedStores.length} belum</ToneBadge>
              )}
              <ToneBadge tone="primary">{manager.totalVisits} visit / avg {manager.averagePct}%</ToneBadge>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4 sm:px-5 sm:py-5">
          {manager.unvisitedStores.length > 0 && (
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">Belum dikunjungi</div>
              <div className="flex flex-wrap gap-2">
                {manager.unvisitedStores.map((store) => (
                  <ToneBadge key={store.id} tone="danger">{store.name.replace('Bagi Kopi ', '')}</ToneBadge>
                ))}
              </div>
            </div>
          )}
          {manager.visitedStores.length > 0 && (
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600">Sudah dikunjungi</div>
              <div className="space-y-2">
                {manager.visitedStores.map((store) => (
                  <div key={store.id} className="flex items-center justify-between rounded-[20px] bg-slate-50 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{store.name.replace('Bagi Kopi ', '')}</div>
                      <div className="mt-1 text-sm text-slate-500">{formatVisitDate(store.tanggal)}</div>
                    </div>
                    <ToneBadge tone="primary">{store.scorePct}%</ToneBadge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function VisitHistoryRow({ visit }) {
  const grade = visitGrade(visit.total_score, visit.max_score)
  const pct = visit.max_score ? Math.round((Number(visit.total_score) / Number(visit.max_score)) * 100) : 0
  const tone = pct >= 85 ? 'ok' : pct >= 70 ? 'warn' : 'danger'

  return (
    <article className="flex items-center gap-4 rounded-[22px] bg-slate-50/85 px-4 py-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 text-sm font-bold">
        {visit.branch?.store_id?.split('-')[1] || '??'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-950">
          {visit.branch?.name?.replace('Bagi Kopi ', '') || '-'}
        </div>
        <div className="mt-1 text-sm text-slate-500">
          {formatVisitDate(visit.tanggal)} / oleh {visit.auditor?.full_name?.split(' ')[0] || '-'}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold text-primary-700">{visit.total_score}/{visit.max_score}</div>
        <ToneBadge tone={tone}>{grade.label}</ToneBadge>
      </div>
    </article>
  )
}
