-- ============================================================
-- Diagnose KPI Personal / 360 visibility
-- Jalankan di Supabase SQL Editor (production)
-- ============================================================

-- 1) Lihat data profil dasar untuk akun toko / head store
select
  p.id,
  p.full_name,
  p.email,
  p.role,
  p.branch_id,
  b.name as branch_name,
  b.district,
  b.area,
  p.is_active
from profiles p
left join branches b on b.id = p.branch_id
where p.role in ('staff','barista','kitchen','waitress','asst_head_store','head_store')
order by b.name nulls last, p.role, p.full_name;

-- 2) Cari akun head store yang tidak punya rekan satu cabang untuk dinilai 360
select
  hs.full_name as head_store_name,
  hs.email as head_store_email,
  b.name as branch_name,
  count(peer.id) as visible_store_peers
from profiles hs
join branches b on b.id = hs.branch_id
left join profiles peer
  on peer.branch_id = hs.branch_id
 and peer.is_active = true
 and peer.role in ('staff','barista','kitchen','waitress','asst_head_store','head_store')
 and peer.id <> hs.id
where hs.role = 'head_store'
  and hs.is_active = true
group by hs.full_name, hs.email, b.name
order by visible_store_peers asc, branch_name;

-- 3) Cari staff toko yang masih role generic 'staff'
select
  p.full_name,
  p.email,
  p.role,
  b.name as branch_name,
  p.is_active
from profiles p
left join branches b on b.id = p.branch_id
where p.role = 'staff'
order by b.name nulls last, p.full_name;

-- 4) Cari akun toko yang belum punya branch_id atau nonaktif
select
  p.full_name,
  p.email,
  p.role,
  p.branch_id,
  p.is_active
from profiles p
where p.role in ('staff','barista','kitchen','waitress','asst_head_store','head_store')
  and (p.branch_id is null or p.is_active = false)
order by p.role, p.full_name;

-- 5) Cek item KPI personal yang aktif per role
select
  role,
  count(*) as active_items
from kpi_personal_items
where is_active = true
group by role
order by role;

-- 6) Cek item 360 yang aktif per group
select
  group_type,
  count(*) as active_items
from kpi_360_items
where is_active = true
group by group_type
order by group_type;
