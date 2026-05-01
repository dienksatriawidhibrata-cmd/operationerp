import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { EXPENSE_CODES } from '../../lib/constants'
import { fmtRp, todayWIB } from '../../lib/utils'
import Alert from '../../components/Alert'
import PhotoUpload from '../../components/PhotoUpload'
import { useToast } from '../../contexts/ToastContext'
import { StaffBottomNav } from '../../components/BottomNav'
import {
  AppIcon,
  EmptyPanel,
  InlineStat,
  SectionPanel,
  SubpageShell,
  ToneBadge,
  LoadingButton,
} from '../../components/ui/AppKit'

export default function BebanOperasional() {
  const { profile } = useAuth()
  const { toastSuccess, toastError } = useToast()
  const today = todayWIB()
  const branchId = profile?.branch_id

  const [query, setQuery] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [selected, setSelected] = useState(null)

  const [tanggal, setTanggal] = useState(today)
  const [qty, setQty] = useState('')
  const [harga, setHarga] = useState('')
  const [detail, setDetail] = useState('')
  const [fotoBukti, setFotoBukti] = useState([])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')

  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!branchId) return
    fetchHistory()
  }, [branchId, tanggal])

  const fetchHistory = async () => {
    const { data, error: historyError } = await supabase
      .from('operational_expenses')
      .select('*')
      .eq('branch_id', branchId)
      .eq('tanggal', tanggal)
      .order('created_at', { ascending: false })

    if (historyError) {
      toastError(`Gagal memuat histori: ${historyError.message}`)
      setHistory([])
      return
    }

    setHistory(data || [])
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus input OPEX ini? Gunakan ini hanya untuk koreksi salah input.')) return

    setDeletingId(id)
    const { error: deleteError } = await supabase.from('operational_expenses').delete().eq('id', id)
    if (deleteError) {
      toastError(`Gagal menghapus: ${deleteError.message}`)
      setDeletingId('')
      return
    }

    toastSuccess('Input OPEX berhasil dihapus.')
    await fetchHistory()
    setDeletingId('')
  }

  const filtered = query.length > 0
    ? EXPENSE_CODES.filter((item) =>
      item.code.toLowerCase().includes(query.toLowerCase()) ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8)
    : []

  const categories = query.length === 0
    ? [...new Set(EXPENSE_CODES.map((item) => item.category))]
    : []

  const total = Number(qty) * Number(harga)
  const totalHariIni = history.reduce((sum, row) => sum + Number(row.total || 0), 0)

  const handleSubmit = async () => {
    if (!branchId) {
      setError('Akun ini tidak terhubung ke cabang manapun.')
      return
    }
    if (!selected) {
      setError('Pilih kode item terlebih dahulu.')
      return
    }
    if (!qty || !harga) {
      setError('Qty dan harga satuan wajib diisi.')
      return
    }
    if (fotoBukti.length === 0) {
      setError('Foto bukti wajib dilampirkan.')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      branch_id: branchId,
      tanggal,
      code: selected.code,
      category: selected.category,
      item_name: selected.name,
      detail: detail || null,
      qty: Number(qty),
      harga_satuan: Number(harga),
      foto_bukti: fotoBukti,
      submitted_by: profile.id,
    }

    const { error: submitErr } = await supabase.from('operational_expenses').insert(payload)
    if (submitErr) {
      toastError(`Gagal menyimpan: ${submitErr.message}`)
    } else {
      toastSuccess('Pengeluaran berhasil disimpan.')
      setSelected(null)
      setQuery('')
      setQty('')
      setHarga('')
      setDetail('')
      setFotoBukti([])
      await fetchHistory()
    }
    setSaving(false)
  }

  return (
    <SubpageShell
      title="Beban Operasional"
      subtitle="Input pengeluaran harian"
      eyebrow="Operational Expense"
      footer={<StaffBottomNav />}
    >
      <SectionPanel
        eyebrow="Daily Snapshot"
        title="Kontrol OPEX Hari Ini"
        description="Catat pengeluaran dengan kode item yang tepat supaya rekap harian langsung rapi."
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <InlineStat label="Tanggal" value={today} tone="primary" />
          <InlineStat label="Histori Hari Ini" value={history.length} tone={history.length > 0 ? 'emerald' : 'slate'} />
          <InlineStat label="Total Hari Ini" value={fmtRp(totalHariIni)} tone={totalHariIni > 0 ? 'amber' : 'slate'} />
          <InlineStat label="Draft Total" value={total > 0 ? fmtRp(total) : '-'} tone={total > 0 ? 'primary' : 'slate'} />
        </div>
      </SectionPanel>

      <div className="mt-6 space-y-6">
        {error && <Alert variant="error">{error}</Alert>}

        <SectionPanel
          eyebrow="Code Picker"
          title="Pilih Kode Item"
          description="Cari berdasarkan kode atau nama item, lalu pilih satu untuk dipakai di form."
          actions={selected && <ToneBadge tone="info">{selected.code}</ToneBadge>}
        >
          <div className="relative">
            <input
              className="input"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setShowDrop(true)
              }}
              onFocus={() => setShowDrop(true)}
              onBlur={() => setTimeout(() => setShowDrop(false), 150)}
              placeholder="Ketik kode atau nama item, contoh: es batu"
            />

            {showDrop && (filtered.length > 0 || categories.length > 0) && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-[22px] border border-primary-100 bg-white shadow-[0_24px_65px_-38px_rgba(37,99,235,0.35)]">
                {filtered.length > 0 && filtered.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    className="w-full border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-primary-50"
                    onPointerDown={(event) => {
                      event.preventDefault()
                      setSelected(item)
                      setQuery(`${item.code} - ${item.name}`)
                      setShowDrop(false)
                    }}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500">{item.code}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{item.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.category}</div>
                  </button>
                ))}
                {categories.length > 0 && (
                  <>
                    <div className="border-b border-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Pilih Kategori</div>
                    {categories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className="w-full border-b border-slate-50 px-4 py-2.5 text-left last:border-0 hover:bg-primary-50"
                        onPointerDown={(event) => {
                          event.preventDefault()
                          setQuery(category)
                          setShowDrop(true)
                        }}
                      >
                        <div className="text-sm font-medium text-slate-700">{category}</div>
                        <div className="text-xs text-slate-400">{EXPENSE_CODES.filter((item) => item.category === category).length} item</div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {selected && (
            <div className="mt-4 rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500">Item Dipilih</div>
              <div className="mt-2 text-base font-semibold text-primary-700">{selected.name}</div>
              <div className="mt-1 text-sm text-primary-600">{selected.code} · {selected.category}</div>
            </div>
          )}
        </SectionPanel>

        <SectionPanel
          eyebrow="Expense Form"
          title="Detail Pengeluaran"
          description="Isi tanggal, qty, harga, dan unggah nota supaya pengeluaran siap masuk rekap."
        >
          <div className="space-y-4">
            <div>
              <label className="label">Tanggal</label>
              <input className="input" type="date" value={tanggal} onChange={(event) => setTanggal(event.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Qty</label>
                <input className="input" type="number" step="any" value={qty} onChange={(event) => setQty(event.target.value)} onWheel={(event) => event.target.blur()} placeholder="0" />
              </div>
              <div>
                <label className="label">Harga Satuan (Rp)</label>
                <input className="input" type="number" value={harga} onChange={(event) => setHarga(event.target.value)} onWheel={(event) => event.target.blur()} placeholder="0" />
              </div>
            </div>

            {qty && harga && (
              <div className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500">Total Cash Out</div>
                <div className="mt-2 text-2xl font-semibold text-primary-700">{fmtRp(total)}</div>
              </div>
            )}

            <div>
              <label className="label">Detail / Keterangan</label>
              <input
                className="input"
                type="text"
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                placeholder="Contoh: Es cube periode 22-30 Apr (opsional)"
              />
            </div>

            <div>
              <label className="label">Foto Nota / Struk</label>
              <PhotoUpload
                folder={`opex/${tanggal}`}
                value={fotoBukti}
                onChange={setFotoBukti}
                label="Upload Foto Nota"
                max={3}
                capture={false}
              />
            </div>

            <LoadingButton onClick={handleSubmit} loading={saving} className="btn-primary">
              Simpan Pengeluaran
            </LoadingButton>
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Ledger"
          title={`Histori Pengeluaran ${tanggal}`}
          description="Rekap pengeluaran untuk tanggal yang dipilih. Ganti tanggal di form untuk melihat hari lain."
          actions={<ToneBadge tone={history.length > 0 ? 'info' : 'slate'}>{history.length} item</ToneBadge>}
        >
          {history.length === 0 ? (
            <EmptyPanel
              title="Belum ada pengeluaran"
              description="Belum ada item yang tercatat untuk tanggal ini."
            />
          ) : (
            <div className="space-y-3">
              {history.map((row) => (
                <div key={row.id} className="flex items-center gap-4 rounded-[22px] bg-slate-50/85 px-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-950">{row.code} - {row.item_name}</div>
                    <div className="mt-1 text-sm text-slate-500">{row.qty} x {fmtRp(row.harga_satuan)}</div>
                    {row.detail && <div className="mt-1 text-xs italic text-slate-400">{row.detail}</div>}
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-primary-700">{fmtRp(row.total)}</div>
                  <button
                    type="button"
                    disabled={deletingId === row.id}
                    onClick={() => handleDelete(row.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-400 transition-colors hover:bg-rose-100 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Hapus entri ini"
                  >
                    {deletingId === row.id ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-rose-300 border-t-rose-600" />
                    ) : (
                      <AppIcon name="warning" size={16} className="rotate-45" />
                    )}
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4">
                <span className="text-sm font-semibold text-slate-700">Total</span>
                <span className="text-lg font-semibold text-primary-700">{fmtRp(totalHariIni)}</span>
              </div>
            </div>
          )}
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}
