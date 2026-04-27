// Edge Function: recruitment-onboard
// Dipanggil oleh frontend saat hr_legal submit kontrak.
// Tugas: buat auth user → profile otomatis via trigger → update candidates → stage_history.
// Memerlukan Supabase Secret: STAFF_SHARED_PASSWORD (isi sama dengan VITE_STAFF_PASS)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const STAFF_SHARED_PASSWORD     = Deno.env.get('STAFF_SHARED_PASSWORD') ?? ''

// Map applied_position kandidat → role Supabase
const POSITION_TO_ROLE: Record<string, string> = {
  barista:       'barista',
  kitchen:       'kitchen',
  waitress:      'waitress',
  staff:         'staff',
  asst_head_store: 'asst_head_store',
}

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Ambil caller token dari Authorization header ──────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401)
    }

    // Client dengan service role untuk semua operasi admin
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    // Client dengan token caller untuk verifikasi role
    const callerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return json({ error: 'Unauthorized' }, 401)

    // Ambil role caller dari profiles
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'hr_legal' && callerProfile?.role !== 'hr_administrator') {
      return json({ error: 'Hanya hr_legal atau hr_administrator yang bisa mengaktifkan kontrak' }, 403)
    }

    // ── Parse request body ────────────────────────────────────────
    const body = await req.json()
    const { candidate_id, email, notes } = body as {
      candidate_id: string
      email: string
      notes?: string
    }

    if (!candidate_id || !email) {
      return json({ error: 'candidate_id dan email wajib diisi' }, 400)
    }

    // ── Ambil data kandidat ───────────────────────────────────────
    const { data: candidate, error: candErr } = await adminClient
      .from('candidates')
      .select('id, full_name, applied_position, branch_id, current_stage, status, email')
      .eq('id', candidate_id)
      .single()

    if (candErr || !candidate) {
      return json({ error: 'Kandidat tidak ditemukan' }, 404)
    }

    if (candidate.current_stage !== 'kontrak_pending') {
      return json({
        error: `Kandidat tidak di tahap kontrak_pending (stage saat ini: ${candidate.current_stage})`
      }, 400)
    }

    // Cek email belum dipakai
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const emailTaken = existingUsers?.users?.some(u => u.email === email)
    if (emailTaken) {
      return json({ error: `Email ${email} sudah digunakan oleh akun lain` }, 400)
    }

    const role = POSITION_TO_ROLE[candidate.applied_position] ?? 'staff'

    // ── Buat auth user ────────────────────────────────────────────
    // handle_new_user trigger akan otomatis buat profile dengan role & branch_id dari metadata
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: STAFF_SHARED_PASSWORD,
      email_confirm: true,          // skip email verification
      user_metadata: {
        full_name: candidate.full_name,
        role,
        branch_id: candidate.branch_id,
      },
    })

    if (createErr || !newUser?.user) {
      return json({ error: `Gagal membuat akun: ${createErr?.message}` }, 500)
    }

    // ── Update profile yang baru dibuat dengan branch_id ─────────
    // handle_new_user mungkin belum bisa set branch_id — update manual untuk pastikan
    const { error: profileErr } = await adminClient
      .from('profiles')
      .update({ branch_id: candidate.branch_id })
      .eq('id', newUser.user.id)

    if (profileErr) {
      console.error('Warning: gagal set branch_id di profile', profileErr)
    }

    // ── Update candidates: email final + lanjut ke OJT ──────────
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
    const { error: histErr } = await adminClient
      .from('stage_history')
      .insert({
        candidate_id,
        from_stage: 'kontrak_pending',
        to_stage: 'ojt_instore',
        action: 'activate',
        notes: notes ?? `Kontrak ditandatangani. Akun dibuat: ${email}`,
        performed_by: caller.id,
        performed_at: new Date().toISOString(),
      })

    if (histErr) {
      console.error('Warning: gagal insert stage_history', histErr)
    }

    // ── Catatan untuk jadwal shift ────────────────────────────────
    // TODO (setelah migration 024 work_schedules):
    //   - Buat jadwal slot untuk besok (tanggal = today + 1 hari)
    //   - branch_id, staff_id = newUser.user.id, role
    //   - HS sudah bisa input shift dari besok

    return json({
      success: true,
      message: `Akun berhasil dibuat untuk ${candidate.full_name}`,
      account: {
        user_id: newUser.user.id,
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
