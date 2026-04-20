-- ── FIX ACCESS untuk barista, kitchen, waitress ──────────────
-- Jalankan SETELAH 006_staff_roles.sql.
--
-- Masalah utama: can_access_branch() dan SC read policies
-- masih hardcode 'staff','asst_head_store','head_store' saja,
-- sehingga barista/kitchen/waitress tidak bisa akses data toko.

-- 1. can_access_branch() — fungsi inti yang dipakai semua policy
CREATE OR REPLACE FUNCTION can_access_branch(b_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM branches b
    WHERE b.id = b_id AND (
      -- Store-level: hanya branch sendiri
      (my_role() IN ('staff','barista','kitchen','waitress','asst_head_store','head_store')
       AND b.id = my_branch())
      -- DM: semua branch di district-nya
      OR (my_role() = 'district_manager' AND b.district = ANY(my_districts()))
      -- AM: semua branch di area-nya
      OR (my_role() = 'area_manager' AND b.area = ANY(my_areas()))
      -- OM + Finance + Support: semua
      OR my_role() IN ('ops_manager','finance_supervisor','sc_supervisor',
                       'support_spv','support_admin')
    )
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. supply_orders read: store roles bisa lihat order ke toko mereka
DROP POLICY IF EXISTS "supply_orders_select" ON supply_orders;
CREATE POLICY "supply_orders_select" ON supply_orders FOR SELECT TO authenticated
  USING (
    is_sc_role()
    OR (
      my_role() IN ('staff','barista','kitchen','waitress',
                    'asst_head_store','head_store',
                    'district_manager','area_manager','ops_manager','support_spv','support_admin')
      AND can_access_branch(branch_id)
    )
  );

-- 3. supply_order_items read
DROP POLICY IF EXISTS "soi_select" ON supply_order_items;
CREATE POLICY "soi_select" ON supply_order_items FOR SELECT TO authenticated
  USING (
    is_sc_role()
    OR EXISTS (
      SELECT 1 FROM supply_orders so
      WHERE so.id = supply_order_items.order_id
        AND my_role() IN ('staff','barista','kitchen','waitress',
                          'asst_head_store','head_store',
                          'district_manager','area_manager','ops_manager','support_spv','support_admin')
        AND can_access_branch(so.branch_id)
    )
  );

-- 4. supply_confirmations read
DROP POLICY IF EXISTS "sc_confirm_select" ON supply_confirmations;
CREATE POLICY "sc_confirm_select" ON supply_confirmations FOR SELECT TO authenticated
  USING (
    is_sc_role()
    OR EXISTS (
      SELECT 1 FROM supply_orders so
      WHERE so.id = supply_confirmations.order_id
        AND my_role() IN ('staff','barista','kitchen','waitress',
                          'asst_head_store','head_store',
                          'district_manager','area_manager','ops_manager','support_spv','support_admin')
        AND can_access_branch(so.branch_id)
    )
  );

-- 5. supply_confirmation_items read
DROP POLICY IF EXISTS "sci_select" ON supply_confirmation_items;
CREATE POLICY "sci_select" ON supply_confirmation_items FOR SELECT TO authenticated
  USING (
    is_sc_role()
    OR EXISTS (
      SELECT 1 FROM supply_confirmations sc
      JOIN supply_orders so ON so.id = sc.order_id
      WHERE sc.id = supply_confirmation_items.confirmation_id
        AND my_role() IN ('staff','barista','kitchen','waitress',
                          'asst_head_store','head_store',
                          'district_manager','area_manager','ops_manager','support_spv','support_admin')
        AND can_access_branch(so.branch_id)
    )
  );

-- 6. surat_jalan read
DROP POLICY IF EXISTS "sj_select" ON surat_jalan;
CREATE POLICY "sj_select" ON surat_jalan FOR SELECT TO authenticated
  USING (
    is_sc_role()
    OR (
      my_role() IN ('staff','barista','kitchen','waitress',
                    'asst_head_store','head_store',
                    'district_manager','area_manager','ops_manager','support_spv','support_admin')
      AND can_access_branch(branch_id)
    )
  );

-- 7. surat_jalan_items read
DROP POLICY IF EXISTS "sji_select" ON surat_jalan_items;
CREATE POLICY "sji_select" ON surat_jalan_items FOR SELECT TO authenticated
  USING (
    is_sc_role()
    OR EXISTS (
      SELECT 1 FROM surat_jalan sj
      WHERE sj.id = surat_jalan_items.sj_id
        AND my_role() IN ('staff','barista','kitchen','waitress',
                          'asst_head_store','head_store',
                          'district_manager','area_manager','ops_manager','support_spv','support_admin')
        AND can_access_branch(sj.branch_id)
    )
  );
