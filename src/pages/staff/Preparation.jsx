import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayWIB } from '../../lib/utils'
import PhotoUpload from '../../components/PhotoUpload'
import PhotoViewer from '../../components/PhotoViewer'
import Alert from '../../components/Alert'
import { StaffBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel, InlineStat, SectionPanel, SegmentedControl, SubpageShell,
} from '../../components/ui/AppKit'

// ── Tambah item baru: cukup tambah baris di sini ──────────────────────────
// key: unik (snake_case), label: nama tampil, section: 'Bar' atau 'Kitchen'
const PREP_ITEMS = [
  // Preparation – Bar
  { key: 'bar_kopi_susu',        label: 'Kopi Susu',            section: 'Bar' },
  { key: 'bar_matcha',           label: 'Matcha',               section: 'Bar' },
  { key: 'bar_chocolate',        label: 'Chocolate',            section: 'Bar' },
  { key: 'bar_bpt',              label: 'BPT',                  section: 'Bar' },
  { key: 'bar_rosella_tea',      label: 'Rosella Tea',          section: 'Bar' },
  { key: 'bar_jpt',              label: 'JPT',                  section: 'Bar' },
  // Preparation – Kitchen
  { key: 'kit_indomie',          label: 'Indomie',              section: 'Kitchen' },
  { key: 'kit_nasi_goreng',      label: 'Nasi Goreng',          section: 'Kitchen' },
  { key: 'kit_sausage_fries',    label: 'Sausage & Fries',      section: 'Kitchen' },
  { key: 'kit_fries_bolognaise', label: 'Fries Bolognaise',     section: 'Kitchen' },
  { key: 'kit_tahu_lada_garam',  label: 'Tahu Lada Garam',      section: 'Kitchen' },
  { key: 'kit_tahu_walik',       label: 'Tahu Walik',           section: 'Kitchen' },
  { key: 'kit_cireng',           label: 'Cireng',               section: 'Kitchen' },
  { key: 'kit_combro',           label: 'Combro',               section: 'Kitchen' },
  { key: 'kit_mix_platter',      label: 'Mix Platter',          section: 'Kitchen' },
  { key: 'kit_garlic_oil',       label: 'Garlic Oil',           section: 'Kitchen' },
  { key: 'kit_bawang_goreng',    label: 'Bawang Putih Goreng',  section: 'Kitchen' },
  { key: 'kit_acar',             label: 'Acar',                 section: 'Kitchen' },
  { key: 'kit_salad',            label: 'Salad',                section: 'Kitchen' },
  { key: 'kit_sambal_matah',     label: 'Sambal Matah',         section: 'Kitchen' },
  { key: 'kit_sambal_goang',     label: 'Sambal Goang',         section: 'Kitchen' },
  { key: 'kit_saus_nashville',   label: 'Saus Nashville',       section: 'Kitchen' },
]

const SECTIONS = [...new Set(PREP_ITEMS.map((i) => i.section))]

export default function Preparation() {
  const { profile } = useAuth()
  const today = todayWIB()
  const branchId = profile?.branch_id

  const [activeShift, setActiveShift] = useState('pagi')
  const [existing, setExisting] = useState({ pagi: null, middle: null, malam: null })
  const [answers, setAnswers] = useState({})
  const [photos, setPhotos] = useState([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (branchId) fetchExisting()
  }, [branchId])

  useEffect(() => {
    const cur = existing[activeShift]
    if (cur) {
      setAnswers(cur.answers || {})
      setPhotos(cur.photos || [])
      setNotes(cur.notes || '')
    } else {
      setAnswers({})
      setPhotos([])
      setNotes('')
    }
    setError('')
    setDone(false)
    setIsEditing(false)
  }, [existing, activeShift])

  const fetchExisting = async () => {
    const { data } = await supabase
      .from('daily_preparation')
      .select('*')
      .eq('branch_id', branchId)
      .eq('tanggal', today)
      .in('shift', ['pagi', 'middle', 'malam'])

    const map = { pagi: null, middle: null, malam: null }
    if (data) data.forEach((row) => { map[row.shift] = row })
    setExisting(map)
  }

  const setQty = (key, val) => setAnswers((cur) => ({ ...cur, [key]: val === '' ? '' : Number(val) }))

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
      notes,
    }

    const cur = existing[activeShift]
    const { error: submitErr } = cur
      ? await supabase.from('daily_preparation').update(payload).eq('id', cur.id)
      : await supabase.from('daily_preparation').insert(payload)

    if (submitErr) {
      setError('Gagal menyimpan: ' + submitErr.message)
    } else {
      setDone(true)
      setIsEditing(false)
      await fetchExisting()
    }
    setSaving(false)
  }

  const isReadOnly = !!existing[activeShift] && !isEditing
  const filledCount = PREP_ITEMS.filter((i) => answers[i.key] !== '' && answers[i.key] !== undefined).length

  return (
    <SubpageShell
      title="Preparation"
      subtitle={`${profile?.branch?.name || 'Bagi Kopi'} / ${today}`}
      eyebrow="Daily Preparation"
      footer={<StaffBottomNav />}
    >
      <SectionPanel
        eyebrow="Shift Control"
        title="Pilih Shift"
        description="Input jumlah preparation per shift."
        actions={
          <SegmentedControl
            options={[
              { key: 'pagi', label: 'Pagi' },
              { key: 'middle', label: 'Middle' },
              { key: 'malam', label: 'Malam' },
            ]}
            value={activeShift}
            onChange={setActiveShift}
          />
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineStat label="Tanggal" value={today} tone="primary" />
          <InlineStat label="Terisi" value={`${filledCount}/${PREP_ITEMS.length}`} tone={isReadOnly ? 'emerald' : 'primary'} />
          <InlineStat label="Status" value={isReadOnly ? 'Sudah Submit' : 'Belum Submit'} tone={isReadOnly ? 'emerald' : 'warn'} />
        </div>
      </SectionPanel>

      <div className="mt-6 space-y-6">
        {existing[activeShift] && !isEditing && !done && (
          <div className="flex items-center justify-between gap-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <span className="text-sm text-emerald-800">Preparation {activeShift} sudah disubmit.</span>
            <button
              onClick={() => setIsEditing(true)}
              className="shrink-0 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Koreksi
            </button>
          </div>
        )}
        {isEditing && <Alert variant="warn">Mode koreksi aktif.</Alert>}
        {done && <Alert variant="ok">Preparation berhasil disimpan.</Alert>}
        {error && <Alert variant="error">{error}</Alert>}

        {SECTIONS.map((section) => (
          <SectionPanel key={section} eyebrow="Jumlah Preparation" title={`Preparation – ${section}`}>
            <div className="space-y-2">
              {PREP_ITEMS.filter((i) => i.section === section).map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4 rounded-[18px] bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-700 flex-1">{item.label}</span>
                  {isReadOnly ? (
                    <span className="text-sm font-bold text-primary-700 w-16 text-right">
                      {answers[item.key] !== undefined && answers[item.key] !== '' ? answers[item.key] : '—'}
                    </span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      className="input py-1.5 text-sm text-center w-20 shrink-0"
                      placeholder="0"
                      value={answers[item.key] ?? ''}
                      onChange={(e) => setQty(item.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          </SectionPanel>
        ))}

        <SectionPanel eyebrow="Dokumentasi" title="Foto Preparation">
          {isReadOnly ? (
            photos.length > 0
              ? <PhotoViewer urls={photos} />
              : <EmptyPanel title="Tidak ada foto" description="Tidak ada foto untuk shift ini." />
          ) : (
            <PhotoUpload
              folder={`preparation/${today}/${activeShift}`}
              value={photos}
              onChange={setPhotos}
              label="Upload Foto Preparation"
              max={5}
            />
          )}
        </SectionPanel>

        <SectionPanel eyebrow="Notes" title="Catatan Shift">
          {isReadOnly ? (
            <p className="text-sm leading-6 text-slate-600">
              {existing[activeShift]?.notes || <span className="italic text-slate-400">Tidak ada catatan</span>}
            </p>
          ) : (
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Catatan kondisi preparation (opsional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </SectionPanel>

        {!isReadOnly && (
          <div className="flex gap-3">
            {isEditing && (
              <button
                type="button"
                onClick={() => { setIsEditing(false); setError('') }}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"
              >
                Batal
              </button>
            )}
            <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Menyimpan...' : isEditing ? 'Simpan Koreksi' : `Submit Preparation ${activeShift === 'pagi' ? 'Pagi' : activeShift === 'middle' ? 'Middle' : 'Malam'}`}
            </button>
          </div>
        )}
      </div>
    </SubpageShell>
  )
}
