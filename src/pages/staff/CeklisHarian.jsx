import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { CHECKLIST_ITEMS } from '../../lib/constants'
import { todayWIB } from '../../lib/utils'
import Toggle from '../../components/Toggle'
import PhotoUpload from '../../components/PhotoUpload'
import PhotoViewer from '../../components/PhotoViewer'
import Alert from '../../components/Alert'
import { StaffBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel,
  InlineStat,
  SectionPanel,
  SegmentedControl,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'

export default function CeklisHarian() {
  const { profile } = useAuth()
  const today = todayWIB()
  const [activeShift, setActiveShift] = useState('pagi')
  const [existing, setExisting] = useState({ pagi: null, malam: null })
  const [answers, setAnswers] = useState({})
  const [photos, setPhotos] = useState({})
  const [oosInput, setOosInput] = useState('')
  const [oosList, setOosList] = useState([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const branchId = profile?.branch_id

  useEffect(() => {
    if (!branchId) return
    fetchExisting()
  }, [branchId])

  useEffect(() => {
    const currentExisting = existing[activeShift]
    if (currentExisting) {
      setAnswers(currentExisting.answers || {})
      setPhotos(currentExisting.photos || {})
      setOosList(currentExisting.item_oos || [])
      setNotes(currentExisting.notes || '')
    } else {
      setAnswers({})
      setPhotos({})
      setOosList([])
      setNotes('')
    }
    setError('')
  }, [existing, activeShift])

  useEffect(() => {
    setDone(false)
    setError('')
  }, [activeShift])

  const fetchExisting = async () => {
    const { data, error: fetchErr } = await supabase
      .from('daily_checklists')
      .select('*')
      .eq('branch_id', branchId)
      .eq('tanggal', today)
      .in('shift', ['pagi', 'malam'])

    if (fetchErr) {
      setError('Gagal memuat data ceklis: ' + fetchErr.message)
      return
    }

    if (data) {
      const map = { pagi: null, malam: null }
      data.forEach((item) => {
        map[item.shift] = item
      })
      setExisting(map)
    }
  }

  const items = CHECKLIST_ITEMS.filter((item) => item.shift === activeShift || item.shift === 'both')

  const setAnswer = (key, value) => setAnswers((current) => ({ ...current, [key]: value }))
  const setPhoto = (key, urls) => setPhotos((current) => ({ ...current, [key]: urls }))

  const addOos = () => {
    const trimmed = oosInput.trim()
    if (trimmed && !oosList.includes(trimmed)) {
      setOosList((current) => [...current, trimmed])
      setOosInput('')
    }
  }

  const removeOos = (item) => setOosList((current) => current.filter((entry) => entry !== item))

  const handleSubmit = async () => {
    setSaving(true)
    setError('')

    const payload = {
      branch_id: branchId,
      shift: activeShift,
      tanggal: today,
      submitted_by: profile.id,
      answers,
      photos,
      item_oos: oosList,
      notes,
    }

    const currentExisting = existing[activeShift]
    const { error: submitErr } = currentExisting
      ? await supabase.from('daily_checklists').update(payload).eq('id', currentExisting.id)
      : await supabase.from('daily_checklists').insert(payload)

    if (submitErr) {
      setError('Gagal menyimpan: ' + submitErr.message)
    } else {
      setDone(true)
      await fetchExisting()
    }
    setSaving(false)
  }

  const isReadOnly = !!existing[activeShift]
  const deadline = activeShift === 'pagi' ? '08.00 WIB' : '03.00 WIB'
  const completionCount = items.filter((item) => answers[item.key] !== undefined).length

  return (
    <SubpageShell
      title="Ceklis Harian"
      subtitle={`${profile?.branch?.name || 'Bagi Kopi'} • ${today}`}
      eyebrow="Operational Checklist"
      footer={<StaffBottomNav />}
    >
      <SectionPanel
        eyebrow="Shift Control"
        title="Pilih Shift"
        description="Checklist pagi dan malam tetap dipisah supaya progresnya jelas dan mudah dicek ulang."
        actions={
          <SegmentedControl
            options={[
              { key: 'pagi', label: 'Pagi' },
              { key: 'malam', label: 'Malam' },
            ]}
            value={activeShift}
            onChange={setActiveShift}
          />
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineStat label="Tanggal" value={today} tone="primary" />
          <InlineStat label="Deadline" value={deadline} tone={activeShift === 'pagi' ? 'amber' : 'slate'} />
          <InlineStat label="Progress" value={`${completionCount}/${items.length}`} tone={isReadOnly ? 'emerald' : 'primary'} />
        </div>
      </SectionPanel>

      <div className="mt-6 space-y-6">
        {isReadOnly && !done && (
          <Alert variant="ok">
            Ceklis {activeShift} sudah disubmit.
            {existing[activeShift]?.is_late && ' Tercatat terlambat dari deadline.'}
          </Alert>
        )}
        {done && <Alert variant="ok">Ceklis berhasil disimpan.</Alert>}
        {error && <Alert variant="error">{error}</Alert>}
        {!isReadOnly && (
          <Alert variant="info">
            Timestamp otomatis dicatat saat submit. Deadline shift ini: <strong>{deadline}</strong>.
          </Alert>
        )}

        <SectionPanel
          eyebrow="Status Awal"
          title={activeShift === 'pagi' ? 'Status Pembukaan' : 'Status Penutupan'}
          description="Pastikan semua platform dan status toko sesuai kondisi aktual."
        >
          <div className="space-y-1">
            {items
              .filter((item) => [
                'toko_buka',
                'toko_close',
                'gofood_aktif',
                'gofood_close',
                'grabfood_aktif',
                'grabfood_close',
                'shopeefood_aktif',
                'shopeefood_close',
              ].includes(item.key))
              .map((item) => (
                <ToggleRow
                  key={item.key}
                  label={item.label}
                  checked={!!answers[item.key]}
                  onChange={(value) => setAnswer(item.key, value)}
                  disabled={isReadOnly}
                />
              ))}
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Area Review"
          title="Kebersihan Area"
          description="Setiap area perlu status kebersihan dan bukti foto agar kondisi toko mudah diverifikasi."
        >
          <div className="space-y-5">
            {items.filter((item) => item.key.endsWith('_bersih')).map((item) => (
              <div key={item.key} className="rounded-[22px] bg-slate-50/85 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  <Toggle
                    checked={!!answers[item.key]}
                    onChange={(value) => setAnswer(item.key, value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="mt-3">
                  {isReadOnly ? (
                    <PhotoViewer urls={photos[item.key]} emptyText="Tidak ada foto" />
                  ) : (
                    <PhotoUpload
                      folder={`ceklis/${today}/${activeShift}`}
                      value={photos[item.key] || []}
                      onChange={(urls) => setPhoto(item.key, urls)}
                      label="Upload Foto Area"
                      max={3}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>

        {activeShift === 'pagi' && (
          <SectionPanel
            eyebrow="Team Readiness"
            title="Staff Grooming"
            description="Dokumentasikan kesiapan tim di awal shift."
          >
            {isReadOnly ? (
              <PhotoViewer urls={photos.staff_grooming} emptyText="Tidak ada foto" />
            ) : (
              <PhotoUpload
                folder={`ceklis/${today}/grooming`}
                value={photos.staff_grooming || []}
                onChange={(urls) => setPhoto('staff_grooming', urls)}
                label="Upload Foto Grooming Staff"
                max={5}
              />
            )}
          </SectionPanel>
        )}

        <SectionPanel
          eyebrow="Inventory Signal"
          title="Item Out of Stock"
          description="Catat item yang kosong agar follow up pengadaan lebih cepat."
        >
          {oosList.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {oosList.map((item) => (
                <ToneBadge key={item} tone="danger">
                  {item}
                  {!isReadOnly && (
                    <button type="button" onClick={() => removeOos(item)} className="text-rose-500">
                      ×
                    </button>
                  )}
                </ToneBadge>
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="Belum ada item OOS"
              description={isReadOnly ? 'Shift ini tidak memiliki catatan item kosong.' : 'Tambahkan item yang sedang kosong bila ada.'}
            />
          )}

          {!isReadOnly && (
            <div className="mt-4 flex gap-2">
              <input
                className="input flex-1"
                placeholder="Nama item OOS..."
                value={oosInput}
                onChange={(event) => setOosInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && addOos()}
              />
              <button
                onClick={addOos}
                className="rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white"
              >
                Tambah
              </button>
            </div>
          )}
        </SectionPanel>

        <SectionPanel
          eyebrow="Notes"
          title="Catatan Shift"
          description="Tambahkan hal penting yang perlu diketahui tim atau manager."
        >
          {isReadOnly ? (
            <p className="text-sm leading-6 text-slate-600">
              {existing[activeShift]?.notes || <span className="italic text-slate-400">Tidak ada catatan</span>}
            </p>
          ) : (
            <textarea
              className="input resize-none"
              rows={4}
              placeholder={`Catatan kondisi ${activeShift} (opsional)...`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          )}
        </SectionPanel>

        {!isReadOnly && (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Menyimpan...' : `Submit Ceklis ${activeShift === 'pagi' ? 'Pagi' : 'Malam'}`}
          </button>
        )}
      </div>
    </SubpageShell>
  )
}

function ToggleRow({ label, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between rounded-[20px] bg-slate-50/85 px-4 py-3">
      <span className="text-sm text-slate-700">{label}</span>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}
