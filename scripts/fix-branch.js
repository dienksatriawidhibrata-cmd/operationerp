/**
 * fix-branch.js
 * Diagnosa mismatch branch lalu update branch_id di profiles.
 *
 * Jalankan:
 *   node scripts/fix-branch.js           ← dry-run (lihat mismatch saja)
 *   node scripts/fix-branch.js --apply   ← apply update ke DB
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}
loadEnv(resolve(__dirname, '../.env'))
loadEnv(resolve(__dirname, '../.env.local'))

const URL_    = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !SVC_KEY) { console.error('Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const supabase = createClient(URL_, SVC_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const APPLY = process.argv.includes('--apply')

function unquote(field) {
  // Strip outer quotes and unescape inner "" → "
  if (field.startsWith('"') && field.endsWith('"')) {
    return field.slice(1, -1).replace(/""/g, '"')
  }
  return field
}

function splitCsvRow(row) {
  // Standard CSV split respecting quoted fields and "" escapes
  const vals = []
  let cur = '', inQ = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') {
      if (inQ && row[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      vals.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  vals.push(cur.trim())
  return vals
}

function parseCsv(text) {
  // Handle BOM, CRLF, dan CR
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
  // Each line is wrapped in outer quotes: "field1,""field2"",..."
  // unquote() strips outer quotes and unescapes "" → "
  const headers = splitCsvRow(unquote(lines[0].trim()))
  return lines.slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const vals = splitCsvRow(unquote(line.trim()))
      const obj = {}
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim() })
      return obj
    })
    .filter((r) => r.Email && r.Email.includes('@'))
}

function norm(s) {
  return s.replace(/^Bagi\s+Kopi[\s\-\u2013]*/i, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

async function main() {
  // 1. Load branches dari DB
  const { data: branches } = await supabase.from('branches').select('id,name').eq('is_active', true)

  console.log('\n── Branch names di DB ──────────────────')
  branches.forEach((b) => console.log(`  "${b.name}"  →  key: "${norm(b.name)}"`))

  const branchByNorm = new Map(branches.map((b) => [norm(b.name), b]))
  const branchByFull = new Map(branches.map((b) => [b.name.toLowerCase().trim(), b]))

  function findBranch(dept) {
    return branchByNorm.get(norm(dept)) || branchByFull.get(dept.toLowerCase().trim()) || null
  }

  // 2. Load CSV
  const rows = parseCsv(readFileSync(resolve(__dirname, '../staff_import.csv'), 'utf8'))

  // 3. Debug: cek isi profiles dulu
  const { data: sample, error: sErr } = await supabase
    .from('profiles')
    .select('id,email,role,branch_id')
    .limit(10)
  if (sErr) { console.error('Error query profiles:', sErr.message); process.exit(1) }
  console.log('\n── Sample 10 profiles dari DB ──────────')
  sample.forEach((p) => console.log(`  [${p.role}] email="${p.email}" branch=${p.branch_id || 'NULL'}`))

  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  console.log(`\nTotal profiles di DB: ${count}`)

  // Load semua profiles sekaligus (tanpa filter email dulu)
  const csvEmails = new Set(rows.map((r) => r.Email.toLowerCase().trim()))
  let allProfiles = []
  let page = 0
  while (true) {
    const { data } = await supabase
      .from('profiles')
      .select('id,email,role,branch_id')
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (!data || data.length === 0) break
    allProfiles = allProfiles.concat(data)
    if (data.length < 1000) break
    page++
  }

  // Filter hanya yang emailnya ada di CSV
  const profiles = allProfiles.filter((p) => p.email && csvEmails.has(p.email.toLowerCase().trim()))
  console.log(`Profile cocok dengan CSV: ${profiles.length} dari ${csvEmails.size} email CSV`)

  const profileByEmail = new Map(profiles.map((p) => [p.email?.toLowerCase(), p]))

  // 4. Match & report
  console.log('\n── Diagnosa mismatch ───────────────────')
  const updates = []
  const misses  = []

  for (const row of rows) {
    const email   = row.Email.toLowerCase().trim()
    const profile = profileByEmail.get(email)
    if (!profile) { console.log(`  NO PROFILE: ${email}`); continue }

    const branch = findBranch(row.Dept)
    if (!branch) {
      misses.push({ email, dept: row.Dept })
      continue
    }

    const needsUpdate =
      !profile.branch_id ||
      profile.branch_id !== branch.id ||
      profile.role !== row.Role

    if (needsUpdate) {
      updates.push({
        id: profile.id, email,
        branch_id: branch.id, branch_name: branch.name,
        role: row.Role, old_role: profile.role,
      })
    }
  }

  console.log(`\n  Akan diupdate : ${updates.length}`)
  console.log(`  Tidak ketemu  : ${misses.length}`)

  if (misses.length) {
    console.log('\n── Dept yang tidak match ───────────────')
    misses.forEach((m) => console.log(`  "${m.dept}"  →  key: "${norm(m.dept)}"  (${m.email})`))
  }

  if (!APPLY) {
    console.log('\n[DRY RUN] Tambahkan --apply untuk update ke DB.\n')
    return
  }

  // 5. Apply updates
  console.log('\n── Applying updates ────────────────────')
  let ok = 0, fail = 0
  for (const u of updates) {
    const { error } = await supabase
      .from('profiles')
      .update({ branch_id: u.branch_id, role: u.role })
      .eq('id', u.id)
    if (error) { console.error(`  FAIL ${u.email}: ${error.message}`); fail++ }
    else { console.log(`  OK   [${u.role.padEnd(16)}] ${u.email} → ${u.branch_name}`); ok++ }
  }
  console.log(`\n  Updated: ${ok}, Failed: ${fail}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
