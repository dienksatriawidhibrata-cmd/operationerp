import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { parse } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = parse(readFileSync(resolve(__dirname, '../.env')))

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const EMAIL     = 'bagikopicilandak@gmail.com'
const STAFF_PASS = env.VITE_STAFF_PASS
const BRANCH_NAME = 'Cilandak Barat'

const { data: branch, error: branchErr } = await supabase
  .from('branches')
  .select('id, name')
  .ilike('name', `%${BRANCH_NAME}%`)
  .maybeSingle()

if (branchErr || !branch) {
  console.error('❌ Branch tidak ditemukan:', branchErr?.message || 'no match')
  process.exit(1)
}

console.log(`Branch ditemukan: ${branch.name} (${branch.id})`)

const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
  email: EMAIL,
  password: STAFF_PASS,
  email_confirm: true,
})

if (authErr) {
  console.error('❌ Auth gagal:', authErr.message)
  process.exit(1)
}

console.log(`✅ Auth user dibuat: ${EMAIL} → ${authData.user.id}`)
console.log(`ℹ️  Profile akan dibuat otomatis via trigger dengan branch_id: ${branch.id}`)
console.log(`\n⚠️  Pastikan trigger/profile sudah ter-update dengan branch_id yang benar.`)
