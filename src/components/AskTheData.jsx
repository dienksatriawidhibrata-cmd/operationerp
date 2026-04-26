import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtRp, todayWIB } from '../lib/utils'
import { AppIcon } from './ui/AppKit'

// ── Helpers ───────────────────────────────────────────────────────────────────

function wibToday(offsetDays = 0) {
  const now = new Date()
  const wib = new Date(now.getTime() + 7 * 3600_000 + offsetDays * 86_400_000)
  return wib.toISOString().split('T')[0]
}

function monthBounds(ym) {
  const [y, m] = ym.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = new Date(y, m, 0).toISOString().split('T')[0]
  return { start, end }
}

function currentYM() {
  const d = new Date(new Date().getTime() + 7 * 3600_000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function lastNMonths(n) {
  const result = []
  const now = new Date(new Date().getTime() + 7 * 3600_000)
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

function pct(done, expected) {
  if (!expected) return 0
  return Math.min(100, Math.round((done / expected) * 100))
}

// ── Query functions ───────────────────────────────────────────────────────────

async function queryDepositStatus(period) {
  const { start, end } = monthBounds(period)
  const [{ data: branches }, { data: deposits }] = await Promise.all([
    supabase.from('branches').select('id, name, store_id').eq('is_active', true).order('name'),
    supabase.from('daily_deposits').select('branch_id, status, cash_disetorkan').gte('tanggal', start).lte('tanggal', end),
  ])
  const byBranch = {}
  for (const d of deposits ?? []) {
    if (!byBranch[d.branch_id]) byBranch[d.branch_id] = { approved: 0, submitted: 0, rejected: 0, total: 0 }
    const s = byBranch[d.branch_id]
    if (d.status === 'approved') { s.approved++; s.total += Number(d.cash_disetorkan || 0) }
    else if (d.status === 'submitted') s.submitted++
    else if (d.status === 'rejected') s.rejected++
  }
  return (branches ?? []).map((b) => ({
    Toko: b.name.replace('Bagi Kopi ', ''),
    'Store ID': b.store_id,
    Selesai: byBranch[b.id]?.approved ?? 0,
    Pending: byBranch[b.id]?.submitted ?? 0,
    Ditolak: byBranch[b.id]?.rejected ?? 0,
    'Total Setoran': fmtRp(byBranch[b.id]?.total ?? 0),
  })).sort((a, b) => a.Pending - b.Pending || a.Selesai - b.Selesai)
}

async function queryChecklistSkip(period) {
  const { start, end } = monthBounds(period)
  const days = new Date(end).getDate()
  const expected = days * 3
  const [{ data: branches }, { data: checklists }, { data: preps }] = await Promise.all([
    supabase.from('branches').select('id, name, store_id').eq('is_active', true).order('name'),
    supabase.from('daily_checklists').select('branch_id').gte('tanggal', start).lte('tanggal', end),
    supabase.from('daily_preparation').select('branch_id').gte('tanggal', start).lte('tanggal', end),
  ])
  const ck = {}, pr = {}
  for (const r of checklists ?? []) ck[r.branch_id] = (ck[r.branch_id] || 0) + 1
  for (const r of preps ?? []) pr[r.branch_id] = (pr[r.branch_id] || 0) + 1
  return (branches ?? []).map((b) => ({
    Toko: b.name.replace('Bagi Kopi ', ''),
    'Ceklis Masuk': ck[b.id] ?? 0,
    'Prep Masuk': pr[b.id] ?? 0,
    'Target (masing-masing)': expected,
    'Ceklis %': `${pct(ck[b.id] ?? 0, expected)}%`,
    'Prep %': `${pct(pr[b.id] ?? 0, expected)}%`,
    'Skip Rate': `${100 - pct(((ck[b.id] ?? 0) + (pr[b.id] ?? 0)), expected * 2)}%`,
  })).sort((a, b) => parseInt(b['Skip Rate']) - parseInt(a['Skip Rate']))
}

async function queryOpex(period) {
  const { start, end } = monthBounds(period)
  const { data } = await supabase.from('operational_expenses')
    .select('branch_id, total_amount, branches(name, store_id)')
    .gte('tanggal', start).lte('tanggal', end)
  const byBranch = {}
  for (const r of data ?? []) {
    const name = r.branches?.name?.replace('Bagi Kopi ', '') ?? r.branch_id
    const sid = r.branches?.store_id ?? ''
    if (!byBranch[r.branch_id]) byBranch[r.branch_id] = { name, sid, total: 0, count: 0 }
    byBranch[r.branch_id].total += Number(r.total_amount || 0)
    byBranch[r.branch_id].count++
  }
  return Object.values(byBranch).sort((a, b) => b.total - a.total).map((x) => ({
    Toko: x.name,
    'Store ID': x.sid,
    'Total Opex': fmtRp(x.total),
    'Jml Transaksi': x.count,
  }))
}

async function queryReportCompliance(period) {
  const { start, end } = monthBounds(period)
  const days = new Date(end).getDate()
  const [{ data: branches }, { data: reports }, { data: deposits }] = await Promise.all([
    supabase.from('branches').select('id, name, store_id').eq('is_active', true).order('name'),
    supabase.from('daily_reports').select('branch_id').gte('tanggal', start).lte('tanggal', end),
    supabase.from('daily_deposits').select('branch_id, status').gte('tanggal', start).lte('tanggal', end),
  ])
  const rc = {}, dc = {}
  for (const r of reports ?? []) rc[r.branch_id] = (rc[r.branch_id] || 0) + 1
  for (const d of deposits ?? []) if (d.status !== 'draft') dc[d.branch_id] = (dc[d.branch_id] || 0) + 1
  return (branches ?? []).map((b) => ({
    Toko: b.name.replace('Bagi Kopi ', ''),
    'Laporan Masuk': rc[b.id] ?? 0,
    'Setoran Masuk': dc[b.id] ?? 0,
    'Skip Laporan': Math.max(0, days - (rc[b.id] ?? 0)),
    'Skip Setoran': Math.max(0, days - (dc[b.id] ?? 0)),
    'Target Hari': days,
  })).sort((a, b) => b['Skip Laporan'] - a['Skip Laporan'])
}

async function queryVisitCompliance(period) {
  const { start, end } = monthBounds(period)
  const { data } = await supabase.from('daily_visits')
    .select('visited_by, visit_date, score, profiles(full_name, role)')
    .gte('visit_date', start).lte('visit_date', end)
  const byMgr = {}
  for (const r of data ?? []) {
    const name = r.profiles?.full_name ?? r.visited_by
    const role = r.profiles?.role ?? ''
    if (!byMgr[r.visited_by]) byMgr[r.visited_by] = { name, role, count: 0, total_score: 0 }
    byMgr[r.visited_by].count++
    byMgr[r.visited_by].total_score += Number(r.score || 0)
  }
  return Object.values(byMgr).sort((a, b) => b.count - a.count).map((m) => ({
    Manager: m.name,
    Role: m.role === 'district_manager' ? 'DM' : m.role === 'area_manager' ? 'AM' : m.role,
    'Jml Visit': m.count,
    'Avg Skor': m.count ? Math.round(m.total_score / m.count) : 0,
  }))
}

async function queryStaffActivity(period) {
  const { start, end } = monthBounds(period)
  const { data } = await supabase.from('daily_checklists')
    .select('submitted_by, profiles(full_name, branches(name))')
    .gte('tanggal', start).lte('tanggal', end)
  const byStaff = {}
  for (const r of data ?? []) {
    const name = r.profiles?.full_name ?? r.submitted_by
    const branch = r.profiles?.branches?.name?.replace('Bagi Kopi ', '') ?? ''
    if (!byStaff[r.submitted_by]) byStaff[r.submitted_by] = { name, branch, count: 0 }
    byStaff[r.submitted_by].count++
  }
  return Object.values(byStaff).sort((a, b) => b.count - a.count).map((s, i) => ({
    '#': i + 1,
    Nama: s.name,
    Toko: s.branch,
    'Jml Ceklis': s.count,
  }))
}

async function querySalesTrend(period) {
  const [y, m] = period.split('-').map(Number)
  const { data } = await supabase.from('pos_sales_monthly')
    .select('outlet_name, year, month, net_sales, transactions')
    .eq('year', y).eq('month', m)
    .order('net_sales', { ascending: false })
    .limit(30)
  return (data ?? []).map((r) => ({
    Outlet: r.outlet_name.replace('Bagi Kopi ', ''),
    'Net Sales': fmtRp(r.net_sales),
    Transaksi: r.transactions,
  }))
}

async function queryComplaintSummary(period) {
  const [y, m] = period.split('-').map(Number)
  const { data } = await supabase.from('pos_complaints')
    .select('outlet_name, topic, priority')
    .eq('year', y).eq('month', m)
  const byOutlet = {}
  for (const r of data ?? []) {
    const key = r.outlet_name
    if (!byOutlet[key]) byOutlet[key] = { total: 0, topics: {} }
    byOutlet[key].total++
    if (r.topic) byOutlet[key].topics[r.topic] = (byOutlet[key].topics[r.topic] || 0) + 1
  }
  return Object.entries(byOutlet)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)
    .map(([outlet, v]) => {
      const topTopic = Object.entries(v.topics).sort((a, b) => b[1] - a[1])[0]
      return {
        Outlet: outlet.replace('Bagi Kopi ', ''),
        'Total Komplain': v.total,
        'Topik Terbanyak': topTopic ? `${topTopic[0]} (${topTopic[1]}x)` : '-',
      }
    })
}

// ── Query config ──────────────────────────────────────────────────────────────

const QUERIES = [
  { id: 'deposit',    label: 'Status Setoran Toko',       icon: 'finance',   fn: queryDepositStatus,    desc: 'Setor, pending, belum per toko' },
  { id: 'checklist',  label: 'Skip Rate Ceklis & Prep',   icon: 'checklist', fn: queryChecklistSkip,    desc: 'Toko yang paling sering skip' },
  { id: 'opex',       label: 'Beban Opex per Toko',       icon: 'opex',      fn: queryOpex,             desc: 'Pengeluaran operasional terbesar' },
  { id: 'report',     label: 'Kepatuhan Laporan HS',      icon: 'checklist', fn: queryReportCompliance, desc: 'Head Store yang sering skip laporan' },
  { id: 'visit',      label: 'Visit DM & AM',             icon: 'map',       fn: queryVisitCompliance,  desc: 'Rajin/lambat mengisi kunjungan' },
  { id: 'staff',      label: 'Aktivitas Staff',           icon: 'users',     fn: queryStaffActivity,    desc: 'Staff paling rajin isi ceklis' },
  { id: 'sales',      label: 'Sales POS per Outlet',      icon: 'chart',     fn: querySalesTrend,       desc: 'Net sales dari data POS' },
  { id: 'complaint',  label: 'Ringkasan Komplain',        icon: 'bell',      fn: queryComplaintSummary, desc: 'Komplain per outlet & topik' },
]

// ── Table component ───────────────────────────────────────────────────────────

function DataTable({ rows }) {
  if (!rows?.length) return <p className="py-4 text-center text-xs text-slate-400">Tidak ada data untuk periode ini.</p>
  const cols = Object.keys(rows[0])
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100">
      <table className="w-full min-w-max text-xs">
        <thead>
          <tr className="bg-slate-50">
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              {cols.map((c) => (
                <td key={c} className="px-3 py-2 text-slate-700 whitespace-nowrap">{row[c]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AskTheData() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [period, setPeriod] = useState(currentYM())
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  async function run(query) {
    setSelected(query)
    setRows(null)
    setError('')
    setLoading(true)
    try {
      const result = await query.fn(period)
      setRows(result)
    } catch (e) {
      setError('Gagal memuat data. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  function handlePeriodChange(e) {
    setPeriod(e.target.value)
    if (selected) run(selected)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50 px-5 py-4 text-left shadow-sm transition-transform active:scale-[0.98]"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-200">
          <AppIcon name="chart" size={20} />
        </div>
        <div>
          <p className="text-xs font-black text-violet-900">Data Explorer</p>
          <p className="text-[10px] text-violet-500">Analisis data operasional & sales toko…</p>
        </div>
        <AppIcon name="chevronRight" size={16} className="ml-auto text-violet-400" />
      </button>
    )
  }

  return (
    <div className="rounded-[2rem] border border-violet-100 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-violet-50 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-600 text-white">
          <AppIcon name="chart" size={18} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-black text-violet-900">Data Explorer</p>
          <p className="text-[9px] text-violet-400">Klik kategori → lihat data tabel</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        {/* Period selector */}
        <div className="mb-4 flex items-center gap-2">
          <AppIcon name="calendar" size={14} className="flex-shrink-0 text-violet-400" />
          <select
            value={period}
            onChange={handlePeriodChange}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-violet-300"
          >
            {lastNMonths(12).map((ym) => {
              const [y, m] = ym.split('-')
              const label = new Date(Number(y), Number(m) - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
              return <option key={ym} value={ym}>{label}</option>
            })}
          </select>
        </div>

        {/* Query buttons */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          {QUERIES.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => run(q)}
              disabled={loading}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition active:scale-95 disabled:opacity-50 ${
                selected?.id === q.id
                  ? 'border-violet-200 bg-violet-50'
                  : 'border-slate-100 bg-slate-50 hover:border-violet-100 hover:bg-violet-50/50'
              }`}
            >
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl ${selected?.id === q.id ? 'bg-violet-600 text-white' : 'bg-white text-slate-500'} shadow-sm`}>
                <AppIcon name={q.icon} size={14} />
              </div>
              <div className="min-w-0">
                <p className={`truncate text-[10px] font-bold leading-tight ${selected?.id === q.id ? 'text-violet-900' : 'text-slate-700'}`}>{q.label}</p>
                <p className="truncate text-[9px] text-slate-400">{q.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Result */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
            <p className="text-xs text-violet-500">Memuat data…</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-rose-50 px-4 py-3">
            <p className="text-xs text-rose-600">{error}</p>
          </div>
        )}

        {!loading && rows !== null && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-500">{selected?.label} · {rows.length} baris</p>
            </div>
            <DataTable rows={rows} />
          </div>
        )}

        {!loading && rows === null && !error && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AppIcon name="chart" size={32} className="mb-2 text-slate-200" />
            <p className="text-xs text-slate-400">Pilih kategori di atas untuk melihat data</p>
          </div>
        )}
      </div>
    </div>
  )
}
