-- ============================================================
-- MIGRATION 027: Konsolidasi ulang semua policy oje_batch_items
-- Hapus policy lama dari 010 + 025, ganti dengan satu set bersih.
-- Jalankan di Supabase Dashboard → SQL Editor.
-- ============================================================

-- ── oje_batches ────────────────────────────────────────────
DROP POLICY IF EXISTS "oje_batch_select" ON oje_batches;
DROP POLICY IF EXISTS "oje_batch_insert" ON oje_batches;
DROP POLICY IF EXISTS "oje_batch_update" ON oje_batches;
DROP POLICY IF EXISTS "oje_batch_delete" ON oje_batches;

CREATE POLICY "oje_batch_select" ON oje_batches FOR SELECT TO authenticated
  USING (my_role() IN (
    'trainer','ops_manager','support_spv','support_admin',
    'head_store','asst_head_store','district_manager','area_manager',
    'hr_staff','hr_spv','hr_legal','hr_administrator'
  ));

CREATE POLICY "oje_batch_insert" ON oje_batches FOR INSERT TO authenticated
  WITH CHECK (my_role() IN (
    'trainer','ops_manager','support_spv','support_admin',
    'head_store','district_manager','area_manager',
    'hr_staff','hr_administrator'
  ));

CREATE POLICY "oje_batch_update" ON oje_batches FOR UPDATE TO authenticated
  USING (my_role() IN (
    'trainer','ops_manager','support_spv','support_admin',
    'head_store','district_manager',
    'hr_staff','hr_administrator'
  ));

CREATE POLICY "oje_batch_delete" ON oje_batches FOR DELETE TO authenticated
  USING (my_role() IN (
    'ops_manager','support_spv','support_admin',
    'hr_administrator'
  ));

-- ── oje_batch_items ────────────────────────────────────────
-- Hapus SEMUA policy lama (dari 010 dan 025)
DROP POLICY IF EXISTS "oje_bi_select"    ON oje_batch_items;
DROP POLICY IF EXISTS "oje_bi_insert"    ON oje_batch_items;
DROP POLICY IF EXISTS "oje_bi_update"    ON oje_batch_items;
DROP POLICY IF EXISTS "oje_bi_delete"    ON oje_batch_items;
DROP POLICY IF EXISTS "oje_items_select" ON oje_batch_items;
DROP POLICY IF EXISTS "oje_items_insert" ON oje_batch_items;
DROP POLICY IF EXISTS "oje_items_update" ON oje_batch_items;

CREATE POLICY "oje_items_select" ON oje_batch_items FOR SELECT TO authenticated
  USING (my_role() IN (
    'trainer','ops_manager','support_spv','support_admin',
    'head_store','asst_head_store','district_manager','area_manager',
    'hr_staff','hr_spv','hr_legal','hr_administrator'
  ));

CREATE POLICY "oje_items_insert" ON oje_batch_items FOR INSERT TO authenticated
  WITH CHECK (my_role() IN (
    'trainer','ops_manager','support_spv','support_admin',
    'head_store','district_manager','area_manager',
    'hr_staff','hr_administrator'
  ));

CREATE POLICY "oje_items_update" ON oje_batch_items FOR UPDATE TO authenticated
  USING (my_role() IN (
    'trainer','ops_manager','support_spv','support_admin',
    'head_store','district_manager','area_manager',
    'hr_staff','hr_administrator'
  ));

CREATE POLICY "oje_items_delete" ON oje_batch_items FOR DELETE TO authenticated
  USING (my_role() IN (
    'ops_manager','support_spv','support_admin',
    'hr_administrator'
  ));
