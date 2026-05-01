/**
 * Reset password semua akun untuk satu atau beberapa role ke password baru.
 *
 * Cara pakai:
 *   node scripts/reset-role-passwords.mjs "PasswordBaru123!" head_store
 *   node scripts/reset-role-passwords.mjs "PasswordBaru123!" staff,barista,kitchen,waitress,asst_head_store
 *
 * Butuh env: SUPABASE_URL / VITE_SUPABASE_URL
 *            SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv(path) {
  try {
    const lines = readFileSync(path, 'utf8').split('\n')
    for (const line of lines) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (!match) continue
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      process.env[key] ??= value
    }
  } catch {
    // Ignore missing env files.
  }
}

loadEnv(resolve(__dirname, '../.env'))
loadEnv(resolve(__dirname, '../.env.local'))
loadEnv(resolve(__dirname, '../backend/.env'))

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
const NEW_PASSWORD = process.argv[2]
const ROLE_INPUT = process.argv[3]
const TARGET_ROLES = (ROLE_INPUT || '')
  .split(',')
  .map((role) => role.trim())
  .filter(Boolean)

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ENV belum lengkap. Butuh SUPABASE_URL/VITE_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY.')
  process.exit(1)
}

if (!NEW_PASSWORD) {
  console.error('Password baru belum diisi.')
  console.error('Cara pakai: node scripts/reset-role-passwords.mjs "PasswordBaru123!" head_store')
  process.exit(1)
}

if (!ROLE_INPUT || TARGET_ROLES.length === 0) {
  console.error('Role target belum diisi.')
  console.error('Contoh: node scripts/reset-role-passwords.mjs "PasswordBaru123!" staff,barista,kitchen,waitress,asst_head_store')
  process.exit(1)
}

if (NEW_PASSWORD.length < 8) {
  console.error('Password minimal 8 karakter.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,full_name,is_active,role')
    .in('role', TARGET_ROLES)
    .not('email', 'is', null)
    .order('role')
    .order('email')

  if (profileError) {
    console.error('Gagal mengambil daftar profiles:', profileError.message)
    process.exit(1)
  }

  const rows = (profiles || []).filter((r) => r.id && r.email)
  console.log(`Role target      : ${TARGET_ROLES.join(', ')}`)
  console.log(`Akun ditemukan   : ${rows.length}`)
  console.log('-'.repeat(60))

  let updated = 0
  let failed = 0

  for (const row of rows) {
    const { error } = await supabase.auth.admin.updateUserById(row.id, {
      password: NEW_PASSWORD,
    })

    if (error) {
      console.error(`FAIL  [${row.role}] ${row.email} (${row.full_name || '-'}): ${error.message}`)
      failed += 1
    } else {
      const status = row.is_active === false ? ' [INACTIVE]' : ''
      console.log(`OK    [${row.role}] ${row.email} (${row.full_name || '-'})${status}`)
      updated += 1
    }

    await sleep(120)
  }

  console.log('-'.repeat(60))
  console.log('\nSelesai')
  console.log(`Updated : ${updated}`)
  console.log(`Failed  : ${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
