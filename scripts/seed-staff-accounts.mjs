// seed-staff-accounts.mjs
// 1. Delete auth + profile for dksatriaw@gmail.com and dienksatriawidhibrata@bagikopi.id
// 2. Create auth + profile for all staff in StaffBaru.xlsx (excl. DROP/RESIGN=true)

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://smykjtotvtuxrwsilyqu.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNteWtqdG90dnR1eHJ3c2lseXF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIzMTI5MywiZXhwIjoyMDkxODA3MjkzfQ.vQBQPHN-P3OFOJYaS2cU3vqw41KrVartD85nLoGsdRk'
const SHARED_PASS  = '1PassBagiKopiOps!!!'

const EMAILS_TO_DELETE = [
  'dksatriaw@gmail.com',
  'dienksatriawidhibrata@bagikopi.id',
]

const POSITION_TO_ROLE = {
  barista:  'barista',
  kitchen:  'kitchen',
  waitress: 'waitress',
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ── Helper ────────────────────────────────────────────────────────────────────
function normalizePosition(pos) {
  if (!pos) return 'staff'
  const p = pos.toLowerCase().trim()
  for (const key of Object.keys(POSITION_TO_ROLE)) {
    if (p.includes(key)) return POSITION_TO_ROLE[key]
  }
  return 'staff'
}

function normalizeDept(dept) {
  if (!dept) return ''
  return dept.trim()
}

// ── Step 1: Delete accounts ───────────────────────────────────────────────────
async function deleteAccounts() {
  console.log('\n=== Deleting accounts ===')
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })

  for (const email of EMAILS_TO_DELETE) {
    const user = users.find(u => u.email === email)
    if (!user) {
      console.log(`  SKIP  ${email} (not found in auth)`)
      continue
    }

    // Delete auth user (profile should cascade via FK or trigger)
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
      console.log(`  ERROR deleting ${email}: ${error.message}`)
    } else {
      console.log(`  DELETED auth: ${email} (id: ${user.id})`)
    }

    // Also explicitly delete from profiles in case no cascade
    const { error: profErr } = await admin.from('profiles').delete().eq('id', user.id)
    if (profErr) {
      console.log(`  WARN  profiles delete for ${email}: ${profErr.message}`)
    } else {
      console.log(`  DELETED profile: ${email}`)
    }
  }
}

// ── Step 2: Load Excel ────────────────────────────────────────────────────────
function loadStaff() {
  const wb = XLSX.readFile(join(__dir, '..', 'StaffBaru.xlsx'))
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

  return rows.filter(row => {
    const drop = String(row['DROP/RESIGN'] ?? '').toLowerCase().trim()
    return drop !== 'true' && drop !== '1' && drop !== 'yes'
  })
}

// ── Step 3: Fetch branches ────────────────────────────────────────────────────
async function fetchBranches() {
  const { data, error } = await admin.from('branches').select('id, name')
  if (error) throw new Error('Failed to fetch branches: ' + error.message)
  const map = {}
  for (const b of data) map[b.name.trim().toLowerCase()] = b.id
  console.log('\nBranches loaded:', Object.keys(map).length)
  return map
}

function resolveBranchId(dept, branchMap) {
  const key = normalizeDept(dept).toLowerCase()
  // Exact match
  if (branchMap[key]) return branchMap[key]
  // Partial match
  for (const [name, id] of Object.entries(branchMap)) {
    if (key.includes(name) || name.includes(key)) return id
  }
  return null
}

// ── Step 4: Create accounts ───────────────────────────────────────────────────
async function createAccounts(staffRows, branchMap) {
  console.log('\n=== Creating accounts ===')
  console.log(`Total staff to process: ${staffRows.length}`)

  // Get existing auth users to avoid duplicate email errors
  const { data: { users: existingUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existingEmails = new Set(existingUsers.map(u => u.email))

  let created = 0, skipped = 0, failed = 0

  for (const row of staffRows) {
    const email       = String(row['email'] ?? '').trim()
    const fullName    = String(row['Employee Name'] ?? row['Name'] ?? '').trim()
    const dept        = String(row['Department'] ?? '').trim()
    const position    = String(row['Job Position'] ?? '').trim()
    const role        = normalizePosition(position)
    const branch_id   = resolveBranchId(dept, branchMap)

    if (!email) {
      console.log(`  SKIP  "${fullName}" — no email`)
      skipped++
      continue
    }

    if (existingEmails.has(email)) {
      console.log(`  SKIP  ${email} — already exists`)
      skipped++
      continue
    }

    if (!branch_id) {
      console.log(`  WARN  ${email} — branch not found for dept: "${dept}" (will create without branch_id)`)
    }

    // Create auth user
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: SHARED_PASS,
      email_confirm: true,
      user_metadata: { full_name: fullName, role, branch_id },
    })

    if (createErr || !newUser?.user) {
      console.log(`  ERROR ${email}: ${createErr?.message}`)
      failed++
      continue
    }

    // Upsert profile
    const { error: profErr } = await admin.from('profiles').upsert({
      id:        newUser.user.id,
      email,
      full_name: fullName,
      role,
      branch_id: branch_id ?? null,
    }, { onConflict: 'id' })

    if (profErr) {
      console.log(`  WARN  profile upsert ${email}: ${profErr.message}`)
    }

    console.log(`  OK    ${email} | ${fullName} | ${role} | dept: ${dept}`)
    created++
    existingEmails.add(email)

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 150))
  }

  console.log(`\n=== Done: ${created} created, ${skipped} skipped, ${failed} failed ===`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Accounts already deleted in previous run; skip
  // await deleteAccounts()

  const staffRows = loadStaff()
  console.log(`\nStaff rows after DROP/RESIGN filter: ${staffRows.length}`)

  // Preview column names
  if (staffRows.length > 0) {
    console.log('Columns:', Object.keys(staffRows[0]).join(', '))
    console.log('Sample row:', JSON.stringify(staffRows[0]))
  }

  const branchMap = await fetchBranches()

  await createAccounts(staffRows, branchMap)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
