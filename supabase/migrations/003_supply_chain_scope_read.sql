-- Broaden read access for Supply Chain tracking to store and manager roles,
-- while keeping finance out of the KPI and SC read path.

DROP POLICY IF EXISTS "supply_orders_select" ON supply_orders;
CREATE POLICY "supply_orders_select" ON supply_orders FOR SELECT TO authenticated
  USING (
    is_sc_role()
    OR (
      my_role() IN ('staff','asst_head_store','head_store','district_manager','area_manager','ops_manager')
      AND can_access_branch(branch_id)
    )
  );

DROP POLICY IF EXISTS "soi_select" ON supply_order_items;
CREATE POLICY "soi_select" ON supply_order_items FOR SELECT TO authenticated
  USING (
    is_sc_role()
    OR EXISTS (
      SELECT 1
      FROM supply_orders so
      WHERE so.id = supply_order_items.order_id
        AND my_role() IN ('staff','asst_head_store','head_store','district_manager','area_manager','ops_manager')
        AND can_access_branch(so.branch_id)
    )
  );

DROP POLICY IF EXISTS "sc_confirm_select" ON supply_confirmations;
CREATE POLICY "sc_confirm_select" ON supply_confirmations FOR SELECT TO authenticated
  USING (
    is_sc_role()
    OR EXISTS (
      SELECT 1
      FROM supply_orders so
      WHERE so.id = supply_confirmations.order_id
        AND my_role() IN ('staff','asst_head_store','head_store','district_manager','area_manager','ops_manager')
        AND can_access_branch(so.branch_id)
    )
  );

DROP POLICY IF EXISTS "sci_select" ON supply_confirmation_items;
CREATE POLICY "sci_select" ON supply_confirmation_items FOR SELECT TO authenticated
  USING (
    is_sc_role()
    OR EXISTS (
      SELECT 1
      FROM supply_confirmations sc
      JOIN supply_orders so ON so.id = sc.order_id
      WHERE sc.id = supply_confirmation_items.confirmation_id
        AND my_role() IN ('staff','asst_head_store','head_store','district_manager','area_manager','ops_manager')
        AND can_access_branch(so.branch_id)
    )
  );

DROP POLICY IF EXISTS "sj_select" ON surat_jalan;
CREATE POLICY "sj_select" ON surat_jalan FOR SELECT TO authenticated
  USING (
    is_sc_role()
    OR (
      my_role() IN ('staff','asst_head_store','head_store','district_manager','area_manager','ops_manager')
      AND can_access_branch(branch_id)
    )
  );

DROP POLICY IF EXISTS "sji_select" ON surat_jalan_items;
CREATE POLICY "sji_select" ON surat_jalan_items FOR SELECT TO authenticated
  USING (
    is_sc_role()
    OR EXISTS (
      SELECT 1
      FROM surat_jalan sj
      WHERE sj.id = surat_jalan_items.sj_id
        AND my_role() IN ('staff','asst_head_store','head_store','district_manager','area_manager','ops_manager')
        AND can_access_branch(sj.branch_id)
    )
  );
