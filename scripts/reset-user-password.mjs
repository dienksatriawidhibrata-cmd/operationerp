/**
 * Reset password untuk satu akun berdasarkan email.
 *
 * Cara pakai:
 *   node scripts/reset-user-password.mjs "user@example.com" "PasswordBaru123!"
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
const TARGET_EMAIL = (process.argv[2] || '').trim().toLowerCase()
const NEW_PASSWORD = process.argv[3]

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ENV belum lengkap. Butuh SUPABASE_URL/VITE_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY.')
  process.exit(1)
}

if (!TARGET_EMAIL || !TARGET_EMAIL.includes('@')) {
  console.error('Email target belum valid.')
  console.error('Cara pakai: node scripts/reset-user-password.mjs "user@example.com" "PasswordBaru123!"')
  process.exit(1)
}

if (!NEW_PASSWORD) {
  console.error('Password baru belum diisi.')
  console.error('Cara pakai: node scripts/reset-user-password.mjs "user@example.com" "PasswordBaru123!"')
  process.exit(1)
}

if (NEW_PASSWORD.length < 8) {
  console.error('Password minimal 8 karakter.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,full_name,is_active,role')
    .eq('email', TARGET_EMAIL)
    .maybeSingle()

  if (profileError) {
    console.error('Gagal mengambil profile:', profileError.message)
    process.exit(1)
  }

  if (!profile?.id) {
    console.error(`Profile dengan email ${TARGET_EMAIL} tidak ditemukan.`)
    process.exit(1)
  }

  const { error } = await supabase.auth.admin.updateUserById(profile.id, {
    password: NEW_PASSWORD,
  })

  if (error) {
    console.error(`Gagal reset password ${TARGET_EMAIL}: ${error.message}`)
    process.exit(1)
  }

  console.log('Sukses reset password:')
  console.log(`Email   : ${profile.email}`)
  console.log(`Nama    : ${profile.full_name || '-'}`)
  console.log(`Role    : ${profile.role || '-'}`)
  console.log(`Status  : ${profile.is_active === false ? 'inactive' : 'active'}`)
  console.log(`Password: ${NEW_PASSWORD}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
