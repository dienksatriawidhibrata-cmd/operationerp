import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const FUNCTION_DECLARATIONS = [
  {
    name: 'get_deposit_status',
    description: 'Status setoran toko: berapa yang sudah setor, pending, belum setor.',
    parameters: { type: 'OBJECT', properties: {
      date_from: { type: 'STRING', description: 'Tanggal mulai YYYY-MM-DD. Default 7 hari lalu.' },
      date_to:   { type: 'STRING', description: 'Tanggal akhir YYYY-MM-DD. Default hari ini.' },
      branch_id: { type: 'STRING', description: 'UUID branch (opsional).' },
    }},
  },
  {
    name: 'get_checklist_skip_rate',
    description: 'Tingkat skip ceklis & preparation per toko, diurutkan dari yang paling sering skip.',
    parameters: { type: 'OBJECT', properties: {
      date_from: { type: 'STRING', description: 'Tanggal mulai YYYY-MM-DD.' },
      date_to:   { type: 'STRING', description: 'Tanggal akhir YYYY-MM-DD.' },
      branch_id: { type: 'STRING', description: 'UUID branch (opsional).' },
      limit:     { type: 'NUMBER', description: 'Jumlah toko (default 10).' },
    }},
  },
  {
    name: 'get_opex_by_branch',
    description: 'Beban operasional (opex) per toko.',
    parameters: { type: 'OBJECT', properties: {
      date_from: { type: 'STRING', description: 'Tanggal mulai YYYY-MM-DD.' },
      date_to:   { type: 'STRING', description: 'Tanggal akhir YYYY-MM-DD.' },
      branch_id: { type: 'STRING', description: 'UUID branch (opsional).' },
      limit:     { type: 'NUMBER', description: 'Jumlah baris (default 15).' },
    }},
  },
  {
    name: 'get_report_compliance',
    description: 'Kepatuhan head store mengisi laporan harian dan setoran.',
    parameters: { type: 'OBJECT', properties: {
      date_from: { type: 'STRING', description: 'Tanggal mulai YYYY-MM-DD.' },
      date_to:   { type: 'STRING', description: 'Tanggal akhir YYYY-MM-DD.' },
      branch_id: { type: 'STRING', description: 'UUID branch (opsional).' },
    }},
  },
  {
    name: 'get_visit_compliance',
    description: 'Kepatuhan DM dan AM mengisi laporan kunjungan.',
    parameters: { type: 'OBJECT', properties: {
      date_from:  { type: 'STRING', description: 'Tanggal mulai YYYY-MM-DD.' },
      date_to:    { type: 'STRING', description: 'Tanggal akhir YYYY-MM-DD.' },
      manager_id: { type: 'STRING', description: 'UUID profile manager (opsional).' },
    }},
  },
  {
    name: 'get_understaffing_report',
    description: 'Toko yang sering understaffing berdasarkan jumlah_staff di laporan harian.',
    parameters: { type: 'OBJECT', properties: {
      date_from: { type: 'STRING', description: 'Tanggal mulai YYYY-MM-DD.' },
      date_to:   { type: 'STRING', description: 'Tanggal akhir YYYY-MM-DD.' },
      branch_id: { type: 'STRING', description: 'UUID branch (opsional).' },
      limit:     { type: 'NUMBER', description: 'Jumlah toko (default 10).' },
    }},
  },
  {
    name: 'get_staff_activity_score',
    description: 'Skor aktivitas staff berdasarkan jumlah ceklis yang diisi.',
    parameters: { type: 'OBJECT', properties: {
      date_from: { type: 'STRING', description: 'Tanggal mulai YYYY-MM-DD.' },
      date_to:   { type: 'STRING', description: 'Tanggal akhir YYYY-MM-DD.' },
      branch_id: { type: 'STRING', description: 'UUID branch (opsional).' },
      limit:     { type: 'NUMBER', description: 'Jumlah staff (default 10).' },
    }},
  },
  {
    name: 'get_sales_trend',
    description: 'Trend net sales bulanan per outlet dari data POS.',
    parameters: { type: 'OBJECT', properties: {
      outlet_name: { type: 'STRING', description: 'Nama outlet (opsional).' },
      period_from: { type: 'STRING', description: 'Periode mulai YYYY-MM.' },
      period_to:   { type: 'STRING', description: 'Periode akhir YYYY-MM.' },
      limit:       { type: 'NUMBER', description: 'Jumlah outlet (default 10).' },
    }},
  },
  {
    name: 'get_complaint_summary',
    description: 'Ringkasan komplain per outlet dan topik dari data POS.',
    parameters: { type: 'OBJECT', properties: {
      outlet_name: { type: 'STRING', description: 'Nama outlet (opsional).' },
      period_from: { type: 'STRING', description: 'Periode mulai YYYY-MM.' },
      period_to:   { type: 'STRING', description: 'Periode akhir YYYY-MM.' },
      topic:       { type: 'STRING', description: 'Filter topik (opsional).' },
      limit:       { type: 'NUMBER', description: 'Jumlah baris (default 10).' },
    }},
  },
]

// ── Gemini REST helper ────────────────────────────────────────────────────────

type GeminiContent = { role: string; parts: GeminiPart[] }
type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: unknown } }

async function geminiGenerate(contents: GeminiContent[]): Promise<{ parts: GeminiPart[]; finishReason: string }> {
  const body = {
    contents,
    tools: [{ function_declarations: FUNCTION_DECLARATIONS }],
    system_instruction: { parts: [{ text: `Kamu adalah AI data analyst untuk Bagi Kopi Ops Manager.
Jawab pertanyaan dalam Bahasa Indonesia yang singkat dan actionable.
Gunakan data dari tools. Sertakan angka spesifik.
Kalau data tidak tersedia, sampaikan dengan jelas.
Format: narasi singkat 2-4 kalimat + poin kunci jika relevan.` }] },
  }
  const resp = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`Gemini error ${resp.status}: ${txt}`)
  }
  const json = await resp.json()
  const candidate = json.candidates?.[0]
  return { parts: candidate?.content?.parts ?? [], finishReason: candidate?.finishReason ?? '' }
}

// ── Tool handlers ─────────────────────────────────────────────────────────────

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

async function runTool(name: string, input: Record<string, unknown>, sb: ReturnType<typeof createClient>): Promise<unknown> {
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
        if (row.status === 'approved')     { s.approved++; s.total_setoran += Number(row.cash_disetorkan || 0) }
        else if (row.status === 'submitted') s.submitted++
        else if (row.status === 'rejected')  s.rejected++
        else                                 s.belum++
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
      let qc = sb.from('daily_checklists').select('branch_id').gte('tanggal', from).lte('tanggal', to)
      let qp = sb.from('daily_preparation').select('branch_id').gte('tanggal', from).lte('tanggal', to)
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
        checklist_done: ckCount[b.id] || 0,
        preparation_done: prCount[b.id] || 0,
        expected_each: expected,
        skip_rate_pct: Math.round((1 - ((ckCount[b.id] || 0) + (prCount[b.id] || 0)) / (expected * 2)) * 100),
      })).sort((a, b) => b.skip_rate_pct - a.skip_rate_pct).slice(0, lim)
      return { period: `${from} s/d ${to}`, results: result }
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
      let qr = sb.from('daily_reports').select('branch_id').gte('tanggal', from).lte('tanggal', to)
      let qd = sb.from('daily_deposits').select('branch_id, status').gte('tanggal', from).lte('tanggal', to)
      if (input.branch_id) { qr = qr.eq('branch_id', input.branch_id as string); qd = qd.eq('branch_id', input.branch_id as string) }
      const [{ data: reports }, { data: deposits }] = await Promise.all([qr, qd])
      const days = Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1)
      const rCount: Record<string, number> = {}
      const dCount: Record<string, number> = {}
      for (const r of reports ?? []) rCount[r.branch_id] = (rCount[r.branch_id] || 0) + 1
      for (const d of deposits ?? []) if (d.status !== 'draft') dCount[d.branch_id] = (dCount[d.branch_id] || 0) + 1
      return { period: `${from} s/d ${to}`, results: (branches ?? []).map((b) => ({
        name: b.name, store_id: b.store_id,
        laporan_masuk: rCount[b.id] || 0,
        setoran_masuk: dCount[b.id] || 0,
        hari: days,
        skip_laporan: Math.max(0, days - (rCount[b.id] || 0)),
        skip_setoran: Math.max(0, days - (dCount[b.id] || 0)),
      })).sort((a, b) => b.skip_laporan - a.skip_laporan) }
    }

    case 'get_visit_compliance': {
      const from = (input.date_from as string) || weekAgo
      const to   = (input.date_to   as string) || today
      let q = sb.from('daily_visits').select('visited_by, visit_date, score, profiles(full_name, role)')
        .gte('visit_date', from).lte('visit_date', to)
      if (input.manager_id) q = q.eq('visited_by', input.manager_id as string)
      const { data, error } = await q
      if (error) return { error: error.message }
      const byMgr: Record<string, { name: string; role: string; count: number; total_score: number }> = {}
      for (const r of data ?? []) {
        const p = (r.profiles as { full_name: string; role: string }) ?? { full_name: r.visited_by, role: '' }
        if (!byMgr[r.visited_by]) byMgr[r.visited_by] = { name: p.full_name, role: p.role, count: 0, total_score: 0 }
        byMgr[r.visited_by].count++
        byMgr[r.visited_by].total_score += Number(r.score || 0)
      }
      return { period: `${from} s/d ${to}`, results: Object.values(byMgr)
        .map((m) => ({ ...m, avg_score: m.count > 0 ? Math.round(m.total_score / m.count) : 0 }))
        .sort((a, b) => b.count - a.count) }
    }

    case 'get_understaffing_report': {
      const from = (input.date_from as string) || weekAgo
      const to   = (input.date_to   as string) || today
      const lim  = (input.limit as number) || 10
      let qr = sb.from('daily_reports').select('branch_id, jumlah_staff').gte('tanggal', from).lte('tanggal', to)
      if (input.branch_id) qr = qr.eq('branch_id', input.branch_id as string)
      const { data: reports } = await qr
      const { data: staffProfiles } = await sb.from('profiles').select('branch_id').eq('is_active', true)
        .in('role', ['staff', 'barista', 'kitchen', 'waitress', 'asst_head_store'])
      const { data: branches } = await sb.from('branches').select('id, name, store_id').eq('is_active', true)
      const staffCount: Record<string, number> = {}
      for (const p of staffProfiles ?? []) if (p.branch_id) staffCount[p.branch_id] = (staffCount[p.branch_id] || 0) + 1
      const reported: Record<string, number[]> = {}
      for (const r of reports ?? []) { if (!reported[r.branch_id]) reported[r.branch_id] = []; reported[r.branch_id].push(Number(r.jumlah_staff || 0)) }
      return { period: `${from} s/d ${to}`, results: (branches ?? []).map((b) => {
        const total = staffCount[b.id] || 0
        const days = reported[b.id] ?? []
        const avg = days.length ? days.reduce((a, x) => a + x, 0) / days.length : 0
        return { name: b.name, store_id: b.store_id, registered_staff: total, avg_reported: Math.round(avg * 10) / 10, understaffing_days: days.filter((d) => d < total * 0.7).length }
      }).sort((a, b) => b.understaffing_days - a.understaffing_days).slice(0, lim) }
    }

    case 'get_staff_activity_score': {
      const from = (input.date_from as string) || weekAgo
      const to   = (input.date_to   as string) || today
      const lim  = (input.limit as number) || 10
      let qc = sb.from('daily_checklists').select('submitted_by, profiles(full_name, branches(name))')
        .gte('tanggal', from).lte('tanggal', to)
      if (input.branch_id) qc = qc.eq('branch_id', input.branch_id as string)
      const { data, error } = await qc
      if (error) return { error: error.message }
      const byStaff: Record<string, { name: string; branch: string; count: number }> = {}
      for (const r of data ?? []) {
        const p = r.profiles as { full_name: string; branches: { name: string } }
        if (!byStaff[r.submitted_by]) byStaff[r.submitted_by] = { name: p?.full_name ?? r.submitted_by, branch: p?.branches?.name ?? '', count: 0 }
        byStaff[r.submitted_by].count++
      }
      const sorted = Object.values(byStaff).sort((a, b) => b.count - a.count)
      return { period: `${from} s/d ${to}`, top: sorted.slice(0, lim), bottom: sorted.slice(-lim).reverse() }
    }

    case 'get_sales_trend': {
      const fromP = parsePeriod(input.period_from as string)
      const toP   = parsePeriod(input.period_to   as string)
      const lim   = (input.limit as number) || 10
      let q = sb.from('pos_sales_monthly').select('outlet_name, year, month, net_sales, transactions')
      if (input.outlet_name) q = q.ilike('outlet_name', `%${input.outlet_name}%`)
      if (fromP) q = q.or(`year.gt.${fromP.year},and(year.eq.${fromP.year},month.gte.${fromP.month})`)
      if (toP)   q = q.or(`year.lt.${toP.year},and(year.eq.${toP.year},month.lte.${toP.month})`)
      const { data, error } = await q.order('year', { ascending: false }).order('month', { ascending: false }).limit(lim * 12)
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
      let q = sb.from('pos_complaints').select('outlet_name, year, month, topic, priority, complaint_text')
      if (input.outlet_name) q = q.ilike('outlet_name', `%${input.outlet_name}%`)
      if (input.topic)       q = q.ilike('topic', `%${input.topic}%`)
      if (fromP) q = q.or(`year.gt.${fromP.year},and(year.eq.${fromP.year},month.gte.${fromP.month})`)
      if (toP)   q = q.or(`year.lt.${toP.year},and(year.eq.${toP.year},month.lte.${toP.month})`)
      const { data, error } = await q.order('year', { ascending: false }).limit(200)
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

// ── Main handler ──────────────────────────────────────────────────────────────

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

  // Agentic loop
  const contents: GeminiContent[] = [{ role: 'user', parts: [{ text: question }] }]
  let finalText = ''

  for (let round = 0; round < 5; round++) {
    const { parts, finishReason } = await geminiGenerate(contents)

    const functionCalls = parts.filter((p): p is { functionCall: { name: string; args: Record<string, unknown> } } => 'functionCall' in p)

    if (functionCalls.length === 0 || finishReason === 'STOP') {
      finalText = parts.filter((p): p is { text: string } => 'text' in p).map((p) => p.text).join('\n')
      break
    }

    // Add model response to history
    contents.push({ role: 'model', parts })

    // Execute tools and add results
    const responseParts: GeminiPart[] = []
    for (const { functionCall } of functionCalls) {
      const result = await runTool(functionCall.name, functionCall.args, sb)
      responseParts.push({ functionResponse: { name: functionCall.name, response: result } })
    }
    contents.push({ role: 'user', parts: responseParts })
  }

  return new Response(JSON.stringify({ answer: finalText || 'Tidak ada jawaban.' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
