-- 031: shift_schedules — weekly staff scheduling by head_store

create table if not exists shift_schedules (
  id          uuid        primary key default gen_random_uuid(),
  branch_id   uuid        not null references branches(id),
  staff_id    uuid        not null references profiles(id),
  tanggal     date        not null,
  shift_type  text        not null,
  shift_hour  text,
  notes       text,
  created_by  uuid        references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint uq_shift_schedule unique(branch_id, staff_id, tanggal)
);

alter table shift_schedules enable row level security;

-- Head store manages their own branch schedule
create policy "head_store_manage_schedule" on shift_schedules
  for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'head_store'
        and p.branch_id = shift_schedules.branch_id
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'head_store'
        and p.branch_id = shift_schedules.branch_id
    )
  );

-- All active branch staff can view their branch schedule
create policy "branch_staff_view_schedule" on shift_schedules
  for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.branch_id = shift_schedules.branch_id
        and p.is_active = true
    )
  );

-- Ops / managers / HR can view all schedules
create policy "managers_view_all_schedules" on shift_schedules
  for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in (
          'district_manager','area_manager','ops_manager',
          'support_spv','support_admin',
          'hr_staff','hr_spv','hr_legal','hr_administrator'
        )
    )
  );

-- Trigger: keep updated_at current
create or replace function update_shift_schedules_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_shift_schedules_updated_at
  before update on shift_schedules
  for each row execute function update_shift_schedules_updated_at();
