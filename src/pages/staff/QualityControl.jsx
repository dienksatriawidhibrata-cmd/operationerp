import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayWIB } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { StaffBottomNav } from '../../components/BottomNav'
import Alert from '../../components/Alert'
import {
  InlineStat,
  LoadingButton,
  SectionPanel,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'
import { createQualityControlRows } from '../../lib/qualityControl'

export default function QualityControl() {
  const { profile } = useAuth()
  const { toastSuccess, toastError } = useToast()
  const today = todayWIB()
  const branchId = profile?.branch_id

  const [makerName, setMakerName] = useState(profile?.full_name || '')
  const [rows, setRows] = useState(createQualityControlRows())
  const [recordId, setRecordId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile?.full_name) return
    setMakerName((current) => current || profile.full_name)
  }, [profile?.full_name])

  useEffect(() => {
    if (!branchId) {
      setLoading(false)
      return
    }
    fetchData()
  }, [branchId])

  const fetchData = async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('daily_quality_controls')
      .select('*')
      .eq('branch_id', branchId)
      .eq('tanggal', today)
      .maybeSingle()

    if (fetchError) {
      setError('Gagal memuat quality control: ' + fetchError.message)
      setLoading(false)
      return
    }

    if (data) {
      setRecordId(data.id)
      setMakerName(data.maker_name || profile?.full_name || '')
      setRows(createQualityControlRows(data.items))
    } else {
      setRecordId(null)
      setRows(createQualityControlRows())
    }

    setLoading(false)
  }

  const handleRowChange = (index, key, value) => {
    setRows((current) => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [key]: value } : row
    )))
  }

  const filledCount = rows.filter((row) => row.stock || row.productionDate || row.notes).length

  const handleSubmit = async () => {
    if (!branchId) {
      setError('Akun ini tidak terhubung ke cabang manapun.')
      return
    }

    if (!makerName.trim()) {
      setError('Nama pembuat wajib diisi.')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      branch_id: branchId,
      tanggal: today,
      maker_name: makerName.trim(),
      submitted_by: profile.id,
      items: rows,
    }

    const { error: saveError } = recordId
      ? await supabase.from('daily_quality_controls').update(payload).eq('id', recordId)
      : await supabase.from('daily_quality_controls').insert(payload)

    if (saveError) {
      toastError('Gagal menyimpan quality control: ' + saveError.message)
    } else {
      toastSuccess('Quality control berhasil disimpan.')
      fetchData()
    }

    setSaving(false)
  }

  return (
    <SubpageShell
      title="Quality Control"
      subtitle="Cek stok dan tanggal pembuatan item harian"
      eyebrow="Daily Reporting"
      footer={<StaffBottomNav />}
    >
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      ) : (
        <>
          <SectionPanel
            eyebrow="Ringkasan"
            title="Status Quality Control"
            description="Isi stok, tanggal pembuatan, dan catatan tiap item agar persiapan toko tetap terjaga."
            actions={<ToneBadge tone={recordId ? 'ok' : 'warn'}>{recordId ? 'Sudah tersimpan' : 'Belum disimpan'}</ToneBadge>}
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <InlineStat label="Tanggal" value={today} tone="primary" />
              <InlineStat label="Nama Pembuat" value={makerName || '-'} tone={makerName ? 'emerald' : 'slate'} />
              <InlineStat label="Item Dicek" value={filledCount} tone={filledCount > 0 ? 'amber' : 'slate'} />
              <InlineStat label="Total Item" value={rows.length} tone="slate" />
            </div>
          </SectionPanel>

          <div className="mt-6 space-y-6">
            {error && <Alert variant="error">{error}</Alert>}

            <SectionPanel
              eyebrow="Form"
              title="Data Pembuat"
              description="Nama pembuat akan ikut tersimpan bersama lembar quality control hari ini."
            >
              <div>
                <label className="label">Nama Pembuat</label>
                <input
                  className="input"
                  type="text"
                  value={makerName}
                  onChange={(event) => setMakerName(event.target.value)}
                  placeholder="Contoh: Dinda / Yogi"
                />
              </div>
            </SectionPanel>

            <SectionPanel
              eyebrow="Checklist"
              title="Lembar Quality Control"
              description="Kosongkan baris yang belum perlu dicatat. Kamu bisa simpan ulang kapan saja di hari yang sama."
            >
              <div className="space-y-3">
                {rows.map((row, index) => (
                  <div key={row.item} className="rounded-[22px] border border-slate-100 bg-slate-50/70 p-4">
                    <div className="text-sm font-semibold text-slate-900">{row.item}</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr]">
                      <div>
                        <label className="label">Stok</label>
                        <input
                          className="input"
                          type="text"
                          value={row.stock}
                          onChange={(event) => handleRowChange(index, 'stock', event.target.value)}
                          placeholder="Contoh: 2 liter / 4 pcs"
                        />
                      </div>
                      <div>
                        <label className="label">Tanggal Pembuatan</label>
                        <input
                          className="input"
                          type="date"
                          value={row.productionDate}
                          onChange={(event) => handleRowChange(index, 'productionDate', event.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Notes</label>
                        <input
                          className="input"
                          type="text"
                          value={row.notes}
                          onChange={(event) => handleRowChange(index, 'notes', event.target.value)}
                          placeholder="Keterangan tambahan"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <LoadingButton onClick={handleSubmit} loading={saving} className="btn-primary">
                  Simpan Quality Control
                </LoadingButton>
              </div>
            </SectionPanel>
          </div>
        </>
      )}
    </SubpageShell>
  )
}
