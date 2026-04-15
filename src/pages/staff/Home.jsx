import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { StaffBottomNav } from '../../components/BottomNav'
import Badge from '../../components/Badge'
import { fmtRp, todayWIB, yesterdayWIB, sisaWaktuLaporan } from '../../lib/utils'

export default function StaffHome() {
  const { profile, signOut } = useAuth()
  const [status, setStatus]   = useState(null)
  const [loading, setLoading] = useState(true)

  const today = todayWIB()
  const yesterday = yesterdayWIB()

  useEffect(() => {
    if (!profile?.branch_id) { setLoading(false); return }
    fetchStatus()
  }, [profile])

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

    const totalOpex = (opexToday.data || []).reduce((s, r) => s + Number(r.total), 0)

    setStatus({
      ceklisPagi:  ceklisPagi.data,
      ceklisMalam: ceklisMalam.data,
      laporan:     laporan.data,
      totalOpex,
    })
    setLoading(false)
  }

  const isStoreLevel = ['staff', 'asst_head_store', 'head_store'].includes(profile?.role)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 11) return 'Selamat pagi'
    if (h < 15) return 'Selamat siang'
    if (h < 18) return 'Selamat sore'
    return 'Selamat malam'
  }

  const shortName = profile?.full_name?.split(' ')[0] || '—'

  return (
    <div className="page-shell">
      {/* Header */}
      <header className="bg-primary-600 text-white px-4 pt-5 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-primary-200 text-sm">{greeting()},</p>
            <h1 className="text-xl font-bold mt-0.5">{shortName} 👋</h1>
            <p className="text-primary-300 text-xs mt-1">
              {profile?.branch?.name || 'Bagi Kopi'} · {new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'short', year:'numeric' })}
            </p>
          </div>
          <button
            onClick={signOut}
            className="text-primary-300 hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 px-4 -mt-3">
        {/* Status cards */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 mt-0">
            {[1,2,3,4].map(i => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-6 bg-gray-100 rounded mb-2 w-8" />
                <div className="h-3 bg-gray-100 rounded w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-0">
            <StatusCard
              value={status?.ceklisPagi ? (status.ceklisPagi.is_late ? '⚠' : '✓') : '!'}
              valueColor={status?.ceklisPagi ? (status.ceklisPagi.is_late ? 'text-yellow-600' : 'text-green-600') : 'text-red-500'}
              label="Ceklis Pagi"
              note={status?.ceklisPagi
                ? (status.ceklisPagi.is_late ? 'Terlambat' : new Date(status.ceklisPagi.submitted_at).toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'}) + ' WIB')
                : 'Belum diisi'}
              noteColor={status?.ceklisPagi ? '' : 'text-red-500'}
            />
            <StatusCard
              value={status?.ceklisMalam ? '✓' : '!'}
              valueColor={status?.ceklisMalam ? 'text-green-600' : 'text-gray-400'}
              label="Ceklis Malam"
              note={status?.ceklisMalam ? 'Sudah' : 'Belum diisi'}
              noteColor={status?.ceklisMalam ? '' : 'text-gray-400'}
            />
            <StatusCard
              value={status?.laporan ? '✓' : '!'}
              valueColor={status?.laporan ? 'text-green-600' : 'text-yellow-500'}
              label={`Laporan ${new Date(yesterday).toLocaleDateString('id-ID', {day:'numeric',month:'short'})}`}
              note={status?.laporan ? 'Submitted' : `Sisa ${sisaWaktuLaporan(yesterday)}`}
              noteColor={status?.laporan ? '' : 'text-yellow-600'}
            />
            <StatusCard
              value={status?.totalOpex > 0 ? fmtRp(status.totalOpex) : 'Rp 0'}
              valueColor="text-primary-700"
              label="Opex Hari Ini"
              note=""
              smallVal
            />
          </div>
        )}

        {/* Alert laporan belum submit */}
        {status && !status.laporan && (
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex gap-2 items-start text-sm text-yellow-800">
            <span className="text-base flex-shrink-0">⏰</span>
            <span>
              Laporan harian <strong>{new Date(yesterday).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</strong> belum disubmit.
              Sisa waktu: <strong>{sisaWaktuLaporan(yesterday)}</strong>
            </span>
          </div>
        )}

        {/* Menu */}
        <p className="section-title">Menu Utama</p>
        <div className="card overflow-hidden">
          {isStoreLevel && (
            <MenuRow to="/staff/ceklis" icon="✅" label="Ceklis Harian" sub="Pagi & Malam · Foto area" color="bg-green-50" />
          )}
          <MenuRow to="/staff/laporan" icon="📊" label="Laporan Harian" sub="Net sales, kunjungan, setoran" color="bg-blue-50" />
          <MenuRow to="/staff/opex" icon="🧾" label="Beban Operasional" sub="Input pengeluaran dengan kode" color="bg-purple-50" last />
        </div>

        {/* Quick access for managers */}
        {!isStoreLevel && (
          <>
            <p className="section-title">Dashboard Manajer</p>
            <div className="card overflow-hidden">
              <MenuRow to="/dm" icon="🏠" label="Dashboard" sub="Status semua toko" color="bg-primary-50" />
              <MenuRow to="/dm/visit" icon="🏪" label="Daily Visit" sub="Audit & scoring toko" color="bg-green-50" />
              <MenuRow to="/dm/approval" icon="✅" label="Approval Setoran" sub="Review & approve setoran" color="bg-yellow-50" last />
            </div>
          </>
        )}
      </div>

      <StaffBottomNav />
    </div>
  )
}

function StatusCard({ value, valueColor, label, note, noteColor = 'text-gray-400', smallVal }) {
  return (
    <div className="card p-4">
      <div className={`font-bold leading-none mb-1 ${smallVal ? 'text-base' : 'text-2xl'} ${valueColor}`}>
        {value}
      </div>
      <div className="text-xs font-medium text-gray-600">{label}</div>
      {note && <div className={`text-[10px] mt-0.5 ${noteColor || 'text-gray-400'}`}>{note}</div>}
    </div>
  )
}

function MenuRow({ to, icon, label, sub, color, last }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 p-4 ${!last ? 'border-b border-gray-50' : ''} hover:bg-gray-50 transition-colors`}
    >
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-xl flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-semibold text-sm text-gray-900">{label}</div>
        <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
      </div>
      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}
