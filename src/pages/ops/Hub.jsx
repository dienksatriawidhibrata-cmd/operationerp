import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { OpsBottomNav } from '../../components/BottomNav'
import SopPreviewSection from '../../components/SopPreviewSection'
import { AppIcon } from '../../components/ui/AppKit'
import { currentPeriodWIB, lastNPeriods, periodBounds, periodLabel, roleLabel, todayWIB } from '../../lib/utils'

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

export default function OpsHub() {
  const { profile, signOut } = useAuth()
  const today = todayWIB()
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriodWIB())

  const [stats, setStats] = useState({
    pendingSetoran: 0,
    ceklisToday: 0,
    activeOrders: 0,
    totalBranches: 0,
  })
  const [leaderboards, setLeaderboards] = useState({
    staffTop: [],
    staffBottom: [],
    storesTop: [],
    storesBottom: [],
    headStoresTop: [],
    headStoresBottom: [],
  })
  const [leaderboardView, setLeaderboardView] = useState('store')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    fetchLeaderboards()
  }, [selectedPeriod])

  const fetchStats = async () => {
    const [setoranRes, ceklisRes, ordersRes, branchRes] = await Promise.all([
      supabase.from('daily_deposits').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
      supabase.from('daily_checklists').select('id', { count: 'exact', head: true }).eq('tanggal', today),
      supabase.from('supply_orders').select('id', { count: 'exact', head: true }).not('status', 'in', '("completed","cancelled")'),
      supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ])

    setStats({
      pendingSetoran: setoranRes.count ?? 0,
      ceklisToday: ceklisRes.count ?? 0,
      activeOrders: ordersRes.count ?? 0,
      totalBranches: branchRes.count ?? 0,
    })
    setLoading(false)
  }

  const fetchLeaderboards = async () => {
    const { startDate, endDate } = periodBounds(selectedPeriod)
    const elapsedDays = getElapsedDaysInPeriod(selectedPeriod, today)
    const expectedChecklistDays = elapsedDays * 3
    const expectedPreparationDays = elapsedDays * 3
    const expectedHeadStoreReportDays = Math.max(elapsedDays - 1, 0)
    const expectedHeadStoreDepositDays = Math.max(elapsedDays - 1, 0)
    const expectedHeadStoreOpexDays = elapsedDays

    const [
      branchesRes,
      storeProfilesRes,
      headStoresRes,
      checklistsRes,
      preparationRes,
      reportsRes,
      depositsRes,
      opexRes,
    ] = await Promise.all([
      supabase.from('branches')
        .select('id, name, store_id')
        .eq('is_active', true)
        .order('name'),
      supabase.from('profiles')
        .select('id, full_name, role, branch_id')
        .eq('is_active', true)
        .in('role', ['staff', 'barista', 'kitchen', 'waitress', 'asst_head_store'])
        .not('branch_id', 'is', null)
        .order('full_name'),
      supabase.from('profiles')
        .select('id, full_name, branch_id')
        .eq('is_active', true)
        .eq('role', 'head_store')
        .not('branch_id', 'is', null)
        .order('full_name'),
      supabase.from('daily_checklists')
        .select('branch_id, submitted_by, is_late')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate),
      supabase.from('daily_preparation')
        .select('branch_id, shift, tanggal, created_at, updated_at')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate),
      supabase.from('daily_reports')
        .select('branch_id, submitted_by, tanggal, submitted_at')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate),
      supabase.from('daily_deposits')
        .select('branch_id, submitted_by, tanggal, submitted_at')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate),
      supabase.from('operational_expenses')
        .select('branch_id, submitted_by, tanggal, created_at')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate),
    ])

    if (
      branchesRes.error ||
      storeProfilesRes.error ||
      headStoresRes.error ||
      checklistsRes.error ||
      preparationRes.error ||
      reportsRes.error ||
      depositsRes.error ||
      opexRes.error
    ) {
      setLeaderboards({
        staffTop: [],
        staffBottom: [],
        storesTop: [],
        storesBottom: [],
        headStoresTop: [],
        headStoresBottom: [],
      })
      return
    }

    const branches = branchesRes.data || []
    const storeProfiles = storeProfilesRes.data || []
    const headStores = headStoresRes.data || []
    const branchMap = Object.fromEntries(branches.map((branch) => [branch.id, branch]))
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
      ])
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
      ])
    )

    ;(checklistsRes.data || []).forEach((row) => {
      const current = storeBase[row.branch_id]
      if (!current) return
      current.checklistCount += 1
      if (!row.is_late) current.checklistOnTime += 1

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
      const onTimePct = pct(
        row.checklistOnTime + row.preparationOnTime,
        expectedChecklistDays + expectedPreparationDays
      )
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
      ])
    )

    ;(reportsRes.data || []).forEach((row) => {
      const current = headStoreBase[row.submitted_by]
      if (!current) return
      const previous = current.reportDays.get(row.tanggal)
      const next = {
        submittedAt: row.submitted_at,
        onTime: isReportLikeOnTime(row.tanggal, row.submitted_at),
      }
      if (!previous || new Date(row.submitted_at) < new Date(previous.submittedAt)) {
        current.reportDays.set(row.tanggal, next)
      }
    })

    ;(depositsRes.data || []).forEach((row) => {
      const current = headStoreBase[row.submitted_by]
      if (!current) return
      const previous = current.depositDays.get(row.tanggal)
      const next = {
        submittedAt: row.submitted_at,
        onTime: isReportLikeOnTime(row.tanggal, row.submitted_at),
      }
      if (!previous || new Date(row.submitted_at) < new Date(previous.submittedAt)) {
        current.depositDays.set(row.tanggal, next)
      }
    })

    ;(opexRes.data || []).forEach((row) => {
      const current = headStoreBase[row.submitted_by]
      if (!current) return
      const previous = current.opexDays.get(row.tanggal)
      const next = {
        createdAt: row.created_at,
        onTime: isOpexOnTime(row.tanggal, row.created_at),
      }
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
        expectedHeadStoreReportDays + expectedHeadStoreDepositDays + expectedHeadStoreOpexDays
      )
      const onTimePct = pct(
        reportOnTime + depositOnTime + opexOnTime,
        expectedHeadStoreReportDays + expectedHeadStoreDepositDays + expectedHeadStoreOpexDays
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

    setLeaderboards({
      staffTop: [...staffRows]
        .sort((a, b) => (b.score - a.score) || b.metrics.localeCompare(a.metrics) || a.title.localeCompare(b.title, 'id-ID'))
        .slice(0, 10),
      staffBottom: [...staffRows]
        .sort((a, b) => (a.score - b.score) || a.metrics.localeCompare(b.metrics) || a.title.localeCompare(b.title, 'id-ID'))
        .slice(0, 10),
      storesTop: [...storeRows]
        .sort((a, b) => (b.score - a.score) || b.metrics.localeCompare(a.metrics) || a.title.localeCompare(b.title, 'id-ID'))
        .slice(0, 10),
      storesBottom: [...storeRows]
        .sort((a, b) => (a.score - b.score) || a.metrics.localeCompare(b.metrics) || a.title.localeCompare(b.title, 'id-ID'))
        .slice(0, 10),
      headStoresTop: [...headStoreRows]
        .sort((a, b) => (b.score - a.score) || b.metrics.localeCompare(a.metrics) || a.title.localeCompare(b.title, 'id-ID'))
        .slice(0, 10),
      headStoresBottom: [...headStoreRows]
        .sort((a, b) => (a.score - b.score) || a.metrics.localeCompare(b.metrics) || a.title.localeCompare(b.title, 'id-ID'))
        .slice(0, 10),
    })
  }

  const shortName = profile?.full_name?.split(' ')[0] ?? 'Manager'
  const periodText = periodLabel(selectedPeriod)

  const pillars = [
    {
      icon: 'store',
      label: 'Retail Pillar',
      sub: `${loading ? '-' : stats.totalBranches} Toko Aktif`,
      status: stats.pendingSetoran > 0 ? 'Pending' : 'Normal',
      detail: stats.pendingSetoran > 0 ? `${stats.pendingSetoran} setoran pending` : `Ceklis masuk ${stats.ceklisToday}`,
      statusColor: stats.pendingSetoran > 0 ? 'text-orange-500' : 'text-green-500',
      bg: 'bg-orange-50 text-orange-600',
    },
    {
      icon: 'finance',
      label: 'Supply Chain',
      sub: `${loading ? '-' : stats.activeOrders} Order Aktif`,
      status: stats.activeOrders > 0 ? 'Berjalan' : 'Aman',
      detail: stats.activeOrders > 0 ? `${stats.activeOrders} order diproses` : 'Tidak ada order tertunda',
      statusColor: stats.activeOrders > 0 ? 'text-blue-500' : 'text-green-500',
      bg: 'bg-blue-50 text-blue-600',
    },
    {
      icon: 'users',
      label: 'Trainer & Dev',
      sub: 'Staff Onboarding',
      status: 'Active',
      detail: 'Lihat dashboard trainer',
      statusColor: 'text-indigo-600',
      bg: 'bg-indigo-50 text-indigo-600',
    },
  ]

  const quickActions = [
    { to: '/dm/approval', icon: 'approval', label: 'Approval\nSetoran', bg: 'bg-amber-50 border-amber-100 text-amber-600' },
    { to: '/dm', icon: 'home', label: 'DM\nDashboard', bg: 'bg-blue-50 border-blue-100 text-blue-600' },
    { to: '/kpi/personal/input', icon: 'checklist', label: 'Input\nKPI', bg: 'bg-sky-50 border-sky-100 text-sky-600' },
    { to: '/tasks', icon: 'checklist', label: 'Manajemen\nTugas', bg: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
  ]

  const reportLinks = [
    { to: '/dm', icon: 'home', label: 'DM Dashboard', sub: 'Ringkasan semua toko', bg: 'bg-blue-50 border-blue-100', color: 'text-blue-600' },
    { to: '/kpi/personal/input', icon: 'checklist', label: 'Input KPI Personal', sub: 'Penilaian manager & store lead', bg: 'bg-sky-50 border-sky-100', color: 'text-sky-600' },
    { to: '/ops/laporan', icon: 'finance', label: 'Laporan Harian', sub: 'Setoran, opex, dan laporan harian', bg: 'bg-slate-100', color: 'text-slate-600' },
    { to: '/trainer', icon: 'users', label: 'Trainer Hub', sub: 'Penilaian staff', bg: 'bg-emerald-50 border-emerald-100', color: 'text-emerald-600' },
    { to: '/trainer/oje', icon: 'checklist', label: 'OJE', sub: 'On Job Evaluation', bg: 'bg-teal-50 border-teal-100', color: 'text-teal-600' },
    { to: '/ops/visit-monitor', icon: 'map', label: 'Audit Log Visit', sub: 'Skor & foto kunjungan', bg: 'bg-violet-50 border-violet-100', color: 'text-violet-600' },
    { to: '/support/staff', icon: 'users', label: 'Manajemen Staf', sub: 'Akun & akses pengguna', bg: 'bg-slate-50 border-slate-200', color: 'text-slate-600' },
  ]

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-28">
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-blue-50 bg-white/80 px-6 py-4 backdrop-blur-md">
        <div>
          <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Operations Manager</h1>
          <p className="text-xl font-extrabold text-gray-900">Command Center</p>
        </div>
        <div className="flex gap-2">
          {stats.pendingSetoran > 0 && (
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <AppIcon name="bell" size={18} />
              <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
            </div>
          )}
          <button onClick={signOut} className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100">
            <AppIcon name="logout" size={18} />
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-[2rem] bg-blue-600 p-4 text-white shadow-lg shadow-blue-200 transition-transform active:scale-[0.97]">
            <p className="mb-1 text-[9px] font-bold uppercase opacity-80">Toko Aktif</p>
            <h3 className="text-xl font-black">{loading ? '...' : stats.totalBranches}</h3>
            <p className="mt-2 text-[9px] font-bold opacity-70">
              {stats.ceklisToday > 0 ? `${stats.ceklisToday} ceklis masuk` : 'Menunggu ceklis'}
            </p>
          </div>
          <div className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-sm">
            <p className="mb-1 text-[9px] font-bold uppercase text-gray-400">Setoran Pending</p>
            <h3 className={`text-xl font-black ${stats.pendingSetoran > 0 ? 'text-orange-500' : 'text-blue-900'}`}>
              {loading ? '...' : stats.pendingSetoran}
            </h3>
            <div className="mt-2 h-1.5 w-full rounded-full bg-blue-50">
              <div
                className="h-1.5 rounded-full bg-blue-600 transition-all"
                style={{ width: stats.totalBranches > 0 ? `${Math.max(0, 100 - (stats.pendingSetoran / stats.totalBranches) * 100)}%` : '100%' }}
              />
            </div>
          </div>
        </div>

        <h2 className="mb-4 text-sm font-extrabold text-gray-800">Pillar Performance</h2>
        <div className="mb-6 space-y-3">
          {pillars.map((pillar) => (
            <div key={pillar.label} className="flex items-center justify-between rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${pillar.bg}`}>
                  <AppIcon name={pillar.icon} size={20} />
                </div>
                <div>
                  <p className="text-xs font-black">{pillar.label}</p>
                  <p className="text-[10px] text-gray-400">{pillar.sub}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-xs font-black ${pillar.statusColor}`}>{pillar.status}</p>
                <p className="text-[9px] text-gray-400">{pillar.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mb-4 text-sm font-extrabold text-gray-800">Akses Cepat</h2>
        <div className="mb-6 grid grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to} className="flex flex-col items-center gap-2">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm transition-transform active:scale-95 ${action.bg}`}>
                <AppIcon name={action.icon} size={22} />
              </div>
              <span className="text-center text-[9px] font-bold leading-tight text-gray-700">
                {action.label.split('\n').map((line, index) => <span key={index}>{line}{index === 0 ? <br /> : ''}</span>)}
              </span>
            </Link>
          ))}
        </div>

        <h2 className="mb-4 text-sm font-extrabold text-gray-800">Laporan Lengkap</h2>
        <div className="mb-6 grid grid-cols-2 gap-3">
          {reportLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-3 rounded-[1.5rem] border px-4 py-3.5 transition-opacity hover:opacity-80 ${link.bg}`}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ${link.color}`}>
                <AppIcon name={link.icon} size={18} />
              </div>
              <div>
                <p className="text-xs font-black leading-tight text-gray-900">{link.label}</p>
                <p className="text-[9px] leading-tight text-gray-400">{link.sub}</p>
              </div>
            </Link>
          ))}
        </div>

        <SopPreviewSection title="Panduan SOP" accent="blue" />

        <h2 className="mb-4 text-sm font-extrabold text-gray-800">Leaderboard Operasional</h2>
        <div className="mb-4">
          <select
            value={selectedPeriod}
            onChange={(event) => setSelectedPeriod(event.target.value)}
            className="w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
          >
            {lastNPeriods(6).map((period) => (
              <option key={period} value={period}>{periodLabel(period)}</option>
            ))}
          </select>
        </div>
        <div className="mb-4 flex gap-2 rounded-[1.25rem] bg-white p-1 shadow-sm">
          <LeaderboardTab label="Toko" active={leaderboardView === 'store'} onClick={() => setLeaderboardView('store')} />
          <LeaderboardTab label="Staff" active={leaderboardView === 'staff'} onClick={() => setLeaderboardView('staff')} />
          <LeaderboardTab label="Head Store" active={leaderboardView === 'head_store'} onClick={() => setLeaderboardView('head_store')} />
        </div>

        <div className="mb-6 grid gap-4 xl:grid-cols-2">
          {leaderboardView === 'store' && (
            <>
              <LeaderboardCard
                title="Top 10 Toko"
                subtitle={`${periodText} · Ceklis + Preparation`}
                tone="emerald"
                countLabel="toko"
                rows={leaderboards.storesTop}
                emptyText="Belum ada data toko untuk periode ini."
              />
              <LeaderboardCard
                title="Bottom 10 Toko"
                subtitle={`${periodText} · Ceklis + Preparation`}
                tone="rose"
                countLabel="toko"
                rows={leaderboards.storesBottom}
                emptyText="Belum ada data toko untuk periode ini."
              />
            </>
          )}
          {leaderboardView === 'staff' && (
            <>
              <LeaderboardCard
                title="Top 10 Staff"
                subtitle={`${periodText} · Checklist`}
                tone="emerald"
                countLabel="staff"
                rows={leaderboards.staffTop}
                emptyText="Belum ada data staff untuk periode ini."
              />
              <LeaderboardCard
                title="Bottom 10 Staff"
                subtitle={`${periodText} · Checklist`}
                tone="rose"
                countLabel="staff"
                rows={leaderboards.staffBottom}
                emptyText="Belum ada data staff untuk periode ini."
              />
            </>
          )}
          {leaderboardView === 'head_store' && (
            <>
              <LeaderboardCard
                title="Top 10 Head Store"
                subtitle={`${periodText} · Opex + Setoran + Laporan`}
                tone="blue"
                countLabel="head store"
                rows={leaderboards.headStoresTop}
                emptyText="Belum ada data head store untuk periode ini."
              />
              <LeaderboardCard
                title="Bottom 10 Head Store"
                subtitle={`${periodText} · Opex + Setoran + Laporan`}
                tone="rose"
                countLabel="head store"
                rows={leaderboards.headStoresBottom}
                emptyText="Belum ada data head store untuk periode ini."
              />
            </>
          )}
        </div>

        <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-5 text-white">
          <div className="relative z-10">
            <h4 className="mb-1 text-sm font-bold italic">"Efisiensi adalah kunci keberlanjutan."</h4>
            <p className="text-[10px] opacity-60">Halo {shortName} - Status sistem hari ini: terkendali.</p>
          </div>
          <AppIcon name="spark" size={80} className="absolute right-4 top-4 opacity-5" />
        </div>
      </div>

      <OpsBottomNav />
    </div>
  )
}

function LeaderboardCard({ title, subtitle, tone, countLabel, rows, emptyText }) {
  const toneClasses = {
    emerald: {
      badge: 'bg-emerald-50 text-emerald-600',
      rank: 'bg-emerald-50 text-emerald-600',
      score: 'text-emerald-700',
    },
    rose: {
      badge: 'bg-rose-50 text-rose-600',
      rank: 'bg-rose-50 text-rose-600',
      score: 'text-rose-700',
    },
    blue: {
      badge: 'bg-sky-50 text-sky-600',
      rank: 'bg-sky-50 text-sky-600',
      score: 'text-sky-700',
    },
  }[tone]

  return (
    <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-slate-900">{title}</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{subtitle}</div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${toneClasses.badge}`}>
          {rows.length} {countLabel}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">{emptyText}</div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={row.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-black ${toneClasses.rank}`}>
                #{index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{row.title}</div>
                <div className="truncate text-[11px] text-slate-500">{row.subtitle}</div>
                <div className="mt-1 truncate text-[10px] font-medium text-slate-400">{row.note}</div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-black ${toneClasses.score}`}>{row.score}</div>
                <div className="text-[10px] font-semibold text-slate-400">{row.metrics}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LeaderboardTab({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-[1rem] px-3 py-2 text-sm font-bold transition-colors ${
        active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )
}

function weightedScore(completionPct, onTimePct) {
  return Math.round((completionPct * 0.7) + (onTimePct * 0.3))
}

function pct(value, total) {
  if (!total || total <= 0) return 0
  return Math.round((value / total) * 100)
}

function getElapsedDaysInPeriod(period, today) {
  if (!period || !today) return 0
  if (today.startsWith(period)) {
    return Number(today.slice(8, 10))
  }

  return periodBounds(period).daysInMonth
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
  const utcHourByShift = {
    pagi: 1,
    middle: 7,
    malam: 20,
  }

  const deadlineHour = utcHourByShift[row.shift]
  if (deadlineHour == null) return false

  const deadline = new Date(Date.UTC(year, month - 1, day, deadlineHour, 0, 0))
  return new Date(timestamp) <= deadline
}
