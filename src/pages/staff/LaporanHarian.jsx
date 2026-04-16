import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtRp, yesterdayWIB, sisaWaktuLaporan } from '../../lib/utils'
import Header from '../../components/Header'
import Alert from '../../components/Alert'
import PhotoUpload from '../../components/PhotoUpload'
import PhotoViewer from '../../components/PhotoViewer'
import { StaffBottomNav } from '../../components/BottomNav'

export default function LaporanHarian() {
  const { profile } = useAuth()
  const yesterday = yesterdayWIB()
  const branchId  = profile?.branch_id

  // Laporan state
  const [laporan, setLaporan] = useState(null)
  const [netSales, setNetSales]         = useState('')
  const [jumlahStaff, setJumlahStaff]   = useState('')
  const [jumlahKunjungan, setJumlahKunjungan] = useState('')
  const [catatan, setCatatan]           = useState('')
  const [savingLaporan, setSavingLaporan] = useState(false)
  const [doneLaporan, setDoneLaporan]   = useState(false)

  // Setoran state
  const [setoran, setSetoran]   = useState(null)
  const [cashPos, setCashPos]           = useState('')
  const [cashSetor, setCashSetor]       = useState('')
  const [alasan, setAlasan]             = useState('')
  const [fotoBukti, setFotoBukti]       = useState([])
  const [savingSetoran, setSavingSetoran] = useState(false)
  const [doneSetoran, setDoneSetoran]   = useState(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!branchId) { setLoading(false); return }
    fetchData()
  }, [branchId])

  const fetchData = async () => {
    const [lapRes, setRes] = await Promise.all([
      supabase.from('daily_reports').select('*').eq('branch_id', branchId).eq('tanggal', yesterday).maybeSingle(),
      supabase.from('daily_deposits').select('*').eq('branch_id', branchId).eq('tanggal', yesterday).maybeSingle(),
    ])

    if (lapRes.error) {
      setError('Gagal memuat data laporan: ' + lapRes.error.message)
      setLoading(false)
      return
    }
    if (setRes.error) {
      setError('Gagal memuat data setoran: ' + setRes.error.message)
      setLoading(false)
      return
    }

    if (lapRes.data) {
      setLaporan(lapRes.data)
      setNetSales(lapRes.data.net_sales)
      setJumlahStaff(lapRes.data.jumlah_staff)
      setJumlahKunjungan(lapRes.data.jumlah_kunjungan)
      setCatatan(lapRes.data.notes || '')
    }
    if (setRes.data) {
      setSetoran(setRes.data)
      setCashPos(setRes.data.cash_pos)
      setCashSetor(setRes.data.cash_disetorkan)
      setAlasan(setRes.data.alasan_selisih || '')
      setFotoBukti(setRes.data.foto_bukti || [])
    }
    setLoading(false)
  }

  const avgSpend = jumlahKunjungan > 0 ? Math.round(Number(netSales) / Number(jumlahKunjungan)) : 0
  const selisih  = Number(cashPos) - Number(cashSetor)

  const submitLaporan = async () => {
    setSavingLaporan(true); setError('')
    const payload = {
      branch_id: branchId,
      tanggal: yesterday,
      net_sales: Number(netSales) || 0,
      jumlah_staff: Number(jumlahStaff) || 0,
      jumlah_kunjungan: Number(jumlahKunjungan) || 0,
      submitted_by: profile.id,
      notes: catatan,
    }
    const { error: err } = laporan
      ? await supabase.from('daily_reports').update(payload).eq('id', laporan.id)
      : await supabase.from('daily_reports').insert(payload)
    if (err) { setError('Gagal: ' + err.message) } else { setDoneLaporan(true); fetchData() }
    setSavingLaporan(false)
  }

  const submitSetoran = async () => {
    if (!cashPos || !cashSetor) { setError('Isi nominal POS dan setoran.'); return }
    if (selisih !== 0 && !alasan) { setError('Alasan selisih wajib diisi.'); return }
    if (fotoBukti.length === 0) { setError('Foto bukti setoran wajib dilampirkan.'); return }
    setSavingSetoran(true); setError('')
    const payload = {
      branch_id: branchId,
      tanggal: yesterday,
      cash_pos: Number(cashPos),
      cash_disetorkan: Number(cashSetor),
      alasan_selisih: alasan || null,
      foto_bukti: fotoBukti,
      status: 'submitted',
      submitted_by: profile.id,
      submitted_at: new Date().toISOString(),
      // Clear stale approval/rejection fields on re-submit
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
    }
    const { error: err } = setoran
      ? await supabase.from('daily_deposits').update(payload).eq('id', setoran.id)
      : await supabase.from('daily_deposits').insert(payload)
    if (err) { setError('Gagal: ' + err.message) } else { setDoneSetoran(true); fetchData() }
    setSavingSetoran(false)
  }

  const laporanDone   = !!laporan
  const setoranDone   = !!setoran
  const setoranApproved = setoran?.status === 'approved'

  if (loading) return (
    <div className="page-shell items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="page-shell">
      <Header
        title="Laporan Harian"
        sub={`${new Date(yesterday).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}`}
      />

      <div className="flex-1 overflow-y-auto pb-28 px-4 pt-4 space-y-3">
        {!laporanDone && (
          <Alert variant="warn">
            Laporan belum disubmit. Deadline: <strong>hari ini jam 14.00 WIB</strong>.
            Sisa: <strong>{sisaWaktuLaporan(yesterday)}</strong>
          </Alert>
        )}
        {doneLaporan && <Alert variant="ok">Laporan berhasil disimpan! ✓</Alert>}
        {doneSetoran && <Alert variant="ok">Setoran berhasil disubmit! Menunggu approval DM.</Alert>}
        {error && <Alert variant="error">{error}</Alert>}

        {/* ── LAPORAN HARIAN ── */}
        <div className="card p-4 space-y-3">
          <h2 className="font-bold text-gray-900">📊 Laporan Harian</h2>

          <div>
            <label className="label">Net Sales (Rp)</label>
            <input className="input" type="number" value={netSales}
              onChange={e => setNetSales(e.target.value)} placeholder="0"
              disabled={laporanDone} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Jumlah Kunjungan</label>
              <input className="input" type="number" value={jumlahKunjungan}
                onChange={e => setJumlahKunjungan(e.target.value)} placeholder="0"
                disabled={laporanDone} />
            </div>
            <div>
              <label className="label">Staff Hadir</label>
              <input className="input" type="number" value={jumlahStaff}
                onChange={e => setJumlahStaff(e.target.value)} placeholder="0"
                disabled={laporanDone} />
            </div>
          </div>

          {/* Avg spend computed */}
          {(netSales > 0 && jumlahKunjungan > 0) && (
            <div className="flex justify-between items-center bg-primary-50 rounded-xl px-4 py-3">
              <span className="text-xs text-primary-600 font-medium">Avg Spend / Kunjungan</span>
              <span className="font-bold text-primary-700">{fmtRp(avgSpend)}</span>
            </div>
          )}

          <div>
            <label className="label">Catatan</label>
            <textarea className="input resize-none" rows={2} value={catatan}
              onChange={e => setCatatan(e.target.value)} disabled={laporanDone}
              placeholder="Promo, event, insiden hari ini..." />
          </div>

          {!laporanDone && (
            <button onClick={submitLaporan} disabled={savingLaporan} className="btn-primary">
              {savingLaporan ? 'Menyimpan...' : 'Submit Laporan Harian'}
            </button>
          )}
          {laporanDone && <p className="text-center text-xs text-green-600 font-semibold">✓ Laporan sudah disubmit</p>}
        </div>

        {/* ── SETORAN CASH ── */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">💰 Setoran Cash</h2>
            {setoran && (
              <StatusPill status={setoran.status} />
            )}
          </div>

          <div>
            <label className="label">Cash POS / Mesin Kasir (Rp)</label>
            <input className="input" type="number" value={cashPos}
              onChange={e => setCashPos(e.target.value)} placeholder="0"
              disabled={setoranDone && setoran?.status !== 'rejected'} />
          </div>

          <div>
            <label className="label">Cash Disetorkan (Rp)</label>
            <input className="input" type="number" value={cashSetor}
              onChange={e => setCashSetor(e.target.value)} placeholder="0"
              disabled={setoranDone && setoran?.status !== 'rejected'} />
          </div>

          {/* Selisih indicator */}
          {cashPos && cashSetor && (
            <div className={`rounded-xl px-4 py-3 ${
              selisih === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className={`text-xs font-semibold ${selisih === 0 ? 'text-green-600' : 'text-red-600'}`}>
                {selisih === 0 ? '✓ Pas — Tidak ada selisih' : '⚠ Selisih'}
              </div>
              {selisih !== 0 && (
                <div className="text-lg font-bold text-red-700 mt-0.5">{fmtRp(Math.abs(selisih))}</div>
              )}
            </div>
          )}

          {/* Alasan selisih */}
          {selisih !== 0 && (!setoranDone || setoran?.status === 'rejected') && (
            <div>
              <label className="label">Alasan Selisih <span className="text-red-500">*</span></label>
              <input className="input" type="text" value={alasan}
                onChange={e => setAlasan(e.target.value)} placeholder="Jelaskan alasan selisih..." />
            </div>
          )}
          {setoranDone && setoran?.alasan_selisih && (
            <div className="text-sm text-gray-600">
              <span className="text-xs font-bold text-gray-400 block mb-1">Alasan Selisih</span>
              {setoran.alasan_selisih}
            </div>
          )}

          {/* Foto bukti */}
          <div>
            <label className="label">Foto Bukti Setoran <span className="text-red-500">*</span></label>
            {setoranDone && setoran?.status !== 'rejected' ? (
              <PhotoViewer urls={fotoBukti} emptyText="Tidak ada foto" />
            ) : (
              <PhotoUpload
                folder={`setoran/${yesterday}`}
                value={fotoBukti}
                onChange={setFotoBukti}
                label="Upload Foto Slip / Struk Setoran"
                max={5}
              />
            )}
          </div>

          {setoran?.status === 'rejected' && setoran?.rejection_reason && (
            <Alert variant="error">
              Setoran direject: <strong>{setoran.rejection_reason}</strong>. Silakan submit ulang.
            </Alert>
          )}

          {!setoranDone || setoran?.status === 'rejected' ? (
            <button onClick={submitSetoran} disabled={savingSetoran} className="btn-primary bg-primary-700">
              {savingSetoran ? 'Menyimpan...' : 'Submit Setoran → Approval DM'}
            </button>
          ) : (
            <p className="text-center text-xs font-semibold" style={{
              color: setoran.status === 'approved' ? '#16a34a' : '#92400e'
            }}>
              {setoran.status === 'approved' ? '✓ Setoran diapprove DM' : '⏳ Menunggu approval DM'}
            </p>
          )}
        </div>
      </div>

      <StaffBottomNav />
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    draft:     { label: 'Draft',    cls: 'bg-gray-100 text-gray-500' },
    submitted: { label: 'Pending',  cls: 'bg-yellow-100 text-yellow-700' },
    approved:  { label: 'Approved', cls: 'bg-green-100 text-green-700' },
    rejected:  { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  }
  const v = map[status] || map.draft
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${v.cls}`}>{v.label}</span>
  )
}
