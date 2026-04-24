import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

interface Branch {
  id: string
  name: string
  store_id: string
  district: string
  area: string
}

interface Profile {
  id: string
  full_name: string
  email: string
  role: string
  managed_districts: string[]
  managed_areas: string[]
}

interface MissingEntry {
  branch: Branch
  items: string[]
}

function wibDate(offsetDays = 0): string {
  const now = new Date()
  const wib = new Date(now.getTime() + 7 * 3600 * 1000 + offsetDays * 86400 * 1000)
  return wib.toISOString().split('T')[0]
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function shiftLabel(shift: string): string {
  if (shift === 'pagi') return 'Ceklis Pagi'
  if (shift === 'middle') return 'Reminder Siang'
  return 'Ceklis Malam'
}

function buildEmailHtml(dm: Profile, missing: MissingEntry[], shift: string, today: string): string {
  const rows = missing.map(({ branch, items }) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#1e293b">${branch.name.replace('Bagi Kopi ', '')}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px">${branch.store_id}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#ef4444;font-size:13px">${items.join(', ')}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:#1e293b;padding:24px 32px">
      <div style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">Bagi Kopi Ops</div>
      <div style="color:#fff;font-size:20px;font-weight:800;margin-top:4px">Reminder ${shiftLabel(shift)}</div>
      <div style="color:#64748b;font-size:13px;margin-top:2px">${dateLabel(today)}</div>
    </div>
    <div style="padding:24px 32px">
      <p style="color:#475569;font-size:14px;margin:0 0 20px">
        Halo <strong>${dm.full_name}</strong>, berikut toko di wilayahmu yang belum submit per waktu reminder:
      </p>
      <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em">Toko</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em">ID</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em">Belum masuk</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#94a3b8;font-size:12px;margin:20px 0 0">
        Segera koordinasi dengan head store terkait untuk memastikan semua submission masuk.
      </p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #f1f5f9">
      <p style="color:#cbd5e1;font-size:11px;margin:0">Bagi Kopi Ops System — pesan otomatis, jangan dibalas</p>
    </div>
  </div>
</body>
</html>`
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
  })
  return res.ok
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  if (CRON_SECRET) {
    const auth = req.headers.get('Authorization') ?? ''
    if (!auth.includes(CRON_SECRET)) return new Response('Unauthorized', { status: 401 })
  }

  const { shift } = await req.json() as { shift: 'pagi' | 'middle' | 'malam' }
  if (!['pagi', 'middle', 'malam'].includes(shift)) {
    return new Response('Invalid shift', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const today = wibDate()
  const yesterday = wibDate(-1)

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, store_id, district, area')
    .eq('is_active', true)

  if (!branches?.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'No active branches' }), { status: 200 })
  }

  // Batch-query submitted records to avoid N+1
  const branchIds = branches.map((b) => b.id)

  const missing: MissingEntry[] = []

  if (shift === 'pagi') {
    const [{ data: ceklisRows }, { data: prepRows }] = await Promise.all([
      supabase.from('daily_checklists').select('branch_id').eq('tanggal', today).eq('shift', 'pagi').in('branch_id', branchIds),
      supabase.from('daily_preparation').select('branch_id').eq('tanggal', today).eq('shift', 'pagi').in('branch_id', branchIds),
    ])
    const hasCeklis = new Set(ceklisRows?.map((r) => r.branch_id))
    const hasPrep = new Set(prepRows?.map((r) => r.branch_id))

    for (const b of branches) {
      const items = []
      if (!hasCeklis.has(b.id)) items.push('Ceklis Pagi')
      if (!hasPrep.has(b.id)) items.push('Preparation Pagi')
      if (items.length) missing.push({ branch: b, items })
    }
  }

  if (shift === 'middle') {
    const [{ data: ceklisRows }, { data: prepRows }, { data: laporanRows }, { data: setoranRows }] = await Promise.all([
      supabase.from('daily_checklists').select('branch_id').eq('tanggal', today).eq('shift', 'middle').in('branch_id', branchIds),
      supabase.from('daily_preparation').select('branch_id').eq('tanggal', today).eq('shift', 'middle').in('branch_id', branchIds),
      supabase.from('daily_reports').select('branch_id').eq('tanggal', yesterday).in('branch_id', branchIds),
      supabase.from('daily_deposits').select('branch_id').eq('tanggal', yesterday).in('status', ['submitted', 'approved']).in('branch_id', branchIds),
    ])
    const hasCeklis = new Set(ceklisRows?.map((r) => r.branch_id))
    const hasPrep = new Set(prepRows?.map((r) => r.branch_id))
    const hasLaporan = new Set(laporanRows?.map((r) => r.branch_id))
    const hasSetoran = new Set(setoranRows?.map((r) => r.branch_id))

    for (const b of branches) {
      const items = []
      if (!hasCeklis.has(b.id)) items.push('Ceklis Middle')
      if (!hasPrep.has(b.id)) items.push('Preparation Middle')
      if (!hasLaporan.has(b.id)) items.push('Laporan Harian')
      if (!hasSetoran.has(b.id)) items.push('Setoran')
      if (items.length) missing.push({ branch: b, items })
    }
  }

  if (shift === 'malam') {
    const { data: ceklisRows } = await supabase
      .from('daily_checklists').select('branch_id').eq('tanggal', today).eq('shift', 'malam').in('branch_id', branchIds)
    const hasCeklis = new Set(ceklisRows?.map((r) => r.branch_id))
    for (const b of branches) {
      if (!hasCeklis.has(b.id)) missing.push({ branch: b, items: ['Ceklis Malam'] })
    }
  }

  if (!missing.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'All stores on track' }), { status: 200 })
  }

  // Get managers
  const { data: managers } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, managed_districts, managed_areas')
    .in('role', ['district_manager', 'area_manager', 'ops_manager'])
    .eq('is_active', true)
    .not('email', 'is', null)

  // Group missing branches per manager
  const dmMap = new Map<string, { dm: Profile; entries: MissingEntry[] }>()
  for (const entry of missing) {
    const matchedManagers = (managers ?? []).filter((dm) => {
      if (dm.role === 'ops_manager') return true
      if (dm.role === 'district_manager') return (dm.managed_districts ?? []).includes(entry.branch.district)
      if (dm.role === 'area_manager') return (dm.managed_areas ?? []).includes(entry.branch.area)
      return false
    })
    for (const dm of matchedManagers) {
      if (!dmMap.has(dm.id)) dmMap.set(dm.id, { dm, entries: [] })
      dmMap.get(dm.id)!.entries.push(entry)
    }
  }

  let sent = 0
  const shiftSubjectMap: Record<string, string> = {
    pagi: 'Ceklis Pagi Belum Masuk',
    middle: 'Reminder Siang (14:00 WIB) Belum Masuk',
    malam: 'Ceklis Malam Belum Masuk',
  }

  for (const { dm, entries } of dmMap.values()) {
    const subject = `[Bagi Kopi] ${shiftSubjectMap[shift]} — ${dateLabel(today)}`
    const html = buildEmailHtml(dm, entries, shift, today)
    const ok = await sendEmail(dm.email, subject, html)
    if (ok) sent++
  }

  return new Response(JSON.stringify({ sent, missing: missing.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
