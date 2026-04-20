-- ── SPLIT role 'staff' → barista | kitchen | waitress ────────
-- Jalankan SETELAH 005_support_roles.sql.

-- 1. Update role CHECK constraint (tambah barista, kitchen, waitress)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'staff','barista','kitchen','waitress',
  'asst_head_store','head_store',
  'district_manager','area_manager','ops_manager',
  'support_spv','support_admin',
  'finance_supervisor','trainer',
  'sc_supervisor','purchasing_admin','warehouse_admin',
  'picking_spv','qc_spv','distribution_spv','warehouse_spv'
));

-- 2. Update handle_new_user() trigger agar menerima semua role baru
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'User Baru'),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'staff') IN (
        'staff','barista','kitchen','waitress',
        'asst_head_store','head_store',
        'district_manager','area_manager','ops_manager',
        'support_spv','support_admin',
        'finance_supervisor','trainer',
        'sc_supervisor','purchasing_admin','warehouse_admin',
        'picking_spv','qc_spv','distribution_spv','warehouse_spv'
      )
      THEN COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
      ELSE 'staff'
    END
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- 3. Update trainer_existing_staff position constraint
ALTER TABLE trainer_existing_staff
  DROP CONSTRAINT IF EXISTS trainer_existing_staff_position_check;
ALTER TABLE trainer_existing_staff
  ADD CONSTRAINT trainer_existing_staff_position_check
  CHECK (position IN ('head_store','asst_head_store','staff','barista','kitchen','waitress'));

-- 4. daily_checklists: barista/kitchen/waitress bisa checklist toko sendiri
DROP POLICY IF EXISTS "checklists_insert" ON daily_checklists;
CREATE POLICY "checklists_insert" ON daily_checklists FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN ('staff','barista','kitchen','waitress','asst_head_store','head_store')
    AND branch_id = my_branch()
  );

DROP POLICY IF EXISTS "checklists_update" ON daily_checklists;
CREATE POLICY "checklists_update" ON daily_checklists FOR UPDATE TO authenticated
  USING (
    my_role() IN ('staff','barista','kitchen','waitress','asst_head_store','head_store')
    AND branch_id = my_branch()
  );

-- 5. daily_reports: barista/kitchen/waitress bisa submit laporan
DROP POLICY IF EXISTS "reports_insert" ON daily_reports;
CREATE POLICY "reports_insert" ON daily_reports FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN ('staff','barista','kitchen','waitress',
                  'asst_head_store','head_store',
                  'district_manager','area_manager','ops_manager','support_spv','support_admin')
    AND can_access_branch(branch_id)
  );

-- 6. daily_deposits: barista/kitchen/waitress bisa input setoran
DROP POLICY IF EXISTS "deposits_insert" ON daily_deposits;
CREATE POLICY "deposits_insert" ON daily_deposits FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN ('staff','barista','kitchen','waitress',
                  'asst_head_store','head_store',
                  'district_manager','area_manager')
    AND can_access_branch(branch_id)
  );

-- 7. operational_expenses: barista/kitchen/waitress bisa input opex
DROP POLICY IF EXISTS "opex_insert" ON operational_expenses;
CREATE POLICY "opex_insert" ON operational_expenses FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN ('staff','barista','kitchen','waitress',
                  'asst_head_store','head_store',
                  'district_manager','area_manager','ops_manager','support_spv','support_admin')
    AND can_access_branch(branch_id)
  );

-- 8. surat_jalan: barista/kitchen/waitress bisa mark delivered (terima barang)
DROP POLICY IF EXISTS "sj_update" ON surat_jalan;
CREATE POLICY "sj_update" ON surat_jalan FOR UPDATE TO authenticated
  USING (my_role() IN (
    'warehouse_admin','warehouse_spv','distribution_spv',
    'ops_manager','sc_supervisor','support_spv','support_admin',
    'staff','barista','kitchen','waitress','asst_head_store','head_store'
  ));

-- 9. kpi_monthly_reports: barista/kitchen/waitress bisa lihat KPI toko sendiri
DROP POLICY IF EXISTS "kpi_monthly_reports_select" ON kpi_monthly_reports;
CREATE POLICY "kpi_monthly_reports_select" ON kpi_monthly_reports FOR SELECT TO authenticated
  USING (
    (
      my_role() IN ('staff','barista','kitchen','waitress','asst_head_store','head_store',
                    'district_manager','area_manager')
      AND can_access_branch(branch_id)
    )
    OR my_role() IN ('ops_manager','support_spv','support_admin')
  );
