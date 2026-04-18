-- Jalankan di Supabase SQL Editor

CREATE TABLE IF NOT EXISTS trainer_new_staff (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  trainee_name     text NOT NULL,
  position         text NOT NULL CHECK (position IN ('barista','waiters','kitchen')),
  branch_id        uuid REFERENCES branches(id) ON DELETE SET NULL,
  assessment_date  date NOT NULL DEFAULT CURRENT_DATE,
  scores           jsonb NOT NULL DEFAULT '{}',
  avg_score        numeric(4,2),
  status           text,
  action_plan      text,
  notes            text,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trainer_existing_staff (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  employee_name    text NOT NULL,
  nip              text,
  position         text NOT NULL CHECK (position IN ('head_store','asst_head_store','staff')),
  branch_id        uuid REFERENCES branches(id) ON DELETE SET NULL,
  assessment_date  date NOT NULL DEFAULT CURRENT_DATE,
  perf_scores      jsonb NOT NULL DEFAULT '{}',
  perf_avg         numeric(4,2),
  pot_scores       jsonb NOT NULL DEFAULT '{}',
  pot_avg          numeric(4,2),
  quadrant         text,
  recommendation   text,
  created_at       timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE trainer_new_staff      ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_existing_staff ENABLE ROW LEVEL SECURITY;

-- Policy: trainer dan ops_manager bisa baca semua
CREATE POLICY "trainer_read" ON trainer_new_staff
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('trainer','ops_manager'))
  );

CREATE POLICY "trainer_write" ON trainer_new_staff
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('trainer','ops_manager'))
  );

CREATE POLICY "trainer_existing_read" ON trainer_existing_staff
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('trainer','ops_manager'))
  );

CREATE POLICY "trainer_existing_write" ON trainer_existing_staff
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('trainer','ops_manager'))
  );
