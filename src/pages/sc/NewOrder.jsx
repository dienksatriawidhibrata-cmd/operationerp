import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { parseOrderFile } from '../../lib/excelParser'
import { todayWIB } from '../../lib/utils'
import Alert from '../../components/Alert'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel, InlineStat, SectionPanel, SubpageShell, ToneBadge,
} from '../../components/ui/AppKit'

function genOrderNumber() {
  const d   = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const rnd = Math.random().toString(36).substring(2,6).toUpperCase()
  return `SO-${ymd}-${rnd}`
}

export default function NewOrder() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const today       = todayWIB()
  const fileRef     = useRef(null)

  const [branches, setBranches]     = useState([])
  const [branchId, setBranchId]     = useState('')
  const [tanggalPO, setTanggalPO]   = useState(today)
  const [catatan, setCatatan]       = useState('')
  const [externalRef, setExternalRef] = useState('')

  const [parsing, setParsing]     = useState(false)
  const [parsed, setParsed]       = useState(null)   // { items, warnings, meta }
  const [items, setItems]         = useState([])     // editable item rows
  const [fileLabel, setFileLabel] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    supabase.from('branches').select('id,name,store_id').eq('is_active', true).order('name')
      .then(({ data }) => setBranches(data || []))
  }, [])

  // ── File upload & parse ─────────────────────────────────
  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileLabel(file.name)
    setParsing(true)
    setError('')
    try {
      const result = await parseOrderFile(file)
      setParsed(result)
      setItems(result.items.map((item, i) => ({ ...item, _id: i })))
      if (result.meta?.externalOrderRef) setExternalRef(result.meta.externalOrderRef)
    } catch (err) {
      setError('Gagal membaca file: ' + err.message)
    } finally {
      setParsing(false)
    }
  }

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  const addItem = () => setItems(prev => [...prev, {
    _id: Date.now(), sku_code: '', sku_name: '', qty_ordered: '', unit: 'PCS', unit_price: null,
  }])

  // ── Submit ──────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!branchId) { setError('Pilih toko tujuan.'); return }
    const validItems = items.filter(item => item.sku_name && Number(item.qty_ordered) > 0)
    if (validItems.length === 0) { setError('Minimal satu item dengan qty valid.'); return }

    setSaving(true)
    setError('')

    const orderNumber = genOrderNumber()

    const { data: order, error: orderErr } = await supabase
      .from('supply_orders')
      .insert({
        order_number: orderNumber,
        branch_id:    branchId,
        tanggal_po:   tanggalPO,
        status:       'picking',
        catatan:      [catatan, externalRef ? `Ref: ${externalRef}` : ''].filter(Boolean).join(' | ') || null,
        created_by:   profile.id,
      })
      .select('id')
      .single()

    if (orderErr) { setError('Gagal buat order: ' + orderErr.message); setSaving(false); return }

    const rows = validItems.map(item => ({
      order_id:    order.id,
      sku_code:    item.sku_code,
      sku_name:    item.sku_name,
      qty_ordered: Number(item.qty_ordered),
      unit:        item.unit || 'PCS',
      unit_price:  item.unit_price ? Number(item.unit_price) : null,
    }))

    const { error: itemsErr } = await supabase.from('supply_order_items').insert(rows)
    if (itemsErr) {
      await supabase.from('supply_orders').delete().eq('id', order.id)
      setError('Gagal simpan items: ' + itemsErr.message)
      setSaving(false)
      return
    }

    // Auto-create pending confirmation records for all 3 stages
    await supabase.from('supply_confirmations').insert([
      { order_id: order.id, stage: 'picking',      status: 'pending' },
      { order_id: order.id, stage: 'qc',           status: 'pending' },
      { order_id: order.id, stage: 'distribution', status: 'pending' },
    ])

    navigate(`/sc/orders/${order.id}`)
  }

  return (
    <SubpageShell
      title="Buat Order Baru"
      subtitle="Upload file Excel / CSV dari sistem PO"
      eyebrow="New Supply Order"
      footer={<SmartBottomNav />}
    >
      <SectionPanel
        eyebrow="Order Info"
        title="Detail Pesanan"
        description="Pilih toko tujuan dan tanggal PO sebelum upload file."
      >
        <div className="space-y-4">
          <div>
            <label className="label">Toko Tujuan</label>
            <select className="input" value={branchId} onChange={e => setBranchId(e.target.value)}>
              <option value="">-- Pilih toko --</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tanggal PO</label>
              <input className="input" type="date" value={tanggalPO} onChange={e => setTanggalPO(e.target.value)} />
            </div>
            <div>
              <label className="label">Ref Eksternal (opsional)</label>
              <input className="input" type="text" value={externalRef}
                onChange={e => setExternalRef(e.target.value)}
                placeholder="No. PO dari sistem lain, e.g. PO34251" />
            </div>
          </div>
          <div>
            <label className="label">Catatan (opsional)</label>
            <input className="input" type="text" value={catatan}
              onChange={e => setCatatan(e.target.value)}
              placeholder="Catatan tambahan untuk order ini" />
          </div>
        </div>
      </SectionPanel>

      <div className="mt-6 space-y-6">
        {error && <Alert variant="error">{error}</Alert>}

        {/* File Upload */}
        <SectionPanel
          eyebrow="File Upload"
          title="Upload File PO"
          description="Upload file Excel (.xlsx, .xls) atau CSV dari sistem. Sistem akan otomatis membaca SKU, nama, qty, dan satuan."
        >
          <div
            className="rounded-[22px] border-2 border-dashed border-primary-200 bg-primary-50/40 px-6 py-8 text-center cursor-pointer hover:bg-primary-50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <div className="text-3xl mb-3">📂</div>
            {parsing ? (
              <div className="text-sm text-primary-600 font-semibold">Membaca file...</div>
            ) : fileLabel ? (
              <>
                <div className="text-sm font-semibold text-primary-700">{fileLabel}</div>
                <div className="mt-1 text-xs text-primary-400">Klik untuk ganti file</div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-slate-600">Klik atau seret file ke sini</div>
                <div className="mt-1 text-xs text-slate-400">.xlsx · .xls · .csv</div>
              </>
            )}
          </div>

          {parsed?.warnings?.length > 0 && (
            <div className="mt-4 space-y-1">
              {parsed.warnings.map((w, i) => (
                <div key={i} className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">⚠️ {w}</div>
              ))}
            </div>
          )}
        </SectionPanel>

        {/* Item Review Table */}
        {items.length > 0 && (
          <SectionPanel
            eyebrow="Item Review"
            title="Review & Edit Item"
            description="Cek hasil parsing. Kamu bisa edit langsung di tabel sebelum menyimpan."
            actions={
              <ToneBadge tone="info">{items.length} item</ToneBadge>
            }
          >
            <div className="grid gap-3 sm:grid-cols-3 mb-4">
              <InlineStat label="Total Item" value={items.length} tone="primary" />
              <InlineStat
                label="Total Qty"
                value={items.reduce((s, i) => s + (Number(i.qty_ordered) || 0), 0).toLocaleString('id-ID')}
                tone="slate"
              />
              <InlineStat
                label="Warnings"
                value={parsed?.warnings?.length ?? 0}
                tone={parsed?.warnings?.length > 0 ? 'warn' : 'emerald'}
              />
            </div>

            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1.4fr_2fr_1fr_0.7fr_0.6fr_auto] gap-2 px-2 mb-2">
              {['SKU Code','Nama Item','Qty','Satuan','Harga Satuan',''].map(h => (
                <div key={h} className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</div>
              ))}
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item._id} className="grid grid-cols-1 sm:grid-cols-[1.4fr_2fr_1fr_0.7fr_0.6fr_auto] gap-2 rounded-[18px] bg-slate-50 px-3 py-3 items-center">
                  <input
                    className="input text-xs py-2"
                    value={item.sku_code}
                    onChange={e => updateItem(idx, 'sku_code', e.target.value)}
                    placeholder="SKU"
                  />
                  <input
                    className="input text-xs py-2"
                    value={item.sku_name}
                    onChange={e => updateItem(idx, 'sku_name', e.target.value)}
                    placeholder="Nama item"
                  />
                  <input
                    className="input text-xs py-2"
                    type="number"
                    value={item.qty_ordered}
                    onChange={e => updateItem(idx, 'qty_ordered', e.target.value)}
                    placeholder="0"
                  />
                  <input
                    className="input text-xs py-2"
                    value={item.unit}
                    onChange={e => updateItem(idx, 'unit', e.target.value.toUpperCase())}
                    placeholder="PCS"
                  />
                  <input
                    className="input text-xs py-2"
                    type="number"
                    value={item.unit_price ?? ''}
                    onChange={e => updateItem(idx, 'unit_price', e.target.value || null)}
                    placeholder="-"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 text-sm"
                  >✕</button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addItem}
              className="mt-3 w-full rounded-[18px] border-2 border-dashed border-slate-200 py-3 text-sm text-slate-400 hover:border-primary-300 hover:text-primary-500 transition-colors"
            >
              + Tambah item manual
            </button>
          </SectionPanel>
        )}

        {items.length === 0 && !parsing && (
          <EmptyPanel
            title="Belum ada item"
            description="Upload file Excel/CSV untuk memuat daftar item, atau tambah manual setelah upload."
          />
        )}

        {items.length > 0 && (
          <button
            onClick={handleSubmit}
            disabled={saving || !branchId}
            className="btn-primary"
          >
            {saving ? 'Menyimpan...' : `Buat Order & Kirim ke Picking (${items.length} item)`}
          </button>
        )}
      </div>
    </SubpageShell>
  )
}
