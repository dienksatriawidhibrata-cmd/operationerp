-- ============================================================
-- BAGI KOPI OPS
-- Auth / Profile Audit Queries
-- Jalankan per blok di Supabase SQL Editor
-- ============================================================

-- 1. Cek user auth yang belum punya profile
select
  u.id,
  u.email,
  u.created_at,
  p.id as profile_id,
  p.role,
  p.is_active
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;

-- 2. Fokus ke user tertentu
-- Ganti email sesuai user yang login lambat
select
  u.id as auth_user_id,
  u.email as auth_email,
  u.created_at as auth_created_at,
  p.id as profile_id,
  p.email as profile_email,
  p.full_name,
  p.role,
  p.branch_id,
  p.managed_districts,
  p.managed_areas,
  p.is_active as profile_is_active
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('sohibbagikopi@gmail.com');

-- 3. Cek profile yang branch_id-nya rusak / tidak ketemu branches
select
  p.id,
  p.email,
  p.role,
  p.branch_id
from public.profiles p
left join public.branches b on b.id = p.branch_id
where p.branch_id is not null
  and b.id is null;

-- 4. Cek role yang tidak sesuai ekspektasi operasional
select
  id,
  email,
  role,
  branch_id,
  managed_districts,
  managed_areas
from public.profiles
where
  (role in ('staff', 'asst_head_store', 'head_store') and branch_id is null)
  or (role = 'district_manager' and coalesce(array_length(managed_districts, 1), 0) = 0)
  or (role = 'area_manager' and coalesce(array_length(managed_areas, 1), 0) = 0);

-- 5. Cek trigger dan function handle_new_user yang aktif
select
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema = 'auth'
  and event_object_table = 'users'
order by trigger_name;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_def
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'handle_new_user';

-- 6. Cek policy table profiles
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'profiles';

-- 7. Tes baca profiles sebagai user login (harus dijalankan saat sudah login via app / SQL role authenticated)
-- Kalau query ini lama atau error, besar kemungkinan sumber bug ada di policy/function
select
  id,
  email,
  full_name,
  role,
  branch_id,
  managed_districts,
  managed_areas,
  is_active
from public.profiles
where id = auth.uid();

-- 8. Cek duplicate/berlebih trigger di auth.users
select
  t.tgname as trigger_name,
  c.relname as table_name,
  pg_get_triggerdef(t.oid) as trigger_def
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth'
  and c.relname = 'users'
  and not t.tgisinternal
order by t.tgname;
