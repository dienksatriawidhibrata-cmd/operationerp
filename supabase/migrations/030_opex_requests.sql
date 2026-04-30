-- Tabel pengajuan dana operasional
-- Flow: submitted → dm_approved → pending_support (AM approve atau DM skip AM)
--       → support_approved → ops_approved (finance bisa lihat/download)
--       Any stage → rejected

CREATE TABLE opex_requests (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           uuid        NOT NULL REFERENCES branches(id),
  tanggal_pengajuan   date        NOT NULL,
  sisa_saldo          numeric(14,2),
  items               jsonb       NOT NULL DEFAULT '[]',
  total_pengajuan     numeric(14,2) NOT NULL DEFAULT 0,
  keterangan          text,
  status              text        NOT NULL DEFAULT 'submitted'
                      CHECK (status IN (
                        'submitted',
                        'dm_approved',
                        'pending_support',
                        'support_approved',
                        'ops_approved',
                        'rejected'
                      )),
  -- Submission
  submitted_by        uuid        NOT NULL REFERENCES profiles(id),
  -- DM
  dm_approved_by      uuid        REFERENCES profiles(id),
  dm_approved_at      timestamptz,
  dm_note             text,
  am_skipped          boolean     NOT NULL DEFAULT false,
  -- AM
  am_approved_by      uuid        REFERENCES profiles(id),
  am_approved_at      timestamptz,
  am_note             text,
  -- Support Admin
  support_approved_by uuid        REFERENCES profiles(id),
  support_approved_at timestamptz,
  support_note        text,
  -- Ops Manager
  ops_approved_by     uuid        REFERENCES profiles(id),
  ops_approved_at     timestamptz,
  ops_note            text,
  -- Rejection (any stage)
  rejected_by         uuid        REFERENCES profiles(id),
  rejected_at         timestamptz,
  rejected_note       text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE opex_requests ENABLE ROW LEVEL SECURITY;

-- head_store & asst_head_store: lihat pengajuan cabang sendiri
CREATE POLICY "store_view_own_branch"
  ON opex_requests FOR SELECT TO authenticated
  USING (
    branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid())
        = ANY(ARRAY['head_store','asst_head_store'])
  );

-- hanya head_store yang bisa submit
CREATE POLICY "head_store_insert"
  ON opex_requests FOR INSERT TO authenticated
  WITH CHECK (
    branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'head_store'
    AND submitted_by = auth.uid()
  );

-- DM, AM, support_admin, support_spv, ops_manager, finance, auditor, hr_administrator: lihat semua
CREATE POLICY "manager_view_all"
  ON opex_requests FOR SELECT TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid())
    = ANY(ARRAY[
      'district_manager','area_manager','ops_manager',
      'support_admin','support_spv',
      'finance_supervisor','hr_administrator','auditor'
    ])
  );

-- Update: DM/AM/support/ops bisa approve masing-masing step
CREATE POLICY "approver_update"
  ON opex_requests FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid())
    = ANY(ARRAY[
      'district_manager','area_manager',
      'support_admin','support_spv',
      'ops_manager','finance_supervisor'
    ])
  )
  WITH CHECK (true);
