-- ============================================================
-- MIGRATION 025: HR roles access ke oje_batches & oje_batch_items
-- Jalankan setelah: 024_ojt_checklists.sql
-- ============================================================

-- HR roles butuh akses penuh ke oje_batches untuk buat & kelola batch
DROP POLICY IF EXISTS "oje_batch_select" ON oje_batches;
DROP POLICY IF EXISTS "oje_batch_insert" ON oje_batches;
DROP POLICY IF EXISTS "oje_batch_update" ON oje_batches;
DROP POLICY IF EXISTS "oje_batch_delete" ON oje_batches;

CREATE POLICY "oje_batch_select" ON oje_batches FOR SELECT TO authenticated
  USING (my_role() IN (
    'trainer','ops_manager','support_spv','support_admin',
    'head_store','district_manager','area_manager',
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
    'hr_staff','hr_administrator'
  ));

CREATE POLICY "oje_batch_delete" ON oje_batches FOR DELETE TO authenticated
  USING (my_role() IN (
    'trainer','ops_manager','support_spv','support_admin',
    'hr_administrator'
  ));

-- HR roles butuh akses ke oje_batch_items
DROP POLICY IF EXISTS "oje_items_select" ON oje_batch_items;
DROP POLICY IF EXISTS "oje_items_insert" ON oje_batch_items;
DROP POLICY IF EXISTS "oje_items_update" ON oje_batch_items;

CREATE POLICY "oje_items_select" ON oje_batch_items FOR SELECT TO authenticated
  USING (
    my_role() IN (
      'trainer','ops_manager','support_spv','support_admin',
      'head_store','district_manager','area_manager',
      'hr_staff','hr_spv','hr_legal','hr_administrator'
    )
    OR EXISTS (
      SELECT 1 FROM oje_batches b
      WHERE b.id = oje_batch_items.batch_id
        AND can_access_branch(b.branch_id)
    )
  );

CREATE POLICY "oje_items_insert" ON oje_batch_items FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN (
      'trainer','ops_manager','support_spv','support_admin',
      'head_store','district_manager','area_manager',
      'hr_staff','hr_administrator'
    )
  );

CREATE POLICY "oje_items_update" ON oje_batch_items FOR UPDATE TO authenticated
  USING (
    my_role() IN (
      'trainer','ops_manager','support_spv','support_admin',
      'head_store','district_manager','area_manager',
      'hr_staff','hr_administrator'
    )
  );
