import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { CHECKLIST_ITEMS } from '../../lib/constants'
import { todayWIB, nowTimeWIB } from '../../lib/utils'
import Header from '../../components/Header'
import Toggle from '../../components/Toggle'
import PhotoUpload from '../../components/PhotoUpload'
import PhotoViewer from '../../components/PhotoViewer'
import Alert from '../../components/Alert'
import { StaffBottomNav } from '../../components/BottomNav'

export default function CeklisHarian() {
  const { profile } = useAuth()
  const today = todayWIB()
  const [activeShift, setActiveShift] = useState('pagi')
  const [existing, setExisting]       = useState({ pagi: null, malam: null })
  const [answers, setAnswers]         = useState({})
  const [photos, setPhotos]           = useState({})
  const [oosInput, setOosInput]       = useState('')
  const [oosList, setOosList]         = useState([])
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [done, setDone]               = useState(false)
  const [error, setError]             = useState('')

  const branchId = profile?.branch_id

  useEffect(() => {
    if (!branchId) return
    fetchExisting()
  }, [branchId])

  useEffect(() => {
    // Load existing data when shift changes.
    // Do NOT reset `done` here — fetchExisting updates `existing` after a
    // successful submit, which would immediately clear the success banner.
    // `done` is only reset when the user explicitly switches shift tabs.
    const ex = existing[activeShift]
    if (ex) {
      setAnswers(ex.answers || {})
      setPhotos(ex.photos || {})
      setOosList(ex.item_oos || [])
      setNotes(ex.notes || '')
    } else {
      setAnswers({})
      setPhotos({})
      setOosList([])
      setNotes('')
    }
    setError('')
  }, [existing])

  // Reset done only when the user manually switches tabs
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
      data.forEach(d => { map[d.shift] = d })
      setExisting(map)
    }
  }

  const items = CHECKLIST_ITEMS.filter(i =>
    i.shift === activeShift || i.shift === 'both'
  )

  const setAnswer = (key, val) => setAnswers(prev => ({ ...prev, [key]: val }))
  const setPhoto  = (key, urls) => setPhotos(prev => ({ ...prev, [key]: urls }))

  const addOos = () => {
    const t = oosInput.trim()
    if (t && !oosList.includes(t)) {
      setOosList(prev => [...prev, t])
      setOosInput('')
    }
  }

  const removeOos = (item) => setOosList(prev => prev.filter(x => x !== item))

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

    const ex = existing[activeShift]
    const { error: err } = ex
      ? await supabase.from('daily_checklists').update(payload).eq('id', ex.id)
      : await supabase.from('daily_checklists').insert(payload)

    if (err) {
      setError('Gagal menyimpan: ' + err.message)
    } else {
      setDone(true)
      await fetchExisting()
    }
    setSaving(false)
  }

  const isReadOnly = !!existing[activeShift]
  const deadline   = activeShift === 'pagi' ? '08.00 WIB' : '03.00 WIB (dini hari)'

  return (
    <div className="page-shell">
      <Header title="Ceklis Harian" sub={`${profile?.branch?.name || ''} · ${today}`} />

      {/* Shift tabs */}
      <div className="flex bg-white border-b border-gray-100 px-4 gap-1 sticky top-[56px] z-10">
        {['pagi', 'malam'].map(s => (
          <button
            key={s}
            onClick={() => setActiveShift(s)}
            className={`flex-1 py-3 text-sm font-semibold rounded-none border-b-2 transition-colors ${
              activeShift === s
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-400'
            }`}
          >
            {s === 'pagi' ? '☀ Pagi (08.00)' : '🌙 Malam (03.00)'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-28 px-4 pt-4 space-y-3">
        {/* Status banner */}
        {isReadOnly && !done && (
          <Alert variant="ok">
            Ceklis {activeShift} sudah disubmit.
            {existing[activeShift]?.is_late && ' ⚠ Terlambat dari deadline.'}
          </Alert>
        )}
        {done && <Alert variant="ok">Ceklis berhasil disimpan! ✓</Alert>}
        {error && <Alert variant="error">{error}</Alert>}
        {!isReadOnly && (
          <Alert variant="info">
            Timestamp otomatis dicatat saat submit. Deadline: <strong>{deadline}</strong>.
          </Alert>
        )}

        {/* Platform status */}
        <Section title={activeShift === 'pagi' ? '📱 Status Pembukaan' : '🔒 Status Penutupan'}>
          {items.filter(i => ['toko_buka','toko_close','gofood_aktif','gofood_close',
            'grabfood_aktif','grabfood_close','shopeefood_aktif','shopeefood_close'].includes(i.key))
            .map(item => (
              <ToggleRow key={item.key} label={item.label} checked={!!answers[item.key]}
                onChange={v => setAnswer(item.key, v)} disabled={isReadOnly} />
            ))}
        </Section>

        {/* Area kebersihan */}
        <Section title="🧹 Kebersihan Area">
          {items.filter(i => i.key.endsWith('_bersih')).map(item => (
            <div key={item.key} className="py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                <Toggle checked={!!answers[item.key]} onChange={v => setAnswer(item.key, v)} disabled={isReadOnly} />
              </div>
              {isReadOnly ? (
                <PhotoViewer urls={photos[item.key]} emptyText="Tidak ada foto" />
              ) : (
                <PhotoUpload
                  folder={`ceklis/${today}/${activeShift}`}
                  value={photos[item.key] || []}
                  onChange={urls => setPhoto(item.key, urls)}
                  label="Upload Foto Area"
                  max={3}
                />
              )}
            </div>
          ))}
        </Section>

        {/* Staff grooming (pagi only) */}
        {activeShift === 'pagi' && (
          <Section title="👔 Staff Grooming">
            <div>
              {isReadOnly ? (
                <PhotoViewer urls={photos['staff_grooming']} emptyText="Tidak ada foto" />
              ) : (
                <PhotoUpload
                  folder={`ceklis/${today}/grooming`}
                  value={photos['staff_grooming'] || []}
                  onChange={urls => setPhoto('staff_grooming', urls)}
                  label="Upload Foto Grooming Staff"
                  max={5}
                />
              )}
            </div>
          </Section>
        )}

        {/* OOS */}
        <Section title="⚠️ Item Out of Stock">
          {oosList.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {oosList.map(item => (
                <span key={item} className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 rounded-full px-3 py-1 text-xs font-semibold">
                  {item}
                  {!isReadOnly && (
                    <button onClick={() => removeOos(item)} className="ml-1 text-red-500 hover:text-red-700">×</button>
                  )}
                </span>
              ))}
            </div>
          )}
          {!isReadOnly && (
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Nama item OOS..."
                value={oosInput}
                onChange={e => setOosInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addOos()}
              />
              <button onClick={addOos} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold">
                +
              </button>
            </div>
          )}
          {oosList.length === 0 && isReadOnly && (
            <p className="text-xs text-gray-400 italic">Tidak ada item OOS</p>
          )}
        </Section>

        {/* Notes */}
        <Section title="📝 Catatan">
          {isReadOnly ? (
            <p className="text-sm text-gray-600">{existing[activeShift]?.notes || <span className="italic text-gray-400">Tidak ada catatan</span>}</p>
          ) : (
            <textarea
              className="input resize-none"
              rows={3}
              placeholder={`Catatan kondisi ${activeShift} (opsional)...`}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          )}
        </Section>

        {!isReadOnly && (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Menyimpan...' : `Submit Ceklis ${activeShift === 'pagi' ? 'Pagi ☀' : 'Malam 🌙'}`}
          </button>
        )}
      </div>

      <StaffBottomNav />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card p-4">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

function ToggleRow({ label, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}
