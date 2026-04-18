import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { parse } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env')
const env = parse(readFileSync(envPath))

const SUPABASE_URL     = env.VITE_SUPABASE_URL
const SERVICE_KEY      = env.SUPABASE_SERVICE_ROLE_KEY
const STAFF_PASS       = env.VITE_STAFF_PASS

if (!SUPABASE_URL || !SERVICE_KEY || !STAFF_PASS) {
  console.error('❌ ENV tidak lengkap. Cek VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_STAFF_PASS di .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Baca Excel
const wb   = XLSX.readFile(resolve(__dirname, '../2026 - Email Store.xlsx'))
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])

// Normalisasi nama: hapus prefix "Bagi Kopi", lowercase, trim
function normalizeName(name = '') {
  return String(name).replace(/^Bagi Kopi\s+/i, '').trim().toLowerCase()
}

// Fetch semua branches
const { data: branches, error: branchErr } = await supabase
  .from('branches')
  .select('id, name, store_id')

if (branchErr) {
  console.error('❌ Gagal fetch branches:', branchErr.message)
  process.exit(1)
}

const branchMap = new Map(branches.map(b => [normalizeName(b.name), b]))

console.log(`\n📋 ${rows.length} store di Excel, ${branches.length} branch di DB\n`)

let created = 0, skipped = 0, failed = 0

for (const row of rows) {
  const storeName = row['Store'] || ''
  const email     = (row['Email'] || '').trim().toLowerCase()

  if (!email) {
    console.warn(`  ⚠️  Skip (no email): ${storeName}`)
    skipped++
    continue
  }

  const SKIP_STORES = ['cawang', 'cilandak']
  if (SKIP_STORES.includes(normalizeName(storeName))) {
    console.log(`  ⏭️  Skip (sudah ada): ${storeName}`)
    skipped++
    continue
  }

  const branch = branchMap.get(normalizeName(storeName))
  if (!branch) {
    console.warn(`  ⚠️  Branch tidak ditemukan untuk: "${storeName}" (normalized: "${normalizeName(storeName)}")`)
    skipped++
    continue
  }

  // 1. Buat user di Supabase Auth
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: STAFF_PASS,
    email_confirm: true,
  })

  if (authErr) {
    if (authErr.message?.toLowerCase().includes('already been registered') ||
        authErr.message?.toLowerCase().includes('already registered') ||
        authErr.code === 'email_exists') {
      console.log(`  ↩️  Sudah ada (Auth): ${email}`)
      skipped++
    } else {
      console.error(`  ❌ Auth gagal [${storeName}] ${email}: ${authErr.message}`)
      failed++
    }
    continue
  }

  const userId = authData.user.id

  // 2. Upsert ke tabel profiles
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id:        userId,
    email,
    full_name: `Staff ${storeName}`,
    role:      'staff',
    branch_id: branch.id,
    is_active: true,
  })

  if (profileErr) {
    console.error(`  ❌ Profile gagal [${storeName}] ${email}: ${profileErr.message}`)
    failed++
    continue
  }

  console.log(`  ✅ ${storeName.padEnd(20)} ${email}  →  branch_id: ${branch.id}`)
  created++
}

console.log(`\n🏁 Selesai: ${created} berhasil, ${skipped} dilewati, ${failed} gagal\n`)
