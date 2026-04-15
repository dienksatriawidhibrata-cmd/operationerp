-- ============================================================
-- BAGI KOPI OPS
-- Auth / Profile Hardening Fix
-- Jalankan per blok di Supabase SQL Editor
-- ============================================================

-- 1. Pastikan function handle_new_user aman untuk email tanpa full_name
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'User Baru'),
    case
      when coalesce(new.raw_user_meta_data->>'role', 'staff') in (
        'staff','asst_head_store','head_store',
        'district_manager','area_manager','ops_manager',
        'finance_supervisor','sc_supervisor'
      )
      then coalesce(new.raw_user_meta_data->>'role', 'staff')
      else 'staff'
    end
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

-- 2. Rapikan trigger agar hanya ada satu trigger on_auth_user_created
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Backfill semua auth.users yang belum punya profile
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'User Baru'),
  case
    when coalesce(u.raw_user_meta_data->>'role', 'staff') in (
      'staff','asst_head_store','head_store',
      'district_manager','area_manager','ops_manager',
      'finance_supervisor','sc_supervisor'
    )
    then coalesce(u.raw_user_meta_data->>'role', 'staff')
    else 'staff'
  end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 4. Samakan email profiles dengan auth.users untuk mencegah data stale
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

-- 5. Index tambahan untuk query login/profile dan visit dashboard
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_branch_id on public.profiles(branch_id);
create index if not exists idx_daily_visits_branch_tanggal on public.daily_visits(branch_id, tanggal desc);
create index if not exists idx_daily_visits_auditor_tanggal on public.daily_visits(auditor_id, tanggal desc);

-- 6. Verifikasi cepat hasil fix
select
  count(*) filter (where p.id is null) as auth_without_profile,
  count(*) as total_auth_users
from auth.users u
left join public.profiles p on p.id = u.id;
