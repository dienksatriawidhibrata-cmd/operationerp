import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { EXPENSE_CODES } from '../../lib/constants'
import { fmtRp, todayWIB } from '../../lib/utils'
import Header from '../../components/Header'
import Alert from '../../components/Alert'
import PhotoUpload from '../../components/PhotoUpload'
import { StaffBottomNav } from '../../components/BottomNav'

export default function BebanOperasional() {
  const { profile } = useAuth()
  const today = todayWIB()
  const branchId = profile?.branch_id

  // Search & selected code
  const [query, setQuery]           = useState('')
  const [showDrop, setShowDrop]     = useState(false)
  const [selected, setSelected]     = useState(null)

  // Form
  const [tanggal, setTanggal]       = useState(today)
  const [qty, setQty]               = useState('')
  const [harga, setHarga]           = useState('')
  const [detail, setDetail]         = useState('')
  const [fotoBukti, setFotoBukti]   = useState([])
  const [saving, setSaving]         = useState(false)
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState('')

  // History today
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!branchId) return
    fetchHistory()
  }, [branchId, done])

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('operational_expenses')
      .select('*')
      .eq('branch_id', branchId)
      .eq('tanggal', today)
      .order('created_at', { ascending: false })
    setHistory(data || [])
  }

  const filtered = query.length > 0
    ? EXPENSE_CODES.filter(c =>
        c.code.toLowerCase().includes(query.toLowerCase()) ||
        c.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : []

  const total = Number(qty) * Number(harga)

  const handleSubmit = async () => {
    if (!selected) { setError('Pilih kode item terlebih dahulu.'); return }
    if (!qty || !harga) { setError('Qty dan harga satuan wajib diisi.'); return }
    if (fotoBukti.length === 0) { setError('Foto bukti wajib dilampirkan.'); return }
    setSaving(true); setError('')

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

    const { error: err } = await supabase.from('operational_expenses').insert(payload)
    if (err) { setError('Gagal: ' + err.message) } else {
      setDone(true)
      setSelected(null); setQuery('')
      setQty(''); setHarga(''); setDetail(''); setFotoBukti([])
      setTimeout(() => setDone(false), 3000)
    }
    setSaving(false)
  }

  const totalHariIni = history.reduce((s, r) => s + Number(r.total), 0)

  return (
    <div className="page-shell">
      <Header title="Beban Operasional" sub="Input pengeluaran harian" />

      <div className="flex-1 overflow-y-auto pb-28 px-4 pt-4 space-y-3">
        {done && <Alert variant="ok">Pengeluaran berhasil disimpan! ✓</Alert>}
        {error && <Alert variant="error">{error}</Alert>}

        {/* Code search */}
        <div className="card p-4">
          <h2 className="font-bold text-gray-900 mb-3">🔍 Pilih Kode Item</h2>
          <div className="relative">
            <input
              className="input"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowDrop(true) }}
              onFocus={() => setShowDrop(true)}
              placeholder="Ketik kode atau nama, contoh: es batu"
            />
            {showDrop && filtered.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-primary-200 rounded-xl shadow-lg z-20 overflow-hidden">
                {filtered.map(c => (
                  <button
                    key={c.code}
                    type="button"
                    className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-primary-50 transition-colors"
                    onClick={() => { setSelected(c); setQuery(`${c.code} — ${c.name}`); setShowDrop(false) }}
                  >
                    <div className="text-[10px] font-bold text-primary-600 tracking-wide">{c.code}</div>
                    <div className="text-sm font-medium text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-400">{c.category}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="mt-3 bg-primary-600 text-white rounded-xl p-3">
              <div className="text-[10px] opacity-60 tracking-wide mb-0.5">ITEM DIPILIH</div>
              <div className="font-bold">{selected.name}</div>
              <div className="text-xs opacity-70">{selected.code} · {selected.category}</div>
            </div>
          )}
        </div>

        {/* Form detail */}
        <div className="card p-4 space-y-3">
          <h2 className="font-bold text-gray-900">📝 Detail Pengeluaran</h2>

          <div>
            <label className="label">Tanggal</label>
            <input className="input" type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Qty</label>
              <input className="input" type="number" step="any" value={qty}
                onChange={e => setQty(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="label">Harga Satuan (Rp)</label>
              <input className="input" type="number" value={harga}
                onChange={e => setHarga(e.target.value)} placeholder="0" />
            </div>
          </div>

          {qty && harga && (
            <div className="flex justify-between items-center bg-primary-50 border border-primary-100 rounded-xl px-4 py-3">
              <span className="text-xs text-primary-600 font-medium">Total Cash Out</span>
              <span className="font-bold text-primary-700 text-lg">{fmtRp(total)}</span>
            </div>
          )}

          <div>
            <label className="label">Detail / Keterangan</label>
            <input className="input" type="text" value={detail}
              onChange={e => setDetail(e.target.value)} placeholder="Contoh: Es cube 22-30 Apr (opsional)" />
          </div>

          <div>
            <label className="label">Foto Nota / Struk <span className="text-red-500">*</span></label>
            <PhotoUpload
              folder={`opex/${tanggal}`}
              value={fotoBukti}
              onChange={setFotoBukti}
              label="Upload Foto Nota"
              max={3}
            />
          </div>

          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? 'Menyimpan...' : 'Simpan Pengeluaran'}
          </button>
        </div>

        {/* History hari ini */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="section-title !mt-0 !mb-0">Hari Ini — {today}</p>
            <span className="text-xs font-bold text-primary-700">{fmtRp(totalHariIni)}</span>
          </div>

          {history.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">Belum ada pengeluaran hari ini</p>
          ) : (
            <div className="card overflow-hidden">
              {history.map((row, i) => (
                <div key={row.id} className={`flex items-center gap-3 px-4 py-3 ${i < history.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{row.code} — {row.item_name}</div>
                    <div className="text-xs text-gray-400">{row.qty} × {fmtRp(row.harga_satuan)}</div>
                  </div>
                  <div className="text-sm font-bold text-primary-700 flex-shrink-0">{fmtRp(row.total)}</div>
                </div>
              ))}
              <div className="px-4 py-3 border-t border-primary-100 flex justify-between items-center bg-primary-50">
                <span className="text-sm font-semibold text-gray-700">Total</span>
                <span className="font-bold text-primary-700">{fmtRp(totalHariIni)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <StaffBottomNav />
    </div>
  )
}
