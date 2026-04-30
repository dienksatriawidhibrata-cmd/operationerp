-- ============================================================
-- Support role focus + super administrator
-- 1. Tambah role super_administrator
-- 2. Support Admin difokuskan ke finance, bukan admin umum
-- 3. Support SPV mendapat akses recruitment/people yang relevan
-- ============================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'staff','barista','kitchen','waitress',
  'asst_head_store','head_store',
  'district_manager','area_manager','ops_manager',
  'support_spv','support_admin','super_administrator',
  'finance_supervisor','trainer',
  'sc_supervisor','purchasing_admin','warehouse_admin',
  'picking_spv','qc_spv','distribution_spv','warehouse_spv',
  'auditor','hr_staff','hr_spv','hr_legal','hr_administrator'
));

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
        'support_spv','support_admin','super_administrator',
        'finance_supervisor','trainer',
        'sc_supervisor','purchasing_admin','warehouse_admin',
        'picking_spv','qc_spv','distribution_spv','warehouse_spv',
        'auditor','hr_staff','hr_spv','hr_legal','hr_administrator'
      ) THEN COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
      ELSE 'staff'
    END
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION can_access_branch(b_id UUID) RETURNS BOOLEAN AS $$
  SELECT my_is_active() AND EXISTS (
    SELECT 1 FROM branches b
    WHERE b.id = b_id AND (
      (my_role() IN ('staff','barista','kitchen','waitress','asst_head_store','head_store') AND b.id = my_branch())
      OR (my_role() = 'district_manager' AND b.district = ANY(my_districts()))
      OR (my_role() = 'area_manager' AND b.area = ANY(my_areas()))
      OR my_role() IN (
        'ops_manager','finance_supervisor','sc_supervisor',
        'support_spv','support_admin','super_administrator','auditor',
        'warehouse_admin','warehouse_spv','purchasing_admin',
        'picking_spv','qc_spv','distribution_spv'
      )
    )
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "profiles_read_own" ON profiles;
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR my_role() IN ('ops_manager','district_manager','area_manager','support_spv','support_admin','super_administrator')
  );

DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE TO authenticated
  USING (my_role() IN ('ops_manager','super_administrator'))
  WITH CHECK (my_role() IN ('ops_manager','super_administrator'));

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

  IF actor_role NOT IN ('ops_manager','super_administrator') THEN
    RAISE EXCEPTION 'Tidak punya akses mengubah profil user lain.';
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "candidates_hr_all" ON candidates;
CREATE POLICY "candidates_hr_all" ON candidates FOR ALL TO authenticated
  USING    (my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator','support_spv'))
  WITH CHECK (my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator','support_spv'));

DROP POLICY IF EXISTS "candidates_ops_select" ON candidates;
CREATE POLICY "candidates_ops_select" ON candidates FOR SELECT TO authenticated
  USING (my_role() IN ('ops_manager','support_spv'));

DROP POLICY IF EXISTS "stage_history_select" ON stage_history;
CREATE POLICY "stage_history_select" ON stage_history FOR SELECT TO authenticated
  USING (
    my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator','ops_manager','support_spv')
    OR EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = stage_history.candidate_id AND (
        (my_role() = 'head_store' AND c.branch_id = my_branch())
        OR (my_role() = 'district_manager' AND EXISTS (
          SELECT 1 FROM branches b WHERE b.id = c.branch_id AND b.district = ANY(my_districts())
        ))
        OR (my_role() = 'trainer' AND c.current_stage IN ('assessment','training'))
      )
    )
  );

DROP POLICY IF EXISTS "stage_history_insert" ON stage_history;
CREATE POLICY "stage_history_insert" ON stage_history FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator','support_spv')
    OR (
      my_role() IN ('head_store','district_manager','trainer')
      AND EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = stage_history.candidate_id AND (
          (my_role() = 'head_store' AND c.branch_id = my_branch())
          OR (my_role() = 'district_manager' AND EXISTS (
            SELECT 1 FROM branches b WHERE b.id = c.branch_id AND b.district = ANY(my_districts())
          ))
          OR my_role() = 'trainer'
        )
      )
    )
  );

DROP POLICY IF EXISTS "stage_forms_select" ON stage_forms;
CREATE POLICY "stage_forms_select" ON stage_forms FOR SELECT TO authenticated
  USING (
    my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator','ops_manager','support_spv')
    OR EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = stage_forms.candidate_id AND (
        (my_role() = 'head_store' AND c.branch_id = my_branch())
        OR (my_role() = 'district_manager' AND EXISTS (
          SELECT 1 FROM branches b WHERE b.id = c.branch_id AND b.district = ANY(my_districts())
        ))
        OR (my_role() = 'trainer' AND c.current_stage IN ('assessment','training'))
      )
    )
  );

DROP POLICY IF EXISTS "stage_forms_insert" ON stage_forms;
CREATE POLICY "stage_forms_insert" ON stage_forms FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator','support_spv')
    OR (
      my_role() IN ('head_store','district_manager','trainer')
      AND EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = stage_forms.candidate_id AND (
          (my_role() = 'head_store' AND c.branch_id = my_branch())
          OR (my_role() = 'district_manager' AND EXISTS (
            SELECT 1 FROM branches b WHERE b.id = c.branch_id AND b.district = ANY(my_districts())
          ))
          OR my_role() = 'trainer'
        )
      )
    )
  );

DROP POLICY IF EXISTS "stage_forms_update" ON stage_forms;
CREATE POLICY "stage_forms_update" ON stage_forms FOR UPDATE TO authenticated
  USING (my_role() IN ('hr_staff','hr_spv','hr_administrator','support_spv'));

DROP POLICY IF EXISTS "ojt_ckl_hr_all" ON ojt_checklists;
CREATE POLICY "ojt_ckl_hr_all" ON ojt_checklists FOR ALL TO authenticated
  USING    (my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator','ops_manager','support_spv'))
  WITH CHECK (my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator','ops_manager','support_spv'));
