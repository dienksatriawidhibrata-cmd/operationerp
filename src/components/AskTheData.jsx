import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtRp } from '../lib/utils'
import { AppIcon } from './ui/AppKit'

// ── Date helpers ──────────────────────────────────────────────────────────────

function wibToday() {
  const wib = new Date(new Date().getTime() + 7 * 3600_000)
  return wib.toISOString().split('T')[0]
}

function firstDayOfMonth() {
  const wib = new Date(new Date().getTime() + 7 * 3600_000)
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function dateOffset(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function monthsInRange(dateStart, dateEnd) {
  const s = new Date(dateStart + 'T00:00:00Z')
  const e = new Date(dateEnd + 'T00:00:00Z')
  const result = []
  const cur = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1))
  while (cur <= e) {
    result.push({ year: cur.getUTCFullYear(), month: cur.getUTCMonth() + 1 })
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }
  return result
}

function prevNMonths(months) {
  if (!months.length) return []
  const n = months.length
  const first = months[0]
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(first.year, first.month - 1 - (n - i), 1))
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
  })
}

function fmtMonthLabel(year, month) {
  return new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

function fmtPeriodLabel(months) {
  if (!months.length) return ''
  const f = months[0], l = months[months.length - 1]
  if (months.length === 1) return fmtMonthLabel(f.year, f.month)
  const ms = new Date(f.year, f.month - 1).toLocaleDateString('id-ID', { month: 'short' })
  const me = new Date(l.year, l.month - 1).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
  return `${ms} – ${me}`
}

function fmtDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Query helpers ─────────────────────────────────────────────────────────────

function monthFilter(months) {
  const minY = Math.min(...months.map(m => m.year))
  const maxY = Math.max(...months.map(m => m.year))
  return { minY, maxY, months }
}

function inMonths(r, months) {
  return months.some(m => m.year === r.year && m.month === r.month)
}

// ── Query functions ───────────────────────────────────────────────────────────

async function querySalesPOS(dateStart, dateEnd) {
  const months = monthsInRange(dateStart, dateEnd)
  if (!months.length) return []
  const { minY, maxY } = monthFilter(months)
  const { data } = await supabase
    .from('pos_sales_monthly')
    .select('outlet_name, year, month, net_sales, transactions, gross_sales, discounts')
    .gte('year', minY).lte('year', maxY)
  const byOutlet = {}
  for (const r of data ?? []) {
    if (!inMonths(r, months)) continue
    const key = r.outlet_name
    if (!byOutlet[key]) byOutlet[key] = { net: 0, txn: 0, gross: 0, disc: 0 }
    byOutlet[key].net   += Number(r.net_sales   || 0)
    byOutlet[key].txn   += Number(r.transactions || 0)
    byOutlet[key].gross += Number(r.gross_sales  || 0)
    byOutlet[key].disc  += Number(r.discounts    || 0)
  }
  return Object.entries(byOutlet)
    .sort((a, b) => b[1].net - a[1].net)
    .map(([outlet, v]) => ({
      Outlet: outlet.replace('Bagi Kopi ', ''),
      'Net Sales': fmtRp(v.net),
      Transaksi: v.txn.toLocaleString('id-ID'),
      'Gross Sales': fmtRp(v.gross),
      Diskon: fmtRp(v.disc),
    }))
}

async function queryKomplain(dateStart, dateEnd) {
  const { data } = await supabase
    .from('pos_complaints')
    .select('outlet_name, topic, priority, complaint_date')
    .gte('complaint_date', dateStart)
    .lte('complaint_date', dateEnd)
    .in('priority', ['Middle', 'High'])
    .limit(5000)
  const byOutlet = {}
  for (const r of data ?? []) {
    const key = r.outlet_name
    if (!byOutlet[key]) byOutlet[key] = { total: 0, high: 0, middle: 0, topics: {} }
    byOutlet[key].total++
    if (r.priority === 'High')   byOutlet[key].high++
    if (r.priority === 'Middle') byOutlet[key].middle++
    if (r.topic) byOutlet[key].topics[r.topic] = (byOutlet[key].topics[r.topic] || 0) + 1
  }
  return Object.entries(byOutlet)
    .sort((a, b) => b[1].high - a[1].high || b[1].total - a[1].total)
    .map(([outlet, v]) => {
      const top = Object.entries(v.topics).sort((a, b) => b[1] - a[1])[0]
      return {
        Outlet: outlet.replace('Bagi Kopi ', ''),
        Total: v.total,
        '🔴 High': v.high,
        '🟡 Middle': v.middle,
        'Topik Terbanyak': top ? `${top[0]} (${top[1]}x)` : '-',
      }
    })
}

async function queryOpex(dateStart, dateEnd) {
  const { data } = await supabase
    .from('operational_expenses')
    .select('branch_id, total_amount, branches(name, store_id), tanggal')
    .gte('tanggal', dateStart)
    .lte('tanggal', dateEnd)
    .limit(10000)
  const byBranch = {}
  for (const r of data ?? []) {
    const name = r.branches?.name?.replace('Bagi Kopi ', '') ?? r.branch_id
    const sid  = r.branches?.store_id ?? ''
    if (!byBranch[r.branch_id]) byBranch[r.branch_id] = { name, sid, total: 0, count: 0 }
    byBranch[r.branch_id].total += Number(r.total_amount || 0)
    byBranch[r.branch_id].count++
  }
  return Object.values(byBranch)
    .sort((a, b) => b.total - a.total)
    .map(x => ({
      Toko: x.name,
      'Store ID': x.sid,
      'Total Opex': fmtRp(x.total),
      'Jml Transaksi': x.count,
    }))
}

async function queryRasioSize(dateStart, dateEnd) {
  const months = monthsInRange(dateStart, dateEnd)
  if (!months.length) return []
  const { minY, maxY } = monthFilter(months)
  const { data } = await supabase
    .from('pos_sales_items')
    .select('outlet_name, size, quantity, net_sales, year, month')
    .gte('year', minY).lte('year', maxY)
    .eq('sales_type', 'Dine in')
    .in('size', ['L', 'S'])
    .limit(50000)
  const byOutlet = {}
  for (const r of data ?? []) {
    if (!inMonths(r, months)) continue
    const key = r.outlet_name
    if (!byOutlet[key]) byOutlet[key] = { L: 0, S: 0, netL: 0, netS: 0 }
    byOutlet[key][r.size]     += Number(r.quantity  || 0)
    if (r.size === 'L') byOutlet[key].netL += Number(r.net_sales || 0)
    if (r.size === 'S') byOutlet[key].netS += Number(r.net_sales || 0)
  }
  return Object.entries(byOutlet)
    .filter(([, v]) => v.L + v.S > 0)
    .sort((a, b) => (b[1].L + b[1].S) - (a[1].L + a[1].S))
    .map(([outlet, v]) => {
      const total = v.L + v.S
      const pctL  = total ? Math.round((v.L / total) * 100) : 0
      return {
        Outlet: outlet.replace('Bagi Kopi ', ''),
        'Qty Large': Math.round(v.L).toLocaleString('id-ID'),
        'Qty Small': Math.round(v.S).toLocaleString('id-ID'),
        '% Large': `${pctL}%`,
        '% Small': `${100 - pctL}%`,
        'Rasio L:S': v.S > 0 ? `${(v.L / v.S).toFixed(2)}:1` : 'L only',
      }
    })
}

async function queryRasioOatmilk(dateStart, dateEnd) {
  const months = monthsInRange(dateStart, dateEnd)
  if (!months.length) return []
  const { minY, maxY } = monthFilter(months)
  const { data } = await supabase
    .from('pos_sales_items')
    .select('outlet_name, item, quantity, net_sales, year, month')
    .gte('year', minY).lte('year', maxY)
    .eq('sales_type', 'Dine in')
    .limit(50000)
  const byItem = {}
  for (const r of data ?? []) {
    if (!inMonths(r, months)) continue
    const isOat  = r.item?.includes('OATSIDE') || r.item?.includes('OAT ALMOND')
    const base   = isOat
      ? r.item.replace(/ X OATSIDE$/i, '').replace(/ OATSIDE$/i, '').replace(/ X OAT ALMOND$/i, '').trim()
      : r.item
    if (!base) continue
    if (!byItem[base]) byItem[base] = { oat: 0, regular: 0, netOat: 0, netReg: 0 }
    if (isOat) {
      byItem[base].oat    += Number(r.quantity  || 0)
      byItem[base].netOat += Number(r.net_sales || 0)
    } else {
      byItem[base].regular += Number(r.quantity  || 0)
      byItem[base].netReg  += Number(r.net_sales || 0)
    }
  }
  return Object.entries(byItem)
    .filter(([, v]) => v.oat > 0)
    .sort((a, b) => b[1].oat - a[1].oat)
    .slice(0, 30)
    .map(([item, v]) => {
      const total  = v.oat + v.regular
      const pctOat = total ? Math.round((v.oat / total) * 100) : 0
      return {
        Item: item,
        'Oatmilk (qty)': Math.round(v.oat).toLocaleString('id-ID'),
        'Reguler (qty)': Math.round(v.regular).toLocaleString('id-ID'),
        '% Oatmilk': `${pctOat}%`,
        'Net Oatmilk': fmtRp(v.netOat),
        'Net Reguler': fmtRp(v.netReg),
      }
    })
}

async function queryItemTrend(dateStart, dateEnd) {
  const curMonths  = monthsInRange(dateStart, dateEnd)
  if (!curMonths.length) return []
  const prevMonths = prevNMonths(curMonths)
  const allMonths  = [...curMonths, ...prevMonths]
  const minY = Math.min(...allMonths.map(m => m.year))
  const maxY = Math.max(...allMonths.map(m => m.year))

  const { data } = await supabase
    .from('pos_sales_items')
    .select('outlet_name, item, net_sales, year, month')
    .gte('year', minY).lte('year', maxY)
    .limit(50000)

  const cur  = {}
  const prev = {}
  for (const r of data ?? []) {
    const key = `${r.outlet_name}||${r.item}`
    if (inMonths(r, curMonths)) {
      cur[key]  = (cur[key]  || 0) + Number(r.net_sales || 0)
    }
    if (inMonths(r, prevMonths)) {
      prev[key] = (prev[key] || 0) + Number(r.net_sales || 0)
    }
  }

  const keys = new Set([...Object.keys(cur), ...Object.keys(prev)])
  const rows = []
  for (const k of keys) {
    const [outlet, item] = k.split('||')
    const c = cur[k]  || 0
    const p = prev[k] || 0
    const delta = c - p
    if (Math.abs(delta) < 10000) continue  // filter noise < 10rb
    rows.push({ outlet, item, c, p, delta })
  }

  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const prevLabel = fmtPeriodLabel(prevMonths)
  const curLabel  = fmtPeriodLabel(curMonths)

  return rows.slice(0, 50).map(r => ({
    Toko: r.outlet.replace('Bagi Kopi ', ''),
    Item: r.item,
    [curLabel]:  fmtRp(r.c),
    [prevLabel]: fmtRp(r.p),
    Delta: `${r.delta >= 0 ? '+' : ''}${fmtRp(r.delta)}`,
    Trend: r.delta > 0 ? '↑ Naik' : '↓ Turun',
  }))
}

async function queryHourlyTrend(dateStart, dateEnd) {
  const { data } = await supabase
    .from('pos_sales_hourly')
    .select('outlet_name, sale_date, hour_bucket, net_sales, txn_count')
    .gte('sale_date', dateStart)
    .lte('sale_date', dateEnd)
    .neq('hour_bucket', 'other')
    .limit(100000)

  const BUCKETS = ['pagi', 'siang', 'malam', 'dinihari']
  const LABELS  = { pagi: 'Pagi (07-11)', siang: 'Siang (12-17)', malam: 'Malam (18-22)', dinihari: 'Dinihari (23-03)' }

  const byOutlet = {}
  for (const r of data ?? []) {
    const key = r.outlet_name
    if (!byOutlet[key]) byOutlet[key] = Object.fromEntries(BUCKETS.map(b => [b, { net: 0, txn: 0 }]))
    const b = r.hour_bucket
    if (!BUCKETS.includes(b)) continue
    byOutlet[key][b].net += Number(r.net_sales  || 0)
    byOutlet[key][b].txn += Number(r.txn_count  || 0)
  }

  return Object.entries(byOutlet)
    .sort((a, b) => {
      const totA = BUCKETS.reduce((s, bk) => s + a[1][bk].net, 0)
      const totB = BUCKETS.reduce((s, bk) => s + b[1][bk].net, 0)
      return totB - totA
    })
    .map(([outlet, buckets]) => {
      const total = BUCKETS.reduce((s, b) => s + buckets[b].net, 0)
      const row = { Outlet: outlet.replace('Bagi Kopi ', '') }
      BUCKETS.forEach(b => {
        row[LABELS[b]] = fmtRp(buckets[b].net)
      })
      row['Total'] = fmtRp(total)
      return row
    })
}

// ── Query config ──────────────────────────────────────────────────────────────

const QUERIES = [
  {
    id: 'sales',
    label: 'Sales POS per Outlet',
    icon: 'chart',
    fn: querySalesPOS,
    desc: 'Net sales dari data POS per toko',
    dateType: 'month',
  },
  {
    id: 'complaint',
    label: 'Ringkasan Komplain',
    icon: 'bell',
    fn: queryKomplain,
    desc: 'Prioritas Middle & High per outlet',
    dateType: 'date',
  },
  {
    id: 'opex',
    label: 'Beban Opex per Toko',
    icon: 'opex',
    fn: queryOpex,
    desc: 'Pengeluaran operasional per toko',
    dateType: 'date',
  },
  {
    id: 'size',
    label: 'Rasio Small vs Large',
    icon: 'chart',
    fn: queryRasioSize,
    desc: 'Perbandingan cup size (Dine in)',
    dateType: 'month',
  },
  {
    id: 'oatmilk',
    label: 'Rasio Oatmilk',
    icon: 'chart',
    fn: queryRasioOatmilk,
    desc: 'Oatmilk vs reguler per item (Dine in)',
    dateType: 'month',
  },
  {
    id: 'itemtrend',
    label: 'Trend Item per Toko',
    icon: 'chart',
    fn: queryItemTrend,
    desc: 'Naik/turun item vs periode sebelumnya',
    dateType: 'month',
  },
  {
    id: 'hourly',
    label: 'Penjualan per Jam',
    icon: 'calendar',
    fn: queryHourlyTrend,
    desc: 'Pagi / Siang / Malam / Dinihari per toko',
    dateType: 'date',
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function DataTable({ rows }) {
  if (!rows?.length) return (
    <p className="py-4 text-center text-xs text-slate-400">Tidak ada data untuk rentang ini.</p>
  )
  const cols = Object.keys(rows[0])
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100">
      <table className="w-full min-w-max text-xs">
        <thead>
          <tr className="bg-slate-50">
            {cols.map(c => (
              <th key={c} className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              {cols.map(c => (
                <td key={c} className="whitespace-nowrap px-3 py-2 text-slate-700">{row[c]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DateRangeBar({ dateStart, dateEnd, onChange }) {
  const today = wibToday()

  function applyPreset(preset) {
    const e = today
    let s
    if (preset === '7d')       s = dateOffset(today, -6)
    else if (preset === '30d') s = dateOffset(today, -29)
    else if (preset === 'mon') s = firstDayOfMonth()
    else if (preset === '3m')  s = dateOffset(firstDayOfMonth(), -89)
    else if (preset === '6m')  s = dateOffset(firstDayOfMonth(), -179)
    if (s) onChange(s, e)
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center gap-2">
        <AppIcon name="calendar" size={14} className="flex-shrink-0 text-violet-400" />
        <input
          type="date"
          value={dateStart}
          max={dateEnd}
          onChange={e => onChange(e.target.value, dateEnd)}
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-violet-300"
        />
        <span className="text-xs text-slate-400">→</span>
        <input
          type="date"
          value={dateEnd}
          min={dateStart}
          max={today}
          onChange={e => onChange(dateStart, e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-violet-300"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[['7d', '7 hari'], ['30d', '30 hari'], ['mon', 'Bulan ini'], ['3m', '3 bulan'], ['6m', '6 bulan']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => applyPreset(key)}
            className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-600 hover:bg-violet-100 active:scale-95"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AskTheData() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [dateStart, setDateStart] = useState(firstDayOfMonth())
  const [dateEnd, setDateEnd]     = useState(wibToday())
  const [loading, setLoading]     = useState(false)
  const [rows, setRows]           = useState(null)
  const [error, setError]         = useState('')

  async function run(query, ds = dateStart, de = dateEnd) {
    setSelected(query)
    setRows(null)
    setError('')
    setLoading(true)
    try {
      const result = await query.fn(ds, de)
      setRows(result)
    } catch (e) {
      setError('Gagal memuat data. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  function handleDateChange(newStart, newEnd) {
    setDateStart(newStart)
    setDateEnd(newEnd)
    if (selected) run(selected, newStart, newEnd)
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
          <p className="text-[10px] text-violet-500">7 analisis POS: sales, rasio, trend item, jam…</p>
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
          <p className="text-[9px] text-violet-400">Pilih rentang tanggal → pilih analisis</p>
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
        {/* Date range */}
        <DateRangeBar dateStart={dateStart} dateEnd={dateEnd} onChange={handleDateChange} />

        {/* Query buttons */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          {QUERIES.map((q, i) => (
            <button
              key={q.id}
              type="button"
              onClick={() => run(q)}
              disabled={loading}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition active:scale-95 disabled:opacity-50 ${
                i === QUERIES.length - 1 && QUERIES.length % 2 !== 0 ? 'col-span-2' : ''
              } ${
                selected?.id === q.id
                  ? 'border-violet-200 bg-violet-50'
                  : 'border-slate-100 bg-slate-50 hover:border-violet-100 hover:bg-violet-50/50'
              }`}
            >
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl shadow-sm ${
                selected?.id === q.id ? 'bg-violet-600 text-white' : 'bg-white text-slate-500'
              }`}>
                <AppIcon name={q.icon} size={14} />
              </div>
              <div className="min-w-0">
                <p className={`truncate text-[10px] font-bold leading-tight ${selected?.id === q.id ? 'text-violet-900' : 'text-slate-700'}`}>
                  {q.label}
                </p>
                <p className="truncate text-[9px] text-slate-400">{q.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
            <p className="text-xs text-violet-500">Memuat data…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-rose-50 px-4 py-3">
            <p className="text-xs text-rose-600">{error}</p>
          </div>
        )}

        {/* Result */}
        {!loading && rows !== null && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-500">
                {selected?.label} · {rows.length} baris · {fmtDate(dateStart)} – {fmtDate(dateEnd)}
              </p>
            </div>
            <DataTable rows={rows} />
          </div>
        )}

        {!loading && rows === null && !error && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AppIcon name="chart" size={32} className="mb-2 text-slate-200" />
            <p className="text-xs text-slate-400">Pilih analisis di atas untuk melihat data</p>
          </div>
        )}
      </div>
    </div>
  )
}
