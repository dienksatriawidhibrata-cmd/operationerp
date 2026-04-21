-- ── 011: Daily Preparation module ────────────────────────────────────────
-- Separate from daily_checklists — tracks daily food & drink preparation

CREATE TABLE IF NOT EXISTS daily_preparation (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id    UUID REFERENCES branches ON DELETE CASCADE NOT NULL,
  tanggal      DATE NOT NULL,
  shift        TEXT NOT NULL CHECK (shift IN ('pagi', 'middle', 'malam')),
  submitted_by UUID REFERENCES profiles,
  answers      JSONB DEFAULT '{}',
  photos       TEXT[] DEFAULT '{}',
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(branch_id, tanggal, shift)
);

ALTER TABLE daily_preparation ENABLE ROW LEVEL SECURITY;

-- Store staff can read/write own branch
CREATE POLICY "prep_store_select" ON daily_preparation FOR SELECT TO authenticated
  USING (
    branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
    OR my_role() IN ('ops_manager','support_spv','support_admin','district_manager','area_manager')
  );

CREATE POLICY "prep_store_insert" ON daily_preparation FOR INSERT TO authenticated
  WITH CHECK (
    branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "prep_store_update" ON daily_preparation FOR UPDATE TO authenticated
  USING (
    branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
    OR my_role() IN ('ops_manager','support_spv','support_admin')
  )
  WITH CHECK (
    branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
    OR my_role() IN ('ops_manager','support_spv','support_admin')
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER prep_updated_at
  BEFORE UPDATE ON daily_preparation
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
