/**
 * StageConfirm.jsx
 * Shared page for Picking / QC / Distribution confirmation.
 * Pass `stage` prop: 'picking' | 'qc' | 'distribution'
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Alert from '../../components/Alert'
import { SCBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel, InlineStat, SectionPanel, SubpageShell, ToneBadge,
} from '../../components/ui/AppKit'

const STAGE_META = {
  picking:      { label: 'Picking',      eyebrow: 'Warehouse Picking',   prevStage: null,         nextStatus: 'qc',           icon: '📦' },
  qc:           { label: 'Quality Control', eyebrow: 'QC Confirmation',  prevStage: 'picking',    nextStatus: 'distribution', icon: '🔍' },
  distribution: { label: 'Distribution', eyebrow: 'Distribution Check',  prevStage: 'qc',         nextStatus: 'sj_ready',     icon: '🚚' },
}

function OrderCard({ order, onSelect }) {
  return (
    <button
      onClick={() => onSelect(order)}
      className="w-full text-left rounded-[22px] bg-slate-50/85 hover:bg-primary-50 px-4 py-4 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900">{order.order_number}</div>
          <div className="text-xs text-slate-400">{order.branch?.name} · {order.tanggal_po}</div>
          {order.catatan && <div className="text-xs text-slate-400 mt-0.5 truncate">{order.catatan}</div>}
        </div>
        <ToneBadge tone="warn">Perlu dikonfirmasi</ToneBadge>
      </div>
    </button>
  )
}

export default function StageConfirm({ stage }) {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const meta        = STAGE_META[stage]

  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [selectedOrder, setSelected] = useState(null)

  // Confirmation state
  const [origItems, setOrigItems]   = useState([])   // supply_order_items
  const [prevConfItems, setPrevCI]  = useState([])   // conf items from previous stage
  const [qtyMap, setQtyMap]         = useState({})   // { order_item_id: qty_confirmed }
  const [noteMap, setNoteMap]       = useState({})   // { order_item_id: catatan }
  const [generalNote, setGenNote]   = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [done, setDone]             = useState(false)
  const [isReconfirm, setIsReconfirm] = useState(false)

  useEffect(() => { fetchPendingOrders() }, [stage])

  const fetchPendingOrders = async () => {
    setLoading(true)
    // Orders in the stage that still need confirmation
    const { data } = await supabase
      .from('supply_orders')
      .select('*, branch:branches(id,name)')
      .eq('status', stage)
      .order('created_at', { ascending: true })
    setOrders(data || [])
    setLoading(false)
  }

  const handleSelectOrder = async (order) => {
    setSelected(order)
    setError('')
    setDone(false)

    // Load order items
    const { data: oItems } = await supabase
      .from('supply_order_items')
      .select('*')
      .eq('order_id', order.id)
      .order('sku_name')

    setOrigItems(oItems || [])

    // Check if this stage was already confirmed (re-confirmation scenario)
    const { data: existingStageConf } = await supabase
      .from('supply_confirmations')
      .select('id, status')
      .eq('order_id', order.id)
      .eq('stage', stage)
      .maybeSingle()
    setIsReconfirm(existingStageConf?.status === 'confirmed')

    // Init qty map from previous stage (or from order items if first stage)
    const prevCI = []
    if (meta.prevStage) {
      const { data: prevConf } = await supabase
        .from('supply_confirmations')
        .select('id')
        .eq('order_id', order.id)
        .eq('stage', meta.prevStage)
        .eq('status', 'confirmed')
        .maybeSingle()

      if (prevConf) {
        const { data: pItems } = await supabase
          .from('supply_confirmation_items')
          .select('*')
          .eq('confirmation_id', prevConf.id)
        prevCI.push(...(pItems || []))
      }
    }
    setPrevCI(prevCI)

    // Pre-fill qty from previous stage or original
    const initQty = {}
    ;(oItems || []).forEach(item => {
      const prevItem = prevCI.find(p => p.order_item_id === item.id)
      initQty[item.id] = prevItem ? prevItem.qty_confirmed : item.qty_ordered
    })
    setQtyMap(initQty)
    setNoteMap({})
    setGenNote('')
  }

  const handleBack = () => {
    setSelected(null)
    setOrigItems([])
    setPrevCI([])
    setQtyMap({})
    setError('')
    setDone(false)
    setIsReconfirm(false)
  }

  const handleConfirm = async () => {
    if (!selectedOrder) return
    setSaving(true)
    setError('')

    // Get or create the confirmation record for this stage
    let confId
    const { data: existingConf } = await supabase
      .from('supply_confirmations')
      .select('id')
      .eq('order_id', selectedOrder.id)
      .eq('stage', stage)
      .maybeSingle()

    if (existingConf) {
      confId = existingConf.id
      // Delete existing items (re-confirming)
      await supabase.from('supply_confirmation_items').delete().eq('confirmation_id', confId)
    } else {
      const { data: newConf, error: confErr } = await supabase
        .from('supply_confirmations')
        .insert({ order_id: selectedOrder.id, stage, status: 'pending' })
        .select('id')
        .single()
      if (confErr) { setError('Gagal buat record konfirmasi: ' + confErr.message); setSaving(false); return }
      confId = newConf.id
    }

    // Insert confirmation items
    const rows = origItems.map(item => ({
      confirmation_id: confId,
      order_item_id:   item.id,
      qty_confirmed:   Number(qtyMap[item.id] ?? item.qty_ordered),
      catatan:         noteMap[item.id] || null,
    }))

    const { error: itemErr } = await supabase.from('supply_confirmation_items').insert(rows)
    if (itemErr) { setError('Gagal simpan items: ' + itemErr.message); setSaving(false); return }

    // Update confirmation status
    await supabase
      .from('supply_confirmations')
      .update({ status: 'confirmed', confirmed_by: profile.id, confirmed_at: new Date().toISOString(), catatan: generalNote || null })
      .eq('id', confId)

    // Advance order status
    await supabase
      .from('supply_orders')
      .update({ status: meta.nextStatus })
      .eq('id', selectedOrder.id)

    setDone(true)
    await fetchPendingOrders()
    setSaving(false)
  }

  const title = `Konfirmasi ${meta.label}`

  if (loading) return (
    <SubpageShell title={title} subtitle="Memuat..." eyebrow={meta.eyebrow} footer={<SCBottomNav />}>
      <div className="flex justify-center py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    </SubpageShell>
  )

  // ── Order list view ──────────────────────────────────────
  if (!selectedOrder) {
    return (
      <SubpageShell
        title={title}
        subtitle={`${meta.icon} Pilih order untuk dikonfirmasi`}
        eyebrow={meta.eyebrow}
        footer={<SCBottomNav />}
      >
        <SectionPanel
          eyebrow="Queue"
          title="Order Menunggu Konfirmasi"
          description={`Order yang sudah sampai di tahap ${meta.label} dan perlu kamu konfirmasi qty-nya.`}
          actions={<ToneBadge tone={orders.length > 0 ? 'warn' : 'ok'}>{orders.length} order</ToneBadge>}
        >
          {orders.length === 0 ? (
            <EmptyPanel
              title={`Tidak ada order di tahap ${meta.label}`}
              description="Semua order sudah dikonfirmasi atau belum ada yang masuk ke tahap ini."
            />
          ) : (
            <div className="space-y-2">
              {orders.map(o => (
                <OrderCard key={o.id} order={o} onSelect={handleSelectOrder} />
              ))}
            </div>
          )}
        </SectionPanel>
      </SubpageShell>
    )
  }

  // ── Confirmation form ────────────────────────────────────
  const totalConfirmed = origItems.reduce((s, item) => s + (Number(qtyMap[item.id]) || 0), 0)
  const totalOrdered   = origItems.reduce((s, item) => s + Number(item.qty_ordered), 0)
  const discrepancies  = origItems.filter(item => {
    const prev = meta.prevStage ? (prevConfItems.find(p => p.order_item_id === item.id)?.qty_confirmed ?? item.qty_ordered) : item.qty_ordered
    return Number(qtyMap[item.id]) !== Number(prev)
  })

  return (
    <SubpageShell
      title={title}
      subtitle={`${selectedOrder.order_number} · ${selectedOrder.branch?.name}`}
      eyebrow={meta.eyebrow}
      footer={<SCBottomNav />}
    >
      <SectionPanel eyebrow="Order Info" title={selectedOrder.order_number}>
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineStat label="Toko" value={selectedOrder.branch?.name} tone="primary" />
          <InlineStat label="Total Item" value={origItems.length} tone="slate" />
          <InlineStat
            label="Selisih"
            value={discrepancies.length}
            tone={discrepancies.length > 0 ? 'warn' : 'ok'}
          />
        </div>
        <button onClick={handleBack} className="mt-3 text-xs text-primary-600 font-semibold">
          ← Kembali ke daftar order
        </button>
      </SectionPanel>

      <div className="mt-6 space-y-6">
        {done && <Alert variant="ok">Konfirmasi {meta.label} berhasil disimpan. Order berlanjut ke tahap berikutnya.</Alert>}
        {isReconfirm && !done && (
          <Alert variant="warn">
            Stage ini sudah pernah dikonfirmasi. Submit ulang akan menimpa data konfirmasi sebelumnya.
          </Alert>
        )}
        {error && <Alert variant="error">{error}</Alert>}

        <SectionPanel
          eyebrow={`Konfirmasi ${meta.label}`}
          title="Input Qty Aktual"
          description={`Isi qty yang benar-benar sudah di-${meta.label.toLowerCase()}. Jika berbeda dari order, isi angka aktualnya.`}
          actions={
            <ToneBadge tone={discrepancies.length > 0 ? 'warn' : 'ok'}>
              {discrepancies.length > 0 ? `${discrepancies.length} selisih` : 'Semua sesuai'}
            </ToneBadge>
          }
        >
          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-[0.7fr_2fr_0.8fr_0.8fr_0.8fr_1.2fr] gap-2 px-2 mb-2">
            {['SKU','Nama','Qty Order', meta.prevStage ? `Qty ${STAGE_META[meta.prevStage]?.label}` : '', `Qty ${meta.label}`,'Catatan'].map((h,i) => (
              <div key={i} className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</div>
            ))}
          </div>

          <div className="space-y-2">
            {origItems.map(item => {
              const prevQty = meta.prevStage
                ? (prevConfItems.find(p => p.order_item_id === item.id)?.qty_confirmed ?? item.qty_ordered)
                : item.qty_ordered
              const confirmed = Number(qtyMap[item.id] ?? prevQty)
              const diff = confirmed - Number(prevQty)
              const hasDiscrepancy = diff !== 0

              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-1 sm:grid-cols-[0.7fr_2fr_0.8fr_0.8fr_0.8fr_1.2fr] gap-2 rounded-[18px] px-3 py-3 items-center ${
                    hasDiscrepancy ? 'bg-amber-50' : 'bg-slate-50/85'
                  }`}
                >
                  <div className="text-xs font-mono text-primary-600">{item.sku_code}</div>
                  <div className="text-sm font-medium text-slate-800">{item.sku_name}</div>
                  <div className="text-sm text-slate-500">{Number(item.qty_ordered).toLocaleString('id-ID')} {item.unit}</div>
                  {meta.prevStage ? (
                    <div className="text-sm text-slate-500">{Number(prevQty).toLocaleString('id-ID')}</div>
                  ) : <div />}
                  <div className="flex items-center gap-1">
                    <input
                      className={`input text-sm py-2 ${hasDiscrepancy ? 'border-amber-300 bg-amber-50' : ''}`}
                      type="number"
                      step="any"
                      value={qtyMap[item.id] ?? prevQty}
                      onChange={e => setQtyMap(prev => ({ ...prev, [item.id]: e.target.value }))}
                    />
                    {hasDiscrepancy && (
                      <span className={`text-xs font-bold shrink-0 ${diff > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    )}
                  </div>
                  <input
                    className="input text-xs py-2"
                    placeholder="Catatan (opsional)"
                    value={noteMap[item.id] || ''}
                    onChange={e => setNoteMap(prev => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </div>
              )
            })}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] bg-slate-50 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Dikonfirmasi</div>
              <div className="mt-1 text-xl font-bold text-slate-900">{totalConfirmed.toLocaleString('id-ID')}</div>
              <div className="text-xs text-slate-400">dari {totalOrdered.toLocaleString('id-ID')} yang dipesan</div>
            </div>
            <div>
              <label className="label">Catatan Umum</label>
              <textarea
                className="input resize-none"
                rows={2}
                value={generalNote}
                onChange={e => setGenNote(e.target.value)}
                placeholder="Catatan keseluruhan konfirmasi ini (opsional)..."
              />
            </div>
          </div>
        </SectionPanel>

        {done ? (
          <button onClick={handleBack} className="btn-primary">
            Kembali ke Daftar Order
          </button>
        ) : (
          <button onClick={handleConfirm} disabled={saving} className="btn-primary">
            {saving ? 'Menyimpan...' : `Konfirmasi ${meta.label} (${origItems.length} item)`}
          </button>
        )}
      </div>
    </SubpageShell>
  )
}
