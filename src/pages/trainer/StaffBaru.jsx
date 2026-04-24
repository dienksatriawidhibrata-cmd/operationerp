import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  AppIcon, SubpageShell, SectionPanel, SegmentedControl, ToneBadge, EmptyPanel, SoftButton,
  LoadingButton,
} from '../../components/ui/AppKit'
import { todayWIB, fmtDate, downloadCsv } from '../../lib/utils'

const CRITERIA = [
  { id: 'menu',      label: 'Menu Unggulan',           desc: 'Hafal produk makanan/minuman unggulan' },
  { id: 'storage',   label: 'Penyimpanan Bahan Baku',  desc: 'SOP suhu & lokasi penyimpanan' },
  { id: 'sop',       label: 'Alur Pembuatan (SOP)',     desc: 'Ketepatan langkah prep/produksi' },
  { id: 'gap',       label: 'Menu Belum Training',      desc: 'Item yang belum dikuasai (makin sedikit makin baik)' },
  { id: 'closing',   label: 'Alur Operasional Closing', desc: 'Standar kebersihan & laporan malam' },
  { id: 'opening',   label: 'Alur Operasional Opening', desc: 'Kesiapan operasional pagi' },
  { id: 'promo',     label: 'Knowledge Promo',          desc: 'Pemahaman diskon & membership' },
  { id: 'checklist', label: 'Daily Checklist',          desc: 'Kedisiplinan pengisian form' },
]

const SCORE_LABELS = { 1: 'Rendah', 2: 'Cukup', 3: 'Baik' }
const POSITIONS = ['barista', 'waiters', 'kitchen']

function calcStatus(avg) {
  if (avg >= 2.5) return 'Lulus Siap Ke Store'
  if (avg >= 1.7) return 'Training'
  return 'Pertimbangkan'
}

function StatusBadge({ status }) {
  const tones = {
    'Lulus Siap Ke Store': 'ok',
    'Training': 'info',
    'Pertimbangkan': 'warn',
  }
  return <ToneBadge tone={tones[status] || 'slate'}>{status}</ToneBadge>
}

const EMPTY_SCORES = () => CRITERIA.reduce((acc, c) => ({ ...acc, [c.id]: 2 }), {})

export default function StaffBaru() {
  const { profile } = useAuth()
  const today = todayWIB()

  const [view, setView] = useState('list')
  const [rows, setRows] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const [form, setForm] = useState({
    trainee_name: '', position: 'barista', branch_id: '',
    assessment_date: today, notes: '',
    scores: EMPTY_SCORES(),
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [rowsRes, branchRes] = await Promise.all([
      supabase
        .from('trainer_new_staff')
        .select('*, branch:branches(name)')
        .order('assessment_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('branches').select('id, name').order('name'),
    ])
    setRows(rowsRes.data || [])
    setBranches(branchRes.data || [])
    setLoading(false)
  }

  const avgScore = useMemo(() => {
    const vals = Object.values(form.scores)
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }, [form.scores])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const avg = avgScore
    const status = calcStatus(avg)
    const { error } = await supabase.from('trainer_new_staff').insert({
      trainer_id:      profile.id,
      trainee_name:    form.trainee_name.trim(),
      position:        form.position,
      branch_id:       form.branch_id || null,
      assessment_date: form.assessment_date,
      scores:          form.scores,
      avg_score:       avg,
      status,
      action_plan:     status,
      notes:           form.notes.trim() || null,
    })
    setSaving(false)
    if (!error) {
      setForm({ trainee_name: '', position: 'barista', branch_id: '', assessment_date: today, notes: '', scores: EMPTY_SCORES() })
      setView('list')
      fetchData()
    }
  }

  const setScore = (id, val) =>
    setForm(f => ({ ...f, scores: { ...f.scores, [id]: val } }))

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchSearch = !search ||
        r.trainee_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.branch?.name?.toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === 'all' || r.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [rows, search, filterStatus])

  const handleDownload = () => {
    const headers = [
      'Tanggal', 'Nama', 'Posisi', 'Store',
      ...CRITERIA.map(c => c.label),
      'Rata-rata', 'Status', 'Catatan',
    ]
    const data = filtered.map(r => [
      r.assessment_date,
      r.trainee_name,
      r.position,
      r.branch?.name || '',
      ...CRITERIA.map(c => r.scores?.[c.id] ?? ''),
      r.avg_score ?? '',
      r.status ?? '',
      r.notes ?? '',
    ])
    downloadCsv(`laporan-staff-baru-${today}.csv`, headers, data)
  }

  return (
    <SubpageShell
      title="Penilaian Staff Baru"
      subtitle="OJT & Assessment"
      eyebrow="Trainer"
      showBack={false}
      footer={<SmartBottomNav />}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <SegmentedControl
          options={[{ key: 'list', label: 'Daftar' }, { key: 'form', label: '+ Tambah Baru' }]}
          value={view}
          onChange={setView}
        />
        {view === 'list' && rows.length > 0 && (
          <SoftButton tone="white" icon="download" onClick={handleDownload}>
            Unduh CSV
          </SoftButton>
        )}
      </div>

      {view === 'list' ? (
        <>
          {/* Stats row */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[
              { label: 'Total', count: rows.length, tone: 'bg-slate-100 text-slate-700' },
              { label: 'Lulus', count: rows.filter(r => r.status === 'Lulus Siap Ke Store').length, tone: 'bg-emerald-50 text-emerald-700' },
              { label: 'Training', count: rows.filter(r => r.status === 'Training').length, tone: 'bg-primary-50 text-primary-700' },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl px-3 py-2.5 text-center ${s.tone}`}>
                <div className="text-xl font-semibold">{loading ? '—' : s.count}</div>
                <div className="text-[11px] font-medium opacity-80">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              placeholder="Cari nama atau store..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input flex-1"
            />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="input sm:w-48"
            >
              <option value="all">Semua Status</option>
              <option value="Lulus Siap Ke Store">Lulus Siap Ke Store</option>
              <option value="Training">Training</option>
              <option value="Pertimbangkan">Pertimbangkan</option>
            </select>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-slate-400">Memuat data...</div>
          ) : filtered.length === 0 ? (
            <EmptyPanel
              title="Belum ada penilaian"
              description="Tambah penilaian staff baru pertama dengan klik Tambah Baru."
              actionLabel="Tambah Penilaian"
              onAction={() => setView('form')}
            />
          ) : (
            <SectionPanel title={`${filtered.length} Assessees`}>
              <div className="divide-y divide-slate-100">
                {filtered.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{r.trainee_name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                        <span className="capitalize">{r.position}</span>
                        {r.branch?.name && <span>· {r.branch.name}</span>}
                        <span>· {r.assessment_date}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge status={r.status} />
                      <span className="text-xs font-semibold text-slate-600">
                        Avg {Number(r.avg_score).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionPanel>
          )}
        </>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          {/* Basic info */}
          <SectionPanel eyebrow="Data Trainee" title="Informasi Dasar">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Nama Lengkap</label>
                <input
                  required className="input"
                  placeholder="Nama trainee"
                  value={form.trainee_name}
                  onChange={e => setForm(f => ({ ...f, trainee_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Posisi</label>
                <select
                  className="input"
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                >
                  {POSITIONS.map(p => (
                    <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Store OJT</label>
                <select
                  className="input"
                  value={form.branch_id}
                  onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
                >
                  <option value="">Pilih store...</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tanggal Assessment</label>
                <input
                  type="date" className="input"
                  value={form.assessment_date}
                  onChange={e => setForm(f => ({ ...f, assessment_date: e.target.value }))}
                />
              </div>
            </div>
          </SectionPanel>

          {/* Criteria scoring */}
          <SectionPanel eyebrow="Penilaian" title="Skor per Kriteria">
            <div className="space-y-5">
              {CRITERIA.map(c => (
                <div key={c.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-sm font-semibold text-slate-800">{c.label}</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">{c.desc}</p>
                    </div>
                    <ToneBadge tone={form.scores[c.id] === 3 ? 'ok' : form.scores[c.id] === 2 ? 'info' : 'warn'}>
                      {form.scores[c.id]} — {SCORE_LABELS[form.scores[c.id]]}
                    </ToneBadge>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(v => (
                      <button
                        key={v} type="button"
                        onClick={() => setScore(c.id, v)}
                        className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all border ${
                          form.scores[c.id] === v
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {v} · {SCORE_LABELS[v]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionPanel>

          {/* Live preview */}
          <div className={`rounded-2xl border p-4 ${
            calcStatus(avgScore) === 'Lulus Siap Ke Store' ? 'border-emerald-200 bg-emerald-50' :
            calcStatus(avgScore) === 'Training'            ? 'border-primary-200 bg-primary-50' :
                                                             'border-amber-200 bg-amber-50'
          }`}>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">Hasil Sementara</div>
            <div className="text-xl font-semibold">{calcStatus(avgScore)}</div>
            <div className="text-sm opacity-75 mt-0.5">Rata-rata skor: {avgScore.toFixed(2)} / 3.00</div>
          </div>

          <div>
            <label className="label">Catatan (opsional)</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Catatan tambahan untuk trainee ini..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pb-4">
            <LoadingButton
              type="submit" loading={saving}
              className="btn-primary flex-1"
            >
              Simpan Penilaian
            </LoadingButton>
            <button
              type="button"
              onClick={() => setView('list')}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </SubpageShell>
  )
}
