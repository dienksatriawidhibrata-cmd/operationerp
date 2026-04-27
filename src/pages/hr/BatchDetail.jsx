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
import { stageLabel } from '../../lib/recruitment'

const BATCH_CRITERIA = ['disiplin','sikap','behavior','nyapu_ngepel','layout','toilet','stamina','kerja_sama','fokus','subjektif']
const BATCH_LABELS   = ['Disiplin','Sikap','Behavior','Nyapu/Ngepel','Layout','Toilet','Stamina','Kerja Sama','Fokus','Subjektif']

function calcTotal(item) {
  return BATCH_CRITERIA.reduce((s, k) => s + (Number(item[k]) || 0), 0)
}

function hasil(total) {
  if (total >= 24) return { label: 'Lulus', tone: 'ok' }
  if (total >= 18) return { label: 'Dipertimbangkan', tone: 'warn' }
  return { label: 'Gagal', tone: 'danger' }
}

export default function HRBatchDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { showToast } = useToast()

  const [batch, setBatch] = useState(null)
  const [items, setItems] = useState([])
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingItems, setEditingItems] = useState({})
  const [saving, setSaving] = useState(false)

  const role = profile?.role
  const isHRStaff = ['hr_staff','hr_administrator','ops_manager'].includes(role)
  const canUpload = ['head_store','district_manager','hr_staff','hr_administrator','ops_manager'].includes(role)

  useEffect(() => {
    async function load() {
      const [{ data: b }, { data: it }, { data: cands }] = await Promise.all([
        supabase.from('oje_batches')
          .select('*, branches(name, store_id)')
          .eq('id', id)
          .single(),
        supabase.from('oje_batch_items')
          .select('*')
          .eq('batch_id', id)
          .order('sort_order'),
        supabase.from('candidates')
          .select('id, full_name, phone, applied_position, current_stage, status')
          .eq('batch_id', id)
          .order('full_name'),
      ])
      setBatch(b)
      setItems(it ?? [])
      setCandidates(cands ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  function startEdit(item) {
    setEditingItems(prev => ({ ...prev, [item.id]: { ...item } }))
  }

  function updateEdit(itemId, field, value) {
    setEditingItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: Number(value) },
    }))
  }

  async function saveItem(itemId) {
    const edited = editingItems[itemId]
    if (!edited) return

    setSaving(true)
    const { error } = await supabase
      .from('oje_batch_items')
      .update(BATCH_CRITERIA.reduce((acc, k) => ({ ...acc, [k]: edited[k] || 0 }), {}))
      .eq('id', itemId)

    if (error) {
      showToast('Gagal menyimpan: ' + error.message, 'error')
    } else {
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, ...edited } : it))
      setEditingItems(prev => {
        const next = { ...prev }
        delete next[itemId]
        return next
      })
      showToast('Nilai tersimpan', 'success')
    }
    setSaving(false)
  }

  // HR Staff: tandai batch selesai diupload → update candidates ke stage batch_oje_uploaded
  async function markUploaded() {
    if (!window.confirm('Tandai batch ini selesai diisi? Kandidat akan lanjut ke tahap Seleksi.')) return
    setSaving(true)
    const { error } = await supabase
      .from('candidates')
      .update({ current_stage: 'batch_oje_uploaded' })
      .eq('batch_id', id)
      .eq('current_stage', 'batch_oje_issued')

    if (error) {
      showToast('Gagal: ' + error.message, 'error')
    } else {
      setCandidates(prev => prev.map(c =>
        c.current_stage === 'batch_oje_issued'
          ? { ...c, current_stage: 'batch_oje_uploaded' }
          : c
      ))
      showToast('Batch ditandai selesai diisi', 'success')
    }
    setSaving(false)
  }

  // HR Staff: advance kandidat pilihan ke OJE in Store (batch_oje_reviewed)
  async function advanceCandidate(candidateId) {
    const { error } = await supabase
      .from('candidates')
      .update({ current_stage: 'batch_oje_reviewed' })
      .eq('id', candidateId)

    const { error: histErr } = await supabase
      .from('stage_history')
      .insert({
        candidate_id: candidateId,
        from_stage: 'batch_oje_uploaded',
        to_stage: 'batch_oje_reviewed',
        action: 'advance',
        notes: 'Kandidat dipilih lanjut ke OJE in Store',
        performed_by: profile?.id,
      })

    if (error || histErr) {
      showToast('Gagal: ' + (error?.message ?? histErr?.message), 'error')
    } else {
      setCandidates(prev => prev.map(c =>
        c.id === candidateId ? { ...c, current_stage: 'batch_oje_reviewed' } : c
      ))
      showToast('Kandidat dilanjutkan ke OJE in Store', 'success')
    }
  }

  async function terminateCandidate(candidateId) {
    if (!window.confirm('Terminasi kandidat ini dari proses rekrutmen?')) return
    const { error } = await supabase
      .from('candidates')
      .update({ status: 'terminated' })
      .eq('id', candidateId)

    await supabase.from('stage_history').insert({
      candidate_id: candidateId,
      from_stage: candidates.find(c => c.id === candidateId)?.current_stage,
      to_stage: 'terminated',
      action: 'terminate',
      performed_by: profile?.id,
    })

    if (!error) {
      setCandidates(prev => prev.map(c =>
        c.id === candidateId ? { ...c, status: 'terminated' } : c
      ))
      showToast('Kandidat diterminasi', 'success')
    }
  }

  if (loading) {
    return (
      <SubpageShell title="Batch Detail" backTo="/hr/batch">
        <p className="text-xs text-slate-400 px-4 py-6">Memuat...</p>
      </SubpageShell>
    )
  }

  if (!batch) {
    return (
      <SubpageShell title="Batch Detail" backTo="/hr/batch">
        <EmptyPanel message="Batch tidak ditemukan" />
      </SubpageShell>
    )
  }

  const uploadedCandidates = candidates.filter(c => c.current_stage === 'batch_oje_uploaded')
  const allUploaded = candidates.length > 0 && candidates.every(c =>
    c.current_stage !== 'batch_oje_issued'
  )

  return (
    <SubpageShell
      title={batch.branches?.name ?? 'Batch Detail'}
      eyebrow={fmtDate(batch.batch_date)}
      backTo="/hr/batch"
    >
      {/* Info batch */}
      <SectionPanel className="mx-4 mt-4">
        <div className="px-4 py-3 space-y-1">
          <InfoRow label="Toko" value={batch.branches?.name} />
          <InfoRow label="Tanggal" value={fmtDate(batch.batch_date)} />
          {batch.evaluator_name && <InfoRow label="Evaluator" value={batch.evaluator_name} />}
          {batch.notes && <InfoRow label="Catatan" value={batch.notes} />}
          <InfoRow label="Jumlah Kandidat" value={candidates.length} />
        </div>
      </SectionPanel>

      {/* Nilai per peserta */}
      <SectionPanel title="Nilai Batch OJE" className="mx-4 mt-4">
        {items.length === 0 ? (
          <EmptyPanel message="Belum ada peserta" />
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(item => {
              const isEditing = !!editingItems[item.id]
              const current = isEditing ? editingItems[item.id] : item
              const total = calcTotal(current)
              const { label, tone } = hasil(total)

              return (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-semibold text-slate-800">{item.nama_peserta}</span>
                      {item.nama_panggilan && (
                        <span className="text-xs text-slate-400 ml-1">({item.nama_panggilan})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">{total}/30</span>
                      <ToneBadge tone={tone} label={label} />
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {BATCH_CRITERIA.map((k, i) => (
                          <div key={k} className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">{BATCH_LABELS[i]}</span>
                            <input
                              type="number"
                              min={0}
                              max={3}
                              value={current[k] || 0}
                              onChange={e => updateEdit(item.id, k, e.target.value)}
                              className="w-12 text-center border border-slate-200 rounded-lg text-xs py-1"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setEditingItems(prev => { const n = {...prev}; delete n[item.id]; return n })}
                          className="flex-1 text-xs bg-slate-100 text-slate-700 rounded-lg py-1.5 font-semibold"
                        >
                          Batal
                        </button>
                        <LoadingButton
                          loading={saving}
                          onClick={() => saveItem(item.id)}
                          className="flex-1 btn-primary text-xs py-1.5"
                        >
                          Simpan
                        </LoadingButton>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {BATCH_CRITERIA.map((k, i) => (
                        <span key={k} className="text-xs bg-slate-50 text-slate-600 rounded px-1.5 py-0.5">
                          {BATCH_LABELS[i]}: <strong>{item[k] || 0}</strong>
                        </span>
                      ))}
                      {canUpload && (
                        <button
                          onClick={() => startEdit(item)}
                          className="text-xs text-primary-600 font-semibold ml-1"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Tandai selesai upload */}
        {canUpload && !allUploaded && candidates.some(c => c.current_stage === 'batch_oje_issued') && (
          <div className="px-4 pb-3">
            <LoadingButton loading={saving} onClick={markUploaded} className="w-full btn-primary text-sm py-2.5">
              Tandai Batch Selesai Diisi
            </LoadingButton>
          </div>
        )}
      </SectionPanel>

      {/* Seleksi kandidat (hr_staff setelah batch terupload) */}
      {isHRStaff && uploadedCandidates.length > 0 && (
        <SectionPanel title="Seleksi Kandidat Lanjut" className="mx-4 mt-4">
          <p className="text-xs text-slate-500 px-4 pt-2 pb-1">
            Pilih kandidat yang lanjut ke OJE in Store. Yang tidak dipilih bisa diterminasi.
          </p>
          <div className="divide-y divide-slate-100">
            {uploadedCandidates.map(c => {
              const item = items.find(it => it.nama_peserta === c.full_name)
              const total = item ? calcTotal(item) : 0
              const { label, tone } = hasil(total)
              return (
                <div key={c.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{c.full_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{c.applied_position}</span>
                      <ToneBadge tone={tone} label={`${total}/30 ${label}`} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => advanceCandidate(c.id)}
                      className="text-xs bg-green-100 text-green-700 font-semibold rounded-lg px-2.5 py-1.5"
                    >
                      Lanjutkan
                    </button>
                    <button
                      onClick={() => terminateCandidate(c.id)}
                      className="text-xs bg-rose-100 text-rose-700 font-semibold rounded-lg px-2.5 py-1.5"
                    >
                      Terminasi
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </SectionPanel>
      )}

      {/* Semua kandidat batch */}
      <SectionPanel title="Kandidat Batch Ini" className="mx-4 mt-4 mb-24">
        {candidates.length === 0 ? (
          <EmptyPanel message="Belum ada kandidat" />
        ) : (
          <div className="divide-y divide-slate-100">
            {candidates.map(c => (
              <Link
                key={c.id}
                to={`/hr/candidates/${c.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-800">{c.full_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{c.phone} · {c.applied_position}</div>
                </div>
                <div className="flex items-center gap-2">
                  {c.status === 'terminated' ? (
                    <ToneBadge tone="danger" label="Terminasi" />
                  ) : (
                    <ToneBadge tone="info" label={stageLabel(c.current_stage)} />
                  )}
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </Link>
            ))}
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
