import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayWIB, yesterdayWIB, visitGrade } from '../../lib/utils'
import Badge from '../../components/Badge'
import { DMBottomNav } from '../../components/BottomNav'

export default function DMDashboard() {
  const { profile, signOut } = useAuth()
  const today     = todayWIB()
  const yesterday = yesterdayWIB()
  const [stores, setStores]     = useState([])
  const [summary, setSummary]   = useState(null)
  const [visits, setVisits]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState('toko') // 'toko' | 'kunjungan'

  useEffect(() => { if (profile) fetchDashboard() }, [profile])

  // Ambil start of week (Senin)
  const weekStart = () => {
    const now = new Date()
    const wibNow = new Date(now.getTime() + 7 * 3600 * 1000)
    const day = wibNow.getUTCDay()
    const diff = day === 0 ? 6 : day - 1
    wibNow.setUTCDate(wibNow.getUTCDate() - diff)
    return wibNow.toISOString().split('T')[0]
  }

  const fetchDashboard = async () => {
    setLoading(true)

    let branchQuery = supabase.from('branches').select('*').eq('is_active', true)
    if (profile.role === 'district_manager')
      branchQuery = branchQuery.in('district', profile.managed_districts || [])
    else if (profile.role === 'area_manager')
      branchQuery = branchQuery.in('area', profile.managed_areas || [])

    const { data: branches, error: branchError } = await branchQuery.order('name')
    if (branchError || !branches || branches.length === 0) {
      setStores([])
      setVisits([])
      setSummary({ total: 0, ceklisOK: 0, laporanOK: 0, visitedCount: 0, pendingSetoran: 0 })
      setLoading(false)
      return
    }

    const ids = branches.map(b => b.id)
    const ws  = weekStart()

    const [ceklisRes, laporanRes, setoranRes, visitRes] = await Promise.all([
      supabase.from('daily_checklists').select('branch_id,shift,is_late').in('branch_id', ids).eq('tanggal', today),
      supabase.from('daily_reports').select('branch_id,net_sales').in('branch_id', ids).eq('tanggal', yesterday),
      supabase.from('daily_deposits').select('branch_id,status,selisih').in('branch_id', ids).eq('tanggal', yesterday),
      supabase.from('daily_visits')
        .select('*, branch:branches(name,store_id), auditor:profiles(full_name,role)')
        .in('branch_id', ids)
        .gte('tanggal', ws)
        .order('tanggal', { ascending: false }),
    ])

    if (ceklisRes.error || laporanRes.error || setoranRes.error || visitRes.error) {
      setStores([])
      setVisits([])
      setSummary({ total: branches.length, ceklisOK: 0, laporanOK: 0, visitedCount: 0, pendingSetoran: 0 })
      setLoading(false)
      return
    }

    const ceklisMap  = {}
    const laporanMap = {}
    const setoranMap = {}
    const visitMap   = {} // branch_id → latest visit this week

    ;(ceklisRes.data  || []).forEach(r => { if (!ceklisMap[r.branch_id]) ceklisMap[r.branch_id] = {}; ceklisMap[r.branch_id][r.shift] = r })
    ;(laporanRes.data || []).forEach(r => { laporanMap[r.branch_id] = r })
    ;(setoranRes.data || []).forEach(r => { setoranMap[r.branch_id] = r })
    ;(visitRes.data   || []).forEach(r => { if (!visitMap[r.branch_id]) visitMap[r.branch_id] = r })

    const enriched = branches.map(b => ({
      ...b,
      ceklisPagi:  ceklisMap[b.id]?.pagi  || null,
      ceklisMalam: ceklisMap[b.id]?.malam || null,
      laporan:     laporanMap[b.id]  || null,
      setoran:     setoranMap[b.id]  || null,
      visitWeek:   visitMap[b.id]    || null,
    }))

    const visitedCount   = Object.keys(visitMap).length
    const pendingSetoran = enriched.filter(b => b.setoran?.status === 'submitted').length

    setSummary({
      total: branches.length,
      ceklisOK: enriched.filter(b => b.ceklisPagi).length,
      laporanOK: enriched.filter(b => b.laporan).length,
      visitedCount,
      pendingSetoran,
    })
    setStores(enriched)
    setVisits(visitRes.data || [])
    setLoading(false)
  }

  const storeBadge = (store) => {
    if (!store.ceklisPagi)                          return { variant: 'danger', label: 'Ceklis' }
    if (!store.laporan)                             return { variant: 'warn',   label: 'Laporan' }
    if (store.setoran?.status === 'submitted')      return { variant: 'warn',   label: 'Setoran' }
    if (store.setoran?.status === 'rejected')       return { variant: 'danger', label: 'Rejected' }
    if (!store.setoran)                             return { variant: 'warn',   label: 'Setoran' }
    return { variant: 'ok', label: 'OK' }
  }

  const shortName = profile?.full_name?.split(' ')[0] || '—'
  const roleName  = profile?.role === 'district_manager' ? `DM ${(profile.managed_districts || []).join(',')}` :
                    profile?.role === 'area_manager'     ? `AM ${(profile.managed_areas || []).join(',')}` : 'Ops Manager'

  return (
    <div className="page-shell">
      <header className="bg-primary-600 text-white px-4 pt-5 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-primary-200 text-sm">{roleName}</p>
            <h1 className="text-xl font-bold mt-0.5">{shortName}</h1>
            <p className="text-primary-300 text-xs mt-1">
              {loading ? '...' : `${summary?.total || 0} toko`} · {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
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
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <StatCard label="Ceklis Pagi ✓" value={`${summary?.ceklisOK}/${summary?.total}`}
                pct={summary?.total ? summary.ceklisOK / summary.total : 0}
                color={summary?.ceklisOK === summary?.total ? 'text-green-600' : 'text-yellow-600'} />
              <StatCard label="Laporan H-1 ✓" value={`${summary?.laporanOK}/${summary?.total}`}
                pct={summary?.total ? summary.laporanOK / summary.total : 0}
                color={summary?.laporanOK === summary?.total ? 'text-green-600' : 'text-yellow-600'} />
              <StatCard label="Visit Minggu Ini" value={`${summary?.visitedCount}/${summary?.total}`}
                pct={summary?.total ? summary.visitedCount / summary.total : 0}
                color={summary?.visitedCount === summary?.total ? 'text-green-600' : 'text-primary-600'} />
              <StatCard label="Setoran Pending" value={summary?.pendingSetoran || 0}
                pct={0} color={summary?.pendingSetoran > 0 ? 'text-yellow-600' : 'text-green-600'} />
            </div>

            {summary?.pendingSetoran > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3 flex gap-2 items-start">
                <span className="text-base flex-shrink-0">💬</span>
                <span className="text-sm text-yellow-800">
                  <strong>{summary.pendingSetoran} setoran</strong> menunggu approval.
                  <Link to="/dm/approval" className="text-primary-600 font-semibold ml-1">Review →</Link>
                </span>
              </div>
            )}

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Link to="/dm/visit" className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <span className="text-2xl">🏪</span>
                <div><div className="font-semibold text-sm">Daily Visit</div><div className="text-xs text-gray-400">Audit toko</div></div>
              </Link>
              <Link to="/dm/approval" className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <span className="text-2xl">✅</span>
                <div><div className="font-semibold text-sm">Approval</div><div className="text-xs text-gray-400">Setoran pending</div></div>
              </Link>
            </div>

            {/* Tabs */}
            <div className="flex bg-primary-100 rounded-xl p-1 mb-3 gap-1">
              <button onClick={() => setActiveTab('toko')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'toko' ? 'bg-white text-primary-700 shadow-sm' : 'text-primary-400'}`}>
                Status Toko
              </button>
              <button onClick={() => setActiveTab('kunjungan')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'kunjungan' ? 'bg-white text-primary-700 shadow-sm' : 'text-primary-400'}`}>
                Kunjungan Minggu Ini
              </button>
            </div>

            {/* TAB: Status Toko */}
            {activeTab === 'toko' && (
              <div className="card overflow-hidden">
                {stores.map((store, i) => {
                  const badge = storeBadge(store)
                  return (
                    <div key={store.id} className={`flex items-center gap-3 px-4 py-3 ${i < stores.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0">
                        {store.store_id?.split('-')[1] || '??'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{store.name.replace('Bagi Kopi ', '')}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5 flex gap-1.5">
                          <span className={store.ceklisPagi ? 'text-green-600' : 'text-red-500'}>
                            {store.ceklisPagi ? '✓' : '✗'} Ceklis
                          </span>
                          <span className={store.laporan ? 'text-green-600' : 'text-gray-400'}>
                            {store.laporan ? '✓' : '—'} Laporan
                          </span>
                          <span className={store.setoran?.status === 'approved' ? 'text-green-600' : store.setoran ? 'text-yellow-600' : 'text-gray-400'}>
                            {store.setoran?.status === 'approved' ? '✓' : store.setoran ? '⏳' : '—'} Setoran
                          </span>
                          {store.visitWeek && (
                            <span className="text-primary-600">
                              🏪 {store.visitWeek.total_score}/{store.visitWeek.max_score}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                  )
                })}
              </div>
            )}

            {/* TAB: Kunjungan Minggu Ini */}
            {activeTab === 'kunjungan' && (
              <>
                {/* Stores belum divisit */}
                {stores.filter(s => !s.visitWeek).length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3">
                    <p className="text-xs font-bold text-yellow-700 mb-1.5">⚠ Belum Divisit Minggu Ini</p>
                    <div className="flex flex-wrap gap-1.5">
                      {stores.filter(s => !s.visitWeek).map(s => (
                        <span key={s.id} className="text-xs bg-white border border-yellow-200 text-yellow-700 px-2 py-0.5 rounded-full">
                          {s.name.replace('Bagi Kopi ', '')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Daftar kunjungan */}
                {visits.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-4xl mb-3">🏪</div>
                    <p className="font-medium">Belum ada kunjungan minggu ini</p>
                    <Link to="/dm/visit" className="text-primary-600 text-sm font-semibold mt-2 block">
                      Mulai Visit →
                    </Link>
                  </div>
                ) : (
                  <div className="card overflow-hidden">
                    {visits.map((v, i) => {
                      const g = visitGrade(v.total_score, v.max_score)
                      return (
                        <div key={v.id} className={`flex items-center gap-3 px-4 py-3 ${i < visits.length - 1 ? 'border-b border-gray-50' : ''}`}>
                          <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0">
                            {v.branch?.store_id?.split('-')[1] || '??'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {v.branch?.name?.replace('Bagi Kopi ', '') || '—'}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {v.tanggal} · oleh {v.auditor?.full_name?.split(' ')[0] || '—'}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-sm text-primary-700">{v.total_score}/{v.max_score}</div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${g.bg} ${g.color}`}>
                              {g.label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
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
