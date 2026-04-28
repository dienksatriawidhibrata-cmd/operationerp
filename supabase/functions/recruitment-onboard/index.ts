// Edge Function: recruitment-onboard
// Dipanggil oleh frontend saat hr_legal submit kontrak.
// Tugas: buat auth user → upsert profile eksplisit → update candidates → stage_history.
//
// Secret yang WAJIB di-set di Supabase Dashboard → Edge Functions → Secrets:
//   STAFF_SHARED_PASSWORD = 1PassBagiKopiOps!!!   (sama dengan VITE_STAFF_PASS di .env)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const STAFF_SHARED_PASSWORD     = Deno.env.get('STAFF_SHARED_PASSWORD') ?? ''

const POSITION_TO_ROLE: Record<string, string> = {
  barista:         'barista',
  kitchen:         'kitchen',
  waitress:        'waitress',
  staff:           'staff',
  asst_head_store: 'asst_head_store',
}

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return json('ok', 200)
  }

  try {
    // ── Validasi secret password ──────────────────────────────────
    if (!STAFF_SHARED_PASSWORD) {
      return json({
        error: 'STAFF_SHARED_PASSWORD belum di-set di Supabase Edge Function Secrets. ' +
               'Buka Dashboard → Edge Functions → recruitment-onboard → Secrets, ' +
               'tambahkan STAFF_SHARED_PASSWORD dengan nilai yang sama dengan VITE_STAFF_PASS.',
      }, 500)
    }

    // ── Auth caller ───────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    // Verifikasi caller dengan service-role + JWT di header
    const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return json({ error: 'Unauthorized' }, 401)

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (!['hr_legal', 'hr_administrator'].includes(callerProfile?.role ?? '')) {
      return json({ error: 'Hanya hr_legal atau hr_administrator yang bisa mengaktifkan kontrak' }, 403)
    }

    // ── Parse body ────────────────────────────────────────────────
    const body = await req.json()
    const { candidate_id, email, notes } = body as {
      candidate_id: string
      email: string
      notes?: string
    }
    if (!candidate_id || !email) {
      return json({ error: 'candidate_id dan email wajib diisi' }, 400)
    }

    // ── Ambil kandidat ────────────────────────────────────────────
    const { data: candidate, error: candErr } = await adminClient
      .from('candidates')
      .select('id, full_name, applied_position, branch_id, current_stage, status')
      .eq('id', candidate_id)
      .single()

    if (candErr || !candidate) return json({ error: 'Kandidat tidak ditemukan' }, 404)
    if (candidate.current_stage !== 'kontrak_pending') {
      return json({
        error: `Kandidat tidak di tahap kontrak_pending (stage saat ini: ${candidate.current_stage})`,
      }, 400)
    }

    // ── Cek email duplikat ────────────────────────────────────────
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    if (existingUsers?.users?.some(u => u.email === email)) {
      return json({ error: `Email ${email} sudah digunakan oleh akun lain` }, 400)
    }

    const role = POSITION_TO_ROLE[candidate.applied_position] ?? 'staff'

    // ── Buat auth user ────────────────────────────────────────────
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: STAFF_SHARED_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: candidate.full_name,
        role,
        branch_id: candidate.branch_id,
      },
    })

    if (createErr || !newUser?.user) {
      return json({ error: `Gagal membuat akun auth: ${createErr?.message}` }, 500)
    }

    // ── Upsert profile secara eksplisit ───────────────────────────
    // Tidak bergantung pada trigger handle_new_user karena Supabase bisa
    // swallow exception trigger. Explicit upsert lebih reliable.
    const { error: profileErr } = await adminClient
      .from('profiles')
      .upsert({
        id:        newUser.user.id,
        email,
        full_name: candidate.full_name,
        role,
        branch_id: candidate.branch_id,
      }, { onConflict: 'id' })

    if (profileErr) {
      // Rollback: hapus auth user agar tidak orphan
      await adminClient.auth.admin.deleteUser(newUser.user.id).catch(() => {})
      return json({ error: `Gagal membuat profile: ${profileErr.message}` }, 500)
    }

    // ── Update kandidat: lanjut ke OJT ───────────────────────────
    const { error: updateErr } = await adminClient
      .from('candidates')
      .update({
        email,
        current_stage: 'ojt_instore',
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidate_id)

    if (updateErr) {
      return json({ error: `Gagal update kandidat: ${updateErr.message}` }, 500)
    }

    // ── Insert stage_history ──────────────────────────────────────
    await adminClient.from('stage_history').insert({
      candidate_id,
      from_stage: 'kontrak_pending',
      to_stage:   'ojt_instore',
      action:     'activate',
      notes:      notes ?? `Kontrak diaktifkan. Akun dibuat: ${email}`,
      performed_by: caller.id,
      performed_at: new Date().toISOString(),
    })

    return json({
      success: true,
      message: `Akun berhasil dibuat untuk ${candidate.full_name}`,
      account: {
        user_id:   newUser.user.id,
        email,
        role,
        branch_id: candidate.branch_id,
      },
    }, 200)

  } catch (err) {
    console.error('recruitment-onboard error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
