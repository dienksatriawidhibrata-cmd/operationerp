import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Tool definitions (Gemini format) ─────────────────────────────────────────

const FUNCTION_DECLARATIONS = [
  {
    name: 'get_deposit_status',
    description: 'Status setoran toko: berapa yang sudah setor, pending, belum setor. Bisa filter by periode dan branch.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Tanggal mulai (YYYY-MM-DD). Default: 7 hari lalu.' },
        date_to:   { type: 'string', description: 'Tanggal akhir (YYYY-MM-DD). Default: hari ini.' },
        branch_id: { type: 'string', description: 'UUID branch tertentu (opsional).' },
      },
    },
  },
  {
    name: 'get_checklist_skip_rate',
    description: 'Tingkat skip ceklis & preparation per toko dalam periode tertentu. Hasilnya diurutkan dari yang paling sering skip.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Tanggal mulai (YYYY-MM-DD).' },
        date_to:   { type: 'string', description: 'Tanggal akhir (YYYY-MM-DD).' },
        branch_id: { type: 'string', description: 'UUID branch (opsional).' },
        limit:     { type: 'number', description: 'Jumlah toko yang dikembalikan (default 10).' },
      },
    },
  },
  {
    name: 'get_opex_by_branch',
    description: 'Beban operasional (opex) per toko. Bisa filter periode dan branch.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Tanggal mulai (YYYY-MM-DD).' },
        date_to:   { type: 'string', description: 'Tanggal akhir (YYYY-MM-DD).' },
        branch_id: { type: 'string', description: 'UUID branch (opsional).' },
        limit:     { type: 'number', description: 'Jumlah baris (default 15).' },
      },
    },
  },
  {
    name: 'get_report_compliance',
    description: 'Kepatuhan head store mengisi laporan harian dan setoran. Siapa yang paling sering skip.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Tanggal mulai (YYYY-MM-DD).' },
        date_to:   { type: 'string', description: 'Tanggal akhir (YYYY-MM-DD).' },
        branch_id: { type: 'string', description: 'UUID branch (opsional).' },
      },
    },
  },
  {
    name: 'get_visit_compliance',
    description: 'Kepatuhan DM dan AM mengisi laporan kunjungan. Siapa yang paling rajin dan paling lambat.',
    parameters: {
      type: 'object',
      properties: {
        date_from:  { type: 'string', description: 'Tanggal mulai (YYYY-MM-DD).' },
        date_to:    { type: 'string', description: 'Tanggal akhir (YYYY-MM-DD).' },
        manager_id: { type: 'string', description: 'UUID profile manager tertentu (opsional).' },
      },
    },
  },
  {
    name: 'get_understaffing_report',
    description: 'Toko yang sering understaffing berdasarkan jumlah_staff di laporan harian vs jumlah staff terdaftar.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Tanggal mulai (YYYY-MM-DD).' },
        date_to:   { type: 'string', description: 'Tanggal akhir (YYYY-MM-DD).' },
        branch_id: { type: 'string', description: 'UUID branch (opsional).' },
        limit:     { type: 'number', description: 'Jumlah toko (default 10).' },
      },
    },
  },
  {
    name: 'get_staff_activity_score',
    description: 'Skor aktivitas staff berdasarkan jumlah ceklis & preparation yang diisi.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Tanggal mulai (YYYY-MM-DD).' },
        date_to:   { type: 'string', description: 'Tanggal akhir (YYYY-MM-DD).' },
        branch_id: { type: 'string', description: 'UUID branch (opsional).' },
        limit:     { type: 'number', description: 'Jumlah staff (default 10).' },
      },
    },
  },
  {
    name: 'get_po_delivery_mismatch',
    description: 'Ketidaksesuaian antara PO (quantity ordered) dan pengiriman actual (quantity received) per item.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Tanggal mulai (YYYY-MM-DD).' },
        date_to:   { type: 'string', description: 'Tanggal akhir (YYYY-MM-DD).' },
        limit:     { type: 'number', description: 'Jumlah item (default 10).' },
      },
    },
  },
  {
    name: 'get_promotion_candidates',
    description: 'Kandidat promosi berdasarkan skor KPI personal tertinggi.',
    parameters: {
      type: 'object',
      properties: {
        period_year:  { type: 'number', description: 'Tahun periode KPI.' },
        period_month: { type: 'number', description: 'Bulan periode KPI.' },
        limit:        { type: 'number', description: 'Jumlah kandidat (default 10).' },
      },
    },
  },
  {
    name: 'get_sales_trend',
    description: 'Trend net sales bulanan per outlet dari data POS.',
    parameters: {
      type: 'object',
      properties: {
        outlet_name: { type: 'string', description: 'Nama outlet (opsional).' },
        period_from: { type: 'string', description: 'Periode mulai format YYYY-MM.' },
        period_to:   { type: 'string', description: 'Periode akhir format YYYY-MM.' },
        limit:       { type: 'number', description: 'Jumlah outlet (default 10).' },
      },
    },
  },
  {
    name: 'get_complaint_summary',
    description: 'Ringkasan komplain per outlet dan topik dari data POS.',
    parameters: {
      type: 'object',
      properties: {
        outlet_name: { type: 'string', description: 'Nama outlet (opsional).' },
        period_from: { type: 'string', description: 'Periode mulai format YYYY-MM.' },
        period_to:   { type: 'string', description: 'Periode akhir format YYYY-MM.' },
        topic:       { type: 'string', description: 'Filter topik komplain (opsional).' },
        limit:       { type: 'number', description: 'Jumlah baris hasil (default 10).' },
      },
    },
  },
]

// ── Tool handlers (sama persis, hanya query Supabase) ─────────────────────────

function wibToday(offsetDays = 0): string {
  const now = new Date()
  const wib = new Date(now.getTime() + 7 * 3600_000 + offsetDays * 86_400_000)
  return wib.toISOString().split('T')[0]
}

function parsePeriod(ym: string | undefined): { year: number; month: number } | null {
  if (!ym) return null
  const [y, m] = ym.split('-').map(Number)
  return y && m ? { year: y, month: m } : null
}

async function runTool(
  name: string,
  input: Record<string, unknown>,
  sb: ReturnType<typeof createClient>,
): Promise<unknown> {
  const today = wibToday()
  const weekAgo = wibToday(-7)

  switch (name) {
    case 'get_deposit_status': {
      const from = (input.date_from as string) || weekAgo
      const to   = (input.date_to   as string) || today
      let q = sb.from('daily_deposits').select('branch_id, tanggal, status, cash_disetorkan, branches(name, store_id)')
        .gte('tanggal', from).lte('tanggal', to)
      if (input.branch_id) q = q.eq('branch_id', input.branch_id as string)
      const { data, error } = await q.order('tanggal', { ascending: false })
      if (error) return { error: error.message }
      const byBranch: Record<string, { name: string; store_id: string; submitted: number; approved: number; rejected: number; belum: number; total_setoran: number }> = {}
      for (const row of data ?? []) {
        const b = (row.branches as { name: string; store_id: string }) ?? { name: row.branch_id, store_id: '' }
        if (!byBranch[row.branch_id]) byBranch[row.branch_id] = { name: b.name, store_id: b.store_id, submitted: 0, approved: 0, rejected: 0, belum: 0, total_setoran: 0 }
        const s = byBranch[row.branch_id]
        if (row.status === 'approved')       { s.approved++;  s.total_setoran += Number(row.cash_disetorkan || 0) }
        else if (row.status === 'submitted')   s.submitted++
        else if (row.status === 'rejected')    s.rejected++
        else                                   s.belum++
      }
      return { period: `${from} s/d ${to}`, branches: Object.values(byBranch) }
    }

    case 'get_checklist_skip_rate': {
      const from = (input.date_from as string) || weekAgo
      const to   = (input.date_to   as string) || today
      const lim  = (input.limit as number) || 10
      let qb = sb.from('branches').select('id, name, store_id').eq('is_active', true)
      if (input.branch_id) qb = qb.eq('id', input.branch_id as string)
      const { data: branches } = await qb.order('name')
      let qc = sb.from('daily_checklists').select('branch_id, shift').gte('tanggal', from).lte('tanggal', to)
      let qp = sb.from('daily_preparation').select('branch_id, shift').gte('tanggal', from).lte('tanggal', to)
      if (input.branch_id) { qc = qc.eq('branch_id', input.branch_id as string); qp = qp.eq('branch_id', input.branch_id as string) }
      const [{ data: checklists }, { data: preps }] = await Promise.all([qc, qp])
      const days = Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1)
      const expected = days * 3
      const ckCount: Record<string, number> = {}
      const prCount: Record<string, number> = {}
      for (const r of checklists ?? []) ckCount[r.branch_id] = (ckCount[r.branch_id] || 0) + 1
      for (const r of preps ?? [])      prCount[r.branch_id] = (prCount[r.branch_id] || 0) + 1
      const result = (branches ?? []).map((b) => ({
        name: b.name, store_id: b.store_id,
        checklist_done: ckCount[b.id] || 0, checklist_expected: expected,
        preparation_done: prCount[b.id] || 0, preparation_expected: expected,
        skip_rate_pct: Math.round((1 - ((ckCount[b.id] || 0) + (prCount[b.id] || 0)) / (expected * 2)) * 100),
      })).sort((a, b) => b.skip_rate_pct - a.skip_rate_pct).slice(0, lim)
      return { period: `${from} s/d ${to}`, expected_per_branch: expected, results: result }
    }

    case 'get_opex_by_branch': {
      const from = (input.date_from as string) || weekAgo
      const to   = (input.date_to   as string) || today
      const lim  = (input.limit as number) || 15
      let q = sb.from('operational_expenses').select('branch_id, total_amount, branches(name, store_id)')
        .gte('tanggal', from).lte('tanggal', to)
      if (input.branch_id) q = q.eq('branch_id', input.branch_id as string)
      const { data, error } = await q
      if (error) return { error: error.message }
      const byBranch: Record<string, { name: string; store_id: string; total: number; count: number }> = {}
      for (const r of data ?? []) {
        const b = (r.branches as { name: string; store_id: string }) ?? { name: r.branch_id, store_id: '' }
        if (!byBranch[r.branch_id]) byBranch[r.branch_id] = { name: b.name, store_id: b.store_id, total: 0, count: 0 }
        byBranch[r.branch_id].total += Number(r.total_amount || 0)
        byBranch[r.branch_id].count++
      }
      return { period: `${from} s/d ${to}`, results: Object.values(byBranch).sort((a, b) => b.total - a.total).slice(0, lim) }
    }

    case 'get_report_compliance': {
      const from = (input.date_from as string) || weekAgo
      const to   = (input.date_to   as string) || today
      let qb = sb.from('branches').select('id, name, store_id').eq('is_active', true)
      if (input.branch_id) qb = qb.eq('id', input.branch_id as string)
      const { data: branches } = await qb
      let qr = sb.from('daily_reports').select('branch_id, tanggal').gte('tanggal', from).lte('tanggal', to)
      let qd = sb.from('daily_deposits').select('branch_id, tanggal, status').gte('tanggal', from).lte('tanggal', to)
      if (input.branch_id) { qr = qr.eq('branch_id', input.branch_id as string); qd = qd.eq('branch_id', input.branch_id as string) }
      const [{ data: reports }, { data: deposits }] = await Promise.all([qr, qd])
      const days = Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1)
      const rCount: Record<string, number> = {}
      const dCount: Record<string, number> = {}
      for (const r of reports ?? []) rCount[r.branch_id] = (rCount[r.branch_id] || 0) + 1
      for (const d of deposits ?? []) if (d.status !== 'draft') dCount[d.branch_id] = (dCount[d.branch_id] || 0) + 1
      const results = (branches ?? []).map((b) => ({
        name: b.name, store_id: b.store_id,
        laporan_masuk: rCount[b.id] || 0, setoran_masuk: dCount[b.id] || 0,
        hari_operasional: days,
        skip_laporan: Math.max(0, days - (rCount[b.id] || 0)),
        skip_setoran: Math.max(0, days - (dCount[b.id] || 0)),
      })).sort((a, b) => b.skip_laporan - a.skip_laporan)
      return { period: `${from} s/d ${to}`, results }
    }

    case 'get_visit_compliance': {
      const from = (input.date_from as string) || weekAgo
      const to   = (input.date_to   as string) || today
      let q = sb.from('daily_visits').select('visited_by, visit_date, score, profiles(full_name, role)')
        .gte('visit_date', from).lte('visit_date', to)
      if (input.manager_id) q = q.eq('visited_by', input.manager_id as string)
      const { data, error } = await q
      if (error) return { error: error.message }
      const byMgr: Record<string, { name: string; role: string; count: number; avg_score: number; total_score: number }> = {}
      for (const r of data ?? []) {
        const p = (r.profiles as { full_name: string; role: string }) ?? { full_name: r.visited_by, role: '' }
        if (!byMgr[r.visited_by]) byMgr[r.visited_by] = { name: p.full_name, role: p.role, count: 0, avg_score: 0, total_score: 0 }
        byMgr[r.visited_by].count++
        byMgr[r.visited_by].total_score += Number(r.score || 0)
      }
      for (const m of Object.values(byMgr)) m.avg_score = m.count > 0 ? Math.round(m.total_score / m.count) : 0
      return { period: `${from} s/d ${to}`, results: Object.values(byMgr).sort((a, b) => b.count - a.count) }
    }

    case 'get_understaffing_report': {
      const from = (input.date_from as string) || weekAgo
      const to   = (input.date_to   as string) || today
      const lim  = (input.limit as number) || 10
      let qr = sb.from('daily_reports').select('branch_id, jumlah_staff').gte('tanggal', from).lte('tanggal', to)
      if (input.branch_id) qr = qr.eq('branch_id', input.branch_id as string)
      let qp = sb.from('profiles').select('branch_id').eq('is_active', true)
        .in('role', ['staff', 'barista', 'kitchen', 'waitress', 'asst_head_store'])
      if (input.branch_id) qp = qp.eq('branch_id', input.branch_id as string)
      let qb = sb.from('branches').select('id, name, store_id').eq('is_active', true)
      if (input.branch_id) qb = qb.eq('id', input.branch_id as string)
      const [{ data: reports }, { data: staffProfiles }, { data: branches }] = await Promise.all([qr, qp, qb])
      const staffCount: Record<string, number> = {}
      for (const p of staffProfiles ?? []) if (p.branch_id) staffCount[p.branch_id] = (staffCount[p.branch_id] || 0) + 1
      const reported: Record<string, number[]> = {}
      for (const r of reports ?? []) { if (!reported[r.branch_id]) reported[r.branch_id] = []; reported[r.branch_id].push(Number(r.jumlah_staff || 0)) }
      const results = (branches ?? []).map((b) => {
        const total = staffCount[b.id] || 0
        const days = reported[b.id] ?? []
        const avgReported = days.length ? days.reduce((a, x) => a + x, 0) / days.length : 0
        return { name: b.name, store_id: b.store_id, registered_staff: total, avg_reported_staff: Math.round(avgReported * 10) / 10, days_reported: days.length, understaffing_days: days.filter((d) => d < total * 0.7).length }
      }).sort((a, b) => b.understaffing_days - a.understaffing_days).slice(0, lim)
      return { period: `${from} s/d ${to}`, results }
    }

    case 'get_staff_activity_score': {
      const from = (input.date_from as string) || weekAgo
      const to   = (input.date_to   as string) || today
      const lim  = (input.limit as number) || 10
      let qc = sb.from('daily_checklists').select('submitted_by, profiles(full_name, branch_id, branches(name))')
        .gte('tanggal', from).lte('tanggal', to)
      if (input.branch_id) qc = qc.eq('branch_id', input.branch_id as string)
      const { data, error } = await qc
      if (error) return { error: error.message }
      const byStaff: Record<string, { name: string; branch: string; count: number }> = {}
      for (const r of data ?? []) {
        const p = r.profiles as { full_name: string; branch_id: string; branches: { name: string } }
        const pName = p?.full_name ?? r.submitted_by
        const bName = p?.branches?.name ?? ''
        if (!byStaff[r.submitted_by]) byStaff[r.submitted_by] = { name: pName, branch: bName, count: 0 }
        byStaff[r.submitted_by].count++
      }
      const sorted = Object.values(byStaff).sort((a, b) => b.count - a.count)
      return { period: `${from} s/d ${to}`, top: sorted.slice(0, lim), bottom: sorted.slice(-lim).reverse() }
    }

    case 'get_po_delivery_mismatch': {
      const from = (input.date_from as string) || wibToday(-30)
      const to   = (input.date_to   as string) || today
      const lim  = (input.limit as number) || 10
      const { data, error } = await sb.from('supply_order_items')
        .select('item_name, quantity_ordered, quantity_received, supply_orders(order_date, status)')
        .gte('supply_orders.order_date', from).lte('supply_orders.order_date', to)
      if (error) return { error: error.message }
      const byItem: Record<string, { item: string; ordered: number; received: number; count: number }> = {}
      for (const r of data ?? []) {
        if (!byItem[r.item_name]) byItem[r.item_name] = { item: r.item_name, ordered: 0, received: 0, count: 0 }
        byItem[r.item_name].ordered  += Number(r.quantity_ordered  || 0)
        byItem[r.item_name].received += Number(r.quantity_received || 0)
        byItem[r.item_name].count++
      }
      const results = Object.values(byItem)
        .map((x) => ({ ...x, mismatch: x.ordered - x.received, mismatch_pct: x.ordered ? Math.round((1 - x.received / x.ordered) * 100) : 0 }))
        .filter((x) => x.mismatch > 0).sort((a, b) => b.mismatch_pct - a.mismatch_pct).slice(0, lim)
      return { period: `${from} s/d ${to}`, results }
    }

    case 'get_promotion_candidates': {
      const year  = (input.period_year  as number) || new Date().getFullYear()
      const month = (input.period_month as number) || new Date().getMonth() + 1
      const lim   = (input.limit as number) || 10
      const { data, error } = await sb.from('kpi_personal_scores')
        .select('staff:profiles!staff_id(full_name, role, branches(name)), score, period_year, period_month')
        .eq('period_year', year).eq('period_month', month)
        .eq('status', 'verified').order('score', { ascending: false }).limit(lim)
      if (error) return { error: error.message }
      return { period: `${year}-${String(month).padStart(2, '0')}`, candidates: data }
    }

    case 'get_sales_trend': {
      const fromP = parsePeriod(input.period_from as string)
      const toP   = parsePeriod(input.period_to   as string)
      const lim   = (input.limit as number) || 10
      let q = sb.from('pos_sales_monthly').select('outlet_name, year, month, net_sales, gross_sales, transactions')
      if (input.outlet_name) q = q.ilike('outlet_name', `%${input.outlet_name}%`)
      if (fromP) q = q.or(`year.gt.${fromP.year},and(year.eq.${fromP.year},month.gte.${fromP.month})`)
      if (toP)   q = q.or(`year.lt.${toP.year},and(year.eq.${toP.year},month.lte.${toP.month})`)
      q = q.order('year', { ascending: false }).order('month', { ascending: false }).limit(lim * 12)
      const { data, error } = await q
      if (error) return { error: error.message }
      const byOutlet: Record<string, { outlet: string; months: unknown[] }> = {}
      for (const r of data ?? []) {
        if (!byOutlet[r.outlet_name]) byOutlet[r.outlet_name] = { outlet: r.outlet_name, months: [] }
        byOutlet[r.outlet_name].months.push({ year: r.year, month: r.month, net_sales: r.net_sales, transactions: r.transactions })
      }
      return { results: Object.values(byOutlet).slice(0, lim) }
    }

    case 'get_complaint_summary': {
      const fromP = parsePeriod(input.period_from as string)
      const toP   = parsePeriod(input.period_to   as string)
      const lim   = (input.limit as number) || 10
      let q = sb.from('pos_complaints').select('outlet_name, year, month, topic, priority, complaint_text, app')
      if (input.outlet_name) q = q.ilike('outlet_name', `%${input.outlet_name}%`)
      if (input.topic) q = q.ilike('topic', `%${input.topic}%`)
      if (fromP) q = q.or(`year.gt.${fromP.year},and(year.eq.${fromP.year},month.gte.${fromP.month})`)
      if (toP)   q = q.or(`year.lt.${toP.year},and(year.eq.${toP.year},month.lte.${toP.month})`)
      q = q.order('year', { ascending: false }).order('month', { ascending: false }).limit(200)
      const { data, error } = await q
      if (error) return { error: error.message }
      const byOutlet: Record<string, { outlet: string; total: number; by_topic: Record<string, number>; samples: string[] }> = {}
      for (const r of data ?? []) {
        if (!byOutlet[r.outlet_name]) byOutlet[r.outlet_name] = { outlet: r.outlet_name, total: 0, by_topic: {}, samples: [] }
        byOutlet[r.outlet_name].total++
        if (r.topic) byOutlet[r.outlet_name].by_topic[r.topic] = (byOutlet[r.outlet_name].by_topic[r.topic] || 0) + 1
        if (byOutlet[r.outlet_name].samples.length < 2 && r.complaint_text) byOutlet[r.outlet_name].samples.push(r.complaint_text)
      }
      return { results: Object.values(byOutlet).sort((a, b) => b.total - a.total).slice(0, lim) }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ── Agentic loop (Gemini) ─────────────────────────────────────────────────────

const SYSTEM = `Kamu adalah AI data analyst untuk Bagi Kopi Ops Manager.
Jawab pertanyaan dalam Bahasa Indonesia yang singkat dan actionable.
Gunakan data yang kamu ambil dari tools. Sertakan angka spesifik.
Kalau data tidak tersedia, sampaikan dengan jelas.
Format jawaban: narasi singkat (2-4 kalimat) + poin-poin kunci jika relevan.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const userToken = authHeader.replace('Bearer ', '')
  const { data: { user } } = await sb.auth.getUser(userToken)
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ops_manager') return new Response('Forbidden', { status: 403, headers: corsHeaders })

  const { question } = await req.json()
  if (!question) return new Response('Missing question', { status: 400, headers: corsHeaders })

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
    systemInstruction: SYSTEM,
  })

  const chat = model.startChat()
  let result = await chat.sendMessage(question)
  let finalText = ''
  const MAX_ROUNDS = 5

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const parts = result.response.candidates?.[0]?.content?.parts ?? []
    const functionCalls = parts.filter((p: { functionCall?: unknown }) => p.functionCall)

    if (functionCalls.length === 0) {
      finalText = result.response.text()
      break
    }

    const toolResponses = []
    for (const part of functionCalls) {
      const { name, args } = part.functionCall as { name: string; args: Record<string, unknown> }
      const toolResult = await runTool(name, args, sb)
      toolResponses.push({
        functionResponse: { name, response: { result: toolResult } },
      })
    }

    result = await chat.sendMessage(toolResponses)
  }

  return new Response(JSON.stringify({ answer: finalText || 'Tidak ada jawaban.' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
