import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  SubpageShell, SectionPanel, ToneBadge, EmptyPanel, LoadingButton,
} from '../../components/ui/AppKit'
import { SmartBottomNav } from '../../components/BottomNav'
import { fmtDate } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import {
  STAGES, STATUS_CONFIG, stageLabel, ACTION_LABELS, POSITION_LABELS,
} from '../../lib/recruitment'

const HR_ROLES = ['hr_staff','hr_spv','hr_legal','hr_administrator']
function backFor(role) {
  return (HR_ROLES.includes(role) || role === 'ops_manager') ? '/hr' : '/hr/store'
}

// ─── Transisi yang diizinkan per role & stage ────────────────────────────────
const ALLOWED_TRANSITIONS = {
  // head_store dan district_manager: upload hasil OJE
  head_store: {
    oje_instore_issued:    ['resubmit'],  // upload form kelulusan OJE
    revision_hs:           ['resubmit'],  // revisi field yang diflag
    ojt_instore:           ['advance'],   // OJT selesai
  },
  district_manager: {
    batch_oje_issued:      ['resubmit'],  // upload hasil batch (handled di BatchDetail)
  },
  // hr_staff: review, approve, flag revisi, forward
  hr_staff: {
    oje_instore_submitted: ['advance', 'revise'],
    review_hrstaff:        ['advance', 'revise'],
    revision_hrstaff:      ['advance', 'revise'],
    batch_oje_reviewed:    ['advance'],   // terbitkan OJE in Store
  },
  // hr_spv: approve atau kembalikan ke hr_staff
  hr_spv: {
    pending_hrspv:         ['advance', 'reject'],
  },
  // hr_legal: submit kontrak
  hr_legal: {
    kontrak_pending:       ['activate'],
  },
  // trainer: assessment dan training
  trainer: {
    assessment:            ['advance', 'reject'],
    training:              ['advance'],
  },
  // hr_administrator: semua aksi
  hr_administrator: {
    batch_oje_reviewed:    ['advance'],
    oje_instore_submitted: ['advance', 'revise'],
    review_hrstaff:        ['advance', 'revise'],
    revision_hs:           ['resubmit'],
    revision_hrstaff:      ['advance', 'revise'],
    pending_hrspv:         ['advance', 'reject'],
    kontrak_pending:       ['activate'],
    ojt_instore:           ['advance'],
    assessment:            ['advance', 'reject'],
    training:              ['advance'],
  },
}

// Stage berikutnya setelah action berhasil
function nextStage(currentStage, action) {
  const map = {
    batch_oje_reviewed:    { advance: 'oje_instore_issued' },
    oje_instore_issued:    { resubmit: 'oje_instore_submitted' },
    oje_instore_submitted: { advance: 'review_hrstaff', revise: 'revision_hs' },
    review_hrstaff:        { advance: 'pending_hrspv', revise: 'revision_hs' },
    revision_hs:           { resubmit: 'review_hrstaff' },
    pending_hrspv:         { advance: 'kontrak_pending', reject: 'revision_hrstaff' },
    revision_hrstaff:      { advance: 'pending_hrspv', revise: 'revision_hs' },
    kontrak_pending:       { activate: 'ojt_instore' },
    ojt_instore:           { advance: 'assessment' },
    assessment:            { advance: 'training', reject: 'on_hold' },
    training:              { advance: 'on_duty' },
  }
  return map[currentStage]?.[action] ?? currentStage
}

const OJE_INSTORE_FIELDS = [
  { key: 'hari_1_hadir',      label: 'Hari 1 – Hadir' },
  { key: 'hari_2_hadir',      label: 'Hari 2 – Hadir' },
  { key: 'hari_3_hadir',      label: 'Hari 3 – Hadir' },
  { key: 'hari_4_hadir',      label: 'Hari 4 – Hadir' },
  { key: 'hari_5_hadir',      label: 'Hari 5 – Hadir' },
  { key: 'penilaian_sikap',   label: 'Penilaian Sikap (1-5)' },
  { key: 'penilaian_skill',   label: 'Penilaian Skill (1-5)' },
  { key: 'penilaian_disiplin',label: 'Penilaian Disiplin (1-5)' },
  { key: 'catatan',           label: 'Catatan HS' },
  { key: 'rekomendasi',       label: 'Rekomendasi (Lulus/Tidak Lulus)' },
]

const BATCH_CRITERIA = ['disiplin','sikap','behavior','nyapu_ngepel','layout','toilet','stamina','kerja_sama','fokus','subjektif']
const BATCH_LABELS = {
  disiplin: 'Disiplin',
  sikap: 'Sikap',
  behavior: 'Behavior',
  nyapu_ngepel: 'Nyapu/Ngepel',
  layout: 'Layout',
  toilet: 'Toilet',
  stamina: 'Stamina',
  kerja_sama: 'Kerja Sama',
  fokus: 'Fokus',
  subjektif: 'Subjektif',
}

const OJE_INSTORE_SCHEMA = [
  { key: 'hari_1_hadir', label: 'Hari 1', type: 'attendance', required: true },
  { key: 'hari_2_hadir', label: 'Hari 2', type: 'attendance', required: true },
  { key: 'hari_3_hadir', label: 'Hari 3', type: 'attendance', required: true },
  { key: 'hari_4_hadir', label: 'Hari 4', type: 'attendance', required: true },
  { key: 'hari_5_hadir', label: 'Hari 5', type: 'attendance', required: true },
  { key: 'penilaian_sikap', label: 'Penilaian Sikap', type: 'score', min: 1, max: 5, required: true },
  { key: 'penilaian_skill', label: 'Penilaian Skill', type: 'score', min: 1, max: 5, required: true },
  { key: 'penilaian_disiplin', label: 'Penilaian Disiplin', type: 'score', min: 1, max: 5, required: true },
  { key: 'catatan', label: 'Catatan Head Store', type: 'textarea', rows: 3, required: true },
  { key: 'rekomendasi', label: 'Rekomendasi', type: 'recommendation', required: true },
]

const OJE_INSTORE_FORM_STAGES = ['oje_instore_issued', 'oje_instore_submitted', 'review_hrstaff', 'revision_hs']

function batchTotal(item) {
  return BATCH_CRITERIA.reduce((sum, key) => sum + (Number(item?.[key]) || 0), 0)
}

function batchResult(item) {
  if (item?.hadir === false) return { label: 'Tidak Hadir', tone: 'danger' }
  const total = batchTotal(item)
  if (total >= 24) return { label: 'Lulus', tone: 'ok' }
  if (total >= 18) return { label: 'Dipertimbangkan', tone: 'warn' }
  return { label: 'Gagal', tone: 'danger' }
}

function isFilled(value) {
  return !(value === undefined || value === null || value === '')
}

function formatInstoreValue(field, value) {
  if (!isFilled(value)) return '-'
  if (field.type === 'attendance') return String(value) === 'hadir' ? 'Hadir' : 'Tidak Hadir'
  if (field.type === 'score') return `${value}/5`
  if (field.type === 'recommendation') return value === 'lulus' ? 'Lulus' : 'Tidak Lulus'
  return value
}

export default function HRCandidateDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { showToast } = useToast()

  const [candidate, setCandidate] = useState(null)
  const [batchItem, setBatchItem] = useState(null)
  const [history, setHistory] = useState([])
  const [currentForm, setCurrentForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Action panel state
  const [showAction, setShowAction] = useState(false)
  const [selectedAction, setSelectedAction] = useState(null)
  const [actionNotes, setActionNotes] = useState('')
  const [revisionFields, setRevisionFields] = useState([])
  const [formData, setFormData] = useState({})
  const [kontrakEmail, setKontrakEmail] = useState('')

  const role = profile?.role

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    const [{ data: c }, { data: h }, { data: sf }] = await Promise.all([
      supabase.from('candidates')
        .select('*, branches(name, store_id)')
        .eq('id', id)
        .single(),
      supabase.from('stage_history')
        .select('*, profiles(full_name, role)')
        .eq('candidate_id', id)
        .order('performed_at', { ascending: false }),
      supabase.from('stage_forms')
        .select('*')
        .eq('candidate_id', id)
        .eq('is_current', true)
        .order('submitted_at', { ascending: false }),
    ])
    let batchEval = null
    if (c?.batch_id && c?.full_name) {
      const { data } = await supabase.from('oje_batch_items')
        .select('*')
        .eq('batch_id', c.batch_id)
        .eq('nama_peserta', c.full_name)
        .maybeSingle()
      batchEval = data ?? null
    }
    setCandidate(c)
    setBatchItem(batchEval)
    setHistory(h ?? [])
    // form terbaru per stage
    const formsByStage = {}
    sf?.forEach(f => { if (!formsByStage[f.stage]) formsByStage[f.stage] = f })
    setCurrentForm(formsByStage)
    setLoading(false)
  }

  const allowedActions = (role && candidate?.current_stage)
    ? (ALLOWED_TRANSITIONS[role]?.[candidate.current_stage] ?? [])
    : []

  async function submitAction() {
    if (!selectedAction) return
    if (['reject','revise'].includes(selectedAction) && !actionNotes.trim()) {
      return showToast('Catatan wajib diisi untuk aksi ini', 'error')
    }
    if (selectedAction === 'revise' && revisionFields.length === 0) {
      return showToast('Pilih setidaknya 1 field yang perlu direvisi', 'error')
    }
    if (
      selectedAction === 'resubmit' &&
      ['oje_instore_issued','revision_hs'].includes(candidate.current_stage)
    ) {
      const requiredField = OJE_INSTORE_SCHEMA.find(f => f.required && !isFilled(formData[f.key]))
      if (requiredField) {
        return showToast(`Field "${requiredField.label}" wajib diisi`, 'error')
      }
    }

    if (selectedAction === 'activate') {
      if (!kontrakEmail.trim()) return showToast('Email kandidat wajib diisi', 'error')
      setActionLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recruitment-onboard`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              candidate_id: id,
              email: kontrakEmail.trim(),
              notes: actionNotes.trim() || undefined,
            }),
          }
        )
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Gagal aktivasi akun')
        showToast(`Akun berhasil dibuat: ${result.account?.email}`, 'success')
        await load()
        setShowAction(false)
      } catch (err) {
        showToast(err.message, 'error')
      } finally {
        setActionLoading(false)
      }
      return
    }

    setActionLoading(true)
    try {
      const to = nextStage(candidate.current_stage, selectedAction)

      if (selectedAction === 'resubmit' && Object.keys(formData).length > 0) {
        // archive_stage_form adalah SECURITY DEFINER → bypass RLS untuk semua role
        await supabase.rpc('archive_stage_form', {
          p_candidate_id: id,
          p_stage: candidate.current_stage,
        })
        const { data: nextVer } = await supabase.rpc('next_form_version', {
          p_candidate_id: id,
          p_stage: candidate.current_stage,
        })
        const { error: formErr } = await supabase.from('stage_forms').insert({
          candidate_id: id,
          stage: candidate.current_stage,
          version: nextVer ?? 1,
          form_data: formData,
          is_current: true,
          submitted_by: profile?.id,
        })
        if (formErr) throw new Error('Gagal simpan form: ' + formErr.message)
      }

      const updatePayload = { current_stage: to }
      if (selectedAction === 'terminate') updatePayload.status = 'terminated'
      if (selectedAction === 'hold')      updatePayload.status = 'on_hold'
      if (to === 'on_duty')               updatePayload.status = 'on_duty'

      const { error: updErr } = await supabase
        .from('candidates')
        .update(updatePayload)
        .eq('id', id)
      if (updErr) throw new Error('Gagal update kandidat: ' + updErr.message)

      const { error: histErr } = await supabase.from('stage_history').insert({
        candidate_id: id,
        from_stage: candidate.current_stage,
        to_stage: to,
        action: selectedAction,
        notes: actionNotes.trim() || null,
        revision_fields: revisionFields.length > 0
          ? { fields: revisionFields, reason: actionNotes.trim() }
          : null,
        performed_by: profile?.id,
      })
      if (histErr) throw new Error('Gagal simpan riwayat: ' + histErr.message)

      showToast('Aksi berhasil disimpan', 'success')
      setShowAction(false)
      setSelectedAction(null)
      setActionNotes('')
      setRevisionFields([])
      setFormData({})
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <SubpageShell title="Detail Kandidat" backTo={backFor(role)}>
        <p className="text-xs text-slate-400 px-4 py-6">Memuat...</p>
      </SubpageShell>
    )
  }

  if (!candidate) {
    return (
      <SubpageShell title="Detail Kandidat" backTo={backFor(role)}>
        <EmptyPanel message="Kandidat tidak ditemukan" />
      </SubpageShell>
    )
  }

  const statusCfg = STATUS_CONFIG[candidate.status] ?? {}
  const currentRevisionFields = history.find(h => h.action === 'revise')?.revision_fields?.fields ?? []
  const latestInstoreForm = OJE_INSTORE_FORM_STAGES
    .map(stage => currentForm?.[stage])
    .filter(Boolean)
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0] ?? null
  const batchSummary = batchItem ? batchResult(batchItem) : null

  return (
    <SubpageShell title={candidate.full_name} eyebrow="Detail Kandidat" backTo={backFor(role)}>
      {/* Info kandidat */}
      <SectionPanel className="mx-4 mt-4">
        <div className="px-4 py-3 space-y-1.5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-base font-bold text-slate-800">{candidate.full_name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {candidate.phone} · {candidate.email ?? 'Email belum diisi'}
              </div>
            </div>
            <ToneBadge tone={statusCfg.tone ?? 'info'} label={statusCfg.label ?? candidate.status} />
          </div>
          <InfoRow label="Posisi" value={POSITION_LABELS[candidate.applied_position] ?? candidate.applied_position} />
          <InfoRow label="Toko" value={candidate.branches?.name} />
          <InfoRow label="Stage" value={stageLabel(candidate.current_stage)} />
          {candidate.batch_id && (
            <div className="pt-1">
              <Link to={`/hr/batch/${candidate.batch_id}`} className="text-xs text-primary-600 font-semibold">
                Lihat Batch OJE →
              </Link>
            </div>
          )}
          {['ojt_instore','assessment','training'].includes(candidate.current_stage) && (
            <div className="pt-1">
              <Link to={`/hr/candidates/${id}/ojt`} className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg inline-block">
                Buka OJT Checklist →
              </Link>
            </div>
          )}
        </div>
      </SectionPanel>

      {batchItem && (
        <SectionPanel title="Ringkasan Batch OJE" className="mx-4 mt-4">
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500">Hasil seleksi batch</div>
                <div className="text-lg font-bold text-slate-800">
                  {batchItem.hadir === false ? 'Tidak dinilai' : `${batchTotal(batchItem)}/30`}
                </div>
              </div>
              <ToneBadge tone={batchSummary?.tone ?? 'info'} label={batchSummary?.label ?? 'Belum ada hasil'} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BATCH_CRITERIA.map(key => (
                <span key={key} className="text-xs bg-slate-50 text-slate-600 rounded px-2 py-1">
                  {BATCH_LABELS[key]}: <strong>{Number(batchItem[key]) || 0}</strong>
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Scorecard batch dipisah dari form OJE in Store supaya evaluasi massal dan evaluasi toko tidak tercampur.
            </p>
          </div>
        </SectionPanel>
      )}

      {/* Action panel */}
      {allowedActions.length > 0 && candidate.status === 'active' && (
        <SectionPanel title="Aksi" className="mx-4 mt-4">
          {!showAction ? (
            <div className="px-4 py-3">
              <button
                onClick={() => setShowAction(true)}
                className="w-full bg-primary-600 text-white text-sm font-semibold rounded-xl py-2.5"
              >
                Lakukan Aksi
              </button>
            </div>
          ) : (
            <div className="px-4 py-3 space-y-3">
              {/* Pilih aksi */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Pilih Aksi</label>
                <div className="flex flex-wrap gap-2">
                  {allowedActions.map(a => (
                    <button
                      key={a}
                      onClick={() => setSelectedAction(a)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                        selectedAction === a
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {ACTION_LABELS[a] ?? a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form OJE in Store (untuk HS upload) */}
              {selectedAction === 'resubmit' &&
                ['oje_instore_issued','revision_hs'].includes(candidate.current_stage) && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 block">Form OJE in Store</label>
                  <p className="text-xs text-slate-500">
                    Form ini khusus evaluasi kandidat selama observasi di toko, terpisah dari scorecard Batch OJE.
                  </p>
                  {OJE_INSTORE_SCHEMA
                    .filter(f => candidate.current_stage !== 'revision_hs' || currentRevisionFields.includes(f.key))
                    .map(f => (
                      <div key={f.key}>
                        <label className="text-xs text-slate-500 block mb-0.5">{f.label}</label>
                        {f.type === 'attendance' && (
                          <select
                            value={formData[f.key] ?? ''}
                            onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))}
                            className="input-field"
                          >
                            <option value="">Pilih status hadir</option>
                            <option value="hadir">Hadir</option>
                            <option value="tidak_hadir">Tidak Hadir</option>
                          </select>
                        )}
                        {f.type === 'score' && (
                          <input
                            type="number"
                            min={f.min}
                            max={f.max}
                            value={formData[f.key] ?? ''}
                            onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))}
                            className="input-field"
                            placeholder={`${f.label} (${f.min}-${f.max})`}
                          />
                        )}
                        {f.type === 'textarea' && (
                          <textarea
                            value={formData[f.key] ?? ''}
                            onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))}
                            className="input-field"
                            rows={f.rows ?? 3}
                            placeholder={f.label}
                          />
                        )}
                        {f.type === 'recommendation' && (
                          <select
                            value={formData[f.key] ?? ''}
                            onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))}
                            className="input-field"
                          >
                            <option value="">Pilih rekomendasi</option>
                            <option value="lulus">Lulus</option>
                            <option value="tidak_lulus">Tidak Lulus</option>
                          </select>
                        )}
                      </div>
                    ))
                  }
                  {candidate.current_stage === 'revision_hs' && currentRevisionFields.length > 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                      Field yang perlu direvisi: {currentRevisionFields.join(', ')}
                    </p>
                  )}
                </div>
              )}

              {/* Field revision selector (untuk hr_staff flag revisi) */}
              {selectedAction === 'revise' && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Field yang Perlu Direvisi
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {OJE_INSTORE_SCHEMA.map(f => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setRevisionFields(prev =>
                          prev.includes(f.key) ? prev.filter(k => k !== f.key) : [...prev, f.key]
                        )}
                        className={`text-xs px-2.5 py-1 rounded-lg border ${
                          revisionFields.includes(f.key)
                            ? 'bg-amber-100 text-amber-700 border-amber-300'
                            : 'bg-white text-slate-500 border-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Email untuk kontrak (hr_legal) */}
              {selectedAction === 'activate' && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Email Kandidat (untuk login akun)
                  </label>
                  <input
                    type="email"
                    value={kontrakEmail}
                    onChange={e => setKontrakEmail(e.target.value)}
                    className="input-field"
                    placeholder="nama@email.com"
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Akun akan dibuat otomatis dengan password shared setelah submit.
                  </p>
                </div>
              )}

              {/* Catatan */}
              {selectedAction && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Catatan {['reject','revise'].includes(selectedAction) ? '(wajib)' : '(opsional)'}
                  </label>
                  <textarea
                    value={actionNotes}
                    onChange={e => setActionNotes(e.target.value)}
                    className="input-field"
                    rows={3}
                    placeholder="Tulis catatan..."
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAction(false); setSelectedAction(null); setActionNotes(''); setRevisionFields([]) }}
                  className="flex-1 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl py-2.5"
                >
                  Batal
                </button>
                <LoadingButton
                  loading={actionLoading}
                  onClick={submitAction}
                  disabled={!selectedAction}
                  className="flex-1 btn-primary text-sm py-2.5 disabled:opacity-40"
                >
                  Konfirmasi
                </LoadingButton>
              </div>
            </div>
          )}
        </SectionPanel>
      )}

      {/* Form OJE in Store terbaru */}
      {latestInstoreForm && (
        <SectionPanel title="Form OJE in Store" className="mx-4 mt-4">
          <div className="px-4 py-3 space-y-1">
            {OJE_INSTORE_FIELDS.map(f => (
              <InfoRow
                key={f.key}
                label={f.label}
                value={formatInstoreValue(
                  OJE_INSTORE_SCHEMA.find(s => s.key === f.key) ?? {},
                  latestInstoreForm.form_data?.[f.key]
                )}
              />
            ))}
            <div className="text-xs text-slate-400 pt-1">
              Versi {latestInstoreForm.version} · {fmtDate(latestInstoreForm.submitted_at)}
              {latestInstoreForm.stage !== 'oje_instore_issued' && (
                <span className="ml-1 text-amber-500">(revisi)</span>
              )}
            </div>
          </div>
        </SectionPanel>
      )}

      {/* Stage timeline */}
      <SectionPanel title="Riwayat Stage" className="mx-4 mt-4 mb-24">
        {history.length === 0 ? (
          <EmptyPanel message="Belum ada riwayat" />
        ) : (
          <div className="px-4 py-3 space-y-3">
            {history.map((h, i) => {
              const actionTone = {
                advance: 'ok', activate: 'ok', resubmit: 'info',
                revise: 'warn', reject: 'warn',
                terminate: 'danger', hold: 'danger',
              }[h.action] ?? 'info'

              return (
                <div key={h.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                      actionTone === 'ok' ? 'bg-green-400' :
                      actionTone === 'warn' ? 'bg-amber-400' :
                      actionTone === 'danger' ? 'bg-rose-400' : 'bg-blue-400'
                    }`} />
                    {i < history.length - 1 && <div className="w-px flex-1 bg-slate-100 my-1" />}
                  </div>
                  <div className="pb-2 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-slate-700">
                          {stageLabel(h.to_stage)}
                        </span>
                        <ToneBadge tone={actionTone} label={ACTION_LABELS[h.action] ?? h.action} className="ml-2" />
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {h.profiles?.full_name ?? '-'} · {fmtDate(h.performed_at)}
                    </div>
                    {h.notes && (
                      <div className="text-xs text-slate-600 mt-1 bg-slate-50 rounded-lg px-2 py-1">
                        {h.notes}
                      </div>
                    )}
                    {h.revision_fields?.fields?.length > 0 && (
                      <div className="text-xs text-amber-600 mt-1">
                        Field: {h.revision_fields.fields.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionPanel>

      <SmartBottomNav />
    </SubpageShell>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-xs font-semibold text-slate-800 text-right">{value ?? '-'}</span>
    </div>
  )
}
