import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtRp } from '../../lib/utils'
import { canIssueSuratJalan, getScopeLabel, isManagerRole, isOpsLikeRole, isStoreRole } from '../../lib/access'
import Alert from '../../components/Alert'
import { DMBottomNav, OpsBottomNav, SCBottomNav, StaffBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel,
  InlineStat,
  SectionPanel,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'

const STAGES = [
  { key: 'picking', label: 'Picking' },
  { key: 'qc', label: 'QC' },
  { key: 'distribution', label: 'Distribution' },
]

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
  cancelled: 'Dibatalkan',
}

function getFooter(role) {
  if (isOpsLikeRole(role)) return <OpsBottomNav />
  if (isManagerRole(role)) return <DMBottomNav />
  if (isStoreRole(role)) return <StaffBottomNav />
  return <SCBottomNav />
}

export default function OrderDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [confirmations, setConfirmations] = useState({})
  const [confirmationItems, setConfirmationItems] = useState({})
  const [suratJalan, setSuratJalan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAll()
  }, [id])

  const fetchAll = async () => {
    setLoading(true)
    setError('')

    const [orderRes, itemsRes, confRes, sjRes] = await Promise.all([
      supabase.from('supply_orders').select('*, branch:branches(id,name,store_id,district,area)').eq('id', id).single(),
      supabase.from('supply_order_items').select('*').eq('order_id', id).order('sku_name'),
      supabase.from('supply_confirmations').select('*, confirmed_by:profiles(full_name)').eq('order_id', id),
      supabase.from('surat_jalan').select('*').eq('order_id', id).maybeSingle(),
    ])

    if (orderRes.error || !orderRes.data) {
      setError('Order tidak ditemukan.')
      setLoading(false)
      return
    }

    setOrder(orderRes.data)
    setItems(itemsRes.data || [])
    setSuratJalan(sjRes.data || null)

    const nextConfirmations = {}
    const nextItems = {}

    for (const confirmation of confRes.data || []) {
      nextConfirmations[confirmation.stage] = confirmation
      nextItems[confirmation.stage] = []
    }

    const confirmationIds = Object.values(nextConfirmations)
      .filter((confirmation) => confirmation.status === 'confirmed')
      .map((confirmation) => confirmation.id)

    if (confirmationIds.length > 0) {
      const { data: itemRows } = await supabase
        .from('supply_confirmation_items')
        .select('*, order_item:supply_order_items(sku_code,sku_name,unit)')
        .in('confirmation_id', confirmationIds)

      ;(itemRows || []).forEach((row) => {
        const stage = Object.values(nextConfirmations).find((confirmation) => confirmation.id === row.confirmation_id)?.stage
        if (!stage) return
        nextItems[stage] = [...(nextItems[stage] || []), row]
      })
    }

    setConfirmations(nextConfirmations)
    setConfirmationItems(nextItems)
    setLoading(false)
  }

  const footer = getFooter(profile?.role)

  if (loading) {
    return (
      <SubpageShell title="Detail Order" subtitle="Memuat..." eyebrow="Supply Order" footer={footer}>
        <div className="flex justify-center py-24">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      </SubpageShell>
    )
  }

  if (!order) {
    return (
      <SubpageShell title="Detail Order" subtitle="Tidak ditemukan" eyebrow="Supply Order" footer={footer}>
        <Alert variant="error">{error || 'Order tidak ditemukan.'}</Alert>
      </SubpageShell>
    )
  }

  const totalQty = items.reduce((sum, item) => sum + Number(item.qty_ordered), 0)
  const subtitle = isStoreRole(profile?.role)
    ? 'Detail order dan hasil konfirmasi barang untuk toko kamu.'
    : isManagerRole(profile?.role)
      ? `Detail order yang sesuai scope ${getScopeLabel(profile)}.`
      : `${order.branch?.name || '-'} / ${order.tanggal_po}`

  return (
    <SubpageShell
      title={order.order_number}
      subtitle={subtitle}
      eyebrow="Supply Order Detail"
      footer={footer}
    >
      <SectionPanel eyebrow="Status" title="Ringkasan Order">
        <div className="grid gap-3 sm:grid-cols-4">
          <InlineStat label="Status" value={STATUS_LABEL[order.status] || order.status} tone={STATUS_TONE[order.status] || 'slate'} />
          <InlineStat label="Toko" value={order.branch?.name || '-'} tone="primary" />
          <InlineStat label="Total Item" value={items.length} tone="slate" />
          <InlineStat label="Total Qty" value={totalQty.toLocaleString('id-ID')} tone="slate" />
        </div>
        {order.catatan && (
          <div className="mt-4 rounded-[18px] bg-slate-50 px-4 py-3 text-sm text-slate-600">{order.catatan}</div>
        )}
      </SectionPanel>

      <div className="mt-6 space-y-6">
        {error && <Alert variant="error">{error}</Alert>}

        <SectionPanel eyebrow="Progress" title="Status Tiap Tahap">
          <div className="grid gap-3 sm:grid-cols-3">
            {STAGES.map(({ key, label }) => {
              const confirmation = confirmations[key]
              const done = confirmation?.status === 'confirmed'

              return (
                <div key={key} className={`rounded-[22px] px-4 py-4 ${done ? 'border border-emerald-100 bg-emerald-50' : 'bg-slate-50'}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">{label}</span>
                    <ToneBadge tone={done ? 'ok' : 'slate'}>{done ? 'Done' : 'Pending'}</ToneBadge>
                  </div>
                  {confirmation?.confirmed_by && (
                    <div className="text-xs text-slate-500">{confirmation.confirmed_by.full_name}</div>
                  )}
                  {confirmation?.confirmed_at && (
                    <div className="mt-1 text-xs text-slate-400">
                      {new Date(confirmation.confirmed_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  {confirmation?.catatan && (
                    <div className="mt-1 text-xs italic text-slate-500">{confirmation.catatan}</div>
                  )}
                </div>
              )
            })}
          </div>
        </SectionPanel>

        {suratJalan && (
          <SectionPanel eyebrow="Surat Jalan" title={suratJalan.sj_number} description={`Tanggal kirim: ${suratJalan.tanggal_kirim}`}>
            <div className="grid gap-3 sm:grid-cols-3">
              <InlineStat label="Status SJ" value={suratJalan.status} tone={suratJalan.status === 'shipped' ? 'primary' : 'emerald'} />
              <InlineStat label="Pengirim" value={suratJalan.pengirim || '-'} tone="slate" />
              <InlineStat
                label="Diterbitkan"
                value={suratJalan.issued_at ? new Date(suratJalan.issued_at).toLocaleDateString('id-ID') : '-'}
                tone="slate"
              />
            </div>
          </SectionPanel>
        )}

        <SectionPanel
          eyebrow="Items"
          title="Daftar Item Order"
          actions={<ToneBadge tone="info">{items.length} SKU</ToneBadge>}
        >
          {items.length === 0 ? (
            <EmptyPanel title="Tidak ada item" description="Order ini tidak memiliki item." />
          ) : (
            <div className="space-y-2">
              <div className="hidden grid-cols-[0.8fr_2fr_0.7fr_0.5fr_0.7fr] gap-2 px-3 sm:grid">
                {['SKU', 'Nama', 'Qty Order', 'Unit', 'Harga'].map((label) => (
                  <div key={label} className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</div>
                ))}
              </div>

              {items.map((item) => {
                const distributionRow = confirmationItems.distribution?.find((row) => row.order_item_id === item.id)
                const diffQty = distributionRow ? Number(distributionRow.qty_confirmed) - Number(item.qty_ordered) : null

                return (
                  <div key={item.id} className="grid grid-cols-1 items-center gap-2 rounded-[18px] bg-slate-50/85 px-3 py-3 sm:grid-cols-[0.8fr_2fr_0.7fr_0.5fr_0.7fr]">
                    <div className="text-xs font-semibold text-primary-600">{item.sku_code}</div>
                    <div className="text-sm font-medium text-slate-800">{item.sku_name}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{Number(item.qty_ordered).toLocaleString('id-ID')}</span>
                      {diffQty != null && diffQty !== 0 && (
                        <span className={`text-xs font-semibold ${diffQty > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {diffQty > 0 ? `+${diffQty}` : diffQty}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{item.unit}</div>
                    <div className="text-xs text-slate-500">{item.unit_price ? fmtRp(item.unit_price) : '-'}</div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionPanel>

        {STAGES.map(({ key, label }) => {
          const rows = confirmationItems[key]
          if (!rows?.length) return null

          const hasDiscrepancy = rows.some((row) => {
            const orderItem = items.find((item) => item.id === row.order_item_id)
            return orderItem && Number(row.qty_confirmed) !== Number(orderItem.qty_ordered)
          })

          return (
            <SectionPanel
              key={key}
              eyebrow={`Konfirmasi ${label}`}
              title={`Hasil ${label}`}
              actions={<ToneBadge tone={hasDiscrepancy ? 'warn' : 'ok'}>{hasDiscrepancy ? 'Ada selisih' : 'Sesuai'}</ToneBadge>}
            >
              <div className="space-y-2">
                {rows
                  .filter((row) => {
                    const orderItem = items.find((item) => item.id === row.order_item_id)
                    return orderItem && Number(row.qty_confirmed) !== Number(orderItem.qty_ordered)
                  })
                  .map((row) => {
                    const orderItem = items.find((item) => item.id === row.order_item_id)
                    const diff = Number(row.qty_confirmed) - Number(orderItem?.qty_ordered || 0)

                    return (
                      <div key={row.id} className="flex items-center gap-3 rounded-[18px] bg-amber-50 px-3 py-3">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-slate-800">{orderItem?.sku_name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Order: {orderItem?.qty_ordered} / {label}: {row.qty_confirmed} {orderItem?.unit}
                          </div>
                        </div>
                        <ToneBadge tone={diff > 0 ? 'info' : 'danger'}>
                          {diff > 0 ? `+${diff}` : diff} {orderItem?.unit}
                        </ToneBadge>
                      </div>
                    )
                  })}

                {!hasDiscrepancy && (
                  <div className="py-2 text-center text-sm text-emerald-600">Semua qty sesuai.</div>
                )}
              </div>
            </SectionPanel>
          )
        })}

        {order.status === 'sj_ready' && !suratJalan && canIssueSuratJalan(profile?.role) && (
          <Link to={`/sc/sj?order=${id}`} className="btn-primary block text-center">
            Terbitkan Surat Jalan
          </Link>
        )}
      </div>
    </SubpageShell>
  )
}
