import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayWIB } from '../../lib/utils'
import {
  canIssueSuratJalan,
  canMarkSuratJalanDelivered,
  canMarkSuratJalanShipped,
  getScopeLabel,
  isManagerRole,
  isOpsLikeRole,
  isStoreRole,
} from '../../lib/access'
import PhotoUpload from '../../components/PhotoUpload'
import Alert from '../../components/Alert'
import { DMBottomNav, OpsBottomNav, SCBottomNav, StaffBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel, InlineStat, SectionPanel, SegmentedControl, SubpageShell, ToneBadge,
  LoadingButton,
} from '../../components/ui/AppKit'

function genSJNumber() {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `SJ-${ymd}-${rnd}`
}

function formatQty(value) {
  return Number(value || 0).toLocaleString('id-ID')
}

const SJ_STATUS_TONE = { draft: 'slate', issued: 'info', shipped: 'warn', delivered: 'ok' }
const SJ_STATUS_LABEL = { draft: 'Draft', issued: 'Diterbitkan', shipped: 'Dalam Perjalanan', delivered: 'Terkirim' }

function sanitizeCsvCell(value) {
  const text = String(value ?? '').replace(/"/g, '""')
  return `"${text}"`
}

function downloadReceiveCsv(sj, items) {
  if (!sj) return

  const rows = [
    ['SJ Number', sj.sj_number],
    ['Store', sj.branch?.name || '-'],
    ['Order', sj.order?.order_number || '-'],
    ['Tanggal Kirim', sj.tanggal_kirim || '-'],
    ['Status', SJ_STATUS_LABEL[sj.status] || sj.status],
    ['Received At', sj.received_at ? new Date(sj.received_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-'],
    ['Receive Note', sj.receive_note || '-'],
    [],
    ['SKU', 'Nama Item', 'Qty Kirim', 'Qty Diterima', 'Unit', 'Selisih', 'Catatan Item'],
    ...items.map((item) => [
      item.sku_code,
      item.sku_name,
      item.qty_kirim,
      item.qty_received ?? item.qty_kirim,
      item.unit,
      Number(item.qty_received ?? item.qty_kirim) - Number(item.qty_kirim),
      item.receive_note || '',
    ]),
  ]

  const csv = rows
    .map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${sj.sj_number || 'penerimaan'}-penerimaan.csv`
  link.click()
  window.URL.revokeObjectURL(url)
}

function NewSJForm() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const orderId = params.get('order')
  const today = todayWIB()

  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [origItems, setOrig] = useState([])

  const [tanggalKirim, setTgl] = useState(today)
  const [pengirim, setPengirim] = useState('')
  const [catatan, setCatatan] = useState('')
  const [fotoSJ, setFotoSJ] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!orderId) {
      setLoading(false)
      return
    }

    ;(async () => {
      const [orderRes, origRes] = await Promise.all([
        supabase.from('supply_orders').select('*, branch:branches(id,name)').eq('id', orderId).single(),
        supabase.from('supply_order_items').select('*').eq('order_id', orderId),
      ])

      if (orderRes.error || !orderRes.data) {
        setError('Order tidak ditemukan.')
        setLoading(false)
        return
      }

      if (orderRes.data.status !== 'sj_ready') {
        setError(`Order ini belum siap untuk diterbitkan SJ (status: ${orderRes.data.status}).`)
        setLoading(false)
        return
      }

      setOrder(orderRes.data)
      setOrig(origRes.data || [])

      const { data: distConf } = await supabase
        .from('supply_confirmations')
        .select('id')
        .eq('order_id', orderId)
        .eq('stage', 'distribution')
        .eq('status', 'confirmed')
        .maybeSingle()

      if (distConf) {
        const { data: distItems } = await supabase
          .from('supply_confirmation_items')
          .select('*')
          .eq('confirmation_id', distConf.id)
        setItems(distItems || [])
      } else {
        setItems((origRes.data || []).map((item) => ({ order_item_id: item.id, qty_confirmed: item.qty_ordered })))
      }

      setLoading(false)
    })()
  }, [orderId])

  const handleIssue = async () => {
    if (!order) return
    setSaving(true)
    setError('')

    const sjNumber = genSJNumber()

    const { data: sj, error: sjErr } = await supabase
      .from('surat_jalan')
      .insert({
        sj_number: sjNumber,
        order_id: order.id,
        branch_id: order.branch_id,
        tanggal_kirim: tanggalKirim,
        pengirim: pengirim || null,
        issued_by: profile.id,
        issued_at: new Date().toISOString(),
        status: 'issued',
        catatan: catatan || null,
        foto_sj: fotoSJ,
      })
      .select('id')
      .single()

    if (sjErr) {
      setError('Gagal terbitkan SJ: ' + sjErr.message)
      setSaving(false)
      return
    }

    const sjItems = items.map((confirmationItem) => {
      const orig = origItems.find((item) => item.id === confirmationItem.order_item_id)
      return {
        sj_id: sj.id,
        order_item_id: confirmationItem.order_item_id,
        sku_code: orig?.sku_code ?? '',
        sku_name: orig?.sku_name ?? '',
        qty_kirim: confirmationItem.qty_confirmed,
        unit: orig?.unit ?? 'PCS',
      }
    })

    const { error: itemsErr } = await supabase.from('surat_jalan_items').insert(sjItems)
    if (itemsErr) {
      await supabase.from('surat_jalan').delete().eq('id', sj.id)
      setError('Gagal simpan item SJ: ' + itemsErr.message)
      setSaving(false)
      return
    }

    await supabase.from('supply_orders').update({ status: 'shipped' }).eq('id', order.id)
    navigate('/sc/sj')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (error && !order) return <Alert variant="error">{error}</Alert>

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      <SectionPanel eyebrow="Order" title={order?.order_number ?? ''} description={order?.branch?.name}>
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineStat label="Toko" value={order?.branch?.name} tone="primary" />
          <InlineStat label="Item" value={items.length} tone="slate" />
          <InlineStat label="Total Qty" value={formatQty(items.reduce((sum, item) => sum + Number(item.qty_confirmed), 0))} tone="slate" />
        </div>
      </SectionPanel>

      <SectionPanel eyebrow="SJ Form" title="Isi Surat Jalan">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tanggal Kirim</label>
              <input className="input" type="date" value={tanggalKirim} onChange={(e) => setTgl(e.target.value)} />
            </div>
            <div>
              <label className="label">Nama Pengirim</label>
              <input className="input" type="text" value={pengirim} onChange={(e) => setPengirim(e.target.value)} placeholder="Nama kurir / supir" />
            </div>
          </div>
          <div>
            <label className="label">Catatan</label>
            <input className="input" type="text" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan pengiriman (opsional)" />
          </div>
          <div>
            <label className="label">Foto SJ (opsional)</label>
            <PhotoUpload folder={`sj/${tanggalKirim}`} value={fotoSJ} onChange={setFotoSJ} label="Upload Foto SJ" max={3} />
          </div>
        </div>
      </SectionPanel>

      <SectionPanel eyebrow="Items" title="Daftar Barang" actions={<ToneBadge tone="info">{items.length} SKU</ToneBadge>}>
        <div className="space-y-2">
          {items.map((confirmationItem) => {
            const orig = origItems.find((item) => item.id === confirmationItem.order_item_id)
            return (
              <div key={confirmationItem.order_item_id} className="flex items-center gap-3 rounded-[18px] bg-slate-50/85 px-3 py-3">
                <div className="shrink-0 text-xs font-mono text-primary-600">{orig?.sku_code}</div>
                <div className="flex-1 text-sm font-medium text-slate-800">{orig?.sku_name}</div>
                <div className="text-sm font-semibold text-slate-900">{formatQty(confirmationItem.qty_confirmed)}</div>
                <div className="text-xs text-slate-400">{orig?.unit}</div>
              </div>
            )
          })}
        </div>
      </SectionPanel>

      <LoadingButton onClick={handleIssue} loading={saving} loadingLabel="Menerbitkan..." disabled={!order} className="btn-primary">
        {`Terbitkan Surat Jalan (${items.length} item)`}
      </LoadingButton>
    </div>
  )
}

function ReceiveSJForm({ sjId }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isWarehouseAdmin = profile?.role === 'warehouse_admin'
  const [sj, setSj] = useState(null)
  const [items, setItems] = useState([])
  const [qtyMap, setQtyMap] = useState({})
  const [noteMap, setNoteMap] = useState({})
  const [generalNote, setGeneralNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sjId) {
      setLoading(false)
      return
    }

    ;(async () => {
      setLoading(true)
      setError('')

      const [sjRes, itemRes] = await Promise.all([
        supabase
          .from('surat_jalan')
          .select('*, branch:branches(name), order:supply_orders(id, order_number, status)')
          .eq('id', sjId)
          .single(),
        supabase
          .from('surat_jalan_items')
          .select('*')
          .eq('sj_id', sjId)
          .order('sku_name'),
      ])

      if (sjRes.error || !sjRes.data) {
        setError('Surat jalan tidak ditemukan.')
        setLoading(false)
        return
      }

      const nextItems = itemRes.data || []
      const nextQty = {}
      const nextNote = {}

      nextItems.forEach((item) => {
        nextQty[item.id] = item.qty_received ?? item.qty_kirim
        nextNote[item.id] = item.receive_note || ''
      })

      setSj(sjRes.data)
      setItems(nextItems)
      setQtyMap(nextQty)
      setNoteMap(nextNote)
      setGeneralNote(sjRes.data.receive_note || '')
      setLoading(false)
    })()
  }, [sjId])

  const handleSubmit = async () => {
    if (!sj) return

    setSaving(true)
    setError('')

    const itemResults = await Promise.all(
      items.map((item) =>
        supabase
          .from('surat_jalan_items')
          .update({
            qty_received: Number(qtyMap[item.id] ?? item.qty_kirim),
            receive_note: noteMap[item.id] || null,
          })
          .eq('id', item.id)
      )
    )

    const itemError = itemResults.find((result) => result.error)?.error
    if (itemError) {
      setError('Gagal menyimpan qty diterima: ' + itemError.message)
      setSaving(false)
      return
    }

    const { error: sjErr } = await supabase
      .from('surat_jalan')
      .update({
        status: 'delivered',
        received_by: profile?.id,
        received_at: new Date().toISOString(),
        receive_note: generalNote || null,
      })
      .eq('id', sj.id)

    if (sjErr) {
      setError('Gagal menyimpan status penerimaan: ' + sjErr.message)
      setSaving(false)
      return
    }

    const { error: orderErr } = await supabase
      .from('supply_orders')
      .update({ status: 'completed' })
      .eq('id', sj.order_id)

    if (orderErr) {
      setError('Qty diterima tersimpan, tapi status order gagal diperbarui: ' + orderErr.message)
      setSaving(false)
      return
    }

    navigate('/sc/sj')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (error && !sj) return <Alert variant="error">{error}</Alert>

  const totalKirim = items.reduce((sum, item) => sum + Number(item.qty_kirim), 0)
  const totalTerima = items.reduce((sum, item) => sum + Number(qtyMap[item.id] ?? item.qty_kirim), 0)
  const discrepancyCount = items.filter((item) => Number(qtyMap[item.id] ?? item.qty_kirim) !== Number(item.qty_kirim)).length
  const canDownload = isWarehouseAdmin || !isStoreRole(profile?.role)

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      <SectionPanel eyebrow="Surat Jalan" title={sj?.sj_number ?? '-'} description={sj?.branch?.name || '-'}>
        <div className="grid gap-3 sm:grid-cols-4">
          <InlineStat label="Order" value={sj?.order?.order_number || '-'} tone="primary" />
          <InlineStat label="SKU" value={items.length} tone="slate" />
          <InlineStat label="Qty Kirim" value={formatQty(totalKirim)} tone="slate" />
          <InlineStat label="Selisih" value={discrepancyCount} tone={discrepancyCount > 0 ? 'amber' : 'emerald'} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <ToneBadge tone={SJ_STATUS_TONE[sj?.status] ?? 'slate'}>{SJ_STATUS_LABEL[sj?.status] ?? sj?.status}</ToneBadge>
          {sj?.received_at && (
            <ToneBadge tone="info">
              Diterima {new Date(sj.received_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
            </ToneBadge>
          )}
          {canDownload && (
            <button
              type="button"
              onClick={() => downloadReceiveCsv(
                {
                  ...sj,
                  receive_note: generalNote,
                },
                items.map((item) => ({
                  ...item,
                  qty_received: Number(qtyMap[item.id] ?? item.qty_kirim),
                  receive_note: noteMap[item.id] || '',
                }))
              )}
              className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
            >
              Download Penerimaan
            </button>
          )}
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Penerimaan"
        title={sj?.status === 'delivered' ? 'Edit Barang Diterima' : 'Konfirmasi Barang Diterima'}
        description="Sesuaikan jumlah barang yang benar-benar diterima toko sebelum final submit."
        actions={<ToneBadge tone={discrepancyCount > 0 ? 'warn' : 'ok'}>{discrepancyCount > 0 ? `${discrepancyCount} selisih` : 'Semua sesuai'}</ToneBadge>}
      >
        <div className="space-y-2">
          {items.map((item) => {
            const qtyReceived = qtyMap[item.id] ?? item.qty_kirim
            const diff = Number(qtyReceived) - Number(item.qty_kirim)
            const hasDiff = diff !== 0

            return (
              <div
                key={item.id}
                className={`grid grid-cols-1 gap-2 rounded-[18px] px-3 py-3 sm:grid-cols-[0.8fr_2fr_0.9fr_0.9fr_1.2fr] sm:items-center ${
                  hasDiff ? 'bg-amber-50' : 'bg-slate-50/85'
                }`}
              >
                <div className="text-xs font-mono text-primary-600">{item.sku_code}</div>
                <div className="text-sm font-medium text-slate-800">{item.sku_name}</div>
                <div className="text-sm text-slate-500">
                  Kirim: {formatQty(item.qty_kirim)} {item.unit}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className={`input py-2 text-sm ${hasDiff ? 'border-amber-300 bg-amber-50' : ''}`}
                    type="number"
                    step="any"
                    value={qtyReceived}
                    onChange={(e) => setQtyMap((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                  {hasDiff && (
                    <span className={`text-xs font-bold ${diff > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  )}
                </div>
                <input
                  className="input py-2 text-xs"
                  placeholder="Catatan item (opsional)"
                  value={noteMap[item.id] || ''}
                  onChange={(e) => setNoteMap((prev) => ({ ...prev, [item.id]: e.target.value }))}
                />
              </div>
            )
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] bg-slate-50 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Diterima</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{formatQty(totalTerima)}</div>
            <div className="text-xs text-slate-400">dari {formatQty(totalKirim)} yang dikirim</div>
          </div>
          <div>
            <label className="label">Catatan Penerimaan</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={generalNote}
              onChange={(e) => setGeneralNote(e.target.value)}
              placeholder="Catatan penerimaan barang (opsional)"
            />
          </div>
        </div>
      </SectionPanel>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => navigate('/sc/sj')}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-slate-300"
        >
          Kembali
        </button>
        <LoadingButton onClick={handleSubmit} loading={saving} className="btn-primary">
          {sj?.status === 'delivered' ? 'Simpan Perubahan Penerimaan' : 'Simpan dan Tandai Diterima'}
        </LoadingButton>
      </div>
    </div>
  )
}

function SJList() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isStoreOnly = isStoreRole(profile?.role)
  const isWarehouseAdmin = profile?.role === 'warehouse_admin'
  const canShip = canMarkSuratJalanShipped(profile?.role)
  const canDeliver = canMarkSuratJalanDelivered(profile?.role)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [pendingAction, setPending] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

  const handleDownloadPenerimaan = async (sj) => {
    setDownloadingId(sj.id)
    const { data: items } = await supabase
      .from('surat_jalan_items')
      .select('*')
      .eq('sj_id', sj.id)
      .order('sku_name')
    setDownloadingId(null)
    downloadReceiveCsv(sj, items || [])
  }

  const fetchList = async () => {
    let query = supabase
      .from('surat_jalan')
      .select('*, branch:branches(name), order:supply_orders(order_number)')
      .order('issued_at', { ascending: false })

    if (isStoreOnly && profile?.branch_id) {
      query = query.eq('branch_id', profile.branch_id)
    }

    const { data } = await query
    setList(data || [])
    setLoading(false)
  }

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!active) return
      setLoading(true)
      await fetchList()
    }

    load()

    const sjFilter = isStoreOnly && profile?.branch_id
      ? `branch_id=eq.${profile.branch_id}`
      : undefined

    const sjChannel = supabase
      .channel(`sj-list-${profile?.id || 'anon'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'surat_jalan', filter: sjFilter },
        () => {
          load()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'supply_orders' },
        () => {
          load()
        }
      )
      .subscribe()

    const intervalId = window.setInterval(load, 30000)

    return () => {
      active = false
      window.clearInterval(intervalId)
      supabase.removeChannel(sjChannel)
    }
  }, [isStoreOnly, profile?.branch_id, profile?.id])

  const confirmAction = async () => {
    if (!pendingAction) return

    const { id, status } = pendingAction
    setPending(null)
    await supabase.from('surat_jalan').update({ status }).eq('id', id)
    fetchList()
  }

  const filtered = filter === 'all' ? list : list.filter((sj) => sj.status === filter)

  const tabs = [
    { key: 'all', label: 'Semua' },
    { key: 'issued', label: 'Diterbitkan' },
    { key: 'shipped', label: 'Perjalanan' },
    { key: 'delivered', label: 'Terkirim' },
  ]

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <SectionPanel
      eyebrow="Surat Jalan"
      title={isStoreOnly ? 'Pengiriman ke Toko' : 'Daftar Surat Jalan'}
      description={isStoreOnly ? 'Daftar pengiriman barang yang ditujukan ke toko kamu.' : 'Semua SJ yang terlihat akan otomatis mengikuti scope cabang atau wilayah akun yang login.'}
      actions={<SegmentedControl options={tabs} value={filter} onChange={setFilter} />}
    >
      {pendingAction && (
        <div className="mb-4 flex items-center gap-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="flex-1 text-sm text-amber-800">{pendingAction.label} - yakin?</span>
          <button
            onClick={confirmAction}
            className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Ya, lanjutkan
          </button>
          <button
            onClick={() => setPending(null)}
            className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
          >
            Batal
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyPanel title="Belum ada surat jalan" description="SJ akan muncul setelah diterbitkan dari halaman order." />
      ) : (
        <div className="space-y-3">
          {filtered.map((sj) => (
            <div key={sj.id} className="rounded-[22px] bg-slate-50/85 px-4 py-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">{sj.sj_number}</div>
                  <div className="text-xs text-slate-400">
                    {sj.branch?.name} · {sj.order?.order_number} · {sj.tanggal_kirim}
                  </div>
                  {sj.pengirim && <div className="text-xs text-slate-400">Pengirim: {sj.pengirim}</div>}
                  {sj.received_at && <div className="text-xs text-slate-400">Diterima: {new Date(sj.received_at).toLocaleString('id-ID')}</div>}
                  {sj.receive_note && <div className="mt-1 text-xs text-slate-500">Catatan terima: {sj.receive_note}</div>}
                </div>
                <ToneBadge tone={SJ_STATUS_TONE[sj.status] ?? 'slate'}>
                  {SJ_STATUS_LABEL[sj.status] ?? sj.status}
                </ToneBadge>
              </div>

              <div className="flex gap-2">
                {!isStoreOnly && (
                  <Link
                    to={`/sc/orders/${sj.order_id}`}
                    className="rounded-xl bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
                  >
                    Lihat Order
                  </Link>
                )}
                {sj.status === 'issued' && canShip && (
                  <button
                    onClick={() => setPending({ id: sj.id, status: 'shipped', label: `Tandai "${sj.sj_number}" sedang dalam perjalanan` })}
                    className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    Tandai Dikirim
                  </button>
                )}
                {(sj.status === 'shipped' || (isStoreOnly && sj.status === 'issued')) && canDeliver && (
                  <button
                    onClick={() => navigate(`/sc/sj?receive=${sj.id}`)}
                    className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Input Penerimaan
                  </button>
                )}
                {sj.status === 'delivered' && canDeliver && (
                  <button
                    onClick={() => navigate(`/sc/sj?receive=${sj.id}`)}
                    className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    {isStoreOnly ? 'Edit Penerimaan' : isWarehouseAdmin ? 'Lihat Penerimaan' : 'Review Penerimaan'}
                  </button>
                )}
                {sj.status === 'delivered' && isWarehouseAdmin && (
                  <button
                    onClick={() => handleDownloadPenerimaan(sj)}
                    disabled={downloadingId === sj.id}
                    className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {downloadingId === sj.id ? 'Mengunduh...' : 'Download CSV'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  )
}

export default function SuratJalanPage() {
  const [params] = useSearchParams()
  const { profile } = useAuth()
  const isStore = isStoreRole(profile?.role)
  const isManager = isManagerRole(profile?.role)
  const isNew = params.has('order') && canIssueSuratJalan(profile?.role)
  const receiveId = params.get('receive')
  const isReceive = !!receiveId && canMarkSuratJalanDelivered(profile?.role)

  const subtitle = isNew
    ? 'Buat SJ dari konfirmasi distribution'
    : isReceive
      ? 'Input jumlah barang yang benar-benar diterima toko'
      : isStore
        ? 'Status kiriman barang yang ditujukan ke toko kamu'
        : isManager
          ? `Daftar surat jalan otomatis mengikuti scope ${getScopeLabel(profile)}`
          : 'Kelola semua surat jalan pengiriman'

  const footer = isOpsLikeRole(profile?.role)
    ? <OpsBottomNav />
    : isManager
      ? <DMBottomNav />
      : isStore
        ? <StaffBottomNav />
        : <SCBottomNav />

  return (
    <SubpageShell
      title={isNew ? 'Terbitkan Surat Jalan' : isReceive ? 'Penerimaan Barang' : isStore ? 'Pengiriman Barang' : 'Surat Jalan'}
      subtitle={subtitle}
      eyebrow="Surat Jalan"
      footer={footer}
    >
      {isNew ? <NewSJForm /> : isReceive ? <ReceiveSJForm sjId={receiveId} /> : <SJList />}
    </SubpageShell>
  )
}
