-- ── ADD support_spv AND support_admin ROLES ──────────────────
-- Jalankan di Supabase SQL Editor.
-- Kedua role ini mendapat akses setara ops_manager.

-- 1. Update role CHECK constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'staff','asst_head_store','head_store',
  'district_manager','area_manager','ops_manager',
  'support_spv','support_admin',
  'finance_supervisor','trainer',
  'sc_supervisor','purchasing_admin','warehouse_admin',
  'picking_spv','qc_spv','distribution_spv','warehouse_spv'
));

-- 2. is_sc_role() — tambah support roles agar bisa akses SC module
CREATE OR REPLACE FUNCTION is_sc_role() RETURNS BOOLEAN AS $$
  SELECT my_role() IN (
    'ops_manager','sc_supervisor','warehouse_admin','warehouse_spv',
    'purchasing_admin','picking_spv','qc_spv','distribution_spv',
    'support_spv','support_admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. profiles: support bisa baca profil semua user (seperti ops_manager)
DROP POLICY IF EXISTS "profiles_read_own" ON profiles;
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR my_role() IN ('ops_manager','district_manager','area_manager','support_spv','support_admin')
  );

-- 4. daily_visits: support bisa insert & update
DROP POLICY IF EXISTS "visits_insert" ON daily_visits;
CREATE POLICY "visits_insert" ON daily_visits FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('district_manager','area_manager','ops_manager','support_spv','support_admin'));

DROP POLICY IF EXISTS "visits_update" ON daily_visits;
CREATE POLICY "visits_update" ON daily_visits FOR UPDATE TO authenticated
  USING (auditor_id = auth.uid() OR my_role() IN ('ops_manager','support_spv','support_admin'));

-- 5. visit_scores: support bisa insert & delete
DROP POLICY IF EXISTS "visit_scores_insert" ON visit_scores;
CREATE POLICY "visit_scores_insert" ON visit_scores FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('district_manager','area_manager','ops_manager','support_spv','support_admin'));

DROP POLICY IF EXISTS "visit_scores_delete" ON visit_scores;
CREATE POLICY "visit_scores_delete" ON visit_scores FOR DELETE TO authenticated
  USING (my_role() IN ('district_manager','area_manager','ops_manager','support_spv','support_admin'));

-- 6. kpi_targets: support bisa manage
DROP POLICY IF EXISTS "kpi_manage" ON kpi_targets;
CREATE POLICY "kpi_manage" ON kpi_targets FOR ALL TO authenticated
  USING    (my_role() IN ('ops_manager','support_spv','support_admin'))
  WITH CHECK (my_role() IN ('ops_manager','support_spv','support_admin'));

-- 7. kpi_monthly_reports: support bisa manage & baca semua
DROP POLICY IF EXISTS "kpi_monthly_reports_select" ON kpi_monthly_reports;
CREATE POLICY "kpi_monthly_reports_select" ON kpi_monthly_reports FOR SELECT TO authenticated
  USING (
    my_role() IN ('staff','asst_head_store','head_store',
                  'district_manager','area_manager','ops_manager','support_spv','support_admin')
    AND can_access_branch(branch_id)
    OR my_role() IN ('ops_manager','support_spv','support_admin')
  );

DROP POLICY IF EXISTS "kpi_monthly_reports_manage" ON kpi_monthly_reports;
CREATE POLICY "kpi_monthly_reports_manage" ON kpi_monthly_reports FOR ALL TO authenticated
  USING    (my_role() IN ('ops_manager','support_spv','support_admin'))
  WITH CHECK (my_role() IN ('ops_manager','support_spv','support_admin'));

-- 8. dm_tasks: support punya akses penuh (seperti ops_manager)
DROP POLICY IF EXISTS "dm_tasks_ops_all" ON dm_tasks;
CREATE POLICY "dm_tasks_ops_all" ON dm_tasks FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND role IN ('ops_manager','support_spv','support_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND role IN ('ops_manager','support_spv','support_admin'))
  );

-- 9. daily_reports: support bisa insert
DROP POLICY IF EXISTS "reports_insert" ON daily_reports;
CREATE POLICY "reports_insert" ON daily_reports FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN ('staff','asst_head_store','head_store',
                  'district_manager','area_manager','ops_manager','support_spv','support_admin')
    AND can_access_branch(branch_id)
  );

-- 10. supply_orders: support bisa insert & update
DROP POLICY IF EXISTS "supply_orders_insert" ON supply_orders;
CREATE POLICY "supply_orders_insert" ON supply_orders FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('warehouse_admin','warehouse_spv','purchasing_admin',
                             'ops_manager','sc_supervisor','support_spv','support_admin'));

DROP POLICY IF EXISTS "supply_orders_update" ON supply_orders;
CREATE POLICY "supply_orders_update" ON supply_orders FOR UPDATE TO authenticated
  USING (my_role() IN ('warehouse_admin','warehouse_spv','ops_manager','sc_supervisor',
                       'picking_spv','qc_spv','distribution_spv','support_spv','support_admin'));

-- 11. supply_order_items
DROP POLICY IF EXISTS "soi_insert" ON supply_order_items;
CREATE POLICY "soi_insert" ON supply_order_items FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('warehouse_admin','warehouse_spv','purchasing_admin',
                             'ops_manager','sc_supervisor','support_spv','support_admin'));

-- 12. supply_confirmations: support bisa update stage
DROP POLICY IF EXISTS "sc_confirm_update" ON supply_confirmations;
CREATE POLICY "sc_confirm_update" ON supply_confirmations FOR UPDATE TO authenticated
  USING (
    (stage = 'picking'      AND my_role() IN ('picking_spv','warehouse_admin','warehouse_spv','ops_manager','sc_supervisor','support_spv','support_admin'))
    OR (stage = 'qc'        AND my_role() IN ('qc_spv','warehouse_admin','warehouse_spv','ops_manager','sc_supervisor','support_spv','support_admin'))
    OR (stage = 'distribution' AND my_role() IN ('distribution_spv','warehouse_admin','warehouse_spv','ops_manager','sc_supervisor','support_spv','support_admin'))
  );

-- 13. surat_jalan: support bisa insert & update
DROP POLICY IF EXISTS "sj_insert" ON surat_jalan;
CREATE POLICY "sj_insert" ON surat_jalan FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('warehouse_admin','warehouse_spv','ops_manager','sc_supervisor',
                             'support_spv','support_admin'));

DROP POLICY IF EXISTS "sj_update" ON surat_jalan;
CREATE POLICY "sj_update" ON surat_jalan FOR UPDATE TO authenticated
  USING (my_role() IN ('warehouse_admin','warehouse_spv','distribution_spv',
                       'ops_manager','sc_supervisor','support_spv','support_admin',
                       'staff','asst_head_store','head_store'));

-- 14. surat_jalan_items
DROP POLICY IF EXISTS "sji_insert" ON surat_jalan_items;
CREATE POLICY "sji_insert" ON surat_jalan_items FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('warehouse_admin','warehouse_spv','ops_manager','sc_supervisor',
                             'support_spv','support_admin'));

-- 15. operational_expenses: support bisa akses
DROP POLICY IF EXISTS "opex_insert" ON operational_expenses;
CREATE POLICY "opex_insert" ON operational_expenses FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN ('staff','asst_head_store','head_store',
                  'district_manager','area_manager','ops_manager','support_spv','support_admin')
    AND can_access_branch(branch_id)
  );

-- 16. trainer tables: support bisa read & write
DROP POLICY IF EXISTS "trainer_read" ON trainer_new_staff;
CREATE POLICY "trainer_read" ON trainer_new_staff FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
                 AND role IN ('trainer','ops_manager','support_spv','support_admin')));

DROP POLICY IF EXISTS "trainer_write" ON trainer_new_staff;
CREATE POLICY "trainer_write" ON trainer_new_staff FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
                      AND role IN ('trainer','ops_manager','support_spv','support_admin')));

DROP POLICY IF EXISTS "trainer_existing_read" ON trainer_existing_staff;
CREATE POLICY "trainer_existing_read" ON trainer_existing_staff FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
                 AND role IN ('trainer','ops_manager','support_spv','support_admin')));

DROP POLICY IF EXISTS "trainer_existing_write" ON trainer_existing_staff;
CREATE POLICY "trainer_existing_write" ON trainer_existing_staff FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
                      AND role IN ('trainer','ops_manager','support_spv','support_admin')));
