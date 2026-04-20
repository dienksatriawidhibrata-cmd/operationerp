-- OJE (On Job Evaluation) tables
-- Run after 009_receive_qty_on_surat_jalan.sql

-- Individual OJE per kandidat
CREATE TABLE IF NOT EXISTS oje_evaluations (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  nickname       TEXT,
  position       TEXT NOT NULL CHECK (position IN ('barista','kitchen','waitress')),
  branch_id      UUID REFERENCES branches,
  observer_name  TEXT,
  observer_id    UUID REFERENCES profiles,
  eval_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  scores         JSONB NOT NULL DEFAULT '{}',
  total_score    INTEGER,
  percentage     NUMERIC(5,1),
  rating         TEXT CHECK (rating IN ('Excellent','Good','Fail')),
  remarks_opening TEXT,
  remarks_closing TEXT,
  alasan          TEXT,
  created_by      UUID REFERENCES profiles,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE oje_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oje_eval_select" ON oje_evaluations FOR SELECT TO authenticated
  USING (my_role() IN ('trainer','ops_manager','support_spv','support_admin',
                        'head_store','district_manager','area_manager'));

CREATE POLICY "oje_eval_insert" ON oje_evaluations FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('trainer','ops_manager','support_spv','support_admin',
                              'head_store','district_manager','area_manager'));

CREATE POLICY "oje_eval_update" ON oje_evaluations FOR UPDATE TO authenticated
  USING (my_role() IN ('trainer','ops_manager','support_spv','support_admin'));

CREATE POLICY "oje_eval_delete" ON oje_evaluations FOR DELETE TO authenticated
  USING (my_role() IN ('trainer','ops_manager','support_spv','support_admin'));


-- Batch OJE header (satu sesi banyak peserta)
CREATE TABLE IF NOT EXISTS oje_batches (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  branch_id      UUID REFERENCES branches,
  evaluator_name TEXT,
  evaluator_id   UUID REFERENCES profiles,
  notes          TEXT,
  created_by     UUID REFERENCES profiles,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE oje_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oje_batch_select" ON oje_batches FOR SELECT TO authenticated
  USING (my_role() IN ('trainer','ops_manager','support_spv','support_admin',
                        'head_store','district_manager','area_manager'));

CREATE POLICY "oje_batch_insert" ON oje_batches FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('trainer','ops_manager','support_spv','support_admin',
                              'head_store','district_manager','area_manager'));

CREATE POLICY "oje_batch_update" ON oje_batches FOR UPDATE TO authenticated
  USING (my_role() IN ('trainer','ops_manager','support_spv','support_admin'));

CREATE POLICY "oje_batch_delete" ON oje_batches FOR DELETE TO authenticated
  USING (my_role() IN ('trainer','ops_manager','support_spv','support_admin'));


-- Batch items (satu baris per peserta)
CREATE TABLE IF NOT EXISTS oje_batch_items (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id      UUID REFERENCES oje_batches ON DELETE CASCADE NOT NULL,
  nama_peserta  TEXT NOT NULL,
  nama_panggilan TEXT,
  disiplin      SMALLINT NOT NULL DEFAULT 0,
  sikap         SMALLINT NOT NULL DEFAULT 0,
  behavior      SMALLINT NOT NULL DEFAULT 0,
  nyapu_ngepel  SMALLINT NOT NULL DEFAULT 0,
  layout        SMALLINT NOT NULL DEFAULT 0,
  toilet        SMALLINT NOT NULL DEFAULT 0,
  stamina       SMALLINT NOT NULL DEFAULT 0,
  kerja_sama    SMALLINT NOT NULL DEFAULT 0,
  fokus         SMALLINT NOT NULL DEFAULT 0,
  subjektif     SMALLINT NOT NULL DEFAULT 0,
  sort_order    SMALLINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE oje_batch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oje_bi_select" ON oje_batch_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM oje_batches b WHERE b.id = oje_batch_items.batch_id
    AND my_role() IN ('trainer','ops_manager','support_spv','support_admin',
                       'head_store','district_manager','area_manager')
  ));

CREATE POLICY "oje_bi_insert" ON oje_batch_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM oje_batches b WHERE b.id = oje_batch_items.batch_id
    AND my_role() IN ('trainer','ops_manager','support_spv','support_admin',
                       'head_store','district_manager','area_manager')
  ));

CREATE POLICY "oje_bi_update" ON oje_batch_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM oje_batches b WHERE b.id = oje_batch_items.batch_id
    AND my_role() IN ('trainer','ops_manager','support_spv','support_admin')
  ));

CREATE POLICY "oje_bi_delete" ON oje_batch_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM oje_batches b WHERE b.id = oje_batch_items.batch_id
    AND my_role() IN ('trainer','ops_manager','support_spv','support_admin')
  ));
