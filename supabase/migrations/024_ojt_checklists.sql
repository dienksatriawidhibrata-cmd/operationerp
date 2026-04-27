-- ============================================================
-- MIGRATION 024: OJT CHECKLISTS
-- Jalankan setelah: 023_recruitment_module.sql
-- ============================================================
-- Tabel untuk checklist OJT in Store.
-- 14 item, 3 kolom sign-off: head_store (hs), trainer, staff.
-- Disimpan sebagai JSONB per item agar tidak perlu alter table
-- jika item bertambah di masa depan.
--
-- Struktur checklist JSONB:
--   {
--     "item_01": { "hs": true,  "trainer": false, "staff": true },
--     "item_02": { "hs": false, "trainer": false, "staff": false },
--     ...
--   }
-- ============================================================

CREATE TABLE IF NOT EXISTS ojt_checklists (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id  UUID REFERENCES candidates NOT NULL,
  branch_id     UUID REFERENCES branches NOT NULL,

  -- Sign-off per item per kolom (lihat struktur di atas)
  checklist     JSONB NOT NULL DEFAULT '{}',

  -- Final sign-off keseluruhan dari masing-masing pihak
  -- Ditandai manual setelah semua item mereka di-tick
  signed_hs          BOOLEAN NOT NULL DEFAULT false,
  signed_hs_by       UUID REFERENCES profiles,
  signed_hs_at       TIMESTAMPTZ,

  signed_trainer     BOOLEAN NOT NULL DEFAULT false,
  signed_trainer_by  UUID REFERENCES profiles,
  signed_trainer_at  TIMESTAMPTZ,

  signed_staff       BOOLEAN NOT NULL DEFAULT false,
  signed_staff_by    UUID REFERENCES profiles,
  signed_staff_at    TIMESTAMPTZ,

  -- True jika ketiga pihak sudah final sign-off
  is_complete   BOOLEAN GENERATED ALWAYS AS (
    signed_hs AND signed_trainer AND signed_staff
  ) STORED,

  created_by    UUID REFERENCES profiles,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE(candidate_id)  -- satu OJT checklist per kandidat
);

CREATE TRIGGER ojt_checklists_updated_at
  BEFORE UPDATE ON ojt_checklists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE ojt_checklists ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ─────────────────────────────────────────────

-- HR roles + Ops Manager: full access
CREATE POLICY "ojt_ckl_hr_all" ON ojt_checklists FOR ALL TO authenticated
  USING    (my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator','ops_manager'))
  WITH CHECK (my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator','ops_manager'));

-- Head Store: baca + update checklist di branch sendiri
CREATE POLICY "ojt_ckl_hs_select" ON ojt_checklists FOR SELECT TO authenticated
  USING (my_role() = 'head_store' AND branch_id = my_branch());

CREATE POLICY "ojt_ckl_hs_insert" ON ojt_checklists FOR INSERT TO authenticated
  WITH CHECK (my_role() = 'head_store' AND branch_id = my_branch());

CREATE POLICY "ojt_ckl_hs_update" ON ojt_checklists FOR UPDATE TO authenticated
  USING (my_role() = 'head_store' AND branch_id = my_branch());

-- Trainer: baca + update kolom trainer untuk semua kandidat di tahap ojt/assessment/training
CREATE POLICY "ojt_ckl_trainer_select" ON ojt_checklists FOR SELECT TO authenticated
  USING (
    my_role() = 'trainer' AND EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = ojt_checklists.candidate_id
        AND c.current_stage IN ('ojt_instore','assessment','training')
    )
  );

CREATE POLICY "ojt_ckl_trainer_update" ON ojt_checklists FOR UPDATE TO authenticated
  USING (
    my_role() = 'trainer' AND EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = ojt_checklists.candidate_id
        AND c.current_stage IN ('ojt_instore','assessment','training')
    )
  );

-- Staff: baca + update kolom staff mereka sendiri
-- (staff yang sudah on-board bisa sign kolom "Staff")
CREATE POLICY "ojt_ckl_staff_select" ON ojt_checklists FOR SELECT TO authenticated
  USING (
    my_role() IN ('staff','barista','kitchen','waitress','asst_head_store')
    AND branch_id = my_branch()
  );

CREATE POLICY "ojt_ckl_staff_update" ON ojt_checklists FOR UPDATE TO authenticated
  USING (
    my_role() IN ('staff','barista','kitchen','waitress','asst_head_store')
    AND branch_id = my_branch()
  );

-- ── Index ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ojt_checklists_candidate ON ojt_checklists(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ojt_checklists_branch    ON ojt_checklists(branch_id);
CREATE INDEX IF NOT EXISTS idx_ojt_checklists_complete  ON ojt_checklists(is_complete);
