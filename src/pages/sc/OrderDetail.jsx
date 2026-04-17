import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fmtRp } from '../../lib/utils'
import Alert from '../../components/Alert'
import { SCBottomNav } from '../../components/BottomNav'
import {
  InlineStat, SectionPanel, SubpageShell, ToneBadge, EmptyPanel,
} from '../../components/ui/AppKit'

const STAGES = [
  { key: 'picking',      label: 'Picking',      role: 'picking_spv' },
  { key: 'qc',          label: 'QC',            role: 'qc_spv' },
  { key: 'distribution',label: 'Distribution',  role: 'distribution_spv' },
]

const STATUS_TONE = {
  draft:        'slate',
  picking:      'warn',
  qc:           'warn',
  distribution: 'warn',
  sj_ready:     'info',
  shipped:      'info',
  completed:    'ok',
  cancelled:    'danger',
}

const STATUS_LABEL = {
  draft:        'Draft',
  picking:      'Picking',
  qc:           'QC',
  distribution: 'Distribution',
  sj_ready:     'Siap SJ',
  shipped:      'Dikirim',
  completed:    'Selesai',
  cancelled:    'Dibatalkan',
}

export default function OrderDetail() {
  const { id } = useParams()

  const [order, setOrder]           = useState(null)
  const [items, setItems]           = useState([])
  const [confirmations, setConfs]   = useState({})
  const [confItems, setConfItems]   = useState({})
  const [sj, setSJ]                 = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  useEffect(() => { fetchAll() }, [id])

  const fetchAll = async () => {
    setLoading(true)
    setError('')

    const [orderRes, itemsRes, confRes, sjRes] = await Promise.all([
      supabase.from('supply_orders').select('*, branch:branches(id,name,store_id)').eq('id', id).single(),
      supabase.from('supply_order_items').select('*').eq('order_id', id).order('sku_name'),
      supabase.from('supply_confirmations').select('*, confirmed_by:profiles(full_name)').eq('order_id', id),
      supabase.from('surat_jalan').select('*').eq('order_id', id).maybeSingle(),
    ])

    if (orderRes.error) { setError('Order tidak ditemukan.'); setLoading(false); return }
    setOrder(orderRes.data)
    setItems(itemsRes.data || [])
    setSJ(sjRes.data)

    const confs = {}
    const confMap = {}
    for (const c of (confRes.data || [])) {
      confs[c.stage] = c
      confMap[c.stage] = []
    }
    setConfs(confs)

    // Fetch confirmation items for all confirmed stages
    const confirmedIds = Object.values(confs)
      .filter(c => c.status === 'confirmed')
      .map(c => c.id)

    if (confirmedIds.length > 0) {
      const { data: ciData } = await supabase
        .from('supply_confirmation_items')
        .select('*, order_item:supply_order_items(sku_code,sku_name,unit)')
        .in('confirmation_id', confirmedIds)

      for (const ci of (ciData || [])) {
        const stage = Object.values(confs).find(c => c.id === ci.confirmation_id)?.stage
        if (stage) confMap[stage] = [...(confMap[stage] || []), ci]
      }
    }

    setConfItems(confMap)
    setLoading(false)
  }

  if (loading) return (
    <SubpageShell title="Detail Order" subtitle="Memuat..." eyebrow="Supply Order" footer={<SCBottomNav />}>
      <div className="flex justify-center py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    </SubpageShell>
  )

  if (!order) return (
    <SubpageShell title="Detail Order" subtitle="Tidak ditemukan" eyebrow="Supply Order" footer={<SCBottomNav />}>
      <Alert variant="error">{error || 'Order tidak ditemukan.'}</Alert>
    </SubpageShell>
  )

  const totalQty = items.reduce((s, i) => s + Number(i.qty_ordered), 0)

  return (
    <SubpageShell
      title={order.order_number}
      subtitle={`${order.branch?.name} · ${order.tanggal_po}`}
      eyebrow="Supply Order Detail"
      footer={<SCBottomNav />}
    >
      {/* Status & stats */}
      <SectionPanel eyebrow="Status" title="Ringkasan Order">
        <div className="grid gap-3 sm:grid-cols-4">
          <InlineStat label="Status" value={STATUS_LABEL[order.status] ?? order.status} tone={STATUS_TONE[order.status] ?? 'slate'} />
          <InlineStat label="Toko" value={order.branch?.name} tone="primary" />
          <InlineStat label="Total Item" value={items.length} tone="slate" />
          <InlineStat label="Total Qty" value={totalQty.toLocaleString('id-ID')} tone="slate" />
        </div>
        {order.catatan && (
          <div className="mt-4 rounded-[18px] bg-slate-50 px-4 py-3 text-sm text-slate-600">{order.catatan}</div>
        )}
      </SectionPanel>

      <div className="mt-6 space-y-6">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Stage progress */}
        <SectionPanel eyebrow="Progress" title="Status Tiap Tahap">
          <div className="grid gap-3 sm:grid-cols-3">
            {STAGES.map(({ key, label }) => {
              const c = confirmations[key]
              const done = c?.status === 'confirmed'
              return (
                <div key={key} className={`rounded-[22px] px-4 py-4 ${done ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-800">{label}</span>
                    <ToneBadge tone={done ? 'ok' : 'slate'}>{done ? 'Done' : 'Pending'}</ToneBadge>
                  </div>
                  {done && c?.confirmed_by && (
                    <div className="text-xs text-slate-500">{c.confirmed_by.full_name}</div>
                  )}
                  {done && c?.confirmed_at && (
                    <div className="text-xs text-slate-400">
                      {new Date(c.confirmed_at).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </div>
                  )}
                  {c?.catatan && <div className="mt-1 text-xs text-slate-500 italic">{c.catatan}</div>}
                </div>
              )
            })}
          </div>
        </SectionPanel>

        {/* Surat Jalan info */}
        {sj && (
          <SectionPanel eyebrow="Surat Jalan" title={sj.sj_number} description={`Tanggal kirim: ${sj.tanggal_kirim}`}>
            <div className="grid gap-3 sm:grid-cols-3">
              <InlineStat label="Status SJ" value={sj.status} tone={sj.status === 'shipped' ? 'info' : 'ok'} />
              <InlineStat label="Pengirim" value={sj.pengirim || '-'} tone="slate" />
              <InlineStat label="Diterbitkan" value={sj.issued_at ? new Date(sj.issued_at).toLocaleDateString('id-ID') : '-'} tone="slate" />
            </div>
          </SectionPanel>
        )}

        {/* Order items */}
        <SectionPanel
          eyebrow="Items"
          title="Daftar Item Order"
          actions={<ToneBadge tone="info">{items.length} SKU</ToneBadge>}
        >
          {items.length === 0 ? (
            <EmptyPanel title="Tidak ada item" description="Order ini tidak memiliki item." />
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div className="hidden sm:grid grid-cols-[0.8fr_2fr_0.7fr_0.5fr_0.7fr] gap-2 px-3">
                {['SKU','Nama','Qty Order','Unit','Harga'].map(h => (
                  <div key={h} className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</div>
                ))}
              </div>
              {items.map(item => {
                // Compare with distribution confirmation if available
                const distConf = confItems['distribution']?.find(ci => ci.order_item_id === item.id)
                const diffQty  = distConf ? distConf.qty_confirmed - item.qty_ordered : null

                return (
                  <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[0.8fr_2fr_0.7fr_0.5fr_0.7fr] gap-2 rounded-[18px] bg-slate-50/85 px-3 py-3 items-center">
                    <div className="text-xs font-mono text-primary-600 font-semibold">{item.sku_code}</div>
                    <div className="text-sm font-medium text-slate-800">{item.sku_name}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{Number(item.qty_ordered).toLocaleString('id-ID')}</span>
                      {diffQty !== null && diffQty !== 0 && (
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

        {/* Confirmation diff per stage */}
        {STAGES.map(({ key, label }) => {
          const ci = confItems[key]
          if (!ci || ci.length === 0) return null
          const hasDiscrepancy = ci.some(c => c.qty_confirmed !== items.find(i => i.id === c.order_item_id)?.qty_ordered)
          return (
            <SectionPanel
              key={key}
              eyebrow={`Konfirmasi ${label}`}
              title={`Hasil ${label}`}
              actions={<ToneBadge tone={hasDiscrepancy ? 'warn' : 'ok'}>{hasDiscrepancy ? 'Ada selisih' : 'Sesuai'}</ToneBadge>}
            >
              <div className="space-y-2">
                {ci.filter(c => {
                  const orig = items.find(i => i.id === c.order_item_id)
                  return orig && c.qty_confirmed !== Number(orig.qty_ordered)
                }).map(c => {
                  const orig = items.find(i => i.id === c.order_item_id)
                  const diff = c.qty_confirmed - Number(orig?.qty_ordered ?? 0)
                  return (
                    <div key={c.id} className="flex items-center gap-3 rounded-[18px] bg-amber-50 px-3 py-3">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-800">{orig?.sku_name}</div>
                        <div className="text-xs text-slate-500">Order: {orig?.qty_ordered} → {label}: {c.qty_confirmed} {orig?.unit}</div>
                      </div>
                      <ToneBadge tone={diff > 0 ? 'info' : 'danger'}>
                        {diff > 0 ? `+${diff}` : diff} {orig?.unit}
                      </ToneBadge>
                    </div>
                  )
                })}
                {!hasDiscrepancy && (
                  <div className="text-sm text-emerald-600 text-center py-2">Semua qty sesuai.</div>
                )}
              </div>
            </SectionPanel>
          )
        })}

        {/* Action: Issue SJ */}
        {order.status === 'sj_ready' && !sj && (
          <Link to={`/sc/sj?order=${id}`} className="btn-primary block text-center">
            Terbitkan Surat Jalan
          </Link>
        )}
      </div>
    </SubpageShell>
  )
}
