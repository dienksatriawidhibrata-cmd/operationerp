import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TARGET_ROLES = ['staff', 'barista', 'kitchen', 'waitress', 'asst_head_store', 'auditor']

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

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY

const SHARED_PASSWORD =
  process.env.STAFF_SHARED_PASSWORD ||
  process.env.STAFF_PASS ||
  process.env.VITE_STAFF_PASS

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SHARED_PASSWORD) {
  console.error('ENV belum lengkap. Butuh SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY, dan STAFF_SHARED_PASSWORD/STAFF_PASS/VITE_STAFF_PASS.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const sleep = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))

async function main() {
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,role,is_active,full_name')
    .in('role', TARGET_ROLES)
    .not('email', 'is', null)
    .order('role')
    .order('email')

  if (profileError) {
    console.error('Gagal mengambil daftar profiles:', profileError.message)
    process.exit(1)
  }

  const rows = (profiles || []).filter((row) => row.id && row.email)
  console.log(`Target user: ${rows.length}`)

  let updated = 0
  let failed = 0

  for (const row of rows) {
    const { error } = await supabase.auth.admin.updateUserById(row.id, {
      password: SHARED_PASSWORD,
    })

    if (error) {
      console.error(`FAIL  [${row.role}] ${row.email}: ${error.message}`)
      failed += 1
    } else {
      console.log(`OK    [${row.role}] ${row.email}${row.is_active === false ? ' (inactive)' : ''}`)
      updated += 1
    }

    await sleep(120)
  }

  console.log(`\nSelesai`)
  console.log(`Updated: ${updated}`)
  console.log(`Failed : ${failed}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
