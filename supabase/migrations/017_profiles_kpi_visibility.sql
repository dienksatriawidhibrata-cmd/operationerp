-- ============================================================
-- Allow KPI-related profile visibility for store roles
-- Migration 017
-- ============================================================

-- Store teams need to see same-branch peers for 360 and KPI pages.
DROP POLICY IF EXISTS "profiles_read_store_scope" ON profiles;
CREATE POLICY "profiles_read_store_scope" ON profiles
  FOR SELECT TO authenticated
  USING (
    role IN ('staff', 'barista', 'kitchen', 'waitress', 'asst_head_store', 'head_store')
    AND can_access_branch(branch_id)
  );

-- Head store needs to see its district manager and area manager for manager-group 360.
DROP POLICY IF EXISTS "profiles_read_head_store_manager_scope" ON profiles;
CREATE POLICY "profiles_read_head_store_manager_scope" ON profiles
  FOR SELECT TO authenticated
  USING (
    my_role() = 'head_store'
    AND (
      (
        role = 'district_manager'
        AND EXISTS (
          SELECT 1
          FROM branches my_branch_row
          WHERE my_branch_row.id = my_branch()
            AND my_branch_row.district = ANY(COALESCE(managed_districts, ARRAY[]::text[]))
        )
      )
      OR (
        role = 'area_manager'
        AND EXISTS (
          SELECT 1
          FROM branches my_branch_row
          WHERE my_branch_row.id = my_branch()
            AND my_branch_row.area = ANY(COALESCE(managed_areas, ARRAY[]::text[]))
        )
      )
    )
  );
