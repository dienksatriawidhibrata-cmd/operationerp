import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  SubpageShell, SectionPanel, SegmentedControl, ToneBadge, EmptyPanel, AppIcon,
  LoadingButton,
} from '../../components/ui/AppKit'
import { todayWIB, fmtDate, downloadCsv } from '../../lib/utils'

// ─── OJE Individual constants ───────────────────────────────────────────────

const OJE_CRITERIA = [
  { id: 'c1',  cat: 'Customer Oriented', label: 'Selalu tersenyum, ramah dan sopan kepada Customer' },
  { id: 'c2',  cat: 'Customer Oriented', label: 'Bersikap dan bertindak mendahulukan kepentingan Customer' },
  { id: 'c3',  cat: 'Job Fit',           label: 'Motivasi Kerja: rasa ingin tahu terhadap dunia kerja' },
  { id: 'c4',  cat: 'Job Fit',           label: 'Inisiatif: melakukan pekerjaan tanpa diminta' },
  { id: 'c5',  cat: 'Job Fit',           label: 'Ketahanan: rajin, sigap, tidak manja/mengeluh' },
  { id: 'c6',  cat: 'Team Work',         label: 'Respect: sopan dan hormat terhadap rekan kerja' },
  { id: 'c7',  cat: 'Team Work',         label: 'Goodwill: bersedia membantu pekerjaan team' },
  { id: 'c8',  cat: 'Work Standard',     label: 'Kualitas Kerja: mengikuti prosedur & standar' },
  { id: 'c9',  cat: 'Work Standard',     label: 'Kebersihan: standar tinggi (Clean-As-You-Go)' },
  { id: 'c10', cat: 'Work Standard',     label: 'Kecepatan Kerja: selesaikan tugas sesuai tenggat waktu' },
  { id: 'c11', cat: 'Attitude',          label: 'Kepatuhan: memahami & melaksanakan instruksi' },
  { id: 'c12', cat: 'Attitude',          label: 'Disiplin: ketepatan waktu hadir' },
  { id: 'c13', cat: 'Attitude',          label: 'Grooming: kerapihan & kebersihan diri' },
]

const BATCH_CRITERIA = ['disiplin','sikap','behavior','nyapu_ngepel','layout','toilet','stamina','kerja_sama','fokus','subjektif']
const BATCH_LABELS   = ['Disiplin','Sikap','Behavior','Nyapu/Ngepel','Layout','Toilet','Stamina','Kerja Sama','Fokus','Subjektif']

const POSITIONS = ['barista','kitchen','waitress']
const MAX_SCORE = 65
const DOWNLOAD_ROLES = ['support_spv','ops_manager','support_admin']

function calcOJE(scores) {
  const total = OJE_CRITERIA.reduce((s, c) => s + (Number(scores[c.id]) || 0), 0)
  const pct   = (total / MAX_SCORE) * 100
  const rating = pct > 80 ? 'Excellent' : pct >= 60 ? 'Good' : 'Fail'
  return { total, pct: parseFloat(pct.toFixed(1)), rating }
}

function calcBatchTotal(item) {
  return BATCH_CRITERIA.reduce((s, k) => s + (Number(item[k]) || 0), 0)
}

function batchHasil(total) {
  if (total >= 24) return 'Lulus'
  if (total >= 18) return 'Dipertimbangkan'
  return 'Gagal'
}

const RATING_TONE = { Excellent: 'ok', Good: 'info', Fail: 'danger' }
const HASIL_TONE  = { Lulus: 'ok', Dipertimbangkan: 'warn', Gagal: 'danger' }

const emptyScores = () => OJE_CRITERIA.reduce((a, c) => ({ ...a, [c.id]: 0 }), {})
const emptyBatchItem = () => BATCH_CRITERIA.reduce((a, k) => ({ ...a, [k]: 0 }), { nama_peserta: '', nama_panggilan: '' })

// ─── Sub-views ───────────────────────────────────────────────────────────────

function OJEDetailModal({ evaluation, onClose }) {
  if (!evaluation) return null
  const cats = [...new Set(OJE_CRITERIA.map((c) => c.cat))]
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] bg-white p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-bold text-slate-800">{evaluation.candidate_name}
              {evaluation.nickname && <span className="ml-1 text-sm text-slate-400">({evaluation.nickname})</span>}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {evaluation.position} · {evaluation.branch?.name || '-'} · {fmtDate(evaluation.eval_date)}
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-lg">×</button>
        </div>

        <div className="flex items-center gap-3 rounded-[18px] bg-slate-50 px-4 py-3">
          <ToneBadge tone={RATING_TONE[evaluation.rating] ?? 'slate'}>{evaluation.rating}</ToneBadge>
          <span className="text-sm font-mono text-slate-600">{evaluation.total_score}/{MAX_SCORE} · {evaluation.percentage}%</span>
          {evaluation.observer_name && <span className="text-xs text-slate-400 ml-auto">Observer: {evaluation.observer_name}</span>}
        </div>

        {cats.map((cat) => (
          <div key={cat}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{cat}</div>
            <div className="space-y-1.5">
              {OJE_CRITERIA.filter((c) => c.cat === cat).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-[14px] bg-slate-50 px-3 py-2 gap-2">
                  <span className="text-xs text-slate-600 flex-1">{c.label}</span>
                  <span className="text-sm font-bold text-primary-700 shrink-0">{evaluation.scores?.[c.id] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {(evaluation.remarks_opening || evaluation.remarks_closing || evaluation.alasan) && (
          <div className="space-y-2">
            {evaluation.remarks_opening && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Shift Opening</div>
                <p className="text-xs text-slate-600 leading-relaxed">{evaluation.remarks_opening}</p>
              </div>
            )}
            {evaluation.remarks_closing && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Shift Closing</div>
                <p className="text-xs text-slate-600 leading-relaxed">{evaluation.remarks_closing}</p>
              </div>
            )}
            {evaluation.alasan && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Alasan</div>
                <p className="text-xs text-slate-600 leading-relaxed">{evaluation.alasan}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function OJEList({ evaluations, batches, branches, loading, onExportIndividual, onExportBatch, canDownload }) {
  const [tab, setTab] = useState('individual')
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterPosition, setFilterPosition] = useState('')
  const [filterRating, setFilterRating] = useState('')
  const [selectedEval, setSelectedEval] = useState(null)

  const tabs = [
    { key: 'individual', label: 'OJE Individual' },
    { key: 'batch',      label: 'Batch Scorecard' },
  ]

  const filteredEvals = evaluations.filter((e) => {
    if (search && !e.candidate_name.toLowerCase().includes(search.toLowerCase()) &&
        !e.nickname?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterBranch && e.branch_id !== filterBranch) return false
    if (filterPosition && e.position !== filterPosition) return false
    if (filterRating && e.rating !== filterRating) return false
    return true
  })

  const filteredBatches = batches.filter((b) => {
    if (filterBranch && b.branch_id !== filterBranch) return false
    if (search && !b.evaluator_name?.toLowerCase().includes(search.toLowerCase()) &&
        !b.branch?.name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
    </div>
  )

  return (
    <div className="space-y-4">
      {selectedEval && <OJEDetailModal evaluation={selectedEval} onClose={() => setSelectedEval(null)} />}

      <div className="flex items-center justify-between gap-2">
        <SegmentedControl options={tabs} value={tab} onChange={setTab} />
        {canDownload && (
          <button
            onClick={tab === 'individual' ? onExportIndividual : onExportBatch}
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 shrink-0"
          >
            <AppIcon name="opex" size={13} /> CSV
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <input
          className="input flex-1 min-w-[140px] py-2 text-sm"
          placeholder="Cari nama..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input py-2 text-sm" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
          <option value="">Semua Toko</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {tab === 'individual' && (
          <>
            <select className="input py-2 text-sm" value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)}>
              <option value="">Semua Posisi</option>
              {POSITIONS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
            <select className="input py-2 text-sm" value={filterRating} onChange={(e) => setFilterRating(e.target.value)}>
              <option value="">Semua Rating</option>
              {['Excellent', 'Good', 'Fail'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </>
        )}
      </div>

      {tab === 'individual' && (
        filteredEvals.length === 0
          ? <EmptyPanel title="Tidak ada data" description={evaluations.length === 0 ? 'Tambah evaluasi via tab OJE Individual.' : 'Tidak ada data yang cocok dengan filter.'} />
          : <SectionPanel eyebrow={`${filteredEvals.length} hasil`} title="OJE Individual">
              <div className="space-y-2">
                {filteredEvals.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelectedEval(e)}
                    className="w-full rounded-[18px] bg-slate-50 px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-100 active:scale-[0.99] transition-all"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{e.candidate_name}
                        {e.nickname && <span className="ml-1 text-xs text-slate-400">({e.nickname})</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {e.position} · {e.branch?.name || '-'} · {fmtDate(e.eval_date)}
                      </div>
                      {e.observer_name && <div className="text-xs text-slate-400">Observer: {e.observer_name}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <ToneBadge tone={RATING_TONE[e.rating] ?? 'slate'}>{e.rating}</ToneBadge>
                      <span className="text-[11px] font-mono text-slate-500">{e.total_score}/{MAX_SCORE} · {e.percentage}%</span>
                    </div>
                  </button>
                ))}
              </div>
            </SectionPanel>
      )}

      {tab === 'batch' && (
        filteredBatches.length === 0
          ? <EmptyPanel title="Tidak ada data" description={batches.length === 0 ? 'Tambah via tab Batch Scorecard.' : 'Tidak ada data yang cocok dengan filter.'} />
          : <SectionPanel eyebrow={`${filteredBatches.length} sesi`} title="Batch Scorecard">
              <div className="space-y-2">
                {filteredBatches.map((b) => (
                  <div key={b.id} className="rounded-[18px] bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{b.branch?.name || '-'}</div>
                        <div className="text-xs text-slate-500">{fmtDate(b.batch_date)} · {b.evaluator_name || '-'}</div>
                      </div>
                      <ToneBadge tone="slate">{b.oje_batch_items?.length ?? 0} peserta</ToneBadge>
                    </div>
                    {b.oje_batch_items?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {b.oje_batch_items.map((item) => {
                          const total = calcBatchTotal(item)
                          const hasil = batchHasil(total)
                          return (
                            <span key={item.id} className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium
                              ${hasil === 'Lulus' ? 'bg-emerald-50 text-emerald-700' : hasil === 'Dipertimbangkan' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                              {item.nama_panggilan || item.nama_peserta} · {total}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionPanel>
      )}
    </div>
  )
}

function OJEIndividualForm({ branches, onSaved }) {
  const { profile } = useAuth()
  const today = todayWIB()

  const [form, setForm] = useState({
    candidate_name: '',
    nickname: '',
    position: 'barista',
    branch_id: '',
    observer_name: profile?.full_name || '',
    eval_date: today,
    scores: emptyScores(),
    remarks_opening: '',
    remarks_closing: '',
    alasan: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const { total, pct, rating } = useMemo(() => calcOJE(form.scores), [form.scores])

  const setScore = (id, val) => setForm((f) => ({ ...f, scores: { ...f.scores, [id]: val } }))
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.candidate_name.trim()) { setError('Nama kandidat wajib diisi.'); return }
    if (!form.branch_id) { setError('Pilih toko terlebih dahulu.'); return }
    const allScored = OJE_CRITERIA.every((c) => Number(form.scores[c.id]) > 0)
    if (!allScored) { setError('Semua kriteria wajib diberi skor.'); return }

    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('oje_evaluations').insert({
      candidate_name:  form.candidate_name.trim(),
      nickname:        form.nickname.trim() || null,
      position:        form.position,
      branch_id:       form.branch_id,
      observer_name:   form.observer_name.trim() || null,
      observer_id:     profile?.id,
      eval_date:       form.eval_date,
      scores:          form.scores,
      total_score:     total,
      percentage:      pct,
      rating,
      remarks_opening: form.remarks_opening.trim() || null,
      remarks_closing: form.remarks_closing.trim() || null,
      alasan:          form.alasan.trim() || null,
      created_by:      profile?.id,
    })
    setSaving(false)
    if (err) { setError('Gagal menyimpan: ' + err.message); return }
    onSaved()
  }

  const cats = [...new Set(OJE_CRITERIA.map((c) => c.cat))]

  return (
    <div className="space-y-4">
      {error && <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {/* Header */}
      <SectionPanel eyebrow="Data Kandidat" title="Informasi Umum">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nama Kandidat *</label>
            <input className="input" value={form.candidate_name} onChange={(e) => set('candidate_name', e.target.value)} placeholder="Nama lengkap" />
          </div>
          <div>
            <label className="label">Nama Panggilan</label>
            <input className="input" value={form.nickname} onChange={(e) => set('nickname', e.target.value)} placeholder="Opsional" />
          </div>
          <div>
            <label className="label">Posisi *</label>
            <select className="input" value={form.position} onChange={(e) => set('position', e.target.value)}>
              {POSITIONS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Toko *</label>
            <select className="input" value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
              <option value="">Pilih toko...</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nama Observer</label>
            <input className="input" value={form.observer_name} onChange={(e) => set('observer_name', e.target.value)} placeholder="Nama trainer/penilai" />
          </div>
          <div>
            <label className="label">Tanggal Evaluasi</label>
            <input className="input" type="date" value={form.eval_date} onChange={(e) => set('eval_date', e.target.value)} />
          </div>
        </div>
      </SectionPanel>

      {/* Scoring */}
      {cats.map((cat) => (
        <SectionPanel key={cat} eyebrow="Penilaian" title={cat}>
          <div className="space-y-3">
            {OJE_CRITERIA.filter((c) => c.cat === cat).map((c) => {
              const val = Number(form.scores[c.id]) || 0
              return (
                <div key={c.id} className="rounded-[18px] bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-700 mb-2">{c.label}</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setScore(c.id, s)}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold transition-all
                          ${val === s ? 'bg-primary-600 text-white shadow-md scale-105' : 'bg-white border border-slate-200 text-slate-500 hover:border-primary-300'}`}
                      >
                        {s}
                      </button>
                    ))}
                    {val > 0 && <span className="ml-1 self-center text-xs text-slate-400">= {val}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </SectionPanel>
      ))}

      {/* Narasi */}
      <SectionPanel eyebrow="Keterangan" title="Catatan Observasi">
        <div className="space-y-3">
          <div>
            <label className="label">Hari Pertama (Shift Opening)</label>
            <textarea className="input resize-none" rows={3} value={form.remarks_opening} onChange={(e) => set('remarks_opening', e.target.value)} placeholder="Detail penilaian hari pertama..." />
          </div>
          <div>
            <label className="label">Hari Kedua (Shift Closing)</label>
            <textarea className="input resize-none" rows={3} value={form.remarks_closing} onChange={(e) => set('remarks_closing', e.target.value)} placeholder="Detail penilaian hari kedua..." />
          </div>
          <div>
            <label className="label">Alasan Kandidat Diterima / Tidak Diterima</label>
            <textarea className="input resize-none" rows={3} value={form.alasan} onChange={(e) => set('alasan', e.target.value)} placeholder="Tuliskan alasan detail..." />
          </div>
        </div>
      </SectionPanel>

      {/* Live score footer */}
      <div className="sticky bottom-20 rounded-[22px] bg-slate-900 px-5 py-4 text-white shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Total</div>
              <div className="text-2xl font-black">{total}<span className="text-sm font-normal text-slate-400">/{MAX_SCORE}</span></div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Persen</div>
              <div className="text-2xl font-black text-primary-400">{pct}%</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Rating</div>
              <div className={`text-base font-bold ${rating === 'Excellent' ? 'text-emerald-400' : rating === 'Good' ? 'text-amber-400' : 'text-rose-400'}`}>{rating || '—'}</div>
            </div>
          </div>
          <LoadingButton onClick={handleSave} loading={saving} className="shrink-0 rounded-2xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">
            Simpan
          </LoadingButton>
        </div>
        <div className="mt-2 text-[10px] text-slate-500">
          Excellent &gt;80% · Good 60–79% · Fail &lt;60%
        </div>
      </div>
    </div>
  )
}

function OJEBatchForm({ branches, onSaved }) {
  const { profile } = useAuth()
  const today = todayWIB()

  const [header, setHeader] = useState({
    batch_date: today,
    branch_id: '',
    evaluator_name: profile?.full_name || '',
    notes: '',
  })
  const [items, setItems] = useState([emptyBatchItem()])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const setH = (k, v) => setHeader((h) => ({ ...h, [k]: v }))

  const setItemField = (idx, k, v) => setItems((prev) => {
    const next = [...prev]
    next[idx] = { ...next[idx], [k]: v }
    return next
  })

  const addItem = () => setItems((prev) => [...prev, emptyBatchItem()])
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    if (!header.branch_id) { setError('Pilih toko terlebih dahulu.'); return }
    if (items.length === 0) { setError('Minimal satu peserta.'); return }
    const allNamed = items.every((i) => i.nama_peserta.trim())
    if (!allNamed) { setError('Nama peserta wajib diisi semua.'); return }

    setSaving(true)
    setError('')

    const { data: batch, error: bErr } = await supabase.from('oje_batches').insert({
      batch_date:     header.batch_date,
      branch_id:      header.branch_id,
      evaluator_name: header.evaluator_name.trim() || null,
      evaluator_id:   profile?.id,
      notes:          header.notes.trim() || null,
      created_by:     profile?.id,
    }).select('id').single()

    if (bErr) { setError('Gagal simpan batch: ' + bErr.message); setSaving(false); return }

    const rows = items.map((item, i) => ({
      batch_id:      batch.id,
      nama_peserta:  item.nama_peserta.trim(),
      nama_panggilan: item.nama_panggilan?.trim() || null,
      sort_order:    i,
      ...BATCH_CRITERIA.reduce((a, k) => ({ ...a, [k]: Number(item[k]) || 0 }), {}),
    }))

    const { error: iErr } = await supabase.from('oje_batch_items').insert(rows)
    if (iErr) {
      await supabase.from('oje_batches').delete().eq('id', batch.id)
      setError('Gagal simpan peserta: ' + iErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <SectionPanel eyebrow="Data Sesi" title="Informasi Batch">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Tanggal</label>
            <input className="input" type="date" value={header.batch_date} onChange={(e) => setH('batch_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Toko *</label>
            <select className="input" value={header.branch_id} onChange={(e) => setH('branch_id', e.target.value)}>
              <option value="">Pilih toko...</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nama Penilai</label>
            <input className="input" value={header.evaluator_name} onChange={(e) => setH('evaluator_name', e.target.value)} placeholder="Nama trainer/penilai" />
          </div>
        </div>
      </SectionPanel>

      {/* Peserta rows */}
      <SectionPanel
        eyebrow="Peserta"
        title={`${items.length} Peserta`}
        actions={
          <button onClick={addItem} className="flex items-center gap-1 rounded-xl bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100">
            + Tambah
          </button>
        }
      >
        <div className="space-y-4">
          {items.map((item, idx) => {
            const total = calcBatchTotal(item)
            const hasil = batchHasil(total)
            return (
              <div key={idx} className="rounded-[18px] border border-slate-100 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex gap-2 flex-1">
                    <input
                      className="input py-2 text-sm flex-1"
                      placeholder="Nama lengkap *"
                      value={item.nama_peserta}
                      onChange={(e) => setItemField(idx, 'nama_peserta', e.target.value)}
                    />
                    <input
                      className="input py-2 text-sm w-28"
                      placeholder="Panggilan"
                      value={item.nama_panggilan}
                      onChange={(e) => setItemField(idx, 'nama_panggilan', e.target.value)}
                    />
                  </div>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="shrink-0 rounded-xl border border-rose-100 bg-rose-50 px-2 py-2 text-xs text-rose-500 hover:bg-rose-100">
                      ✕
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {BATCH_CRITERIA.map((k, ci) => (
                    <div key={k} className="flex flex-col items-center gap-1">
                      <div className="text-[9px] font-semibold text-slate-400 text-center leading-tight">{BATCH_LABELS[ci]}</div>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        className="input py-1.5 text-center text-sm w-full"
                        value={item[k] || ''}
                        onChange={(e) => setItemField(idx, k, e.target.value)}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs text-slate-500">Total: <span className="font-bold text-slate-800">{total}</span></span>
                  <ToneBadge tone={HASIL_TONE[hasil]}>{hasil}</ToneBadge>
                  <span className="text-[10px] text-slate-400">Lulus ≥24 · Dptm 18–23 · Gagal &lt;18</span>
                </div>
              </div>
            )
          })}
        </div>
      </SectionPanel>

      <div>
        <label className="label">Catatan (opsional)</label>
        <textarea className="input resize-none" rows={2} value={header.notes} onChange={(e) => setH('notes', e.target.value)} placeholder="Catatan sesi batch..." />
      </div>

      <LoadingButton onClick={handleSave} loading={saving} className="btn-primary">
        {`Simpan Batch (${items.length} peserta)`}
      </LoadingButton>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function OJEPage() {
  const { profile } = useAuth()
  const canDownload = DOWNLOAD_ROLES.includes(profile?.role)

  const [view, setView]           = useState('list')
  const [evaluations, setEvals]   = useState([])
  const [batches, setBatches]     = useState([])
  const [branches, setBranches]   = useState([])
  const [loading, setLoading]     = useState(true)

  const TABS = [
    { key: 'list',       label: 'Daftar' },
    { key: 'individual', label: 'OJE Individual' },
    { key: 'batch',      label: 'Batch Scorecard' },
  ]

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [evalRes, batchRes, branchRes] = await Promise.all([
      supabase
        .from('oje_evaluations')
        .select('*, branch:branches(name)')
        .order('eval_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('oje_batches')
        .select('*, branch:branches(name), oje_batch_items(*)')
        .order('batch_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('branches').select('id, name').order('name'),
    ])
    setEvals(evalRes.data || [])
    setBatches(batchRes.data || [])
    setBranches(branchRes.data || [])
    setLoading(false)
  }

  const handleSaved = () => {
    setView('list')
    fetchAll()
  }

  const exportIndividual = () => {
    const rows = evaluations.map((e) => ({
      Tanggal:       e.eval_date,
      Nama:          e.candidate_name,
      Panggilan:     e.nickname || '',
      Posisi:        e.position,
      Toko:          e.branch?.name || '',
      Observer:      e.observer_name || '',
      Total:         e.total_score,
      Persen:        e.percentage,
      Rating:        e.rating,
      'Shift Opening': e.remarks_opening || '',
      'Shift Closing': e.remarks_closing || '',
      Alasan:        e.alasan || '',
      ...OJE_CRITERIA.reduce((a, c) => ({ ...a, [c.label.slice(0, 30)]: e.scores?.[c.id] ?? 0 }), {}),
    }))
    downloadCsv(rows, `OJE_Individual_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const exportBatch = () => {
    const rows = batches.flatMap((b) =>
      (b.oje_batch_items || []).map((item) => ({
        'Tgl Batch':    b.batch_date,
        Toko:           b.branch?.name || '',
        Penilai:        b.evaluator_name || '',
        'Nama Peserta': item.nama_peserta,
        Panggilan:      item.nama_panggilan || '',
        ...BATCH_CRITERIA.reduce((a, k, i) => ({ ...a, [BATCH_LABELS[i]]: item[k] }), {}),
        Total:          calcBatchTotal(item),
        Hasil:          batchHasil(calcBatchTotal(item)),
      }))
    )
    downloadCsv(rows, `OJE_Batch_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const totalEval  = evaluations.length
  const totalLulus = evaluations.filter((e) => e.rating !== 'Fail').length
  const totalFail  = evaluations.filter((e) => e.rating === 'Fail').length

  return (
    <SubpageShell
      title="On Job Evaluation"
      subtitle="Penilaian kandidat barista, kitchen & waitress"
      eyebrow="Trainer"
      showBack={false}
      footer={<SmartBottomNav />}
      action={
        <div className="flex gap-2 items-center">
          <span className="text-xs text-slate-500">{totalEval} eval · {totalLulus} lulus</span>
        </div>
      }
    >
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Total', value: totalEval, tone: 'bg-slate-100 text-slate-700' },
          { label: 'Lulus', value: totalLulus, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Fail',  value: totalFail,  tone: 'bg-rose-50 text-rose-700' },
        ].map((s) => (
          <div key={s.label} className={`rounded-[18px] p-3 text-center ${s.tone}`}>
            <div className="text-xl font-black">{s.value}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{s.label}</div>
          </div>
        ))}
      </div>

      <SegmentedControl options={TABS} value={view} onChange={setView} className="mb-4" />

      {view === 'list' && (
        <OJEList
          evaluations={evaluations}
          batches={batches}
          branches={branches}
          loading={loading}
          onExportIndividual={exportIndividual}
          onExportBatch={exportBatch}
          canDownload={canDownload}
        />
      )}
      {view === 'individual' && (
        <OJEIndividualForm branches={branches} onSaved={handleSaved} />
      )}
      {view === 'batch' && (
        <OJEBatchForm branches={branches} onSaved={handleSaved} />
      )}
    </SubpageShell>
  )
}
