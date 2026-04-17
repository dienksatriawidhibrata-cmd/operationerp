import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayWIB } from '../../lib/utils'
import {
  canIssueSuratJalan,
  canMarkSuratJalanDelivered,
  canMarkSuratJalanShipped,
  getScopeLabel,
  isManagerRole,
  isStoreRole,
} from '../../lib/access'
import PhotoUpload from '../../components/PhotoUpload'
import Alert from '../../components/Alert'
import { DMBottomNav, OpsBottomNav, SCBottomNav, StaffBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel, InlineStat, SectionPanel, SegmentedControl, SubpageShell, ToneBadge,
} from '../../components/ui/AppKit'

function genSJNumber() {
  const d   = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const rnd = Math.random().toString(36).substring(2,6).toUpperCase()
  return `SJ-${ymd}-${rnd}`
}

const SJ_STATUS_TONE = { draft:'slate', issued:'info', shipped:'warn', delivered:'ok' }
const SJ_STATUS_LABEL = { draft:'Draft', issued:'Diterbitkan', shipped:'Dalam Perjalanan', delivered:'Terkirim' }

// ── New SJ form ───────────────────────────────────────────

function NewSJForm() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [params]    = useSearchParams()
  const orderId     = params.get('order')
  const today       = todayWIB()

  const [order, setOrder]     = useState(null)
  const [items, setItems]     = useState([])     // distribution-confirmed quantities
  const [origItems, setOrig]  = useState([])     // supply_order_items for names

  const [tanggalKirim, setTgl] = useState(today)
  const [pengirim, setPengirim] = useState('')
  const [catatan, setCatatan]  = useState('')
  const [fotoSJ, setFotoSJ]    = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!orderId) { setLoading(false); return }

    ;(async () => {
      const [orderRes, origRes] = await Promise.all([
        supabase.from('supply_orders').select('*, branch:branches(id,name)').eq('id', orderId).single(),
        supabase.from('supply_order_items').select('*').eq('order_id', orderId),
      ])
      if (orderRes.error || !orderRes.data) { setError('Order tidak ditemukan.'); setLoading(false); return }
      if (orderRes.data.status !== 'sj_ready') {
        setError('Order ini belum siap untuk diterbitkan SJ (status: ' + orderRes.data.status + ').')
        setLoading(false)
        return
      }

      setOrder(orderRes.data)
      setOrig(origRes.data || [])

      // Get distribution confirmation items
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
        // fallback to order items
        setItems((origRes.data || []).map(i => ({ order_item_id: i.id, qty_confirmed: i.qty_ordered })))
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
        sj_number:     sjNumber,
        order_id:      order.id,
        branch_id:     order.branch_id,
        tanggal_kirim: tanggalKirim,
        pengirim:      pengirim || null,
        issued_by:     profile.id,
        issued_at:     new Date().toISOString(),
        status:        'issued',
        catatan:       catatan || null,
        foto_sj:       fotoSJ,
      })
      .select('id')
      .single()

    if (sjErr) { setError('Gagal terbitkan SJ: ' + sjErr.message); setSaving(false); return }

    // Insert SJ items from distribution confirmation
    const sjItems = items.map(ci => {
      const orig = origItems.find(o => o.id === ci.order_item_id)
      return {
        sj_id:         sj.id,
        order_item_id: ci.order_item_id,
        sku_code:      orig?.sku_code ?? '',
        sku_name:      orig?.sku_name ?? '',
        qty_kirim:     ci.qty_confirmed,
        unit:          orig?.unit ?? 'PCS',
      }
    })

    const { error: itemsErr } = await supabase.from('surat_jalan_items').insert(sjItems)
    if (itemsErr) {
      await supabase.from('surat_jalan').delete().eq('id', sj.id)
      setError('Gagal simpan item SJ: ' + itemsErr.message)
      setSaving(false)
      return
    }

    // Update order status
    await supabase.from('supply_orders').update({ status: 'shipped' }).eq('id', order.id)

    navigate('/sc/sj')
  }

  if (loading) return (
    <div className="flex justify-center py-24">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
    </div>
  )

  if (error && !order) return <Alert variant="error">{error}</Alert>

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      <SectionPanel eyebrow="Order" title={order?.order_number ?? ''} description={order?.branch?.name}>
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineStat label="Toko" value={order?.branch?.name} tone="primary" />
          <InlineStat label="Item" value={items.length} tone="slate" />
          <InlineStat label="Total Qty" value={items.reduce((s,i) => s + Number(i.qty_confirmed), 0).toLocaleString('id-ID')} tone="slate" />
        </div>
      </SectionPanel>

      <SectionPanel eyebrow="SJ Form" title="Isi Surat Jalan">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tanggal Kirim</label>
              <input className="input" type="date" value={tanggalKirim} onChange={e => setTgl(e.target.value)} />
            </div>
            <div>
              <label className="label">Nama Pengirim</label>
              <input className="input" type="text" value={pengirim} onChange={e => setPengirim(e.target.value)} placeholder="Nama kurir / supir" />
            </div>
          </div>
          <div>
            <label className="label">Catatan</label>
            <input className="input" type="text" value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan pengiriman (opsional)" />
          </div>
          <div>
            <label className="label">Foto SJ (opsional)</label>
            <PhotoUpload folder={`sj/${tanggalKirim}`} value={fotoSJ} onChange={setFotoSJ} label="Upload Foto SJ" max={3} />
          </div>
        </div>
      </SectionPanel>

      <SectionPanel eyebrow="Items" title="Daftar Barang" actions={<ToneBadge tone="info">{items.length} SKU</ToneBadge>}>
        <div className="space-y-2">
          {items.map(ci => {
            const orig = origItems.find(o => o.id === ci.order_item_id)
            return (
              <div key={ci.order_item_id} className="flex items-center gap-3 rounded-[18px] bg-slate-50/85 px-3 py-3">
                <div className="text-xs font-mono text-primary-600 shrink-0">{orig?.sku_code}</div>
                <div className="flex-1 text-sm font-medium text-slate-800">{orig?.sku_name}</div>
                <div className="text-sm font-semibold text-slate-900">{Number(ci.qty_confirmed).toLocaleString('id-ID')}</div>
                <div className="text-xs text-slate-400">{orig?.unit}</div>
              </div>
            )
          })}
        </div>
      </SectionPanel>

      <button onClick={handleIssue} disabled={saving || !order} className="btn-primary">
        {saving ? 'Menerbitkan...' : `Terbitkan Surat Jalan (${items.length} item)`}
      </button>
    </div>
  )
}

// ── SJ List ───────────────────────────────────────────────

function SJList() {
  const { profile }   = useAuth()
  const isStoreOnly   = isStoreRole(profile?.role)
  const canShip       = canMarkSuratJalanShipped(profile?.role)
  const canDeliver    = canMarkSuratJalanDelivered(profile?.role)
  const [list, setList]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState('all')
  const [pendingAction, setPending] = useState(null) // { id, status, label }

  useEffect(() => { fetchList() }, [])

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

  const confirmAction = async () => {
    if (!pendingAction) return
    const { id, status } = pendingAction
    const sj = list.find(s => s.id === id)
    setPending(null)
    await supabase.from('surat_jalan').update({ status }).eq('id', id)
    if (status === 'delivered' && sj) {
      await supabase.from('supply_orders').update({ status: 'completed' }).eq('id', sj.order_id)
    }
    fetchList()
  }

  const filtered = filter === 'all' ? list : list.filter(sj => sj.status === filter)

  const tabs = [
    { key: 'all', label: 'Semua' },
    { key: 'issued', label: 'Diterbitkan' },
    { key: 'shipped', label: 'Perjalanan' },
    { key: 'delivered', label: 'Terkirim' },
  ]

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>

  return (
    <SectionPanel
      eyebrow="Surat Jalan"
      title={isStoreOnly ? 'Pengiriman ke Toko' : 'Daftar Surat Jalan'}
      description={isStoreOnly ? 'Daftar pengiriman barang yang ditujukan ke toko kamu.' : 'Semua SJ yang terlihat akan otomatis mengikuti scope cabang atau wilayah akun yang login.'}
      actions={
        <SegmentedControl options={tabs} value={filter} onChange={setFilter} />
      }
    >
      {pendingAction && (
        <div className="mb-4 flex items-center gap-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="flex-1 text-sm text-amber-800">
            {pendingAction.label} — yakin?
          </span>
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
          {filtered.map(sj => (
            <div key={sj.id} className="rounded-[22px] bg-slate-50/85 px-4 py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">{sj.sj_number}</div>
                  <div className="text-xs text-slate-400">
                    {sj.branch?.name} · {sj.order?.order_number} · {sj.tanggal_kirim}
                  </div>
                  {sj.pengirim && <div className="text-xs text-slate-400">Pengirim: {sj.pengirim}</div>}
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
                {sj.status === 'shipped' && canDeliver && (
                  <button
                    onClick={() => setPending({ id: sj.id, status: 'delivered', label: `Tandai "${sj.sj_number}" sudah diterima toko` })}
                    className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Tandai Diterima
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

// ── Main export ───────────────────────────────────────────

export default function SuratJalanPage() {
  const [params]  = useSearchParams()
  const { profile } = useAuth()
  const isStore   = isStoreRole(profile?.role)
  const isManager = isManagerRole(profile?.role)
  const isNew     = params.has('order') && canIssueSuratJalan(profile?.role)
  const subtitle = isNew
    ? 'Buat SJ dari konfirmasi distribution'
    : isStore
      ? 'Status kiriman barang yang ditujukan ke toko kamu'
      : isManager
        ? `Daftar surat jalan otomatis mengikuti scope ${getScopeLabel(profile)}`
        : 'Kelola semua surat jalan pengiriman'
  const footer = profile?.role === 'ops_manager'
    ? <OpsBottomNav />
    : isManager
      ? <DMBottomNav />
      : isStore
        ? <StaffBottomNav />
        : <SCBottomNav />

  return (
    <SubpageShell
      title={isNew ? 'Terbitkan Surat Jalan' : isStore ? 'Pengiriman Barang' : 'Surat Jalan'}
      subtitle={subtitle}
      eyebrow="Surat Jalan"
      footer={footer}
    >
      {isNew ? <NewSJForm /> : <SJList />}
    </SubpageShell>
  )
}
