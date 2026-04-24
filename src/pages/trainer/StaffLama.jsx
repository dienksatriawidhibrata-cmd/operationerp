import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  AppIcon, SubpageShell, SectionPanel, SegmentedControl, ToneBadge, EmptyPanel, SoftButton,
  LoadingButton,
} from '../../components/ui/AppKit'
import { todayWIB, downloadCsv } from '../../lib/utils'

// ─── Config ────────────────────────────────────────────────────────────────

const PERF_CRITERIA = {
  head_store: [
    { id: 'biz_acumen',  label: 'Business Acumen' },
    { id: 'financial',   label: 'Financial Management' },
    { id: 'compliance',  label: 'Compliance & Risk' },
    { id: 'leadership',  label: 'Leadership' },
    { id: 'people',      label: 'People Management' },
    { id: 'strategic',   label: 'Strategic Planning' },
    { id: 'pnl',         label: 'PNL' },
  ],
  asst_head_store: [
    { id: 'kalibrasi',   label: 'Tes Kalibrasi' },
    { id: 'pos',         label: 'Tes POS' },
    { id: 'spreadsheet', label: 'Spreadsheet' },
    { id: 'opex',        label: 'OPEX' },
    { id: 'leadership',  label: 'Leadership' },
    { id: 'forecast',    label: 'Forecast' },
    { id: 'sales',       label: 'Sales' },
    { id: 'hpp',         label: 'HPP' },
    { id: 'budgeting',   label: 'Budgeting' },
  ],
  staff: [
    { id: 'menu_minum',  label: 'Tes Menu Minuman' },
    { id: 'menu_makan',  label: 'Tes Menu Makanan' },
    { id: 'sop',         label: 'Tes SOP' },
    { id: 'kalibrasi',   label: 'Kelas Kalibrasi' },
    { id: 'scheduling',  label: 'Scheduling' },
    { id: 'leadership',  label: 'Leadership' },
  ],
}

const POT_CRITERIA = [
  { id: 'agile',      label: 'Agile' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'learning',   label: 'Learning' },
]

const SCORE_LABELS = { 1: 'Rendah', 2: 'Cukup', 3: 'Baik' }

const POSITIONS = [
  { value: 'head_store',       label: 'Head Store' },
  { value: 'asst_head_store',  label: 'Asst. Head Store' },
  { value: 'staff',            label: 'Staff' },
]

function calcLevel(avg) {
  if (avg >= 2.5) return 'High'
  if (avg >= 1.7) return 'Moderate'
  return 'Low'
}

// Key: `${potLevel}-${perfLevel}` matching the 9-box layout
const MATRIX = {
  'High-High':         { label: 'Consistent Star',     action: 'Stretch / Renggangkan',          bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  'High-Moderate':     { label: 'Future Star',          action: 'Stretch & Develop',              bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-400' },
  'High-Low':          { label: 'Rough Diamond',        action: 'Develop / Pengembangan',         bg: 'bg-sky-50',      text: 'text-sky-700',     dot: 'bg-sky-400'     },
  'Moderate-High':     { label: 'Current Star',         action: 'Stretch & Develop',              bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-400'    },
  'Moderate-Moderate': { label: 'Key Player',           action: 'Develop / Pengembangan',         bg: 'bg-blue-50',     text: 'text-blue-600',    dot: 'bg-blue-300'    },
  'Moderate-Low':      { label: 'Inconsistent Player',  action: 'Observe / Mengamati',            bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400'   },
  'Low-High':          { label: 'High Professional',    action: 'Causes Analysis & Develop',      bg: 'bg-orange-50',   text: 'text-orange-700',  dot: 'bg-orange-400'  },
  'Low-Moderate':      { label: 'Solid Professional',   action: 'Improve Performance',            bg: 'bg-orange-50',   text: 'text-orange-600',  dot: 'bg-orange-300'  },
  'Low-Low':           { label: 'Talent Risk',          action: 'Reassign / Exit',               bg: 'bg-rose-50',     text: 'text-rose-700',    dot: 'bg-rose-400'    },
}

function getQuadrant(potAvg, perfAvg) {
  const pot  = calcLevel(potAvg)
  const perf = calcLevel(perfAvg)
  return { key: `${pot}-${perf}`, ...MATRIX[`${pot}-${perf}`] }
}

function emptyPerfScores(position) {
  return (PERF_CRITERIA[position] || []).reduce((acc, c) => ({ ...acc, [c.id]: 2 }), {})
}

function emptyPotScores() {
  return POT_CRITERIA.reduce((acc, c) => ({ ...acc, [c.id]: 2 }), {})
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function StaffLama() {
  const { profile } = useAuth()
  const today = todayWIB()

  const [tab, setTab]         = useState('matrix')
  const [rows, setRows]       = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
  const [filterPos, setFilterPos] = useState('all')
  const [selectedCell, setSelectedCell] = useState(null)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    employee_name: '', nip: '', position: 'head_store', branch_id: '',
    assessment_date: today,
    perf_scores: emptyPerfScores('head_store'),
    pot_scores:  emptyPotScores(),
  })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const [rowsRes, branchRes] = await Promise.all([
      supabase
        .from('trainer_existing_staff')
        .select('*, branch:branches(name)')
        .order('assessment_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('branches').select('id, name').order('name'),
    ])
    setRows(rowsRes.data || [])
    setBranches(branchRes.data || [])
    setLoading(false)
  }

  const perfAvg = useMemo(() => {
    const criteria = PERF_CRITERIA[form.position] || []
    if (!criteria.length) return 0
    const vals = criteria.map(c => form.perf_scores[c.id] ?? 2)
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }, [form.perf_scores, form.position])

  const potAvg = useMemo(() => {
    const vals = POT_CRITERIA.map(c => form.pot_scores[c.id] ?? 2)
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }, [form.pot_scores])

  const liveQuadrant = useMemo(() => getQuadrant(potAvg, perfAvg), [potAvg, perfAvg])

  const handlePositionChange = (pos) => {
    setForm(f => ({
      ...f,
      position: pos,
      perf_scores: emptyPerfScores(pos),
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const quadrant = getQuadrant(potAvg, perfAvg)
    const payload = {
      employee_name:   form.employee_name.trim(),
      nip:             form.nip.trim() || null,
      position:        form.position,
      branch_id:       form.branch_id || null,
      assessment_date: form.assessment_date,
      perf_scores:     form.perf_scores,
      perf_avg:        perfAvg,
      pot_scores:      form.pot_scores,
      pot_avg:         potAvg,
      quadrant:        quadrant.label,
      recommendation:  quadrant.action,
    }

    const { error } = editingId
      ? await supabase.from('trainer_existing_staff').update(payload).eq('id', editingId)
      : await supabase.from('trainer_existing_staff').insert({ ...payload, trainer_id: profile.id })

    setSaving(false)
    if (!error) {
      setForm({
        employee_name: '', nip: '', position: 'head_store', branch_id: '',
        assessment_date: today,
        perf_scores: emptyPerfScores('head_store'),
        pot_scores: emptyPotScores(),
      })
      setEditingId(null)
      setTab('matrix')
      fetchData()
    }
  }

  const handleEdit = (row) => {
    setForm({
      employee_name:   row.employee_name,
      nip:             row.nip || '',
      position:        row.position,
      branch_id:       row.branch_id || '',
      assessment_date: row.assessment_date,
      perf_scores:     row.perf_scores || emptyPerfScores(row.position),
      pot_scores:      row.pot_scores  || emptyPotScores(),
    })
    setEditingId(row.id)
    setTab('form')
  }

  const handleCancelEdit = () => {
    setForm({
      employee_name: '', nip: '', position: 'head_store', branch_id: '',
      assessment_date: today,
      perf_scores: emptyPerfScores('head_store'),
      pot_scores: emptyPotScores(),
    })
    setEditingId(null)
    setTab('list')
  }

  const setPerfScore = (id, val) =>
    setForm(f => ({ ...f, perf_scores: { ...f.perf_scores, [id]: val } }))

  const setPotScore = (id, val) =>
    setForm(f => ({ ...f, pot_scores: { ...f.pot_scores, [id]: val } }))

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchSearch = !search ||
        r.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.branch?.name?.toLowerCase().includes(search.toLowerCase())
      const matchPos = filterPos === 'all' || r.position === filterPos
      const matchCell = !selectedCell || r.quadrant === MATRIX[selectedCell]?.label
      return matchSearch && matchPos && matchCell
    })
  }, [rows, search, filterPos, selectedCell])

  const handleDownload = () => {
    const headers = [
      'Tanggal', 'Nama', 'NIP', 'Jabatan', 'Store',
      'Perf Avg', 'Pot Avg', 'Kuadran', 'Rekomendasi',
    ]
    const data = filtered.map(r => [
      r.assessment_date, r.employee_name, r.nip || '',
      r.position, r.branch?.name || '',
      r.perf_avg ?? '', r.pot_avg ?? '',
      r.quadrant ?? '', r.recommendation ?? '',
    ])
    downloadCsv(`laporan-staff-lama-${today}.csv`, headers, data)
  }

  // Build matrix counts
  const matrixCounts = useMemo(() => {
    const counts = {}
    rows.forEach(r => {
      if (r.quadrant) {
        const key = Object.entries(MATRIX).find(([, v]) => v.label === r.quadrant)?.[0]
        if (key) counts[key] = (counts[key] || 0) + 1
      }
    })
    return counts
  }, [rows])

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <SubpageShell
      title="Evaluasi Staff Lama"
      subtitle="9-Box Performance vs Potential"
      eyebrow="Trainer"
      showBack={false}
      footer={<SmartBottomNav />}
    >
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <SegmentedControl
          options={[
            { key: 'matrix', label: '9-Box' },
            { key: 'list',   label: 'Daftar' },
            { key: 'form',   label: editingId ? '✎ Edit' : '+ Tambah' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'list' && rows.length > 0 && (
          <SoftButton tone="white" icon="download" onClick={handleDownload}>
            Unduh CSV
          </SoftButton>
        )}
      </div>

      {/* ── 9-BOX TAB ── */}
      {tab === 'matrix' && (
        <>
          <SectionPanel
            eyebrow="Matriks Evaluasi"
            title="9-Box Grid"
            description="Klik kuadran untuk filter daftar. Potential (atas–bawah) vs Performance (kiri–kanan)."
            actions={selectedCell && (
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="text-xs font-semibold text-primary-600 underline"
              >
                Reset filter
              </button>
            )}
          >
            <div className="mt-2">
              {/* Y-label */}
              <div className="flex items-center gap-1 mb-1">
                <div className="w-16 shrink-0" />
                <div className="flex flex-1 justify-around text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                  <span>Low Perf</span><span>Mod. Perf</span><span>High Perf</span>
                </div>
              </div>

              {['High', 'Moderate', 'Low'].map(pot => (
                <div key={pot} className="flex items-stretch gap-1 mb-1">
                  <div className="w-16 shrink-0 flex items-center justify-end pr-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">
                    {pot}<br />Pot.
                  </div>
                  {['Low', 'Moderate', 'High'].map(perf => {
                    const key = `${pot}-${perf}`
                    const cell = MATRIX[key]
                    const count = matrixCounts[key] || 0
                    const isActive = selectedCell === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedCell(isActive ? null : key)}
                        className={`flex-1 rounded-xl border-2 p-2 text-center transition-all ${cell.bg} ${cell.text} ${
                          isActive ? 'border-current shadow-md scale-105' : 'border-transparent hover:border-current/30'
                        }`}
                      >
                        <div className="text-[10px] font-bold uppercase leading-none opacity-80">{cell.label}</div>
                        <div className="mt-1.5 text-xl font-bold">{count}</div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </SectionPanel>

          {/* List below matrix filtered by selected cell */}
          {(selectedCell || rows.length > 0) && (
            <SectionPanel
              title={selectedCell ? `${MATRIX[selectedCell]?.label} (${filtered.length})` : `Semua (${rows.length})`}
              className="mt-4"
              actions={rows.length > 0 && (
                <SoftButton tone="white" icon="download" onClick={handleDownload}>
                  Unduh CSV
                </SoftButton>
              )}
            >
              {loading ? (
                <div className="py-8 text-center text-sm text-slate-400">Memuat...</div>
              ) : filtered.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">Tidak ada data di kuadran ini.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filtered.map(r => {
                    const q = Object.entries(MATRIX).find(([, v]) => v.label === r.quadrant)?.[1]
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{r.employee_name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                            <span>{POSITIONS.find(p => p.value === r.position)?.label}</span>
                            {r.branch?.name && <span>· {r.branch.name}</span>}
                            <span>· {r.assessment_date}</span>
                          </div>
                          {r.recommendation && (
                            <div className="text-[11px] text-slate-400 mt-0.5 italic">{r.recommendation}</div>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(r)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                          >
                            Edit
                          </button>
                          <div className="text-right">
                            {q && (
                              <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-current/20 ${q.bg} ${q.text}`}>
                                {r.quadrant}
                              </span>
                            )}
                            <div className="text-xs text-slate-500 mt-1">
                              P {Number(r.perf_avg).toFixed(1)} · T {Number(r.pot_avg).toFixed(1)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionPanel>
          )}
        </>
      )}

      {/* ── LIST TAB ── */}
      {tab === 'list' && (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              placeholder="Cari nama atau store..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input flex-1"
            />
            <select
              value={filterPos}
              onChange={e => setFilterPos(e.target.value)}
              className="input sm:w-48"
            >
              <option value="all">Semua Jabatan</option>
              {POSITIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-slate-400">Memuat data...</div>
          ) : filtered.length === 0 ? (
            <EmptyPanel
              title="Belum ada data evaluasi"
              description="Tambah penilaian staff lama dengan klik tab + Tambah."
              actionLabel="Tambah Evaluasi"
              onAction={() => setTab('form')}
            />
          ) : (
            <SectionPanel title={`${filtered.length} Karyawan`}>
              <div className="divide-y divide-slate-100">
                {filtered.map(r => {
                  const q = Object.entries(MATRIX).find(([, v]) => v.label === r.quadrant)?.[1]
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{r.employee_name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                          <span>{POSITIONS.find(p => p.value === r.position)?.label}</span>
                          {r.branch?.name && <span>· {r.branch.name}</span>}
                          <span>· {r.assessment_date}</span>
                        </div>
                        {r.recommendation && (
                          <div className="text-[11px] text-slate-400 mt-0.5 italic">{r.recommendation}</div>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(r)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                        >
                          Edit
                        </button>
                        <div className="text-right">
                          {q && (
                            <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-current/20 ${q.bg} ${q.text}`}>
                              {r.quadrant}
                            </span>
                          )}
                          <div className="text-xs text-slate-500 mt-1">
                            P {Number(r.perf_avg).toFixed(1)} · T {Number(r.pot_avg).toFixed(1)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </SectionPanel>
          )}
        </>
      )}

      {/* ── FORM TAB ── */}
      {tab === 'form' && (
        <form onSubmit={handleSave} className="space-y-5">
          <SectionPanel eyebrow="Data Karyawan" title="Informasi Dasar">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Nama Lengkap</label>
                <input
                  required className="input"
                  placeholder="Nama karyawan"
                  value={form.employee_name}
                  onChange={e => setForm(f => ({ ...f, employee_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">NIP (opsional)</label>
                <input
                  className="input"
                  placeholder="Nomor Induk Pegawai"
                  value={form.nip}
                  onChange={e => setForm(f => ({ ...f, nip: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Jabatan</label>
                <select
                  className="input"
                  value={form.position}
                  onChange={e => handlePositionChange(e.target.value)}
                >
                  {POSITIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Store</label>
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

          {/* Performance criteria */}
          <SectionPanel eyebrow="Performance" title="Skor Kompetensi Teknis">
            <div className="space-y-5">
              {(PERF_CRITERIA[form.position] || []).map(c => (
                <div key={c.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-slate-800">{c.label}</span>
                    <ToneBadge tone={form.perf_scores[c.id] === 3 ? 'ok' : form.perf_scores[c.id] === 2 ? 'info' : 'warn'}>
                      {form.perf_scores[c.id]} — {SCORE_LABELS[form.perf_scores[c.id]]}
                    </ToneBadge>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(v => (
                      <button
                        key={v} type="button"
                        onClick={() => setPerfScore(c.id, v)}
                        className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all border ${
                          form.perf_scores[c.id] === v
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                Rata-rata Performance: <strong>{perfAvg.toFixed(2)}</strong> → <strong>{calcLevel(perfAvg)}</strong>
              </div>
            </div>
          </SectionPanel>

          {/* Potential criteria */}
          <SectionPanel eyebrow="Potential" title="Skor Potensi (Agile, Leadership, Learning)">
            <div className="space-y-5">
              {POT_CRITERIA.map(c => (
                <div key={c.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-slate-800">{c.label}</span>
                    <ToneBadge tone={form.pot_scores[c.id] === 3 ? 'ok' : form.pot_scores[c.id] === 2 ? 'info' : 'warn'}>
                      {form.pot_scores[c.id]} — {SCORE_LABELS[form.pot_scores[c.id]]}
                    </ToneBadge>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(v => (
                      <button
                        key={v} type="button"
                        onClick={() => setPotScore(c.id, v)}
                        className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all border ${
                          form.pot_scores[c.id] === v
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                Rata-rata Potential: <strong>{potAvg.toFixed(2)}</strong> → <strong>{calcLevel(potAvg)}</strong>
              </div>
            </div>
          </SectionPanel>

          {/* Live 9-box result */}
          <div className={`rounded-2xl border-2 p-4 ${liveQuadrant.bg} ${liveQuadrant.text} border-current/20`}>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">Hasil Sementara (9-Box)</div>
            <div className="text-xl font-bold">{liveQuadrant.label}</div>
            <div className="text-sm opacity-80 mt-0.5">Rekomendasi: {liveQuadrant.action}</div>
            <div className="text-xs opacity-60 mt-1">
              Performance {perfAvg.toFixed(2)} ({calcLevel(perfAvg)}) · Potential {potAvg.toFixed(2)} ({calcLevel(potAvg)})
            </div>
          </div>

          <div className="flex gap-3 pb-4">
            <LoadingButton
              type="submit" loading={saving}
              className="btn-primary flex-1"
            >
              {editingId ? 'Simpan Perubahan' : 'Simpan Evaluasi'}
            </LoadingButton>
            <button
              type="button"
              onClick={editingId ? handleCancelEdit : () => setTab('matrix')}
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
