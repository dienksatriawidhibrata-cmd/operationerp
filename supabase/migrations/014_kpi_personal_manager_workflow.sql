-- ============================================================
-- KPI PERSONAL MANAGER WORKFLOW
-- Migration 014
-- ============================================================

ALTER TABLE kpi_personal_scores
  ALTER COLUMN branch_id DROP NOT NULL;

ALTER TABLE kpi_personal_scores
  DROP CONSTRAINT IF EXISTS kpi_personal_scores_staff_id_period_month_item_key_key;

ALTER TABLE kpi_personal_scores
  ADD CONSTRAINT kpi_personal_scores_staff_period_item_scorer_key
  UNIQUE (staff_id, period_month, item_key, scored_by);

DROP POLICY IF EXISTS "kpi_scores_insert" ON kpi_personal_scores;
DROP POLICY IF EXISTS "kpi_scores_update" ON kpi_personal_scores;
DROP POLICY IF EXISTS "kpi_scores_delete" ON kpi_personal_scores;

CREATE POLICY "kpi_scores_insert" ON kpi_personal_scores
  FOR INSERT TO authenticated
  WITH CHECK (
    scored_by = auth.uid()
    AND (
      (
        my_role() = 'head_store'
        AND branch_id = my_branch()
        AND EXISTS (
          SELECT 1
          FROM profiles target
          WHERE target.id = staff_id
            AND target.role IN ('barista', 'kitchen', 'waitress', 'asst_head_store')
            AND target.branch_id = my_branch()
        )
      )
      OR (
        my_role() = 'district_manager'
        AND EXISTS (
          SELECT 1
          FROM profiles target
          JOIN branches branch ON branch.id = target.branch_id
          WHERE target.id = staff_id
            AND target.role = 'head_store'
            AND branch.district = ANY(COALESCE((SELECT managed_districts FROM profiles WHERE id = auth.uid()), ARRAY[]::text[]))
        )
      )
      OR (
        my_role() = 'area_manager'
        AND EXISTS (
          SELECT 1
          FROM profiles target
          JOIN branches branch ON branch.district = ANY(COALESCE(target.managed_districts, ARRAY[]::text[]))
          WHERE target.id = staff_id
            AND target.role = 'district_manager'
            AND branch.area = ANY(COALESCE((SELECT managed_areas FROM profiles WHERE id = auth.uid()), ARRAY[]::text[]))
        )
      )
      OR (
        my_role() = 'ops_manager'
        AND EXISTS (
          SELECT 1
          FROM profiles target
          WHERE target.id = staff_id
            AND target.role = 'district_manager'
        )
      )
      OR (
        my_role() = 'support_spv'
        AND EXISTS (
          SELECT 1
          FROM profiles target
          WHERE target.id = staff_id
            AND target.role IN ('head_store', 'district_manager')
        )
      )
    )
  );

CREATE POLICY "kpi_scores_update" ON kpi_personal_scores
  FOR UPDATE TO authenticated
  USING (
    (scored_by = auth.uid() AND verified_at IS NULL)
    OR (
      my_role() = 'district_manager'
      AND EXISTS (
        SELECT 1
        FROM profiles target
        JOIN branches branch ON branch.id = target.branch_id
        WHERE target.id = staff_id
          AND target.role IN ('barista', 'kitchen', 'waitress', 'asst_head_store')
          AND branch.district = ANY(COALESCE((SELECT managed_districts FROM profiles WHERE id = auth.uid()), ARRAY[]::text[]))
      )
    )
    OR (
      my_role() = 'area_manager'
      AND EXISTS (
        SELECT 1
        FROM profiles target
        JOIN branches branch ON branch.id = target.branch_id
        WHERE target.id = staff_id
          AND target.role = 'head_store'
          AND branch.area = ANY(COALESCE((SELECT managed_areas FROM profiles WHERE id = auth.uid()), ARRAY[]::text[]))
      )
    )
    OR (
      my_role() = 'ops_manager'
      AND EXISTS (
        SELECT 1
        FROM profiles target
        WHERE target.id = staff_id
          AND target.role = 'district_manager'
      )
    )
  )
  WITH CHECK (
    (scored_by = auth.uid() AND verified_at IS NULL)
    OR (
      verified_by = auth.uid()
      AND (
        (
          my_role() = 'district_manager'
          AND EXISTS (
            SELECT 1
            FROM profiles target
            JOIN branches branch ON branch.id = target.branch_id
            WHERE target.id = staff_id
              AND target.role IN ('barista', 'kitchen', 'waitress', 'asst_head_store')
              AND branch.district = ANY(COALESCE((SELECT managed_districts FROM profiles WHERE id = auth.uid()), ARRAY[]::text[]))
          )
        )
        OR (
          my_role() = 'area_manager'
          AND EXISTS (
            SELECT 1
            FROM profiles target
            JOIN branches branch ON branch.id = target.branch_id
            WHERE target.id = staff_id
              AND target.role = 'head_store'
              AND branch.area = ANY(COALESCE((SELECT managed_areas FROM profiles WHERE id = auth.uid()), ARRAY[]::text[]))
          )
        )
        OR (
          my_role() = 'ops_manager'
          AND EXISTS (
            SELECT 1
            FROM profiles target
            WHERE target.id = staff_id
              AND target.role = 'district_manager'
          )
        )
      )
    )
  );

CREATE POLICY "kpi_scores_delete" ON kpi_personal_scores
  FOR DELETE TO authenticated
  USING (
    scored_by = auth.uid()
    AND verified_at IS NULL
  );
