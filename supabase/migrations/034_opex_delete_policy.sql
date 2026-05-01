DROP POLICY IF EXISTS "opex_delete" ON operational_expenses;
CREATE POLICY "opex_delete" ON operational_expenses
  FOR DELETE TO authenticated
  USING (
    can_access_branch(branch_id)
    AND my_role() IN ('staff','asst_head_store','head_store','district_manager','area_manager','ops_manager')
  );
