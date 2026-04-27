-- ============================================================
-- MIGRATION 023: RECRUITMENT MODULE
-- Jalankan setelah: 018_auditor_role.sql
-- Lokal only — jangan deploy ke production sebelum UI siap
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- 1. TAMBAH 4 HR ROLES BARU
-- ═══════════════════════════════════════════════════════════

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'staff','barista','kitchen','waitress',
  'asst_head_store','head_store',
  'district_manager','area_manager','ops_manager',
  'support_spv','support_admin',
  'finance_supervisor','trainer',
  'sc_supervisor','purchasing_admin','warehouse_admin',
  'picking_spv','qc_spv','distribution_spv','warehouse_spv',
  'auditor',
  'hr_staff','hr_spv','hr_legal','hr_administrator'
));

-- handle_new_user: terima role HR baru dari user metadata
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
        'support_spv','support_admin',
        'finance_supervisor','trainer',
        'sc_supervisor','purchasing_admin','warehouse_admin',
        'picking_spv','qc_spv','distribution_spv','warehouse_spv',
        'auditor',
        'hr_staff','hr_spv','hr_legal','hr_administrator'
      )
      THEN COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
      ELSE 'staff'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- can_access_branch: HR roles lihat semua branch (seperti ops_manager)
CREATE OR REPLACE FUNCTION can_access_branch(b_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM branches b
    WHERE b.id = b_id AND (
      (my_role() IN ('staff','barista','kitchen','waitress','asst_head_store','head_store')
       AND b.id = my_branch())
      OR (my_role() = 'district_manager' AND b.district = ANY(my_districts()))
      OR (my_role() = 'area_manager'    AND b.area    = ANY(my_areas()))
      OR my_role() IN (
        'ops_manager','finance_supervisor','sc_supervisor',
        'support_spv','support_admin','auditor',
        'hr_staff','hr_spv','hr_legal','hr_administrator'
      )
    )
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles: HR roles butuh baca profiles untuk candidate management
DROP POLICY IF EXISTS "profiles_read_own" ON profiles;
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT TO authenticated USING (
  id = auth.uid()
  OR my_role() IN (
    'ops_manager','district_manager','area_manager',
    'hr_staff','hr_spv','hr_legal','hr_administrator'
  )
);

-- ═══════════════════════════════════════════════════════════
-- 2. TABEL: candidates
--    1 record per kandidat — source of truth pipeline
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS candidates (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name        TEXT NOT NULL,
  phone            TEXT NOT NULL,
  -- email diisi selama proses, nilai final dari hr_legal saat kontrak
  email            TEXT,
  applied_position TEXT NOT NULL CHECK (applied_position IN (
                     'barista','kitchen','waitress','staff','asst_head_store'
                   )),
  branch_id        UUID REFERENCES branches NOT NULL,
  -- FK ke oje_batches existing (nullable: diset saat batch diterbitkan)
  batch_id         UUID REFERENCES oje_batches,
  current_stage    TEXT NOT NULL DEFAULT 'batch_oje_issued' CHECK (current_stage IN (
                     'batch_oje_issued',       -- S1:  hr_staff publish batch
                     'batch_oje_uploaded',     -- S2:  HS/DM upload hasil batch
                     'batch_oje_reviewed',     -- S3:  hr_staff seleksi siapa lanjut ke OJE in Store
                     'oje_instore_issued',     -- S4:  hr_staff assign kandidat ke toko
                     'oje_instore_submitted',  -- S5:  HS upload form kelulusan OJE
                     'review_hrstaff',         -- S6:  hr_staff review form (approve / flag revisi)
                     'revision_hs',            -- S7:  HS sedang merevisi field yang diflag
                     'pending_hrspv',          -- S8:  menunggu approval hr_spv
                     'revision_hrstaff',       -- S9:  hr_spv reject → kembali ke hr_staff
                     'kontrak_pending',        -- S10: menunggu hr_legal submit kontrak
                     'ojt_instore',            -- S11: OJT berlangsung di toko
                     'assessment',             -- S12: Trainer melakukan assessment
                     'training',              -- S13: Trainer melakukan training
                     'on_duty'                -- S14: aktif bekerja
                   )),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                     'active',      -- sedang dalam proses
                     'terminated',  -- gagal / keluar (soft delete)
                     'on_hold',     -- ditahan sementara
                     'on_duty'      -- sudah aktif bekerja
                   )),
  notes            TEXT,
  created_by       UUID REFERENCES profiles,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at setiap kali ada perubahan
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- HR: full access semua kandidat semua branch
CREATE POLICY "candidates_hr_all" ON candidates FOR ALL TO authenticated
  USING    (my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator'))
  WITH CHECK (my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator'));

-- Head Store: read kandidat di branch sendiri saja
CREATE POLICY "candidates_hs_select" ON candidates FOR SELECT TO authenticated
  USING (my_role() = 'head_store' AND branch_id = my_branch());

-- Head Store: update kandidat di branch sendiri (untuk upload form OJE/OJT)
CREATE POLICY "candidates_hs_update" ON candidates FOR UPDATE TO authenticated
  USING (my_role() = 'head_store' AND branch_id = my_branch());

-- DM: read kandidat di distriknya
CREATE POLICY "candidates_dm_select" ON candidates FOR SELECT TO authenticated
  USING (
    my_role() = 'district_manager' AND EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = candidates.branch_id AND b.district = ANY(my_districts())
    )
  );

-- DM: update (untuk upload hasil batch OJE)
CREATE POLICY "candidates_dm_update" ON candidates FOR UPDATE TO authenticated
  USING (
    my_role() = 'district_manager' AND EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = candidates.branch_id AND b.district = ANY(my_districts())
    )
  );

-- Trainer: read kandidat di stage assessment / training
CREATE POLICY "candidates_trainer_select" ON candidates FOR SELECT TO authenticated
  USING (
    my_role() = 'trainer'
    AND current_stage IN ('assessment','training')
  );

-- Ops Manager: read all untuk monitoring
CREATE POLICY "candidates_ops_select" ON candidates FOR SELECT TO authenticated
  USING (my_role() = 'ops_manager');

-- ═══════════════════════════════════════════════════════════
-- 3. TABEL: stage_history
--    Append-only audit trail — TIDAK BOLEH update/delete
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stage_history (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id     UUID REFERENCES candidates NOT NULL,
  from_stage       TEXT,    -- null untuk entry pertama (kandidat baru dibuat)
  to_stage         TEXT NOT NULL,
  action           TEXT NOT NULL CHECK (action IN (
                     'advance',    -- lanjut ke stage berikutnya
                     'reject',     -- ditolak / tidak lulus
                     'revise',     -- hr_staff / hr_spv minta revisi (flag fields)
                     'resubmit',   -- HS / hr_staff resubmit setelah revisi
                     'terminate',  -- terminasi kandidat
                     'hold',       -- tahan sementara
                     'activate'    -- kontrak signed, akun dibuat
                   )),
  notes            TEXT,
  -- JSON: { "fields": ["field_a","field_b"], "reason": "..." }
  revision_fields  JSONB,
  performed_by     UUID REFERENCES profiles NOT NULL,
  performed_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE stage_history ENABLE ROW LEVEL SECURITY;

-- SELECT: HR + ops_manager + pihak yang terlibat (HS branch, DM distrik, trainer)
CREATE POLICY "stage_history_select" ON stage_history FOR SELECT TO authenticated
  USING (
    my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator','ops_manager')
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

-- INSERT: semua role yang bisa melakukan stage transition
CREATE POLICY "stage_history_insert" ON stage_history FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator')
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

-- TIDAK ADA policy UPDATE / DELETE → append-only dijamin di level DB

-- ═══════════════════════════════════════════════════════════
-- 4. TABEL: stage_forms
--    Versioned form data per stage — selalu INSERT baru, jangan UPDATE isi
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stage_forms (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id     UUID REFERENCES candidates NOT NULL,
  stage            TEXT NOT NULL,
  -- version naik setiap revisi; version lama is_current = false
  version          INTEGER NOT NULL DEFAULT 1,
  -- isi form flexible per stage (tidak perlu alter table saat field bertambah)
  form_data        JSONB NOT NULL DEFAULT '{}',
  -- field yang sedang diflag untuk direvisi oleh HS
  -- { "fields": ["penilaian_kebersihan"], "reason": "..." }
  revision_fields  JSONB,
  attachments      TEXT[] DEFAULT '{}',
  submitted_by     UUID REFERENCES profiles NOT NULL,
  submitted_at     TIMESTAMPTZ DEFAULT now(),
  is_current       BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(candidate_id, stage, version)
);

ALTER TABLE stage_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_forms_select" ON stage_forms FOR SELECT TO authenticated
  USING (
    my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator','ops_manager')
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

-- INSERT: HR + HS (branch sendiri) + DM (distrik sendiri) + Trainer
CREATE POLICY "stage_forms_insert" ON stage_forms FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN ('hr_staff','hr_spv','hr_legal','hr_administrator')
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

-- UPDATE: hanya untuk set is_current=false (oleh HR saat ada versi baru)
CREATE POLICY "stage_forms_update" ON stage_forms FOR UPDATE TO authenticated
  USING (my_role() IN ('hr_staff','hr_spv','hr_administrator'));

-- ═══════════════════════════════════════════════════════════
-- 5. HELPER FUNCTION: archive_stage_form
--    Panggil sebelum insert versi baru — set is_current=false untuk versi lama
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION archive_stage_form(p_candidate_id UUID, p_stage TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE stage_forms
  SET is_current = false
  WHERE candidate_id = p_candidate_id
    AND stage = p_stage
    AND is_current = true;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 6. HELPER FUNCTION: next_form_version
--    Ambil nomor version berikutnya untuk stage tertentu
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION next_form_version(p_candidate_id UUID, p_stage TEXT)
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(MAX(version), 0) + 1
  FROM stage_forms
  WHERE candidate_id = p_candidate_id AND stage = p_stage;
$$;

-- ═══════════════════════════════════════════════════════════
-- 7. INDICES untuk performa query
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_candidates_branch  ON candidates(branch_id);
CREATE INDEX IF NOT EXISTS idx_candidates_batch   ON candidates(batch_id);
CREATE INDEX IF NOT EXISTS idx_candidates_stage   ON candidates(current_stage);
CREATE INDEX IF NOT EXISTS idx_candidates_status  ON candidates(status);

CREATE INDEX IF NOT EXISTS idx_stage_history_cid  ON stage_history(candidate_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_at   ON stage_history(performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_stage_forms_cid    ON stage_forms(candidate_id, stage);
CREATE INDEX IF NOT EXISTS idx_stage_forms_cur    ON stage_forms(candidate_id, stage, is_current)
  WHERE is_current = true;

-- ═══════════════════════════════════════════════════════════
-- CATATAN UNTUK SPRINT BERIKUTNYA
-- ═══════════════════════════════════════════════════════════
-- S2: Edge Function recruitment-onboard
--     Dipanggil saat hr_legal submit kontrak (stage: kontrak_pending → on_duty)
--     Tugasnya:
--       1. Buat auth user (email dari kontrak, password = VITE_STAFF_PASS)
--       2. Trigger handle_new_user → buat profile dengan role & branch_id dari kandidat
--       3. Insert ke stage_history (action: activate)
--       4. Update candidates.status = on_duty, current_stage = on_duty
--       5. Buat jadwal slot besok (setelah tabel work_schedules tersedia)
-- S3: Tabel ojt_checklists (migration 024)
--     Setelah struktur form OJT dikonfirmasi dengan user
-- ═══════════════════════════════════════════════════════════
