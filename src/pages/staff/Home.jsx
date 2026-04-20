import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { StaffBottomNav } from '../../components/BottomNav'
import { canViewKPI, canViewSupplyChain, isStoreRole } from '../../lib/access'
import { AppIcon } from '../../components/ui/AppKit'
import { fmtRp, todayWIB, yesterdayWIB, sisaWaktuLaporan } from '../../lib/utils'

export default function StaffHome() {
  const { profile, signOut } = useAuth()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sopCards, setSopCards] = useState([])
  const [announcements, setAnnouncements] = useState([])

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
    const [sopRes, annRes] = await Promise.all([
      supabase.from('sop_cards').select('id,title,category,file_url,sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('announcements').select('id,title,body,published_at').eq('is_active', true).order('published_at', { ascending: false }).limit(5),
    ])
    if (sopRes.data) setSopCards(sopRes.data)
    if (annRes.data) setAnnouncements(annRes.data)
  }

  const fetchStatus = async () => {
    const branchId = profile.branch_id

    const [ceklisPagi, ceklisMalam, laporan, opexToday] = await Promise.all([
      supabase.from('daily_checklists')
        .select('id, is_late, submitted_at')
        .eq('branch_id', branchId).eq('tanggal', today).eq('shift', 'pagi')
        .maybeSingle(),

      supabase.from('daily_checklists')
        .select('id, is_late')
        .eq('branch_id', branchId).eq('tanggal', today).eq('shift', 'malam')
        .maybeSingle(),

      supabase.from('daily_reports')
        .select('id, submitted_at, is_late')
        .eq('branch_id', branchId).eq('tanggal', yesterday)
        .maybeSingle(),

      supabase.from('operational_expenses')
        .select('total')
        .eq('branch_id', branchId).eq('tanggal', today),
    ])

    const totalOpex = (opexToday.data || []).reduce((sum, row) => sum + Number(row.total), 0)

    setStatus({
      ceklisPagi: ceklisPagi.data,
      ceklisMalam: ceklisMalam.data,
      laporan: laporan.data,
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

  const ceklisDone = [status?.ceklisPagi, status?.ceklisMalam].filter(Boolean).length
  const ceklisPct = Math.round((ceklisDone / 2) * 100)

  const quickActions = [
    ...(isHeadStore || !isStoreLevel ? [{ to: '/staff/laporan', icon: 'chart', label: 'Laporan\nHarian' }] : []),
    ...(isHeadStore ? [{ to: '/staff/opex', icon: 'opex', label: 'Input\nOpex' }] : []),
    ...(kpiEnabled ? [{ to: '/kpi', icon: 'checklist', label: 'KPI\nKerja' }] : []),
    ...(supplyChainEnabled ? [{ to: '/sc/sj', icon: 'finance', label: 'Penerimaan\nBarang' }] : []),
    ...(!isHeadStore ? [{ to: '/trainer/staff-baru', icon: 'users', label: 'Training\nCard' }] : []),
  ].slice(0, 4)

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
          <button onClick={signOut} className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors relative">
            <AppIcon name="bell" size={18} />
            {!loading && !status?.laporan && profile?.branch_id && (isHeadStore || !isStoreLevel) && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
            )}
          </button>
          <button onClick={signOut} className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors">
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

              {/* Laporan H-1 */}
              <div className="bg-orange-50 rounded-2xl p-3 text-center">
                <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center"
                  style={{ background: !loading && status?.laporan ? '#f97316' : '#fed7aa' }}>
                  <AppIcon name="chart" size={14}
                    className={!loading && status?.laporan ? 'text-white' : 'text-orange-400'} />
                </div>
                <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Laporan</p>
                <div className="w-full bg-orange-100 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-1.5 rounded-full transition-all duration-500 ${!loading && status?.laporan ? 'bg-orange-400 w-full' : 'w-0'}`} />
                </div>
                <p className="text-[8px] text-gray-400 mt-1 font-semibold">
                  {loading ? '...' : status?.laporan ? 'Submitted' : 'Pending'}
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
              <p className="text-[8px] opacity-70 mt-1">{loading ? '...' : `${ceklisDone} dari 2 ceklis`}</p>
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
        {!loading && status && !status.laporan && profile?.branch_id && (isHeadStore || !isStoreLevel) && (
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
                <a
                  key={sop.id}
                  href={sop.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 w-36 bg-white border border-blue-50 rounded-[1.5rem] p-4 shadow-sm active:scale-[0.97] transition-transform"
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-3">
                    <AppIcon name="checklist" size={18} />
                  </div>
                  <p className="text-[10px] font-bold text-gray-800 leading-tight mb-1">{sop.title}</p>
                  <p className="text-[9px] text-gray-400 font-semibold">{sop.category}</p>
                </a>
              ))}
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
                : `Ceklis: ${status?.ceklisPagi ? 'Pagi ✓' : 'Pagi -'} ${status?.ceklisMalam ? '· Malam ✓' : '· Malam -'} · Laporan: ${status?.laporan ? '✓' : 'Pending'}`}
            </p>
          </div>
          <AppIcon name="store" size={72} className="absolute -right-3 -bottom-3 opacity-5" />
        </div>
      </div>

      <StaffBottomNav />
    </div>
  )
}
