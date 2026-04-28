import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  AppIcon,
  EmptyPanel,
  HeroCard,
  InlineStat,
  LoadingButton,
  SectionPanel,
  ToneBadge,
} from '../../components/ui/AppKit'
import { todayWIB } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { POSITION_LABELS } from '../../lib/recruitment'

const POSITIONS = ['barista', 'kitchen', 'waitress', 'staff', 'asst_head_store']

function blankCandidate() {
  return { full_name: '', phone: '', email: '', applied_position: 'barista' }
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default function HRBatchOJE() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [batches, setBatches] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    batch_date: todayWIB(),
    branch_id: '',
    notes: '',
  })
  const [candidates, setCandidates] = useState([blankCandidate()])

  useEffect(() => {
    async function load() {
      const [{ data: batchRows }, { data: branchRows }] = await Promise.all([
        supabase
          .from('oje_batches')
          .select('id, batch_date, notes, branches(name), created_at, evaluator_name')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('branches')
          .select('id, name, store_id')
          .eq('is_active', true)
          .order('name'),
      ])

      setBatches(batchRows || [])
      setBranches(branchRows || [])
      setLoading(false)
    }
    load()
  }, [])

  const validCandidateCount = useMemo(
    () => candidates.filter((candidate) => candidate.full_name.trim() || candidate.phone.trim() || candidate.email.trim()).length,
    [candidates],
  )

  function addCandidate() {
    setCandidates((current) => [...current, blankCandidate()])
  }

  function removeCandidate(index) {
    setCandidates((current) => current.filter((_, idx) => idx !== index))
  }

  function updateCandidate(index, field, value) {
    setCandidates((current) => current.map((candidate, idx) => (
      idx === index ? { ...candidate, [field]: value } : candidate
    )))
  }

  function resetForm() {
    setForm({
      batch_date: todayWIB(),
      branch_id: '',
      notes: '',
    })
    setCandidates([blankCandidate()])
    setShowForm(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!form.branch_id) return showToast('Pilih toko terlebih dahulu', 'error')
    const valid = candidates.every((candidate) => candidate.full_name.trim() && candidate.phone.trim() && candidate.email.trim())
    if (!valid) return showToast('Nama, nomor HP, dan email semua kandidat wajib diisi', 'error')

    setSaving(true)
    try {
      const { data: batch, error: batchErr } = await supabase
        .from('oje_batches')
        .insert({
          batch_date: form.batch_date,
          branch_id: form.branch_id,
          evaluator_name: profile?.full_name,
          evaluator_id: profile?.id,
          notes: form.notes || null,
          created_by: profile?.id,
        })
        .select('id')
        .single()

      if (batchErr) throw batchErr

      const candidateRows = candidates.map((candidate) => ({
        full_name: candidate.full_name.trim(),
        phone: candidate.phone.trim(),
        email: candidate.email.trim(),
        applied_position: candidate.applied_position,
        branch_id: form.branch_id,
        batch_id: batch.id,
        current_stage: 'batch_oje_issued',
        status: 'active',
        created_by: profile?.id,
      }))

      const { error: candidateErr } = await supabase.from('candidates').insert(candidateRows)
      if (candidateErr) throw candidateErr

      const batchItems = candidates.map((candidate, index) => ({
        batch_id: batch.id,
        nama_peserta: candidate.full_name.trim(),
        nama_panggilan: '',
        sort_order: index,
      }))

      const { error: itemsErr } = await supabase.from('oje_batch_items').insert(batchItems)
      if (itemsErr) throw itemsErr

      showToast(`Batch OJE dibuat untuk ${candidates.length} kandidat`, 'success')
      navigate(`/hr/batch/${batch.id}`)
    } catch (err) {
      console.error(err)
      showToast('Gagal membuat batch: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-28">
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-blue-50 bg-white/85 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            to="/hr"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
          >
            <AppIcon name="chevronLeft" size={18} />
          </Link>
          <div>
            <h1 className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Recruitment</h1>
            <p className="text-lg font-extrabold text-gray-900">Batch OJE</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5">
        <HeroCard
          eyebrow="Batch Control"
          title="Buat batch lalu lanjut ke scorecard"
          description="Pola kerjanya disederhanakan: buat batch, isi kandidat, lalu langsung pindah ke halaman detail batch untuk penilaian dan seleksi."
          meta={(
            <>
              <ToneBadge tone="info">{batches.length} riwayat batch</ToneBadge>
              <ToneBadge tone={showForm ? 'warn' : 'ok'}>{showForm ? 'Form aktif' : 'Siap buat batch'}</ToneBadge>
            </>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <InlineStat label="Riwayat Batch" value={batches.length} tone="primary" />
            <InlineStat label="Toko Aktif" value={branches.length} tone="slate" />
            <InlineStat label="Draft Kandidat" value={validCandidateCount} tone={validCandidateCount > 0 ? 'amber' : 'slate'} />
          </div>
        </HeroCard>

        <SectionPanel
          className="mt-6"
          eyebrow="Create Batch"
          title={showForm ? 'Form Batch OJE Baru' : 'Mulai Batch Baru'}
          description={showForm ? 'Lengkapi data batch dan semua kandidat yang akan ikut sesi ini.' : 'Tekan tombol di bawah untuk membuat batch baru.'}
          actions={
            !showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Buat Batch Baru
              </button>
            ) : (
              <ToneBadge tone="warn">{candidates.length} kandidat</ToneBadge>
            )
          }
        >
          {!showForm ? (
            <EmptyPanel
              title="Belum ada draft batch"
              description="Mulai dari sini kalau HR sedang menyiapkan sesi batch OJE baru."
              actionLabel="Buat Batch OJE"
              onAction={() => setShowForm(true)}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Tanggal Batch</label>
                  <input
                    type="date"
                    value={form.batch_date}
                    onChange={(event) => setForm((current) => ({ ...current, batch_date: event.target.value }))}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Toko Target</label>
                  <select
                    value={form.branch_id}
                    onChange={(event) => setForm((current) => ({ ...current, branch_id: event.target.value }))}
                    className="input"
                    required
                  >
                    <option value="">Pilih toko</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Catatan Batch</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="input resize-none"
                  placeholder="Catatan sesi batch, evaluator, atau kebutuhan khusus."
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Daftar Kandidat</div>
                    <div className="text-xs text-slate-500">Nama, nomor HP, email, dan posisi wajib diisi untuk semua peserta.</div>
                  </div>
                  <button
                    type="button"
                    onClick={addCandidate}
                    className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100"
                  >
                    + Tambah Kandidat
                  </button>
                </div>

                <div className="space-y-3">
                  {candidates.map((candidate, index) => (
                    <div key={index} className="rounded-[22px] bg-slate-50/85 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">Kandidat {index + 1}</div>
                        {candidates.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCandidate(index)}
                            className="text-xs font-semibold text-rose-600"
                          >
                            Hapus
                          </button>
                        )}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          type="text"
                          value={candidate.full_name}
                          onChange={(event) => updateCandidate(index, 'full_name', event.target.value)}
                          className="input"
                          placeholder="Nama lengkap"
                          required
                        />
                        <input
                          type="tel"
                          value={candidate.phone}
                          onChange={(event) => updateCandidate(index, 'phone', event.target.value)}
                          className="input"
                          placeholder="Nomor HP"
                          required
                        />
                        <input
                          type="email"
                          value={candidate.email}
                          onChange={(event) => updateCandidate(index, 'email', event.target.value)}
                          className="input"
                          placeholder="Email"
                          required
                        />
                        <select
                          value={candidate.applied_position}
                          onChange={(event) => updateCandidate(index, 'applied_position', event.target.value)}
                          className="input"
                        >
                          {POSITIONS.map((position) => (
                            <option key={position} value={position}>{POSITION_LABELS[position] || position}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-slate-300"
                >
                  Batal
                </button>
                <LoadingButton
                  type="submit"
                  loading={saving}
                  className="btn-primary flex-1"
                >
                  Simpan dan Buka Batch Detail
                </LoadingButton>
              </div>
            </form>
          )}
        </SectionPanel>

        <SectionPanel
          className="mt-6 mb-2"
          eyebrow="Batch History"
          title="Riwayat Batch OJE"
          description="Buka batch untuk lanjut isi scorecard atau meninjau sesi yang sudah pernah dibuat."
          actions={<ToneBadge tone="info">{batches.length} batch</ToneBadge>}
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : batches.length === 0 ? (
            <EmptyPanel
              title="Belum ada batch"
              description="Riwayat batch akan muncul setelah sesi pertama dibuat."
            />
          ) : (
            <div className="space-y-2">
              {batches.map((batch) => (
                <Link
                  key={batch.id}
                  to={`/hr/batch/${batch.id}`}
                  className="flex items-center gap-3 rounded-[20px] bg-slate-50/85 px-4 py-3 transition-colors hover:bg-slate-100"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <AppIcon name="checklist" size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">{batch.branches?.name || '-'}</div>
                    <div className="truncate text-xs text-slate-500">
                      {formatDate(batch.batch_date)} · {batch.evaluator_name || '-'}
                    </div>
                  </div>
                  <AppIcon name="chevronRight" size={16} className="text-slate-400" />
                </Link>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>

      <SmartBottomNav />
    </div>
  )
}
