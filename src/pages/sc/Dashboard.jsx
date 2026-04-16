import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SCBottomNav, OpsBottomNav } from '../../components/BottomNav'
import {
  HeroCard, InlineStat, SectionPanel, SubpageShell, ToneBadge, EmptyPanel,
} from '../../components/ui/AppKit'

const STATUS_TONE = {
  draft: 'slate', picking: 'warn', qc: 'warn', distribution: 'warn',
  sj_ready: 'info', shipped: 'info', completed: 'ok', cancelled: 'danger',
}
const STATUS_LABEL = {
  draft: 'Draft', picking: 'Picking', qc: 'QC', distribution: 'Distribution',
  sj_ready: 'Siap SJ', shipped: 'Dikirim', completed: 'Selesai', cancelled: 'Batal',
}

const STAGE_ORDER = ['draft','picking','qc','distribution','sj_ready','shipped','completed','cancelled']

export default function SCDashboard() {
  const { profile } = useAuth()
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchOrders() }, [])

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('supply_orders')
      .select('*, branch:branches(id,name,store_id)')
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(60)
    setOrders(data || [])
    setLoading(false)
  }

  // Stats
  const byStatus = STAGE_ORDER.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s).length
    return acc
  }, {})

  const activeCount = orders.filter(o => !['completed','cancelled'].includes(o.status)).length
  const urgentCount = orders.filter(o => o.status === 'sj_ready').length

  const canCreateOrder = ['warehouse_admin','purchasing_admin','ops_manager','sc_supervisor'].includes(profile?.role)

  return (
    <SubpageShell
      title="Supply Chain"
      subtitle="Warehouse → Store delivery tracking"
      eyebrow="SC Dashboard"
      footer={profile?.role === 'ops_manager' ? <OpsBottomNav /> : <SCBottomNav />}
    >
      <HeroCard
        eyebrow="Overview"
        title={`${activeCount} Order Aktif`}
        description="Pantau semua alur pengiriman dari warehouse ke toko. Setiap order melewati Picking → QC → Distribution → Surat Jalan."
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

        {/* Quick actions */}
        <div className="grid gap-3 sm:grid-cols-2">
          {canCreateOrder && (
            <Link
              to="/sc/orders/new"
              className="flex items-center gap-3 rounded-[22px] bg-primary-600 px-5 py-4 text-white hover:bg-primary-700 transition-colors"
            >
              <span className="text-2xl">📂</span>
              <div>
                <div className="text-sm font-semibold">Buat Order Baru</div>
                <div className="text-xs text-primary-200">Upload Excel / CSV</div>
              </div>
            </Link>
          )}
          <Link
            to="/sc/sj"
            className="flex items-center gap-3 rounded-[22px] bg-slate-100 px-5 py-4 hover:bg-slate-200 transition-colors"
          >
            <span className="text-2xl">📄</span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Surat Jalan</div>
              <div className="text-xs text-slate-400">Lihat & kelola semua SJ</div>
            </div>
          </Link>
        </div>

        {/* Orders needing SJ */}
        {byStatus.sj_ready > 0 && (
          <SectionPanel
            eyebrow="Action Required"
            title="Perlu Diterbitkan SJ"
            description="Order berikut sudah selesai konfirmasi Distribution dan siap diterbitkan Surat Jalan."
            actions={<ToneBadge tone="warn">{byStatus.sj_ready} order</ToneBadge>}
          >
            <div className="space-y-2">
              {orders.filter(o => o.status === 'sj_ready').map(o => (
                <div key={o.id} className="flex items-center gap-3 rounded-[22px] bg-amber-50 border border-amber-100 px-4 py-4">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900">{o.order_number}</div>
                    <div className="text-xs text-slate-400">{o.branch?.name} · {o.tanggal_po}</div>
                  </div>
                  <Link
                    to={`/sc/sj?order=${o.id}`}
                    className="rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                  >
                    Terbitkan SJ
                  </Link>
                </div>
              ))}
            </div>
          </SectionPanel>
        )}

        {/* All active orders */}
        <SectionPanel
          eyebrow="Order Aktif"
          title="Semua Order Berjalan"
          description="Klik order untuk melihat detail lengkap termasuk konfirmasi tiap tahap."
          actions={<ToneBadge tone="info">{activeCount} order</ToneBadge>}
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : orders.length === 0 ? (
            <EmptyPanel
              title="Tidak ada order aktif"
              description="Semua order sudah selesai atau belum ada order baru."
            />
          ) : (
            <div className="space-y-2">
              {orders.map(o => (
                <Link
                  key={o.id}
                  to={`/sc/orders/${o.id}`}
                  className="flex items-center gap-3 rounded-[22px] bg-slate-50/85 hover:bg-primary-50 px-4 py-4 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{o.order_number}</div>
                    <div className="text-xs text-slate-400 truncate">{o.branch?.name} · {o.tanggal_po}</div>
                    {o.catatan && <div className="text-xs text-slate-400 truncate">{o.catatan}</div>}
                  </div>
                  <ToneBadge tone={STATUS_TONE[o.status] ?? 'slate'}>
                    {STATUS_LABEL[o.status] ?? o.status}
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
