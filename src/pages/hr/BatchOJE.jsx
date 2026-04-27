import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  SubpageShell, SectionPanel, LoadingButton, EmptyPanel,
} from '../../components/ui/AppKit'
import { SmartBottomNav } from '../../components/BottomNav'
import { fmtDate, todayWIB } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'

const POSITIONS = ['barista', 'kitchen', 'waitress', 'staff', 'asst_head_store']

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

  // State untuk kandidat yang ditambah ke batch sebelum submit
  const [candidates, setCandidates] = useState([
    { full_name: '', phone: '', email: '', applied_position: 'barista' },
  ])

  useEffect(() => {
    async function load() {
      const [{ data: b }, { data: br }] = await Promise.all([
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
      setBatches(b ?? [])
      setBranches(br ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function addCandidate() {
    setCandidates(prev => [...prev, { full_name: '', phone: '', email: '', applied_position: 'barista' }])
  }

  function removeCandidate(idx) {
    setCandidates(prev => prev.filter((_, i) => i !== idx))
  }

  function updateCandidate(idx, field, value) {
    setCandidates(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.branch_id) return showToast('Pilih toko terlebih dahulu', 'error')
    const valid = candidates.every(c => c.full_name.trim() && c.phone.trim() && c.email.trim())
    if (!valid) return showToast('Nama, nomor HP, dan email semua kandidat wajib diisi', 'error')

    setSaving(true)
    try {
      // 1. Buat oje_batch
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

      // 2. Buat candidates dan hubungkan ke batch
      const candidateRows = candidates.map(c => ({
        full_name: c.full_name.trim(),
        phone: c.phone.trim(),
        email: c.email.trim(),
        applied_position: c.applied_position,
        branch_id: form.branch_id,
        batch_id: batch.id,
        current_stage: 'batch_oje_issued',
        status: 'active',
        created_by: profile?.id,
      }))

      const { error: candErr } = await supabase.from('candidates').insert(candidateRows)
      if (candErr) throw candErr

      // 3. Insert oje_batch_items (satu per kandidat, nilai awal 0)
      const batchItems = candidates.map((c, idx) => ({
        batch_id: batch.id,
        nama_peserta: c.full_name.trim(),
        nama_panggilan: '',
        sort_order: idx,
      }))

      await supabase.from('oje_batch_items').insert(batchItems)

      showToast(`Batch OJE dibuat — ${candidates.length} kandidat`, 'success')
      navigate(`/hr/batch/${batch.id}`)
    } catch (err) {
      console.error(err)
      showToast('Gagal membuat batch: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SubpageShell title="Batch OJE" eyebrow="HR · Recruitment" backTo="/hr">
      {/* Tombol buat batch baru */}
      {!showForm && (
        <div className="px-4 pt-4">
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-primary-600 text-white text-sm font-semibold rounded-xl py-3"
          >
            + Buat Batch OJE Baru
          </button>
        </div>
      )}

      {/* Form buat batch */}
      {showForm && (
        <SectionPanel title="Batch OJE Baru" className="mx-4 mt-4">
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Tanggal Batch</label>
              <input
                type="date"
                value={form.batch_date}
                onChange={e => setForm(f => ({ ...f, batch_date: e.target.value }))}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Toko Target</label>
              <select
                value={form.branch_id}
                onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
                className="input-field"
                required
              >
                <option value="">-- Pilih Toko --</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Catatan (opsional)</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="input-field"
                rows={2}
                placeholder="Catatan batch OJE..."
              />
            </div>

            {/* Daftar kandidat */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-600">Kandidat</label>
                <button
                  type="button"
                  onClick={addCandidate}
                  className="text-xs text-primary-600 font-semibold"
                >
                  + Tambah
                </button>
              </div>
              <div className="space-y-3">
                {candidates.map((c, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">Kandidat {idx + 1}</span>
                      {candidates.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCandidate(idx)}
                          className="text-xs text-rose-500 font-semibold"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Nama lengkap"
                      value={c.full_name}
                      onChange={e => updateCandidate(idx, 'full_name', e.target.value)}
                      className="input-field"
                      required
                    />
                    <input
                      type="tel"
                      placeholder="Nomor HP"
                      value={c.phone}
                      onChange={e => updateCandidate(idx, 'phone', e.target.value)}
                      className="input-field"
                      required
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={c.email}
                      onChange={e => updateCandidate(idx, 'email', e.target.value)}
                      className="input-field"
                      required
                    />
                    <select
                      value={c.applied_position}
                      onChange={e => updateCandidate(idx, 'applied_position', e.target.value)}
                      className="input-field"
                    >
                      {POSITIONS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl py-2.5"
              >
                Batal
              </button>
              <LoadingButton loading={saving} className="flex-1 btn-primary text-sm py-2.5">
                Buat Batch
              </LoadingButton>
            </div>
          </form>
        </SectionPanel>
      )}

      {/* Daftar batch existing */}
      <SectionPanel title="Riwayat Batch OJE" className="mx-4 mt-4 mb-24">
        {loading ? (
          <p className="text-xs text-slate-400 px-4 py-3">Memuat...</p>
        ) : batches.length === 0 ? (
          <EmptyPanel message="Belum ada batch OJE" />
        ) : (
          <div className="divide-y divide-slate-100">
            {batches.map(b => (
              <Link
                key={b.id}
                to={`/hr/batch/${b.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    {b.branches?.name ?? '-'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {fmtDate(b.batch_date)}
                    {b.evaluator_name && ` · ${b.evaluator_name}`}
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </SectionPanel>

      <SmartBottomNav />
    </SubpageShell>
  )
}
