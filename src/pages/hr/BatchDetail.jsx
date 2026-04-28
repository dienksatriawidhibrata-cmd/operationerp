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

function isHadir(item) {
  return item.hadir !== false
}

function calcTotal(item) {
  if (!isHadir(item)) return 0
  return BATCH_CRITERIA.reduce((s, k) => s + (Number(item[k]) || 0), 0)
}

function hasil(total, hadir) {
  if (!hadir) return { label: 'Tidak Hadir', tone: 'danger' }
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

  async function toggleHadir(item) {
    const newHadir = !isHadir(item)
    const { error } = await supabase
      .from('oje_batch_items')
      .update({
        hadir: newHadir,
        // Reset semua nilai ke 0 kalau tidak hadir
        ...(newHadir ? {} : BATCH_CRITERIA.reduce((acc, k) => ({ ...acc, [k]: 0 }), {})),
      })
      .eq('id', item.id)

    if (error) {
      showToast('Gagal update kehadiran: ' + error.message, 'error')
    } else {
      setItems(prev => prev.map(it =>
        it.id === item.id
          ? { ...it, hadir: newHadir, ...(newHadir ? {} : BATCH_CRITERIA.reduce((acc, k) => ({ ...acc, [k]: 0 }), {})) }
          : it
      ))
      // Batalkan edit mode kalau sedang edit
      setEditingItems(prev => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
    }
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

  // Tandai batch selesai: advance yang hadir → batch_oje_uploaded,
  // terminate yang tidak hadir (otomatis)
  async function markUploaded() {
    const tidakHadirItems = items.filter(it => !it.hadir)
    const tidakHadirNames = new Set(tidakHadirItems.map(it => it.nama_peserta))

    const hadirCandidates  = candidates.filter(c => c.current_stage === 'batch_oje_issued' && !tidakHadirNames.has(c.full_name))
    const absenCandidates  = candidates.filter(c => c.current_stage === 'batch_oje_issued' && tidakHadirNames.has(c.full_name))

    const absenCount = absenCandidates.length
    const msg = absenCount > 0
      ? `Tandai batch selesai?\n${hadirCandidates.length} kandidat lanjut ke seleksi.\n${absenCount} kandidat tidak hadir akan otomatis diterminasi.`
      : 'Tandai batch ini selesai diisi? Semua kandidat akan lanjut ke tahap Seleksi.'

    if (!window.confirm(msg)) return
    setSaving(true)

    try {
      // Advance kandidat yang hadir
      if (hadirCandidates.length > 0) {
        const { error } = await supabase
          .from('candidates')
          .update({ current_stage: 'batch_oje_uploaded' })
          .in('id', hadirCandidates.map(c => c.id))
        if (error) throw error
      }

      // Terminate kandidat tidak hadir
      if (absenCandidates.length > 0) {
        const { error } = await supabase
          .from('candidates')
          .update({ status: 'terminated' })
          .in('id', absenCandidates.map(c => c.id))
        if (error) throw error

        // Insert stage_history untuk setiap terminasi
        await supabase.from('stage_history').insert(
          absenCandidates.map(c => ({
            candidate_id: c.id,
            from_stage: 'batch_oje_issued',
            to_stage: 'terminated',
            action: 'terminate',
            notes: 'Tidak hadir saat OJE Batch',
            performed_by: profile?.id,
          }))
        )
      }

      setCandidates(prev => prev.map(c => {
        if (hadirCandidates.find(h => h.id === c.id))  return { ...c, current_stage: 'batch_oje_uploaded' }
        if (absenCandidates.find(a => a.id === c.id))  return { ...c, status: 'terminated' }
        return c
      }))

      const msg2 = absenCount > 0
        ? `Batch selesai. ${absenCount} kandidat tidak hadir diterminasi.`
        : 'Batch ditandai selesai diisi'
      showToast(msg2, 'success')
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
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
  const tidakHadirCount = items.filter(it => !it.hadir).length

  // Kandidat yang sudah melewati fase batch (lanjut ke OJE in Store atau lebih jauh)
  const BATCH_STAGES = new Set(['batch_oje_issued', 'batch_oje_uploaded', 'batch_oje_reviewed'])
  function isAdvancedToOjeInstore(cand) {
    return cand && cand.status !== 'terminated' && !BATCH_STAGES.has(cand.current_stage)
  }

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
          <InfoRow label="Jumlah Peserta" value={items.length} />
          {tidakHadirCount > 0 && (
            <InfoRow label="Tidak Hadir" value={`${tidakHadirCount} orang`} />
          )}
        </div>
      </SectionPanel>

      {/* Nilai per peserta */}
      <SectionPanel title="Nilai Batch OJE" className="mx-4 mt-4">
        {allUploaded && (
          <div className="px-4 pt-3 pb-1">
            <div className="rounded-xl bg-blue-50 px-4 py-2.5">
              <p className="text-xs font-semibold text-blue-700">Batch selesai — penilaian dikunci</p>
              <p className="text-xs text-blue-600 mt-0.5">Seleksi kandidat lanjut di bagian bawah halaman.</p>
            </div>
          </div>
        )}
        {items.length === 0 ? (
          <EmptyPanel message="Belum ada peserta" />
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(item => {
              const isEditing = !!editingItems[item.id]
              const current = isEditing ? editingItems[item.id] : item
              const total = calcTotal(current)
              const hadirFlag = isHadir(item)
              const { label, tone } = hasil(total, hadirFlag)
              const linkedCand = candidates.find(c => c.full_name === item.nama_peserta)
              const advanced = isAdvancedToOjeInstore(linkedCand)

              return (
                <div key={item.id} className={`px-4 py-3 ${!hadirFlag ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-semibold text-slate-800">{item.nama_peserta}</span>
                      {item.nama_panggilan && (
                        <span className="text-xs text-slate-400 ml-1">({item.nama_panggilan})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {hadirFlag && !advanced && (
                        <span className="text-xs font-bold text-slate-700">{total}/30</span>
                      )}
                      <ToneBadge tone={tone} label={label} />
                    </div>
                  </div>

                  {/* Kandidat yang sudah lanjut ke OJE in Store — form ini tidak berlaku lagi */}
                  {advanced && linkedCand && (
                    <div className="bg-blue-50 rounded-lg px-3 py-2 mb-2">
                      <p className="text-xs text-blue-700 font-semibold mb-1">
                        Penilaian dilanjutkan ke OJE in Store
                      </p>
                      <p className="text-xs text-blue-600 mb-1">
                        Form batch ini sudah dikunci. Gunakan halaman kandidat untuk penilaian OJE in Store.
                      </p>
                      <Link
                        to={`/hr/candidates/${linkedCand.id}`}
                        className="text-xs text-primary-600 font-semibold underline"
                      >
                        Buka Form OJE in Store →
                      </Link>
                    </div>
                  )}

                  {/* Toggle kehadiran — hanya jika belum advance dan batch belum dikunci */}
                  {canUpload && !advanced && !allUploaded && (
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => toggleHadir(item)}
                        className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
                          hadirFlag
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-rose-50 text-rose-600 border-rose-200'
                        }`}
                      >
                        {hadirFlag ? '✓ Hadir' : '✗ Tidak Hadir'}
                      </button>
                      <span className="text-xs text-slate-400">Klik untuk ubah</span>
                    </div>
                  )}

                  {/* Nilai editable — hanya saat batch belum dikunci */}
                  {hadirFlag && !advanced && !allUploaded && (
                    isEditing ? (
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
                    )
                  )}

                  {/* Nilai read-only — batch sudah dikunci, kandidat belum ke OJE in Store */}
                  {hadirFlag && !advanced && allUploaded && (
                    <div className="flex flex-wrap gap-1">
                      {BATCH_CRITERIA.map((k, i) => (
                        <span key={k} className="text-xs bg-slate-50 text-slate-400 rounded px-1.5 py-0.5">
                          {BATCH_LABELS[i]}: <strong>{item[k] || 0}</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Nilai read-only untuk kandidat yang sudah advance */}
                  {hadirFlag && advanced && (
                    <div className="flex flex-wrap gap-1">
                      {BATCH_CRITERIA.map((k, i) => (
                        <span key={k} className="text-xs bg-slate-50 text-slate-400 rounded px-1.5 py-0.5">
                          {BATCH_LABELS[i]}: <strong>{item[k] || 0}</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Peserta tidak hadir — tampil keterangan */}
                  {!hadirFlag && (
                    <p className="text-xs text-slate-400 italic">Tidak hadir — tidak dinilai</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Tandai selesai upload */}
        {canUpload && !allUploaded && candidates.some(c => c.current_stage === 'batch_oje_issued') && (
          <div className="px-4 pb-3">
            {tidakHadirCount > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-2">
                {tidakHadirCount} peserta tidak hadir akan otomatis diterminasi saat batch diselesaikan.
              </p>
            )}
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
              const { label, tone } = hasil(total, item?.hadir ?? true)
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
