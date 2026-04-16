create or replace function public.ops_manager_configure_profile(
  target_user_id uuid,
  target_full_name text,
  target_role text,
  target_branch_id uuid default null,
  target_managed_districts text[] default '{}',
  target_managed_areas text[] default '{}'
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_role text := trim(coalesce(target_role, ''));
  result_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if my_role() <> 'ops_manager' then
    raise exception 'Hanya ops_manager yang boleh mengatur akun baru';
  end if;

  if normalized_role not in (
    'staff',
    'asst_head_store',
    'head_store',
    'district_manager',
    'area_manager',
    'ops_manager',
    'finance_supervisor',
    'sc_supervisor'
  ) then
    raise exception 'Role tidak valid: %', normalized_role;
  end if;

  if normalized_role in ('staff', 'asst_head_store', 'head_store') and target_branch_id is null then
    raise exception 'Akun toko wajib punya branch_id';
  end if;

  if normalized_role = 'district_manager' and coalesce(array_length(target_managed_districts, 1), 0) = 0 then
    raise exception 'District manager wajib punya managed_districts';
  end if;

  if normalized_role = 'area_manager' and coalesce(array_length(target_managed_areas, 1), 0) = 0 then
    raise exception 'Area manager wajib punya managed_areas';
  end if;

  update public.profiles
  set
    full_name = coalesce(nullif(trim(target_full_name), ''), full_name),
    role = normalized_role,
    branch_id = case
      when normalized_role in ('staff', 'asst_head_store', 'head_store') then target_branch_id
      else null
    end,
    managed_districts = case
      when normalized_role = 'district_manager' then coalesce(target_managed_districts, '{}')
      else '{}'
    end,
    managed_areas = case
      when normalized_role = 'area_manager' then coalesce(target_managed_areas, '{}')
      else '{}'
    end,
    is_active = true,
    email = coalesce(
      nullif(email, ''),
      (select u.email from auth.users u where u.id = target_user_id)
    )
  where id = target_user_id
  returning * into result_profile;

  if result_profile.id is null then
    raise exception 'Profile untuk user % tidak ditemukan', target_user_id;
  end if;

  return result_profile;
end;
$$;

grant execute on function public.ops_manager_configure_profile(uuid, text, text, uuid, text[], text[]) to authenticated;
