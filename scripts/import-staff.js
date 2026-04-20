/**
 * import-staff.js — Bulk-create Supabase Auth users dari staff_import.csv
 *
 * Jalankan:
 *   node scripts/import-staff.js
 *
 * Butuh env vars (tambahkan sementara ke .env atau export di terminal):
 *   SUPABASE_URL            = nilai VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY = dari Supabase > Settings > API > service_role
 *   STAFF_PASS              = nilai VITE_STAFF_PASS yang sama
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load .env manually (no extra deps needed) ─────────────────
function loadEnv(path) {
  try {
    const lines = readFileSync(path, 'utf8').split('\n')
    for (const line of lines) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}
loadEnv(resolve(__dirname, '../.env'))
loadEnv(resolve(__dirname, '../.env.local'))

const URL_     = process.env.SUPABASE_URL          || process.env.VITE_SUPABASE_URL
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASS     = process.env.STAFF_PASS             || process.env.VITE_STAFF_PASS

if (!URL_ || !SVC_KEY || !PASS) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STAFF_PASS di .env atau terminal.')
  process.exit(1)
}

const supabase = createClient(URL_, SVC_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Simple CSV parser (no external dep) ───────────────────────
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split('\n')
  const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim())
  return lines.slice(1).map((line) => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$)/g) || []
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/"/g, '').trim() })
    return obj
  })
}

// ── Normalize dept → branch key ───────────────────────────────
function normDept(dept) {
  return dept.replace(/^Bagi\s+Kopi[\s\-\u2013]+/i, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const csvText = readFileSync(resolve(__dirname, '../staff_import.csv'), 'utf8')
  const rows = parseCsv(csvText).filter((r) => r.Email && r.Email.includes('@'))

  // Load branches
  const { data: branches, error: bErr } = await supabase
    .from('branches').select('id,name').eq('is_active', true)
  if (bErr) { console.error('Gagal load branches:', bErr.message); process.exit(1) }

  const branchMap = new Map()
  for (const b of branches) {
    branchMap.set(normDept(b.name), b.id)
    branchMap.set(b.name.toLowerCase().trim(), b.id)
  }
  console.log(`Loaded ${branches.length} branches.\n`)

  let ok = 0, skip = 0, fail = 0

  for (const row of rows) {
    const email    = row.Email.toLowerCase().trim()
    const role     = row.Role
    const name     = row.Name.trim()
    const branchId = branchMap.get(normDept(row.Dept)) || null

    if (!branchId) console.warn(`  ⚠ Branch not found: "${row.Dept}" (${email})`)

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: PASS,
      email_confirm: true,
      user_metadata: { full_name: name, role },
    })

    if (error) {
      if (error.message.includes('already')) {
        console.log(`  skip  ${email}`)
        skip++
      } else {
        console.error(`  FAIL  ${email}: ${error.message}`)
        fail++
      }
    } else {
      if (branchId && data?.user?.id) {
        await supabase.from('profiles')
          .update({ full_name: name, role, branch_id: branchId })
          .eq('id', data.user.id)
      }
      console.log(`  OK    [${role.padEnd(16)}] ${email}`)
      ok++
    }

    await sleep(150) // ~6 req/s, di bawah limit
  }

  console.log(`\n── Selesai ──`)
  console.log(`  Dibuat  : ${ok}`)
  console.log(`  Dilewati: ${skip}`)
  console.log(`  Gagal   : ${fail}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
