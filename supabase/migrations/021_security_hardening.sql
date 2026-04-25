-- ============================================================
-- Security hardening:
-- 1. Prevent self privilege escalation on profiles
-- 2. Enforce active-session access on operational tables
-- ============================================================

CREATE OR REPLACE FUNCTION my_is_active() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND is_active = true
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_access_branch(b_id UUID) RETURNS BOOLEAN AS $$
  SELECT my_is_active() AND EXISTS (
    SELECT 1 FROM branches b
    WHERE b.id = b_id AND (
      (my_role() IN ('staff','barista','kitchen','waitress','asst_head_store','head_store') AND b.id = my_branch())
      OR (my_role() = 'district_manager' AND b.district = ANY(my_districts()))
      OR (my_role() = 'area_manager' AND b.area = ANY(my_areas()))
      OR my_role() IN (
        'ops_manager','finance_supervisor','sc_supervisor',
        'support_spv','support_admin','auditor',
        'warehouse_admin','warehouse_spv','purchasing_admin',
        'picking_spv','qc_spv','distribution_spv'
      )
    )
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_sc_role() RETURNS BOOLEAN AS $$
  SELECT my_is_active() AND my_role() IN (
    'ops_manager','sc_supervisor','warehouse_admin','warehouse_spv',
    'purchasing_admin','picking_spv','qc_spv','distribution_spv',
    'support_spv','support_admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE TO authenticated
  USING (my_role() IN ('ops_manager','support_spv','support_admin'))
  WITH CHECK (my_role() IN ('ops_manager','support_spv','support_admin'));

CREATE OR REPLACE FUNCTION guard_profile_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_role TEXT;
BEGIN
  IF actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO actor_role
  FROM profiles
  WHERE id = actor_id;

  IF actor_id = OLD.id THEN
    IF NEW.role IS DISTINCT FROM OLD.role
      OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
      OR NEW.managed_districts IS DISTINCT FROM OLD.managed_districts
      OR NEW.managed_areas IS DISTINCT FROM OLD.managed_areas
      OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Tidak boleh mengubah akses profil sendiri.';
    END IF;

    RETURN NEW;
  END IF;

  IF actor_role NOT IN ('ops_manager','support_spv','support_admin') THEN
    RAISE EXCEPTION 'Tidak punya akses mengubah profil user lain.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_mutation_trigger ON profiles;
CREATE TRIGGER guard_profile_mutation_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION guard_profile_mutation();

DO $$
DECLARE
  table_name TEXT;
  protected_tables TEXT[] := ARRAY[
    'branches',
    'expense_codes',
    'daily_checklists',
    'daily_preparation',
    'daily_reports',
    'daily_deposits',
    'operational_expenses',
    'daily_visits',
    'visit_scores',
    'kpi_targets',
    'kpi_monthly_reports',
    'supply_orders',
    'supply_order_items',
    'supply_confirmations',
    'supply_confirmation_items',
    'surat_jalan',
    'surat_jalan_items',
    'sop_cards',
    'announcements',
    'oje_evaluations',
    'oje_batches',
    'oje_batch_items',
    'kpi_personal_items',
    'kpi_360_items',
    'kpi_personal_scores',
    'kpi_360_submissions',
    'kpi_360_scores',
    'trainer_new_staff',
    'trainer_existing_staff',
    'dm_tasks'
  ];
BEGIN
  FOREACH table_name IN ARRAY protected_tables LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS active_session_only ON %I', table_name);
      EXECUTE format(
        'CREATE POLICY active_session_only ON %I AS RESTRICTIVE FOR ALL TO authenticated USING (my_is_active()) WITH CHECK (my_is_active())',
        table_name
      );
    END IF;
  END LOOP;
END $$;
