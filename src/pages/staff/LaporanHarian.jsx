import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtRp, sisaWaktuLaporan, yesterdayWIB } from '../../lib/utils'
import Alert from '../../components/Alert'
import PhotoUpload from '../../components/PhotoUpload'
import PhotoViewer from '../../components/PhotoViewer'
import { StaffBottomNav } from '../../components/BottomNav'
import {
  InlineStat,
  SectionPanel,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'

export default function LaporanHarian() {
  const { profile } = useAuth()
  const yesterday = yesterdayWIB()
  const branchId = profile?.branch_id

  const [laporan, setLaporan] = useState(null)
  const [netSales, setNetSales] = useState('')
  const [jumlahStaff, setJumlahStaff] = useState('')
  const [jumlahKunjungan, setJumlahKunjungan] = useState('')
  const [catatan, setCatatan] = useState('')
  const [savingLaporan, setSavingLaporan] = useState(false)
  const [doneLaporan, setDoneLaporan] = useState(false)
  const [isEditingLaporan, setIsEditingLaporan] = useState(false)

  const [setoran, setSetoran] = useState(null)
  const [cashPos, setCashPos] = useState('')
  const [cashSetor, setCashSetor] = useState('')
  const [alasan, setAlasan] = useState('')
  const [fotoBukti, setFotoBukti] = useState([])
  const [savingSetoran, setSavingSetoran] = useState(false)
  const [doneSetoran, setDoneSetoran] = useState(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!branchId) {
      setLoading(false)
      return
    }
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
  const selisih = Number(cashPos || 0) - Number(cashSetor || 0)

  const submitLaporan = async () => {
    if (netSales === '' || netSales === null || netSales === undefined) {
      setError('Net sales wajib diisi.')
      return
    }
    setSavingLaporan(true)
    setError('')
    const payload = {
      branch_id: branchId,
      tanggal: yesterday,
      net_sales: Number(netSales) || 0,
      jumlah_staff: Number(jumlahStaff) || 0,
      jumlah_kunjungan: Number(jumlahKunjungan) || 0,
      submitted_by: profile.id,
      notes: catatan,
    }

    const { error: submitErr } = laporan
      ? await supabase.from('daily_reports').update(payload).eq('id', laporan.id)
      : await supabase.from('daily_reports').insert(payload)

    if (submitErr) {
      setError('Gagal: ' + submitErr.message)
    } else {
      setDoneLaporan(true)
      setIsEditingLaporan(false)
      fetchData()
    }
    setSavingLaporan(false)
  }

  const submitSetoran = async () => {
    if (!cashPos || !cashSetor) {
      setError('Isi nominal POS dan setoran.')
      return
    }
    if (selisih !== 0 && !alasan) {
      setError('Alasan selisih wajib diisi.')
      return
    }
    if (fotoBukti.length === 0) {
      setError('Foto bukti setoran wajib dilampirkan.')
      return
    }

    setSavingSetoran(true)
    setError('')

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
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
    }

    const { error: submitErr } = setoran
      ? await supabase.from('daily_deposits').update(payload).eq('id', setoran.id)
      : await supabase.from('daily_deposits').insert(payload)

    if (submitErr) {
      setError('Gagal: ' + submitErr.message)
    } else {
      setDoneSetoran(true)
      fetchData()
    }
    setSavingSetoran(false)
  }

  const laporanDone = !!laporan && !isEditingLaporan
  const setoranEditable = !setoran || setoran.status === 'rejected'
  const reportDateLabel = new Date(yesterday).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  if (loading) {
    return (
      <SubpageShell
        title="Laporan Harian"
        subtitle={reportDateLabel}
        eyebrow="Daily Reporting"
        footer={<StaffBottomNav />}
      >
        <div className="flex justify-center py-24">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      </SubpageShell>
    )
  }

  return (
    <SubpageShell
      title="Laporan Harian"
      subtitle={reportDateLabel}
      eyebrow="Daily Reporting"
      footer={<StaffBottomNav />}
    >
      <SectionPanel
        eyebrow="Ringkasan"
        title="Status Laporan & Setoran"
        description="Pantau dua alur penting ini sekaligus supaya tidak ada yang tertinggal sebelum deadline."
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <InlineStat label="Laporan" value={laporanDone ? 'Done' : 'Open'} tone={laporanDone ? 'emerald' : 'amber'} />
          <InlineStat
            label="Setoran"
            value={setoran?.status === 'approved' ? 'Approved' : setoran?.status === 'submitted' ? 'Pending' : setoran?.status === 'rejected' ? 'Rejected' : 'Draft'}
            tone={setoran?.status === 'approved' ? 'emerald' : setoran?.status === 'submitted' ? 'amber' : setoran?.status === 'rejected' ? 'rose' : 'slate'}
          />
          <InlineStat label="Avg Spend" value={avgSpend > 0 ? fmtRp(avgSpend) : '-'} tone={avgSpend > 0 ? 'primary' : 'slate'} />
          <InlineStat label="Selisih Setoran" value={cashPos && cashSetor ? fmtRp(Math.abs(selisih)) : '-'} tone={selisih === 0 ? 'emerald' : selisih ? 'rose' : 'slate'} />
        </div>
      </SectionPanel>

      <div className="mt-6 space-y-6">
        {!laporanDone && (
          <Alert variant="warn">
            Laporan belum disubmit. Deadline hari ini jam <strong>14.00 WIB</strong>. Sisa: <strong>{sisaWaktuLaporan(yesterday)}</strong>
          </Alert>
        )}
        {doneLaporan && <Alert variant="ok">Laporan berhasil disimpan.</Alert>}
        {doneSetoran && <Alert variant="ok">Setoran berhasil disubmit dan menunggu approval DM.</Alert>}
        {error && <Alert variant="error">{error}</Alert>}

        <SectionPanel
          eyebrow="Daily Report"
          title="Form Laporan Harian"
          description={`Laporan ini untuk operasional tanggal ${reportDateLabel} (kemarin). Deadline hari ini jam 14.00 WIB.`}
          actions={
            <div className="flex items-center gap-2">
              {laporan && !isEditingLaporan && (
                <button
                  onClick={() => setIsEditingLaporan(true)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Edit
                </button>
              )}
              <ToneBadge tone={laporan ? (isEditingLaporan ? 'warn' : 'ok') : 'warn'}>
                {laporan ? (isEditingLaporan ? 'Mode edit' : 'Sudah submit') : `Sisa ${sisaWaktuLaporan(yesterday)}`}
              </ToneBadge>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="label">Net Sales (Rp)</label>
              <input
                className="input"
                type="number"
                value={netSales}
                onChange={(event) => setNetSales(event.target.value)}
                placeholder="0"
                disabled={laporanDone}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Jumlah Kunjungan</label>
                <input
                  className="input"
                  type="number"
                  value={jumlahKunjungan}
                  onChange={(event) => setJumlahKunjungan(event.target.value)}
                  placeholder="0"
                  disabled={laporanDone}
                />
              </div>
              <div>
                <label className="label">Staff Hadir</label>
                <input
                  className="input"
                  type="number"
                  value={jumlahStaff}
                  onChange={(event) => setJumlahStaff(event.target.value)}
                  placeholder="0"
                  disabled={laporanDone}
                />
              </div>
            </div>

            {netSales > 0 && jumlahKunjungan > 0 && (
              <div className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500">Avg Spend</div>
                <div className="mt-2 text-2xl font-semibold text-primary-700">{fmtRp(avgSpend)}</div>
              </div>
            )}

            <div>
              <label className="label">Catatan</label>
              <textarea
                className="input resize-none"
                rows={3}
                value={catatan}
                onChange={(event) => setCatatan(event.target.value)}
                disabled={laporanDone}
                placeholder="Promo, event, insiden, atau hal penting lainnya..."
              />
            </div>

            {(!laporan || isEditingLaporan) && (
              <div className="flex gap-3">
                {isEditingLaporan && (
                  <button
                    type="button"
                    onClick={() => { setIsEditingLaporan(false); fetchData() }}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"
                  >
                    Batal
                  </button>
                )}
                <button onClick={submitLaporan} disabled={savingLaporan} className="btn-primary flex-1">
                  {savingLaporan ? 'Menyimpan...' : isEditingLaporan ? 'Simpan Perubahan' : 'Submit Laporan Harian'}
                </button>
              </div>
            )}
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Cash Deposit"
          title="Form Setoran Cash"
          description="Pastikan nominal, alasan selisih, dan bukti setoran lengkap sebelum dikirim."
          actions={setoran && <StatusPill status={setoran.status} />}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Cash POS / Mesin Kasir (Rp)</label>
              <input
                className="input"
                type="number"
                value={cashPos}
                onChange={(event) => setCashPos(event.target.value)}
                placeholder="0"
                disabled={!setoranEditable}
              />
            </div>

            <div>
              <label className="label">Cash Disetorkan (Rp)</label>
              <input
                className="input"
                type="number"
                value={cashSetor}
                onChange={(event) => setCashSetor(event.target.value)}
                placeholder="0"
                disabled={!setoranEditable}
              />
            </div>

            {cashPos && cashSetor && (
              <div
                className={`rounded-[22px] px-4 py-4 ${
                  selisih === 0 ? 'border border-emerald-200 bg-emerald-50' : 'border border-rose-200 bg-rose-50'
                }`}
              >
                <div
                  className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                    selisih === 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {selisih === 0 ? 'Tidak ada selisih' : 'Selisih cash'}
                </div>
                <div
                  className={`mt-2 text-2xl font-semibold ${
                    selisih === 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {selisih === 0 ? 'Pas' : fmtRp(Math.abs(selisih))}
                </div>
              </div>
            )}

            {selisih !== 0 && setoranEditable && (
              <div>
                <label className="label">Alasan Selisih</label>
                <input
                  className="input"
                  type="text"
                  value={alasan}
                  onChange={(event) => setAlasan(event.target.value)}
                  placeholder="Jelaskan alasan selisih..."
                />
              </div>
            )}

            {setoran?.alasan_selisih && !setoranEditable && (
              <div className="rounded-[22px] bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Alasan Selisih</div>
                <div className="mt-2">{setoran.alasan_selisih}</div>
              </div>
            )}

            <div>
              <label className="label">Foto Bukti Setoran</label>
              {setoranEditable ? (
                <PhotoUpload
                  folder={`setoran/${yesterday}`}
                  value={fotoBukti}
                  onChange={setFotoBukti}
                  label="Upload Foto Slip / Struk Setoran"
                  max={5}
                  capture={false}
                />
              ) : (
                <PhotoViewer urls={fotoBukti} emptyText="Tidak ada foto" />
              )}
            </div>

            {setoran?.status === 'rejected' && setoran?.rejection_reason && (
              <Alert variant="error">
                Setoran direject: <strong>{setoran.rejection_reason}</strong>. Silakan revisi dan submit ulang.
              </Alert>
            )}

            {setoranEditable ? (
              <button onClick={submitSetoran} disabled={savingSetoran} className="btn-primary">
                {savingSetoran ? 'Menyimpan...' : 'Submit Setoran ke Approval DM'}
              </button>
            ) : (
              <div className="text-center text-sm font-semibold text-slate-500">
                {setoran?.status === 'approved' ? 'Setoran sudah diapprove DM.' : 'Setoran sedang menunggu approval DM.'}
              </div>
            )}
          </div>
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}

function StatusPill({ status }) {
  const map = {
    draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600' },
    submitted: { label: 'Pending', cls: 'bg-amber-50 text-amber-700' },
    approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700' },
    rejected: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700' },
  }
  const value = map[status] || map.draft
  return (
    <span className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${value.cls}`}>
      {value.label}
    </span>
  )
}
