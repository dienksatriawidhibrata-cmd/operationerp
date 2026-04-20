-- Add store receiving details for surat jalan.
-- Run in Supabase SQL Editor after 008_sc_race_condition_and_tables.sql.

ALTER TABLE surat_jalan
  ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES profiles,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receive_note TEXT;

ALTER TABLE surat_jalan_items
  ADD COLUMN IF NOT EXISTS qty_received NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS receive_note TEXT;

DROP POLICY IF EXISTS "sji_update" ON surat_jalan_items;
CREATE POLICY "sji_update" ON surat_jalan_items FOR UPDATE TO authenticated
  USING (
    is_sc_role()
    OR EXISTS (
      SELECT 1
      FROM surat_jalan sj
      WHERE sj.id = surat_jalan_items.sj_id
        AND my_role() IN (
          'staff','barista','kitchen','waitress','asst_head_store','head_store',
          'warehouse_admin','warehouse_spv','distribution_spv',
          'ops_manager','sc_supervisor','support_spv','support_admin'
        )
        AND can_access_branch(sj.branch_id)
    )
  );
