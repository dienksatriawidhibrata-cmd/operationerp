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
  isStoreRole,
} from '../../lib/access'
import {
  AppIcon,
  EmptyPanel,
  HeroCard,
  InlineStat,
  SectionPanel,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'

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
  if (role === 'ops_manager') return <OpsBottomNav />
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

  return 'Warehouse -> Store delivery tracking'
}

export default function SCDashboard() {
  const { profile, signOut } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    setLoading(true)

    const { data } = await supabase
      .from('supply_orders')
      .select('*, branch:branches(id,name,store_id,district,area)')
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(60)

    setOrders(data || [])
    setLoading(false)
  }

  const byStatus = STAGE_ORDER.reduce((acc, status) => {
    acc[status] = orders.filter((order) => order.status === status).length
    return acc
  }, {})

  const activeCount = orders.filter((order) => !['completed', 'cancelled'].includes(order.status)).length
  const urgentCount = orders.filter((order) => order.status === 'sj_ready').length
  const canCreateOrder = canCreateSupplyOrder(profile?.role)
  const canIssueSJ = canIssueSuratJalan(profile?.role)

  return (
    <SubpageShell
      title="Supply Chain"
      subtitle={getSubtitle(profile)}
      eyebrow="SC Dashboard"
      showBack={false}
      action={
        <button
          onClick={signOut}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.35)] transition-colors hover:border-primary-200 hover:text-primary-700"
          aria-label="Keluar"
        >
          <AppIcon name="logout" size={18} />
        </button>
      }
      footer={getFooter(profile?.role)}
    >
      <HeroCard
        eyebrow="Overview"
        title={`${activeCount} Order Aktif`}
        description="Pantau semua alur pengiriman dari warehouse ke outlet. Data di halaman ini selalu menyesuaikan cabang atau wilayah yang boleh kamu lihat."
        meta={
          <>
            {urgentCount > 0 && <ToneBadge tone="warn">{urgentCount} perlu SJ</ToneBadge>}
            <ToneBadge tone="info">{activeCount} aktif</ToneBadge>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <InlineStat label="Picking" value={byStatus.picking} tone={byStatus.picking > 0 ? 'warn' : 'slate'} />
          <InlineStat label="QC" value={byStatus.qc} tone={byStatus.qc > 0 ? 'warn' : 'slate'} />
          <InlineStat label="Distribution" value={byStatus.distribution} tone={byStatus.distribution > 0 ? 'warn' : 'slate'} />
          <InlineStat label="Siap SJ" value={byStatus.sj_ready} tone={byStatus.sj_ready > 0 ? 'info' : 'slate'} />
        </div>
      </HeroCard>

      <div className="mt-6 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {canCreateOrder && (
            <Link
              to="/sc/orders/new"
              className="flex items-center gap-3 rounded-[22px] bg-primary-600 px-5 py-4 text-white transition-colors hover:bg-primary-700"
            >
              <span className="text-2xl">PO</span>
              <div>
                <div className="text-sm font-semibold">Buat Order Baru</div>
                <div className="text-xs text-primary-200">Upload Excel atau CSV</div>
              </div>
            </Link>
          )}

          <Link
            to="/sc/sj"
            className="flex items-center gap-3 rounded-[22px] bg-slate-100 px-5 py-4 transition-colors hover:bg-slate-200"
          >
            <span className="text-2xl">SJ</span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Surat Jalan</div>
              <div className="text-xs text-slate-400">Lihat pengiriman dan status penerimaan barang.</div>
            </div>
          </Link>
        </div>

        {canIssueSJ && urgentCount > 0 && (
          <SectionPanel
            eyebrow="Action Required"
            title="Perlu Diterbitkan SJ"
            description="Order berikut sudah selesai distribution dan siap diterbitkan Surat Jalan."
            actions={<ToneBadge tone="warn">{urgentCount} order</ToneBadge>}
          >
            <div className="space-y-2">
              {orders.filter((order) => order.status === 'sj_ready').map((order) => (
                <div key={order.id} className="flex items-center gap-3 rounded-[22px] border border-amber-100 bg-amber-50 px-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{order.order_number}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {order.branch?.name} / {order.tanggal_po}
                    </div>
                  </div>
                  <Link
                    to={`/sc/sj?order=${order.id}`}
                    className="rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                  >
                    Terbitkan SJ
                  </Link>
                </div>
              ))}
            </div>
          </SectionPanel>
        )}

        <SectionPanel
          eyebrow="Order Aktif"
          title="Semua Order Berjalan"
          description="Klik order untuk melihat detail barang, hasil konfirmasi tiap tahap, dan status surat jalannya."
          actions={<ToneBadge tone="info">{activeCount} order</ToneBadge>}
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : orders.length === 0 ? (
            <EmptyPanel
              title="Tidak ada order aktif"
              description="Semua order sudah selesai atau belum ada order baru untuk scope ini."
            />
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  to={`/sc/orders/${order.id}`}
                  className="flex items-center gap-3 rounded-[22px] bg-slate-50/85 px-4 py-4 transition-colors hover:bg-primary-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{order.order_number}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {order.branch?.name} / {order.branch?.district || '-'} / {order.tanggal_po}
                    </div>
                    {order.catatan && <div className="mt-1 truncate text-xs text-slate-400">{order.catatan}</div>}
                  </div>
                  <ToneBadge tone={STATUS_TONE[order.status] || 'slate'}>
                    {STATUS_LABEL[order.status] || order.status}
                  </ToneBadge>
                </Link>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}
