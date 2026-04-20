-- ── 008: SC race condition fix + sop_cards + announcements ───
-- Jalankan di Supabase SQL Editor.

-- ══════════════════════════════════════════════════════════════
-- 1. SC Race Condition Fix
--    Cegah double-insert item untuk confirmation yang sama
-- ══════════════════════════════════════════════════════════════
ALTER TABLE supply_confirmation_items
  DROP CONSTRAINT IF EXISTS sci_unique_item;
ALTER TABLE supply_confirmation_items
  ADD CONSTRAINT sci_unique_item UNIQUE (confirmation_id, order_item_id);

-- ══════════════════════════════════════════════════════════════
-- 2. sop_cards — Kartu SOP yang bisa diakses staff
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sop_cards (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'Umum',
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(file_name)
);

ALTER TABLE sop_cards ENABLE ROW LEVEL SECURITY;

-- Semua authenticated bisa baca SOP aktif
CREATE POLICY "sop_read" ON sop_cards FOR SELECT TO authenticated
  USING (is_active = true);

-- Hanya ops-like + support bisa manage
CREATE POLICY "sop_manage" ON sop_cards FOR ALL TO authenticated
  USING    (my_role() IN ('ops_manager','support_spv','support_admin'))
  WITH CHECK (my_role() IN ('ops_manager','support_spv','support_admin'));

-- ══════════════════════════════════════════════════════════════
-- 3. announcements — Pengumuman dari support/ops ke staff
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS announcements (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  -- NULL = semua toko, isi branch_id = toko tertentu saja
  branch_id     UUID REFERENCES branches ON DELETE CASCADE,
  -- NULL/kosong = semua role, isi = role tertentu
  target_roles  TEXT[] DEFAULT NULL,
  created_by    UUID REFERENCES profiles ON DELETE SET NULL,
  published_at  TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ DEFAULT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Staff baca: announcement aktif, belum expired, dan berlaku untuk mereka
CREATE POLICY "announcements_read" ON announcements FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      -- Ditarget ke semua
      (target_roles IS NULL OR array_length(target_roles, 1) IS NULL)
      -- Atau role user ada di daftar
      OR my_role() = ANY(target_roles)
    )
    AND (
      -- Untuk semua toko
      branch_id IS NULL
      -- Atau toko user
      OR branch_id = my_branch()
      -- Atau ops-like bisa lihat semua
      OR my_role() IN ('ops_manager','support_spv','support_admin')
    )
  );

-- support_spv + ops bisa manage semua
CREATE POLICY "announcements_manage" ON announcements FOR ALL TO authenticated
  USING    (my_role() IN ('ops_manager','support_spv','support_admin'))
  WITH CHECK (my_role() IN ('ops_manager','support_spv','support_admin'));
