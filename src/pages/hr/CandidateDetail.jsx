import { useEffect, useState, Fragment } from 'react'
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
  STATUS_CONFIG, POSITION_LABELS, stageLabel, ACTION_LABELS,
  BATCH_CRITERIA, BATCH_LABELS,
  OJE_INSTORE_SCHEMA, OJE_INSTORE_FORM_STAGES, OJE_INSTORE_FIELD_SUMMARY, OJE_INSTORE_CATEGORIES,
  allowedActionsFor, nextStage,
  batchTotal, batchResult, formatInstoreValue,
} from '../../lib/recruitment'

const HR_ROLES = ['hr_staff', 'hr_spv', 'hr_legal', 'hr_administrator', 'support_spv']

function backFor(role) {
  return (HR_ROLES.includes(role) || role === 'ops_manager') ? '/hr' : '/hr/store'
}

function isFilled(value) {
  return !(value === undefined || value === null || value === '')
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

  // OJE in Store form state (inline untuk head_store)
  const [formData, setFormData] = useState({})

  // Generic action state (untuk review/approval/kontrak)
  const [showAction, setShowAction] = useState(false)
  const [selectedAction, setSelectedAction] = useState(null)
  const [actionNotes, setActionNotes] = useState('')
  const [revisionFields, setRevisionFields] = useState([])
  const [kontrakEmail, setKontrakEmail] = useState('')

  const role = profile?.role

  useEffect(() => { load() }, [id])

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

    const formsByStage = {}
    sf?.forEach(f => { if (!formsByStage[f.stage]) formsByStage[f.stage] = f })
    setCurrentForm(formsByStage)

    // Pre-populate formData dari form yang sudah ada untuk stage revisi
    if (c?.current_stage === 'revision_hs' && sf && sf.length > 0) {
      const latestOJEForm = sf
        .filter(f => OJE_INSTORE_FORM_STAGES.includes(f.stage))
        .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0]
      if (latestOJEForm?.form_data) {
        setFormData(latestOJEForm.form_data)
      }
    }

    setLoading(false)
  }

  const allowedActions = allowedActionsFor(role, candidate?.current_stage)

  // Submit inline OJE in Store form (head_store di oje_instore_issued / revision_hs)
  async function submitOJEForm() {
    const stage = candidate.current_stage
    const revisionFieldsFromHistory = history.find(h => h.action === 'revise')?.revision_fields?.fields ?? []

    const fieldsToValidate = (stage === 'revision_hs' && revisionFieldsFromHistory.length > 0)
      ? OJE_INSTORE_SCHEMA.filter(f => f.required && revisionFieldsFromHistory.includes(f.key))
      : OJE_INSTORE_SCHEMA.filter(f => f.required)

    const missingField = fieldsToValidate.find(f => !isFilled(formData[f.key]))
    if (missingField) {
      return showToast(`Field "${missingField.label}" wajib diisi`, 'error')
    }

    setActionLoading(true)
    try {
      const to = nextStage(stage, 'resubmit')

      await supabase.rpc('archive_stage_form', {
        p_candidate_id: id,
        p_stage: stage,
      })
      const { data: nextVer } = await supabase.rpc('next_form_version', {
        p_candidate_id: id,
        p_stage: stage,
      })
      const { error: formErr } = await supabase.from('stage_forms').insert({
        candidate_id: id,
        stage,
        version: nextVer ?? 1,
        form_data: formData,
        is_current: true,
        submitted_by: profile?.id,
      })
      if (formErr) throw new Error('Gagal simpan form: ' + formErr.message)

      const { error: updErr } = await supabase
        .from('candidates')
        .update({ current_stage: to })
        .eq('id', id)
      if (updErr) throw new Error('Gagal update kandidat: ' + updErr.message)

      const { error: histErr } = await supabase.from('stage_history').insert({
        candidate_id: id,
        from_stage: stage,
        to_stage: to,
        action: 'resubmit',
        notes: null,
        performed_by: profile?.id,
      })
      if (histErr) throw new Error('Gagal simpan riwayat: ' + histErr.message)

      showToast(stage === 'revision_hs' ? 'Revisi berhasil dikirim' : 'Form OJE berhasil dikirim', 'success')
      setFormData({})
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Submit aksi generik (review, approve, reject, activate, advance)
  async function submitAction() {
    if (!selectedAction) return
    if (['reject', 'revise'].includes(selectedAction) && !actionNotes.trim()) {
      return showToast('Catatan wajib diisi untuk aksi ini', 'error')
    }
    if (selectedAction === 'revise' && revisionFields.length === 0) {
      return showToast('Pilih setidaknya 1 field yang perlu direvisi', 'error')
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
          },
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

      const updatePayload = { current_stage: to }
      if (selectedAction === 'terminate') updatePayload.status = 'terminated'
      if (selectedAction === 'hold')      updatePayload.status = 'on_hold'
      if (to === 'on_duty')              updatePayload.status = 'on_duty'

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

  const stage = candidate.current_stage
  const statusCfg = STATUS_CONFIG[candidate.status] ?? {}
  const batchSummary = batchItem ? batchResult(batchItem) : null
  const latestInstoreForm = OJE_INSTORE_FORM_STAGES
    .map(s => currentForm?.[s])
    .filter(Boolean)
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0] ?? null
  const currentRevisionFields = history.find(h => h.action === 'revise')?.revision_fields?.fields ?? []
  const latestRejectNote = history.find(h => h.action === 'reject')?.notes ?? null
  const latestReviseNote = history.find(h => h.action === 'revise')?.notes ?? null

  // Stage ini butuh head_store isi form OJE inline
  const isOJEInputStage = ['oje_instore_issued', 'revision_hs'].includes(stage) && allowedActions.includes('resubmit')

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
          <InfoRow label="Stage" value={stageLabel(stage)} />
          {candidate.batch_id && (
            <div className="pt-1">
              <Link to={`/hr/batch/${candidate.batch_id}`} className="text-xs text-primary-600 font-semibold">
                Lihat Batch OJE →
              </Link>
            </div>
          )}
          {['ojt_instore', 'assessment', 'training'].includes(stage) && (
            <div className="pt-1">
              <Link
                to={`/hr/candidates/${id}/ojt`}
                className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg inline-block"
              >
                Buka OJT Checklist →
              </Link>
            </div>
          )}
        </div>
      </SectionPanel>

      {/* Ringkasan Batch OJE */}
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
          </div>
        </SectionPanel>
      )}

      {/* Form OJE in Store — inline input untuk head_store */}
      {isOJEInputStage && (
        <SectionPanel
          title={stage === 'revision_hs' ? 'Revisi Form OJE in Store' : 'Form OJE in Store'}
          className="mx-4 mt-4"
        >
          {/* Notice revisi — tampil saat stage revision_hs */}
          {stage === 'revision_hs' && currentRevisionFields.length > 0 && (
            <div className="mx-4 mb-1 mt-1 rounded-xl bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 mb-1.5">HR Staff minta revisi field berikut:</p>
              <div className="flex flex-wrap gap-1.5">
                {currentRevisionFields.map(f => {
                  const schemaField = OJE_INSTORE_SCHEMA.find(s => s.key === f)
                  return (
                    <span key={f} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      {schemaField?.label ?? f}
                    </span>
                  )
                })}
              </div>
              {latestReviseNote && (
                <p className="text-xs text-amber-600 mt-2">Catatan: {latestReviseNote}</p>
              )}
            </div>
          )}

          <div className="px-4 pb-4 pt-2 space-y-3">
            <p className="text-xs text-slate-500">
              {stage === 'revision_hs'
                ? 'Perbaiki field yang diminta di atas, lalu kirim ulang.'
                : 'Isi hasil observasi kandidat di toko selama 5 hari OJE.'
              }
            </p>

            {(() => {
              let lastCategory = null
              return OJE_INSTORE_SCHEMA
                .filter(f => stage !== 'revision_hs' || currentRevisionFields.includes(f.key))
                .map(f => {
                  const showHeader = f.category && f.category !== lastCategory
                  lastCategory = f.category
                  return (
                    <Fragment key={f.key}>
                      {showHeader && (
                        <div className="mt-3 mb-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                          {OJE_INSTORE_CATEGORIES.find(c => c.key === f.category)?.label}
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-medium text-slate-700 block mb-0.5">{f.label}</label>
                        {f.description && (
                          <p className="text-[11px] text-slate-400 leading-relaxed mb-1">{f.description}</p>
                        )}
                        {f.type === 'attendance' && (
                          <div className="flex gap-2">
                            {['hadir', 'tidak_hadir'].map(val => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, [f.key]: val }))}
                                className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                                  formData[f.key] === val
                                    ? val === 'hadir'
                                      ? 'bg-green-100 text-green-700 border-green-300'
                                      : 'bg-rose-100 text-rose-700 border-rose-300'
                                    : 'bg-white text-slate-500 border-slate-200'
                                }`}
                              >
                                {val === 'hadir' ? 'Hadir' : 'Tidak Hadir'}
                              </button>
                            ))}
                          </div>
                        )}
                        {f.type === 'score' && (
                          <div className="flex gap-1.5">
                            {[1, 2, 3, 4, 5].map(n => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, [f.key]: n }))}
                                className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-colors ${
                                  Number(formData[f.key]) === n
                                    ? 'bg-primary-600 text-white border-primary-600'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        )}
                        {f.type === 'textarea' && (
                          <textarea
                            value={formData[f.key] ?? ''}
                            onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))}
                            className="input resize-none"
                            rows={f.rows ?? 3}
                            placeholder={f.label}
                          />
                        )}
                        {f.type === 'recommendation' && (
                          <div className="flex gap-2">
                            {['lulus', 'tidak_lulus'].map(val => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, [f.key]: val }))}
                                className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                                  formData[f.key] === val
                                    ? val === 'lulus'
                                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                      : 'bg-rose-100 text-rose-700 border-rose-300'
                                    : 'bg-white text-slate-500 border-slate-200'
                                }`}
                              >
                                {val === 'lulus' ? 'Lulus' : 'Tidak Lulus'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </Fragment>
                  )
                })
            })()}

            <LoadingButton
              loading={actionLoading}
              onClick={submitOJEForm}
              className="btn-primary w-full text-sm py-2.5"
            >
              {stage === 'revision_hs' ? 'Kirim Revisi' : 'Kirim Form OJE'}
            </LoadingButton>
          </div>
        </SectionPanel>
      )}

      {/* Form OJE in Store — read-only (untuk reviewer / stage setelah submit) */}
      {latestInstoreForm && !isOJEInputStage && (
        <SectionPanel title="Form OJE in Store" className="mx-4 mt-4">
          <div className="px-4 py-3 space-y-1">
            {OJE_INSTORE_FIELD_SUMMARY.map(f => (
              <InfoRow
                key={f.key}
                label={f.label}
                value={formatInstoreValue(
                  OJE_INSTORE_SCHEMA.find(s => s.key === f.key) ?? {},
                  latestInstoreForm.form_data?.[f.key],
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

      {/* Aksi generik (review, approve, reject, advance, kontrak) */}
      {!isOJEInputStage && allowedActions.length > 0 && candidate.status === 'active' && (
        <SectionPanel title="Aksi" className="mx-4 mt-4">
          {/* Notice untuk hr_staff ketika HR SPV reject */}
          {stage === 'revision_hrstaff' && latestRejectNote && (
            <div className="mx-4 mb-1 mt-1 rounded-xl bg-rose-50 px-4 py-3">
              <p className="text-xs font-semibold text-rose-700 mb-1">HR SPV menolak — pilih langkah berikutnya:</p>
              <p className="text-xs text-rose-600">{latestRejectNote}</p>
            </div>
          )}

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

              {/* Field revision selector — hr_staff minta revisi ke head_store */}
              {selectedAction === 'revise' && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Field yang Perlu Direvisi
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {OJE_INSTORE_SCHEMA.filter(f => f.type !== 'attendance').map(f => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setRevisionFields(prev =>
                          prev.includes(f.key) ? prev.filter(k => k !== f.key) : [...prev, f.key],
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

              {/* Email untuk aktivasi kontrak (hr_legal) */}
              {selectedAction === 'activate' && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Email Kandidat (untuk login akun)
                  </label>
                  <input
                    type="email"
                    value={kontrakEmail}
                    onChange={e => setKontrakEmail(e.target.value)}
                    className="input"
                    placeholder={candidate.email || 'nama@email.com'}
                  />
                  {candidate.email && !kontrakEmail && (
                    <button
                      type="button"
                      onClick={() => setKontrakEmail(candidate.email)}
                      className="text-xs text-primary-600 mt-1 font-medium"
                    >
                      Gunakan email yang sudah ada ({candidate.email})
                    </button>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    Akun dibuat otomatis dengan password shared setelah submit.
                  </p>
                </div>
              )}

              {/* Catatan */}
              {selectedAction && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Catatan {['reject', 'revise'].includes(selectedAction) ? '(wajib)' : '(opsional)'}
                  </label>
                  <textarea
                    value={actionNotes}
                    onChange={e => setActionNotes(e.target.value)}
                    className="input resize-none"
                    rows={3}
                    placeholder="Tulis catatan..."
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAction(false)
                    setSelectedAction(null)
                    setActionNotes('')
                    setRevisionFields([])
                  }}
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

      {/* Timeline riwayat stage */}
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
