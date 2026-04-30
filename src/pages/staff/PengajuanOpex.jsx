import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { EXPENSE_CODES } from '../../lib/constants'
import { fmtRp, todayWIB } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { StaffBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel,
  InlineStat,
  SectionPanel,
  SubpageShell,
  ToneBadge,
  LoadingButton,
} from '../../components/ui/AppKit'

const EXPENSE_CATEGORIES = [...new Set(EXPENSE_CODES.map((c) => c.category))]

const emptyRow = () => ({ kebutuhan: '', kategori: '', jumlah: '', harga_satuan: '' })

const STATUS_MAP = {
  submitted:   { label: 'Menunggu DM',   tone: 'warn' },
  dm_approved: { label: 'Disetujui DM',  tone: 'info' },
  am_approved: { label: 'Final Approved', tone: 'ok'  },
  rejected:    { label: 'Ditolak',        tone: 'danger' },
}

export default function PengajuanOpex() {
  const { profile } = useAuth()
  const { toastSuccess, toastError } = useToast()
  const today = todayWIB()
  const branchId = profile?.branch_id
  const branchName = profile?.branch?.name || '-'

  const [tanggal, setTanggal] = useState(today)
  const [sisaSaldo, setSisaSaldo] = useState('')
  const [items, setItems] = useState([emptyRow()])
  const [keterangan, setKeterangan] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (!branchId) return
    fetchHistory()
  }, [branchId])

  const fetchHistory = async () => {
    setLoadingHistory(true)
    const { data } = await supabase
      .from('opex_requests')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(30)
    setHistory(data || [])
    setLoadingHistory(false)
  }

  const addRow = () => setItems((prev) => [...prev, emptyRow()])
  const removeRow = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i))
  const updateRow = (i, field, value) =>
    setItems((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))

  const rowTotal = (row) => Number(row.jumlah || 0) * Number(row.harga_satuan || 0)
  const totalPengajuan = items.reduce((sum, row) => sum + rowTotal(row), 0)

  const handleSubmit = async () => {
    if (!branchId) {
      setError('Akun tidak terhubung ke cabang manapun.')
      return
    }
    const validItems = items.filter((r) => r.kebutuhan && r.kategori && r.jumlah && r.harga_satuan)
    if (validItems.length === 0) {
      setError('Minimal satu item harus diisi lengkap (kebutuhan, kategori, jumlah, harga).')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      branch_id: branchId,
      tanggal_pengajuan: tanggal,
      sisa_saldo: sisaSaldo ? Number(sisaSaldo) : null,
      items: validItems.map((r) => ({
        kebutuhan: r.kebutuhan,
        kategori: r.kategori,
        jumlah: Number(r.jumlah),
        harga_satuan: Number(r.harga_satuan),
        total: rowTotal(r),
      })),
      total_pengajuan: validItems.reduce((sum, r) => sum + rowTotal(r), 0),
      keterangan: keterangan || null,
      submitted_by: profile.id,
    }

    const { error: err } = await supabase.from('opex_requests').insert(payload)
    if (err) {
      toastError('Gagal menyimpan: ' + err.message)
    } else {
      toastSuccess('Pengajuan berhasil dikirim.')
      setItems([emptyRow()])
      setKeterangan('')
      setSisaSaldo('')
      fetchHistory()
    }
    setSaving(false)
  }

  return (
    <SubpageShell
      title="Pengajuan Dana Operasional"
      subtitle="Ajukan kebutuhan dana toko ke DM"
      eyebrow="Opex Request"
      footer={<StaffBottomNav />}
    >
      <SectionPanel
        eyebrow="Snapshot"
        title="Ringkasan Form"
        description="Total kebutuhan dana berdasarkan item yang diinput."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineStat label="Cabang" value={branchName.replace('Bagi Kopi ', '')} tone="primary" />
          <InlineStat label="Jumlah Item" value={items.filter((r) => r.kebutuhan).length} tone="slate" />
          <InlineStat
            label="Total Pengajuan"
            value={totalPengajuan > 0 ? fmtRp(totalPengajuan) : '-'}
            tone={totalPengajuan > 0 ? 'amber' : 'slate'}
          />
        </div>
      </SectionPanel>

      <div className="mt-6 space-y-6">
        {error && (
          <div className="rounded-[22px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <SectionPanel eyebrow="Header" title="Info Pengajuan">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tanggal Pengajuan</label>
              <input
                className="input"
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Sisa Saldo (Rp) — opsional</label>
              <input
                className="input"
                type="number"
                value={sisaSaldo}
                onChange={(e) => setSisaSaldo(e.target.value)}
                onWheel={(e) => e.target.blur()}
                placeholder="0"
              />
            </div>
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Rincian"
          title="Daftar Kebutuhan"
          description="Isi setiap item dengan kebutuhan, kategori, jumlah, dan harga satuan."
          actions={
            <button
              type="button"
              onClick={addRow}
              className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-600 hover:bg-primary-100 transition-colors"
            >
              + Tambah Item
            </button>
          }
        >
          <div className="space-y-3">
            {items.map((row, i) => (
              <div
                key={i}
                className="space-y-3 rounded-[22px] border border-slate-100 bg-slate-50/70 px-4 py-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Item {i + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-400 hover:bg-rose-100 transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div>
                  <label className="label">Kebutuhan</label>
                  <input
                    className="input"
                    type="text"
                    value={row.kebutuhan}
                    onChange={(e) => updateRow(i, 'kebutuhan', e.target.value)}
                    placeholder="Contoh: Gaji OB, Iuran Sampah, Token Listrik…"
                  />
                </div>

                <div>
                  <label className="label">Kategori</label>
                  <select
                    className="input"
                    value={row.kategori}
                    onChange={(e) => updateRow(i, 'kategori', e.target.value)}
                  >
                    <option value="">Pilih kategori…</option>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Jumlah</label>
                    <input
                      className="input"
                      type="number"
                      step="any"
                      value={row.jumlah}
                      onChange={(e) => updateRow(i, 'jumlah', e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="label">Harga Satuan (Rp)</label>
                    <input
                      className="input"
                      type="number"
                      value={row.harga_satuan}
                      onChange={(e) => updateRow(i, 'harga_satuan', e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      placeholder="0"
                    />
                  </div>
                </div>

                {rowTotal(row) > 0 && (
                  <div className="text-sm font-semibold text-primary-700">
                    Subtotal: {fmtRp(rowTotal(row))}
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addRow}
              className="w-full rounded-[22px] border-2 border-dashed border-primary-200 bg-primary-50/50 py-3 text-sm font-semibold text-primary-600 hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              + Tambah Item
            </button>

            {totalPengajuan > 0 && (
              <div className="flex items-center justify-between rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4">
                <span className="text-sm font-semibold text-slate-700">Total Pengajuan</span>
                <span className="text-lg font-bold text-primary-700">{fmtRp(totalPengajuan)}</span>
              </div>
            )}
          </div>
        </SectionPanel>

        <SectionPanel eyebrow="Keterangan" title="Catatan Tambahan">
          <textarea
            className="input min-h-[96px] resize-y"
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="Jelaskan alasan atau kebutuhan mendesak untuk pengajuan dana ini…"
          />
        </SectionPanel>

        <LoadingButton onClick={handleSubmit} loading={saving} className="btn-primary w-full">
          Kirim Pengajuan
        </LoadingButton>

        <SectionPanel
          eyebrow="Riwayat"
          title="Pengajuan Sebelumnya"
          actions={
            <ToneBadge tone="slate">{history.length} pengajuan</ToneBadge>
          }
        >
          {loadingHistory ? (
            <p className="text-sm text-slate-400">Memuat…</p>
          ) : history.length === 0 ? (
            <EmptyPanel
              title="Belum ada pengajuan"
              description="Belum ada pengajuan dana yang dikirim dari toko ini."
            />
          ) : (
            <div className="space-y-3">
              {history.map((req) => {
                const st = STATUS_MAP[req.status] || { label: req.status, tone: 'slate' }
                const expanded = expandedId === req.id
                return (
                  <div key={req.id} className="rounded-[22px] bg-slate-50/85 px-4 py-4">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setExpandedId(expanded ? null : req.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">{req.tanggal_pengajuan}</span>
                        <ToneBadge tone={st.tone}>{st.label}</ToneBadge>
                      </div>
                      <div className="mt-1.5 text-lg font-bold text-slate-900">{fmtRp(req.total_pengajuan)}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {Array.isArray(req.items) ? req.items.length : 0} item
                        {req.sisa_saldo != null ? ` · Sisa saldo ${fmtRp(req.sisa_saldo)}` : ''}
                      </div>
                    </button>

                    {expanded && (
                      <div className="mt-3 space-y-2">
                        {Array.isArray(req.items) && req.items.map((item, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-3 rounded-2xl bg-white px-3 py-2.5 text-sm">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900">{item.kebutuhan}</div>
                              <div className="text-xs text-slate-400">{item.kategori}</div>
                              <div className="text-xs text-slate-500">{item.jumlah} × {fmtRp(item.harga_satuan)}</div>
                            </div>
                            <div className="shrink-0 font-semibold text-primary-700">{fmtRp(item.total)}</div>
                          </div>
                        ))}
                        {req.keterangan && (
                          <p className="px-1 text-xs italic text-slate-500">{req.keterangan}</p>
                        )}
                        {req.dm_note && (
                          <p className="px-1 text-xs text-slate-600">
                            <span className="font-semibold">Catatan DM:</span> {req.dm_note}
                          </p>
                        )}
                        {req.am_note && (
                          <p className="px-1 text-xs text-slate-600">
                            <span className="font-semibold">Catatan AM:</span> {req.am_note}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}
