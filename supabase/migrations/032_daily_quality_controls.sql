-- 032: Daily Quality Control for head_store + asst_head_store

CREATE TABLE IF NOT EXISTS daily_quality_controls (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id    UUID REFERENCES branches ON DELETE CASCADE NOT NULL,
  tanggal      DATE NOT NULL,
  maker_name   TEXT NOT NULL,
  submitted_by UUID REFERENCES profiles,
  items        JSONB DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(branch_id, tanggal)
);

ALTER TABLE daily_quality_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_select" ON daily_quality_controls;
CREATE POLICY "qc_select" ON daily_quality_controls FOR SELECT TO authenticated
  USING (
    branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
    OR my_role() IN ('district_manager','area_manager','ops_manager','support_spv','support_admin')
  );

DROP POLICY IF EXISTS "qc_insert" ON daily_quality_controls;
CREATE POLICY "qc_insert" ON daily_quality_controls FOR INSERT TO authenticated
  WITH CHECK (
    branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
    AND my_role() IN ('head_store','asst_head_store')
  );

DROP POLICY IF EXISTS "qc_update" ON daily_quality_controls;
CREATE POLICY "qc_update" ON daily_quality_controls FOR UPDATE TO authenticated
  USING (
    (branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()) AND my_role() IN ('head_store','asst_head_store'))
    OR my_role() IN ('ops_manager','support_spv','support_admin')
  )
  WITH CHECK (
    (branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()) AND my_role() IN ('head_store','asst_head_store'))
    OR my_role() IN ('ops_manager','support_spv','support_admin')
  );

DROP TRIGGER IF EXISTS quality_controls_updated_at ON daily_quality_controls;
CREATE TRIGGER quality_controls_updated_at
  BEFORE UPDATE ON daily_quality_controls
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
