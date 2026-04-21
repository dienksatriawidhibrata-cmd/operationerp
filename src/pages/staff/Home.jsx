import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { StaffBottomNav } from '../../components/BottomNav'
import { canViewKPI, canViewSupplyChain, isStoreRole } from '../../lib/access'
import { AppIcon } from '../../components/ui/AppKit'
import { fmtRp, todayWIB, yesterdayWIB, sisaWaktuLaporan } from '../../lib/utils'
import { fetchSopFiles } from '../../lib/googleApis'

export default function StaffHome() {
  const { profile, signOut } = useAuth()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sopCards, setSopCards] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [viewingSop, setViewingSop] = useState(null)

  const today = todayWIB()
  const yesterday = yesterdayWIB()

  useEffect(() => {
    fetchSopAndAnnouncements()
    if (!profile?.branch_id) {
      setLoading(false)
      return
    }
    fetchStatus()
  }, [profile])

  const fetchSopAndAnnouncements = async () => {
    const [sopFiles, annRes] = await Promise.all([
      fetchSopFiles().catch(() => []),
      supabase.from('announcements').select('id,title,body,published_at').eq('is_active', true).order('published_at', { ascending: false }).limit(5),
    ])
    setSopCards(sopFiles)
    if (annRes.data) setAnnouncements(annRes.data)
  }

  const fetchStatus = async () => {
    const branchId = profile.branch_id

    const [ceklisPagi, ceklisMiddle, ceklisMalam, laporan, prepPagi, prepMiddle, prepMalam, opexToday] = await Promise.all([
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
      totalOpex,
    })
    setLoading(false)
  }

  const isStoreLevel = isStoreRole(profile?.role)
  const isHeadStore = profile?.role === 'head_store'
  const kpiEnabled = canViewKPI(profile?.role)
  const supplyChainEnabled = canViewSupplyChain(profile?.role)
  const shortName = profile?.full_name?.split(' ')[0] || '-'
  const branchName = profile?.branch?.name?.replace('Bagi Kopi ', '') || 'Toko'

  const ceklisDone = [status?.ceklisPagi, status?.ceklisMiddle, status?.ceklisMalam].filter(Boolean).length
  const ceklisPct = Math.round((ceklisDone / 3) * 100)

  const quickActions = isHeadStore ? [
    { to: '/staff/laporan',      icon: 'chart',     label: 'Laporan\nHarian' },
    { to: '/kpi/personal/input', icon: 'checklist', label: 'Input\nKPI Staff' },
    { to: '/kpi/360',            icon: 'spark',     label: 'Penilaian\n360°' },
    { to: '/sc/sj',              icon: 'finance',   label: 'Terima\nBarang' },
  ] : isStoreLevel ? [
    { to: '/staff/preparation',  icon: 'approval',  label: 'Prep\nHarian' },
    { to: '/kpi/personal',       icon: 'chart',     label: 'KPI\nPersonal' },
    { to: '/kpi/360',            icon: 'spark',     label: 'Penilaian\n360°' },
    { to: '/sc/sj',              icon: 'finance',   label: 'Terima\nBarang' },
  ] : [
    ...(kpiEnabled ? [{ to: '/kpi', icon: 'checklist', label: 'KPI\nKerja' }] : []),
    ...(supplyChainEnabled ? [{ to: '/sc/sj', icon: 'finance', label: 'Penerimaan\nBarang' }] : []),
  ].slice(0, 4)

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
        <div className="flex items-center gap-2">
          <button type="button" className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors relative">
            <AppIcon name="bell" size={18} />
            {hasPendingReportReminder && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
            )}
          </button>
          <button type="button" onClick={signOut} className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors">
            <AppIcon name="logout" size={18} />
          </button>
        </div>
      </div>

      <div className="px-5 pt-5">
        {/* Branch not configured */}
        {!loading && !profile?.branch_id && (
          <div className="mb-4 p-4 rounded-3xl bg-rose-50 border border-rose-100">
            <p className="text-sm text-rose-700 font-semibold">Akun belum dikonfigurasi ke cabang manapun. Hubungi ops manager.</p>
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
              {/* Pagi */}
              <div className="bg-blue-50 rounded-2xl p-3 text-center">
                <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center"
                  style={{ background: !loading && status?.ceklisPagi ? '#22c55e' : '#dbeafe' }}>
                  <AppIcon name="spark" size={14}
                    className={!loading && status?.ceklisPagi ? 'text-white' : 'text-blue-400'} />
                </div>
                <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Pagi</p>
                <div className="w-full bg-blue-100 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-1.5 rounded-full transition-all duration-500 ${
                    loading ? 'w-0' :
                    status?.ceklisPagi
                      ? (status.ceklisPagi.is_late ? 'bg-amber-400 w-full' : 'bg-green-500 w-full')
                      : 'w-0'
                  }`} />
                </div>
                <p className="text-[8px] text-gray-400 mt-1 font-semibold">
                  {loading ? '...' : status?.ceklisPagi ? (status.ceklisPagi.is_late ? 'Terlambat' : 'Selesai') : 'Belum'}
                </p>
              </div>

              {/* Middle Ceklis */}
              <div className="bg-violet-50 rounded-2xl p-3 text-center">
                <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center"
                  style={{ background: !loading && status?.ceklisMiddle ? '#7c3aed' : '#ede9fe' }}>
                  <AppIcon name="checklist" size={14}
                    className={!loading && status?.ceklisMiddle ? 'text-white' : 'text-violet-400'} />
                </div>
                <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Middle</p>
                <div className="w-full bg-violet-100 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-1.5 rounded-full transition-all duration-500 ${
                    loading ? 'w-0' :
                    status?.ceklisMiddle
                      ? (status.ceklisMiddle.is_late ? 'bg-amber-400 w-full' : 'bg-violet-500 w-full')
                      : 'w-0'
                  }`} />
                </div>
                <p className="text-[8px] text-gray-400 mt-1 font-semibold">
                  {loading ? '...' : status?.ceklisMiddle ? (status.ceklisMiddle.is_late ? 'Terlambat' : 'Selesai') : 'Belum'}
                </p>
              </div>

              {/* Malam */}
              <div className="bg-indigo-50 rounded-2xl p-3 text-center">
                <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center"
                  style={{ background: !loading && status?.ceklisMalam ? '#6366f1' : '#e0e7ff' }}>
                  <AppIcon name="checklist" size={14}
                    className={!loading && status?.ceklisMalam ? 'text-white' : 'text-indigo-400'} />
                </div>
                <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Malam</p>
                <div className="w-full bg-indigo-100 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-1.5 rounded-full transition-all duration-500 ${!loading && status?.ceklisMalam ? 'bg-indigo-500 w-full' : 'w-0'}`} />
                </div>
                <p className="text-[8px] text-gray-400 mt-1 font-semibold">
                  {loading ? '...' : status?.ceklisMalam ? 'Selesai' : 'Terbuka'}
                </p>
              </div>
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
              {/* Prep Pagi */}
              <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center"
                  style={{ background: !loading && status?.prepPagi ? '#10b981' : '#d1fae5' }}>
                  <AppIcon name="spark" size={14}
                    className={!loading && status?.prepPagi ? 'text-white' : 'text-emerald-400'} />
                </div>
                <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Pagi</p>
                <div className="w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-1.5 rounded-full transition-all duration-500 ${!loading && status?.prepPagi ? 'bg-emerald-500 w-full' : 'w-0'}`} />
                </div>
                <p className="text-[8px] text-gray-400 mt-1 font-semibold">
                  {loading ? '...' : status?.prepPagi ? 'Selesai' : 'Belum'}
                </p>
              </div>

              {/* Prep Middle */}
              <div className="bg-teal-50 rounded-2xl p-3 text-center">
                <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center"
                  style={{ background: !loading && status?.prepMiddle ? '#0d9488' : '#ccfbf1' }}>
                  <AppIcon name="checklist" size={14}
                    className={!loading && status?.prepMiddle ? 'text-white' : 'text-teal-400'} />
                </div>
                <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Middle</p>
                <div className="w-full bg-teal-100 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-1.5 rounded-full transition-all duration-500 ${!loading && status?.prepMiddle ? 'bg-teal-500 w-full' : 'w-0'}`} />
                </div>
                <p className="text-[8px] text-gray-400 mt-1 font-semibold">
                  {loading ? '...' : status?.prepMiddle ? 'Selesai' : 'Belum'}
                </p>
              </div>

              {/* Prep Malam */}
              <div className="bg-cyan-50 rounded-2xl p-3 text-center">
                <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center"
                  style={{ background: !loading && status?.prepMalam ? '#0891b2' : '#cffafe' }}>
                  <AppIcon name="approval" size={14}
                    className={!loading && status?.prepMalam ? 'text-white' : 'text-cyan-400'} />
                </div>
                <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Malam</p>
                <div className="w-full bg-cyan-100 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-1.5 rounded-full transition-all duration-500 ${!loading && status?.prepMalam ? 'bg-cyan-500 w-full' : 'w-0'}`} />
                </div>
                <p className="text-[8px] text-gray-400 mt-1 font-semibold">
                  {loading ? '...' : status?.prepMalam ? 'Selesai' : 'Belum'}
                </p>
              </div>
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
          <div className="flex-1 bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-3xl text-white relative overflow-hidden shadow-md">
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
          </div>
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

        {/* Papan Pengumuman */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-extrabold text-gray-800 text-sm">Papan Pengumuman</h2>
            <button className="text-[10px] text-blue-600 font-bold">Lihat Semua</button>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-5 rounded-[2rem] text-white relative overflow-hidden shadow-lg">
            <div className="relative z-10">
              <span className="bg-white/20 text-[8px] font-black px-2 py-0.5 rounded uppercase mb-2 inline-block">Pengumuman</span>
              <h3 className="font-bold text-sm mb-1">Selamat Bekerja, {shortName}!</h3>
              <p className="text-[10px] opacity-85 leading-relaxed">
                Pastikan ceklis pagi & malam sudah diisi setiap hari. Laporan harian wajib disubmit sebelum pukul 10.00 WIB.
              </p>
            </div>
            <AppIcon name="spark" size={80} className="absolute -right-4 -bottom-4 opacity-10" />
          </div>
        </div>

        {/* SOP Section */}
        {sopCards.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-extrabold text-gray-800 text-sm">Panduan SOP</h2>
              <span className="text-[10px] text-gray-400 font-semibold">{sopCards.length} dokumen</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
              {sopCards.map((sop) => (
                <button
                  key={sop.id}
                  onClick={() => setViewingSop(sop)}
                  className="flex-shrink-0 w-36 bg-white border border-blue-50 rounded-[1.5rem] p-4 shadow-sm active:scale-[0.97] transition-transform text-left"
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-3">
                    <AppIcon name="checklist" size={18} />
                  </div>
                  <p className="text-[10px] font-bold text-gray-800 leading-tight">{sop.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SOP Viewer Modal */}
        {viewingSop && (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/60" onClick={() => setViewingSop(null)}>
            <div
              className="relative flex flex-col bg-white rounded-t-[2rem] mt-auto h-[92dvh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <p className="font-bold text-sm text-gray-900 truncate pr-4">{viewingSop.name}</p>
                <button
                  onClick={() => setViewingSop(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0 text-lg font-bold"
                >
                  ×
                </button>
              </div>
              <iframe
                src={viewingSop.previewUrl}
                title={viewingSop.name}
                className="flex-1 w-full border-0"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
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
