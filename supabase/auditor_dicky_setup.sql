-- ── Setup akun Auditor: dicky.iman18@gmail.com ─────────────────────────────
--
-- Jalankan script ini di Supabase SQL Editor SETELAH:
--   1. Migration 018_auditor_role.sql sudah dijalankan
--   2. User dicky.iman18@gmail.com sudah dibuat di Supabase Auth
--      (Authentication > Users > Add User)
--
-- Ganti <USER_UUID> dengan UUID dari user yang baru dibuat.
-- UUID bisa dilihat di kolom "UID" di halaman Authentication > Users.

UPDATE public.profiles
SET
  full_name  = 'Dicky Iman',
  role       = 'auditor',
  is_active  = true,
  branch_id  = NULL
WHERE email = 'dicky.iman18@gmail.com';

-- Verifikasi hasil
SELECT id, email, full_name, role, is_active
FROM public.profiles
WHERE email = 'dicky.iman18@gmail.com';
