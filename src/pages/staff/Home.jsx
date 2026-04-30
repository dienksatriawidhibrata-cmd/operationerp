import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { StaffBottomNav } from '../../components/BottomNav'
import { canViewKPI, canViewSupplyChain, isStoreRole } from '../../lib/access'
import { AppIcon } from '../../components/ui/AppKit'
import { currentPeriodWIB, fmtRp, todayWIB, yesterdayWIB, sisaWaktuLaporan } from '../../lib/utils'
import ReminderBanner from '../../components/ReminderBanner'
import LeaderboardSection from '../../components/LeaderboardSection'
import { fetchOperationalLeaderboards, EMPTY_LEADERBOARDS } from '../../lib/opsLeaderboards'

function StatusItem({ icon, label, done, loading, statusLabel, to }) {
  const tone = loading ? 'loading' : done ? 'done' : 'pending'
  const styles = {
    loading: { card: 'bg-slate-50',  iconBg: '#cbd5e1', track: 'bg-slate-100', fill: 'w-0' },
    done:    { card: 'bg-blue-50',   iconBg: '#2563eb', track: 'bg-blue-100',  fill: 'bg-blue-600 w-full' },
    pending: { card: 'bg-rose-50',   iconBg: '#ef4444', track: 'bg-rose-100',  fill: 'w-0' },
  }[tone]

  const content = (
    <div className={`${styles.card} rounded-2xl p-3 text-center`}>
      <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: styles.iconBg }}>
        <AppIcon name={icon} size={14} className="text-white" />
      </div>
      <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">{label}</p>
      <div className={`w-full ${styles.track} h-1.5 rounded-full overflow-hidden`}>
        <div className={`h-1.5 rounded-full transition-all duration-500 ${styles.fill}`} />
      </div>
      <p className="text-[8px] text-gray-400 mt-1 font-semibold">
        {loading ? '...' : statusLabel}
      </p>
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="block transition-transform active:scale-[0.98]">
        {content}
      </Link>
    )
  }

  return content
}

const HIDDEN_HEAD_STORE_ROLES = ['staff', 'barista', 'kitchen', 'waitress']

export default function StaffHome() {
  const { profile, signOut } = useAuth()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState([])
  const [tasks, setTasks] = useState([])
  const [leaderboardPeriod, setLeaderboardPeriod] = useState(currentPeriodWIB())
  const [leaderboardView, setLeaderboardView] = useState('staff')
  const [leaderboards, setLeaderboards] = useState(EMPTY_LEADERBOARDS)

  const today = todayWIB()
  const yesterday = yesterdayWIB()

  useEffect(() => {
    fetchSopAndAnnouncements()
    fetchTasks()
    if (!profile?.branch_id) {
      setLoading(false)
      return
    }
    fetchStatus()
  }, [profile])

  useEffect(() => {
    fetchOperationalLeaderboards({ supabase, period: leaderboardPeriod, today })
      .then(setLeaderboards)
      .catch(() => setLeaderboards(EMPTY_LEADERBOARDS))
  }, [leaderboardPeriod])

  const fetchSopAndAnnouncements = async () => {
    const [annRes] = await Promise.all([
      supabase.from('announcements').select('id,title,body,published_at').eq('is_active', true).order('published_at', { ascending: false }).limit(5),
    ])
    if (annRes.data) setAnnouncements(annRes.data)
  }

  const fetchTasks = async () => {
    if (!profile?.id || profile.role !== 'head_store') {
      setTasks([])
      return
    }

    const { data } = await supabase
      .from('dm_tasks')
      .select('id,title,due_date,is_done,created_at')
      .eq('assigned_to', profile.id)
      .eq('is_done', false)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(5)

    setTasks(data || [])
  }

  const fetchStatus = async () => {
    const branchId = profile.branch_id

    const [ceklisPagi, ceklisMiddle, ceklisMalam, laporan, prepPagi, prepMiddle, prepMalam, opexToday, setoran] = await Promise.all([
      supabase.from('daily_checklists')
        .select('id, is_late, submitted_at')
        .eq('branch_id', branchId).eq('tanggal', today).eq('shift', 'pagi')
        .maybeSingle(),

      supabase.from('daily_checklists')
        .select('id, is_late')
        .eq('branch_id', branchId).eq('tanggal', today).eq('shift', 'middle')
        .maybeSingle(),

      supabase.from('daily_checklists')
        .select('id, is_late')
        .eq('branch_id', branchId).eq('tanggal', today).eq('shift', 'malam')
        .maybeSingle(),

      supabase.from('daily_reports')
        .select('id, submitted_at, is_late')
        .eq('branch_id', branchId).eq('tanggal', yesterday)
        .maybeSingle(),

      supabase.from('daily_preparation')
        .select('id')
        .eq('branch_id', branchId).eq('tanggal', today).eq('shift', 'pagi')
        .maybeSingle(),

      supabase.from('daily_preparation')
        .select('id')
        .eq('branch_id', branchId).eq('tanggal', today).eq('shift', 'middle')
        .maybeSingle(),

      supabase.from('daily_preparation')
        .select('id')
        .eq('branch_id', branchId).eq('tanggal', today).eq('shift', 'malam')
        .maybeSingle(),

      supabase.from('operational_expenses')
        .select('total')
        .eq('branch_id', branchId).eq('tanggal', today),

      supabase.from('daily_deposits')
        .select('id')
        .eq('branch_id', branchId)
        .eq('tanggal', yesterday)
        .in('status', ['submitted', 'approved'])
        .maybeSingle(),
    ])

    const totalOpex = (opexToday.data || []).reduce((sum, row) => sum + Number(row.total), 0)

    setStatus({
      ceklisPagi: ceklisPagi.data,
      ceklisMiddle: ceklisMiddle.data,
      ceklisMalam: ceklisMalam.data,
      laporan: laporan.data,
      prepPagi: prepPagi.data,
      prepMiddle: prepMiddle.data,
      prepMalam: prepMalam.data,
      setoran: setoran.data,
      totalOpex,
    })
    setLoading(false)
  }

  const isStoreLevel = isStoreRole(profile?.role)
  const isHeadStore = profile?.role === 'head_store'
  const isAsstHeadStore = profile?.role === 'asst_head_store'
  const kpiEnabled = canViewKPI(profile?.role)
  const supplyChainEnabled = canViewSupplyChain(profile?.role)
  const shortName = profile?.full_name?.split(' ')[0] || '-'
  const branchName = profile?.branch?.name?.replace('Bagi Kopi ', '') || 'Toko'

  const ceklisDone = [status?.ceklisPagi, status?.ceklisMiddle, status?.ceklisMalam].filter(Boolean).length
  const ceklisPct = Math.round((ceklisDone / 3) * 100)
  const laporanStatus = status?.laporan ? (status.laporan.is_late ? 'Terlambat' : 'Masuk') : 'Belum'
  const opexStatus = (status?.totalOpex || 0) > 0 ? 'Sudah ada input' : 'Belum ada input'

  const quickActions = isHeadStore ? [
    { to: '/laporan',               icon: 'chart',     label: 'Hub\nLaporan' },
    { to: '/staff/pengajuan-opex',  icon: 'finance',   label: 'Pengajuan\nDana' },
    { to: '/kpi/personal/input',    icon: 'checklist', label: 'Input\nKPI Team' },
    { to: '/kpi/360',               icon: 'spark',     label: 'Penilaian\n360°' },
    { to: '/sc/sj',                 icon: 'finance',   label: 'Terima\nBarang' },
    { to: '/sop',                   icon: 'checklist', label: 'Panduan\nSOP' },
  ] : isAsstHeadStore ? [
    { to: '/laporan',                 icon: 'chart',     label: 'Hub\nLaporan' },
    { to: '/laporan/quality-control', icon: 'checklist', label: 'Quality\nControl' },
    { to: '/kpi/personal',            icon: 'chart',     label: 'KPI\nPersonal' },
    { to: '/kpi/360',                 icon: 'spark',     label: 'Penilaian\n360°' },
    { to: '/sc/sj',                   icon: 'finance',   label: 'Terima\nBarang' },
    { to: '/sop',                     icon: 'checklist', label: 'Panduan\nSOP' },
  ] : isStoreLevel ? [
    { to: '/staff/preparation',  icon: 'approval',  label: 'Prep\nHarian' },
    { to: '/kpi/personal',       icon: 'chart',     label: 'KPI\nPersonal' },
    { to: '/kpi/360',            icon: 'spark',     label: 'Penilaian\n360°' },
    { to: '/sc/sj',              icon: 'finance',   label: 'Terima\nBarang' },
    { to: '/sop',                icon: 'checklist', label: 'Panduan\nSOP' },
  ] : [
    ...(kpiEnabled ? [{ to: '/kpi', icon: 'checklist', label: 'KPI\nKerja' }] : []),
    ...(supplyChainEnabled ? [{ to: '/sc/sj', icon: 'finance', label: 'Penerimaan\nBarang' }] : []),
    { to: '/sop', icon: 'checklist', label: 'Panduan\nSOP' },
  ]

  const hasPendingReportReminder = !loading && !status?.laporan && profile?.branch_id && (isHeadStore || !isStoreLevel)

  return (
    <div className="min-h-screen bg-[#f0f6ff] pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 flex justify-between items-center border-b border-blue-50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-base shadow-md">
            {shortName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-semibold">Selamat Bekerja,</p>
            <p className="font-extrabold text-gray-900 text-base leading-tight">{shortName}</p>
          </div>
        </div>
        <button type="button" onClick={signOut} className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors">
          <AppIcon name="logout" size={18} />
        </button>
      </div>

      <div className="px-5 pt-5">
        {/* Branch not configured */}
        {!loading && !profile?.branch_id && (
          <div className="mb-4 p-4 rounded-3xl bg-rose-50 border border-rose-100">
            <p className="text-sm text-rose-700 font-semibold">Akun belum dikonfigurasi ke cabang manapun. Hubungi ops manager.</p>
          </div>
        )}

        {isStoreLevel && profile?.branch_id && (
          <ReminderBanner status={status} loading={loading} isHeadStore={isHeadStore} />
        )}

        {isHeadStore && (
          <div className="bg-white rounded-[2rem] border border-amber-50 shadow-sm mb-5 overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xs font-black text-gray-800 uppercase tracking-wide">Laporan Harian</h2>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">{branchName}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <StatusItem
                  icon="chart"
                  label="Laporan"
                  done={!loading && !!status?.laporan}
                  loading={loading}
                  statusLabel={laporanStatus}
                  to="/staff/laporan#laporan-form"
                />
                <StatusItem
                  icon="opex"
                  label="Opex"
                  done={!loading && (status?.totalOpex || 0) > 0}
                  loading={loading}
                  statusLabel={opexStatus}
                  to="/staff/opex"
                />
                <StatusItem
                  icon="finance"
                  label="Setoran"
                  done={!loading && !!status?.setoran}
                  loading={loading}
                  statusLabel={loading ? '...' : status?.setoran ? 'Sudah' : 'Belum'}
                  to="/staff/laporan#setoran-form"
                />
              </div>
            </div>

            <Link
              to="/laporan"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-amber-500 text-white font-bold text-sm text-center hover:bg-amber-600 transition-colors active:scale-[0.98]"
            >
              <AppIcon name="chart" size={16} />
              Buka Hub Laporan
            </Link>
          </div>
        )}

        {/* Ceklis Card */}
        <div className="bg-white rounded-[2rem] border border-blue-50 shadow-sm mb-5 overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-black text-gray-800 uppercase tracking-wide">Status Ceklis Harian</h2>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{branchName}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <StatusItem
                icon="spark"
                label="Pagi"
                done={!!status?.ceklisPagi}
                loading={loading}
                statusLabel={status?.ceklisPagi ? (status.ceklisPagi.is_late ? 'Terlambat' : 'Selesai') : 'Belum'}
                to="/staff/ceklis"
              />
              <StatusItem
                icon="checklist"
                label="Middle"
                done={!!status?.ceklisMiddle}
                loading={loading}
                statusLabel={status?.ceklisMiddle ? (status.ceklisMiddle.is_late ? 'Terlambat' : 'Selesai') : 'Belum'}
                to="/staff/ceklis"
              />
              <StatusItem
                icon="checklist"
                label="Malam"
                done={!!status?.ceklisMalam}
                loading={loading}
                statusLabel={status?.ceklisMalam ? 'Selesai' : 'Belum'}
                to="/staff/ceklis"
              />
            </div>
          </div>

          {isStoreLevel && (
            <Link
              to="/staff/ceklis"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-blue-600 text-white font-bold text-sm text-center hover:bg-blue-700 transition-colors active:scale-[0.98]"
            >
              <AppIcon name="checklist" size={16} />
              Mulai Input Ceklis
            </Link>
          )}
        </div>

        {/* Preparation Card */}
        <div className="bg-white rounded-[2rem] border border-emerald-50 shadow-sm mb-5 overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-black text-gray-800 uppercase tracking-wide">Status Preparation Harian</h2>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{branchName}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <StatusItem
                icon="spark"
                label="Pagi"
                done={!!status?.prepPagi}
                loading={loading}
                statusLabel={status?.prepPagi ? 'Selesai' : 'Belum'}
                to="/staff/preparation"
              />
              <StatusItem
                icon="checklist"
                label="Middle"
                done={!!status?.prepMiddle}
                loading={loading}
                statusLabel={status?.prepMiddle ? 'Selesai' : 'Belum'}
                to="/staff/preparation"
              />
              <StatusItem
                icon="approval"
                label="Malam"
                done={!!status?.prepMalam}
                loading={loading}
                statusLabel={status?.prepMalam ? 'Selesai' : 'Belum'}
                to="/staff/preparation"
              />
            </div>
          </div>

          {isStoreLevel && (
            <Link
              to="/staff/preparation"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-emerald-600 text-white font-bold text-sm text-center hover:bg-emerald-700 transition-colors active:scale-[0.98]"
            >
              <AppIcon name="approval" size={16} />
              Mulai Input Preparation
            </Link>
          )}
        </div>

        {isHeadStore && (
          <div className="mb-5 rounded-[2rem] border border-amber-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-black text-gray-800 uppercase tracking-wide">Tugas</h2>
                <Link to="/tasks" className="text-[10px] font-bold text-amber-600">Lihat Semua</Link>
              </div>
              {tasks.length > 0 ? (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div key={task.id} className="rounded-2xl bg-amber-50 px-3 py-3">
                      <p className="text-sm font-semibold text-slate-900 leading-tight">{task.title}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {task.due_date
                          ? `Jatuh tempo ${new Date(`${task.due_date}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`
                          : 'Belum ada jatuh tempo'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  Tidak ada tugas aktif saat ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className={`grid gap-4 mb-5 ${quickActions.length <= 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-white border border-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm active:scale-95 transition-transform">
                <AppIcon name={action.icon} size={22} />
              </div>
              <span className="text-[9px] font-bold text-center leading-tight text-gray-700">
                {action.label.split('\n').map((l, i) => <span key={i}>{l}{i === 0 ? <br /> : ''}</span>)}
              </span>
            </Link>
          ))}
        </div>

        {/* Status & Achievement */}
        <div className="flex gap-3 mb-5">
          <Link to="/staff/ceklis" className="flex-1 block bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-3xl text-white relative overflow-hidden shadow-md transition-transform active:scale-[0.98]">
            <div className="relative z-10">
              <p className="text-[9px] font-bold opacity-80 uppercase mb-1">Target Ceklis</p>
              <p className="text-2xl font-black">{loading ? '-' : `${ceklisPct}%`}</p>
              <div className="w-full bg-white/20 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-white h-1.5 rounded-full transition-all duration-700"
                  style={{ width: loading ? '0%' : `${ceklisPct}%` }}
                />
              </div>
              <p className="text-[8px] opacity-70 mt-1">{loading ? '...' : `${ceklisDone} dari 3 ceklis`}</p>
            </div>
            <AppIcon name="spark" size={52} className="absolute -right-2 -bottom-2 opacity-10" />
          </Link>
          <Link to="/staff/opex" className="flex-1 bg-white border border-blue-100 p-4 rounded-3xl shadow-sm flex flex-col justify-between hover:border-blue-300 transition-colors">
            <p className="text-[9px] font-bold text-gray-400 uppercase">Opex Hari Ini</p>
            <p className="text-base font-black text-gray-900 leading-tight mt-1">
              {loading ? '-' : fmtRp(status?.totalOpex || 0)}
            </p>
            <div className="flex items-center gap-1 mt-2">
              <AppIcon name="opex" size={12} className="text-blue-400" />
              <p className="text-[8px] text-blue-400 font-semibold">Input pengeluaran</p>
            </div>
          </Link>
        </div>

        {/* Pending laporan warning */}
        {hasPendingReportReminder && (
          <div className="mb-5 bg-gradient-to-r from-amber-500 to-amber-600 p-5 rounded-[2rem] text-white relative overflow-hidden shadow-lg">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-white/20 text-[8px] font-black px-2 py-0.5 rounded uppercase">Reminder</span>
              </div>
              <p className="font-bold text-sm mb-1">Laporan Harian Belum Disubmit</p>
              <p className="text-[10px] opacity-90">
                Tgl {new Date(yesterday).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} · Sisa waktu: {sisaWaktuLaporan(yesterday)}
              </p>
            </div>
            <AppIcon name="warning" size={72} className="absolute -right-4 -bottom-4 opacity-10" />
          </div>
        )}

        {/* Announcements */}
        {announcements.length > 0 && (
          <div className="mb-6">
            <h2 className="font-extrabold text-gray-800 text-sm mb-3">Pengumuman</h2>
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className="bg-white border border-amber-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 flex-shrink-0 mt-0.5">
                      <AppIcon name="bell" size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-gray-800 leading-tight mb-1">{ann.title}</p>
                      <p className="text-[10px] text-gray-500 leading-relaxed">{ann.body}</p>
                      <p className="text-[9px] text-gray-300 font-semibold mt-1">
                        {ann.published_at ? new Date(ann.published_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="mb-6">
          <LeaderboardSection
            selectedPeriod={leaderboardPeriod}
            onPeriodChange={setLeaderboardPeriod}
            leaderboardView={leaderboardView}
            onViewChange={setLeaderboardView}
            leaderboards={leaderboards}
            profile={profile}
            showHeadStore={!HIDDEN_HEAD_STORE_ROLES.includes(profile?.role)}
          />
        </div>

        {/* Notice Board */}
        <div className="bg-slate-900 p-5 rounded-[2.5rem] text-white relative overflow-hidden mb-2">
          <div className="relative z-10">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status Operasional</p>
            <h4 className="text-sm font-bold mb-1">{profile?.branch?.name || 'Bagi Kopi'}</h4>
            <p className="text-[10px] opacity-60 leading-relaxed">
              {loading
                ? 'Memuat status...'
                : `Ceklis: ${status?.ceklisPagi ? 'Pagi ✓' : 'Pagi -'} ${status?.ceklisMiddle ? '· Middle ✓' : '· Middle -'} ${status?.ceklisMalam ? '· Malam ✓' : '· Malam -'} · Laporan: ${status?.laporan ? '✓' : 'Pending'}`}
            </p>
          </div>
          <AppIcon name="store" size={72} className="absolute -right-3 -bottom-3 opacity-5" />
        </div>
      </div>

      <StaffBottomNav />
    </div>
  )
}
