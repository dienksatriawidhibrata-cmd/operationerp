import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayWIB } from '../../lib/utils'
import { PREPARATION_ITEMS } from '../../lib/constants'
import PhotoUpload from '../../components/PhotoUpload'
import PhotoViewer from '../../components/PhotoViewer'
import Alert from '../../components/Alert'
import { StaffBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel, InlineStat, SectionPanel, SegmentedControl, SubpageShell,
} from '../../components/ui/AppKit'

const SECTIONS = [...new Set(PREPARATION_ITEMS.map((i) => i.section))]

function buildPreparationDraftKey(branchId, tanggal, shift) {
  if (!branchId || !tanggal || !shift) return ''
  return `bagikopi-ops-preparation-draft:${branchId}:${tanggal}:${shift}`
}

function readPreparationDraft(branchId, tanggal, shift) {
  if (typeof window === 'undefined') return null
  const key = buildPreparationDraftKey(branchId, tanggal, shift)
  if (!key) return null

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writePreparationDraft(branchId, tanggal, shift, draft) {
  if (typeof window === 'undefined') return
  const key = buildPreparationDraftKey(branchId, tanggal, shift)
  if (!key) return

  try {
    window.localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // Ignore draft cache write failures.
  }
}

function clearPreparationDraft(branchId, tanggal, shift) {
  if (typeof window === 'undefined') return
  const key = buildPreparationDraftKey(branchId, tanggal, shift)
  if (!key) return

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore draft cache clear failures.
  }
}

function normalizePreparationAnswers(rawAnswers = {}) {
  const qtyMap = {}
  const photoMap = {}

  PREPARATION_ITEMS.forEach((item) => {
    const current = rawAnswers?.[item.key]

    if (current && typeof current === 'object' && !Array.isArray(current)) {
      qtyMap[item.key] = current.qty === '' || current.qty == null ? '' : Number(current.qty)
      photoMap[item.key] = Array.isArray(current.photos) ? current.photos : []
      return
    }

    qtyMap[item.key] = current === '' || current == null ? '' : Number(current)
    photoMap[item.key] = []
  })

  return { qtyMap, photoMap }
}

function buildPreparationAnswers(qtyMap = {}, photoMap = {}) {
  return PREPARATION_ITEMS.reduce((acc, item) => {
    const qty = qtyMap[item.key]
    const photos = photoMap[item.key] || []
    if (qty === '' || qty == null) return acc

    acc[item.key] = {
      qty: Number(qty),
      photos,
    }
    return acc
  }, {})
}

export default function Preparation() {
  const { profile } = useAuth()
  const today = todayWIB()
  const branchId = profile?.branch_id

  const [activeShift, setActiveShift] = useState('pagi')
  const [existing, setExisting] = useState({ pagi: null, middle: null, malam: null })
  const [qtyMap, setQtyMap] = useState({})
  const [photoMap, setPhotoMap] = useState({})
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
      const normalized = normalizePreparationAnswers(cur.answers || {})
      setQtyMap(normalized.qtyMap)
      setPhotoMap(normalized.photoMap)
      setNotes(cur.notes || '')
    } else {
      const draft = readPreparationDraft(branchId, today, activeShift)
      setQtyMap(draft?.qtyMap || {})
      setPhotoMap(draft?.photoMap || {})
      setNotes(draft?.notes || '')
    }
    setError('')
    setDone(false)
    setIsEditing(false)
  }, [existing, activeShift, branchId, today])

  useEffect(() => {
    if (!branchId || existing[activeShift]) return

    writePreparationDraft(branchId, today, activeShift, {
      qtyMap,
      photoMap,
      notes,
    })
  }, [branchId, today, activeShift, existing, qtyMap, photoMap, notes])

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

  const setQty = (key, val) => setQtyMap((cur) => ({ ...cur, [key]: val === '' ? '' : Number(val) }))
  const setItemPhotos = (key, urls) => setPhotoMap((cur) => ({ ...cur, [key]: urls }))

  const handleSubmit = async () => {
    setSaving(true)
    setError('')

    const missingPhotos = PREPARATION_ITEMS
      .filter((item) => qtyMap[item.key] !== '' && qtyMap[item.key] != null)
      .filter((item) => (photoMap[item.key] || []).length === 0)

    if (missingPhotos.length > 0) {
      setError(`Foto wajib diisi per item. Lengkapi foto untuk: ${missingPhotos.slice(0, 3).map((item) => item.label).join(', ')}${missingPhotos.length > 3 ? ' dan lainnya' : ''}.`)
      setSaving(false)
      return
    }

    const answers = buildPreparationAnswers(qtyMap, photoMap)
    const photos = PREPARATION_ITEMS.flatMap((item) => photoMap[item.key] || [])

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
      clearPreparationDraft(branchId, today, activeShift)
      setDone(true)
      setIsEditing(false)
      await fetchExisting()
    }
    setSaving(false)
  }

  const isReadOnly = !!existing[activeShift] && !isEditing
  const filledCount = PREPARATION_ITEMS.filter((i) => qtyMap[i.key] !== '' && qtyMap[i.key] !== undefined).length

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
          <InlineStat label="Terisi" value={`${filledCount}/${PREPARATION_ITEMS.length}`} tone={isReadOnly ? 'emerald' : 'primary'} />
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
          <SectionPanel key={section} eyebrow="Jumlah Preparation" title={`Preparation - ${section}`} description="Isi jumlah dan unggah 1 foto untuk setiap item yang disiapkan.">
            <div className="space-y-2">
              {PREPARATION_ITEMS.filter((i) => i.section === section).map((item) => (
                <div key={item.key} className="rounded-[18px] bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-700 flex-1">{item.label}</span>
                    {isReadOnly ? (
                      <span className="text-sm font-bold text-primary-700 w-16 text-right">
                        {qtyMap[item.key] !== undefined && qtyMap[item.key] !== '' ? qtyMap[item.key] : '-'}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        className="input py-1.5 text-sm text-center w-20 shrink-0"
                        placeholder="0"
                        value={qtyMap[item.key] ?? ''}
                        onChange={(e) => setQty(item.key, e.target.value)}
                      />
                    )}
                  </div>

                  <div className="mt-3">
                    {isReadOnly ? (
                      (photoMap[item.key] || []).length > 0 ? (
                        <PhotoViewer urls={photoMap[item.key] || []} emptyText="" />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-400">
                          Tidak ada foto item.
                        </div>
                      )
                    ) : (
                      <PhotoUpload
                        folder={`preparation/${today}/${activeShift}/${item.key}`}
                        value={photoMap[item.key] || []}
                        onChange={(urls) => setItemPhotos(item.key, urls)}
                        label={`Upload Foto ${item.label}`}
                        max={1}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionPanel>
        ))}

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
