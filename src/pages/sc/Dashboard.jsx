import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { DMBottomNav, OpsBottomNav, SCBottomNav, StaffBottomNav } from '../../components/BottomNav'
import {
  canCreateSupplyOrder,
  canIssueSuratJalan,
  getScopeLabel,
  isManagerRole,
  isOpsLikeRole,
  isStoreRole,
} from '../../lib/access'
import { AppIcon, ToneBadge } from '../../components/ui/AppKit'

const STATUS_TONE = {
  draft: 'slate',
  picking: 'warn',
  qc: 'warn',
  distribution: 'warn',
  sj_ready: 'info',
  shipped: 'info',
  completed: 'ok',
  cancelled: 'danger',
}

const STATUS_LABEL = {
  draft: 'Draft',
  picking: 'Picking',
  qc: 'QC',
  distribution: 'Distribution',
  sj_ready: 'Siap SJ',
  shipped: 'Dikirim',
  completed: 'Selesai',
  cancelled: 'Batal',
}

const STAGE_ORDER = ['draft', 'picking', 'qc', 'distribution', 'sj_ready', 'shipped', 'completed', 'cancelled']

function getFooter(role) {
  if (isOpsLikeRole(role)) return <OpsBottomNav />
  if (isManagerRole(role)) return <DMBottomNav />
  if (isStoreRole(role)) return <StaffBottomNav />
  return <SCBottomNav />
}

function getSubtitle(profile) {
  if (isStoreRole(profile?.role)) {
    return 'Pantau order aktif dan pengiriman barang yang menuju toko kamu.'
  }
  if (isManagerRole(profile?.role)) {
    return `Order dan pengiriman otomatis difilter untuk ${getScopeLabel(profile)}.`
  }
  return 'Warehouse → Store delivery tracking'
}

export default function SCDashboard() {
  const { profile, signOut } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [leadTimes, setLeadTimes] = useState({ picking: null, qc: null, distribution: null })

  const fetchOrders = async () => {
    setLoading(true)

    const [ordersRes, ltRes] = await Promise.all([
      supabase
        .from('supply_orders')
        .select('*, branch:branches(id,name,store_id,district,area)')
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(60),
      supabase
        .from('supply_confirmations')
        .select('stage, confirmed_at, order:supply_orders(created_at)')
        .eq('status', 'confirmed')
        .not('confirmed_at', 'is', null)
        .order('confirmed_at', { ascending: false })
        .limit(90),
    ])

    setOrders(ordersRes.data || [])

    const confs = ltRes.data || []
    const avgHours = (stage) => {
      const rows = confs.filter((c) => c.stage === stage && c.order?.created_at)
      if (!rows.length) return null
      const hrs = rows.map((c) => (new Date(c.confirmed_at) - new Date(c.order.created_at)) / 3600000)
      return (hrs.reduce((a, b) => a + b, 0) / hrs.length).toFixed(1)
    }
    setLeadTimes({ picking: avgHours('picking'), qc: avgHours('qc'), distribution: avgHours('distribution') })

    setLoading(false)
  }

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!active) return
      await fetchOrders()
    }

    load()

    const orderChannel = supabase
      .channel(`sc-dashboard-${profile?.id || 'anon'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'supply_orders' },
        () => {
          load()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'surat_jalan' },
        () => {
          load()
        }
      )
      .subscribe()

    const intervalId = window.setInterval(load, 30000)

    return () => {
      active = false
      window.clearInterval(intervalId)
      supabase.removeChannel(orderChannel)
    }
  }, [profile?.id])

  const byStatus = STAGE_ORDER.reduce((acc, status) => {
    acc[status] = orders.filter((order) => order.status === status).length
    return acc
  }, {})

  const activeCount = orders.filter((order) => !['completed', 'cancelled'].includes(order.status)).length
  const urgentCount = orders.filter((order) => order.status === 'sj_ready').length
  const canCreateOrder = canCreateSupplyOrder(profile?.role)
  const canIssueSJ = canIssueSuratJalan(profile?.role)

  const workflowStats = [
    { label: 'Antrean', key: 'draft', count: byStatus.draft, urgentFlag: false, to: null },
    { label: 'On Picking', key: 'picking', count: byStatus.picking, urgentFlag: byStatus.picking > 0, to: '/sc/picking' },
    { label: 'QC Check', key: 'qc', count: byStatus.qc, urgentFlag: byStatus.qc > 0, to: '/sc/qc' },
    { label: 'Distribusi', key: 'distribution', count: byStatus.distribution, urgentFlag: false, to: '/sc/distribution' },
    { label: 'Siap SJ', key: 'sj_ready', count: byStatus.sj_ready, urgentFlag: byStatus.sj_ready > 0, to: '/sc/sj' },
    { label: 'Dikirim', key: 'shipped', count: byStatus.shipped, urgentFlag: false, to: '/sc/sj' },
  ]

  const quickActions = [
    ...(canCreateOrder ? [{ to: '/sc/orders/new', icon: 'plus', label: 'Buat\nOrder', bg: 'bg-blue-600 text-white', border: '' }] : []),
    { to: '/sc/picking', icon: 'checklist', label: 'Picking\nList', bg: 'bg-white text-blue-600', border: 'border-2 border-blue-50' },
    { to: '/sc/qc', icon: 'approval', label: 'Quality\nControl', bg: 'bg-white text-blue-600', border: 'border-2 border-blue-50' },
    { to: '/sc/distribution', icon: 'map', label: 'Jadwal\nKirim', bg: 'bg-white text-blue-600', border: 'border-2 border-blue-50' },
    { to: '/sc/sj', icon: 'finance', label: 'Surat\nJalan', bg: 'bg-white text-blue-600', border: 'border-2 border-blue-50' },
  ].filter(Boolean)

  return (
    <div className="min-h-screen bg-[#f4f7fa] pb-28">
      {/* Header */}
      <div className="p-6 flex justify-between items-center bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 border border-blue-100">
            <AppIcon name="finance" size={22} />
          </div>
          <div>
            <h1 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Supply Chain Ops</h1>
            <p className="font-bold text-gray-900 text-lg leading-tight">
              {isStoreRole(profile?.role) ? profile?.branch?.name?.replace('Bagi Kopi ', '') || 'Toko' : 'Gudang & Distribusi'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchOrders} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-600 border border-gray-100 hover:bg-gray-100 transition-colors">
            <AppIcon name="refresh" size={18} />
          </button>
          <button onClick={signOut} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-600 border border-gray-100 hover:bg-gray-100 transition-colors">
            <AppIcon name="logout" size={18} />
          </button>
        </div>
      </div>

      <div className="px-5 pt-6">
        {/* Live Status Widget */}
        <div className="bg-blue-50/50 p-5 rounded-[2rem] border border-blue-100 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-black text-blue-900 uppercase">Status Arus Barang</h2>
            <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-md font-bold">Live</span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            {workflowStats.slice(0, 3).map((stat) => {
              const inner = (
                <>
                  <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">{stat.label}</p>
                  <p className="text-xl font-black text-blue-700">{loading ? '-' : String(stat.count ?? 0).padStart(2, '0')}</p>
                  {stat.urgentFlag && stat.count > 0 && (
                    <span className="text-[8px] text-orange-500 font-bold">Perlu aksi</span>
                  )}
                </>
              )
              return stat.to ? (
                <Link key={stat.key} to={stat.to} className="bg-white p-3 rounded-2xl border border-blue-50 hover:border-blue-200 active:scale-95 transition-all block">
                  {inner}
                </Link>
              ) : (
                <div key={stat.key} className="bg-white p-3 rounded-2xl border border-blue-50">
                  {inner}
                </div>
              )
            })}
          </div>

          <div className="p-3 bg-white rounded-2xl border border-blue-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-bold text-gray-500 uppercase">Proses Distribusi</span>
              <span className="text-[9px] font-bold text-blue-600">
                {loading ? '-' : `${activeCount} order aktif`}
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: activeCount > 0 ? `${Math.min(100, (byStatus.shipped || 0) / activeCount * 100 + 20)}%` : '5%' }}
              />
            </div>
          </div>
        </div>

        {/* Lead Time Metrics */}
        {(leadTimes.picking || leadTimes.qc || leadTimes.distribution) && (
          <div className="mb-6">
            <h2 className="font-extrabold text-gray-800 text-sm mb-3">Rata-rata Lead Time</h2>
            <div className="bg-white rounded-[1.5rem] border border-gray-100 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">PO → Selesai (jam)</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'PO→Picking', val: leadTimes.picking },
                  { label: 'PO→QC', val: leadTimes.qc },
                  { label: 'PO→Distribusi', val: leadTimes.distribution },
                ].map((lt) => (
                  <div key={lt.label} className="text-center">
                    <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">{lt.label}</div>
                    <div className="text-lg font-black text-blue-700">{lt.val ? `${lt.val}j` : '-'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className={`grid gap-4 mb-6 ${quickActions.length <= 4 ? 'grid-cols-4' : 'grid-cols-4'}`}>
          {quickActions.slice(0, 4).map((action) => (
            <Link key={action.to} to={action.to} className="flex flex-col items-center gap-2">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm active:scale-95 transition-transform ${action.bg} ${action.border}`}>
                <AppIcon name={action.icon} size={22} />
              </div>
              <span className="text-[9px] font-bold text-center leading-tight text-gray-700">
                {action.label.split('\n').map((l, i) => <span key={i}>{l}{i === 0 ? <br /> : ''}</span>)}
              </span>
            </Link>
          ))}
        </div>

        {/* Stats Cards */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 bg-white p-4 rounded-2xl border-l-4 border-blue-600 shadow-sm">
            <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Order Aktif</p>
            <div className="flex items-center gap-2">
              <h4 className="text-2xl font-black text-gray-800">{loading ? '-' : activeCount}</h4>
              {urgentCount > 0 && <AppIcon name="warning" size={16} className="text-orange-400" />}
            </div>
          </div>
          <div className="flex-1 bg-white p-4 rounded-2xl border-l-4 border-orange-400 shadow-sm">
            <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Perlu SJ</p>
            <div className="flex items-center gap-2">
              <h4 className={`text-2xl font-black ${urgentCount > 0 ? 'text-orange-500' : 'text-gray-800'}`}>
                {loading ? '-' : urgentCount}
              </h4>
              {urgentCount > 0 && <span className="text-[8px] text-orange-500 font-bold">Urgent</span>}
            </div>
          </div>
        </div>

        {/* Urgent SJ Orders */}
        {canIssueSJ && urgentCount > 0 && (
          <div className="mb-6">
            <h2 className="font-extrabold text-gray-800 text-sm mb-3">Perlu Diterbitkan SJ</h2>
            <div className="space-y-2">
              {orders.filter((order) => order.status === 'sj_ready').map((order) => (
                <div key={order.id} className="flex items-center gap-3 rounded-[1.5rem] border border-amber-100 bg-amber-50 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{order.order_number}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {order.branch?.name} / {order.tanggal_po}
                    </div>
                  </div>
                  <Link
                    to={`/sc/sj?order=${order.id}`}
                    className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Terbitkan SJ
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order List */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-extrabold text-gray-800 text-sm">Semua Order Berjalan</h2>
            <ToneBadge tone="info">{activeCount} order</ToneBadge>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 text-center">
              <AppIcon name="spark" size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-700">Tidak ada order aktif</p>
              <p className="text-xs text-gray-400 mt-1">Semua order selesai atau belum ada order baru.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  to={`/sc/orders/${order.id}`}
                  className="flex items-center gap-3 rounded-[1.5rem] bg-white px-4 py-4 border border-gray-100 hover:border-blue-200 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{order.order_number}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {order.branch?.name} / {order.branch?.district || '-'} / {order.tanggal_po}
                    </div>
                    {order.catatan && <div className="mt-0.5 truncate text-xs text-slate-400">{order.catatan}</div>}
                  </div>
                  <ToneBadge tone={STATUS_TONE[order.status] || 'slate'}>
                    {STATUS_LABEL[order.status] || order.status}
                  </ToneBadge>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Notice */}
        <div className="bg-slate-900 p-5 rounded-[2rem] text-white relative overflow-hidden shadow-xl">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-blue-600 text-[8px] font-black px-2 py-0.5 rounded uppercase">Info SC</span>
            </div>
            <h3 className="font-bold text-sm mb-1">{getSubtitle(profile)}</h3>
            <p className="text-[10px] opacity-70 leading-relaxed">
              Data order difilter otomatis sesuai akses dan scope wilayah kamu.
            </p>
          </div>
          <AppIcon name="map" size={72} className="absolute -right-4 -bottom-4 opacity-5" />
        </div>
      </div>

      {getFooter(profile?.role)}
    </div>
  )
}
