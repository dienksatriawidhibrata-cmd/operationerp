-- ============================================================
-- BAGI KOPI OPS — Database Schema
-- Supabase PostgreSQL
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── BRANCHES ──────────────────────────────────────────────
CREATE TABLE branches (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id   TEXT UNIQUE NOT NULL,          -- e.g. BK-0001
  name       TEXT NOT NULL,                 -- e.g. Bagi Kopi Margorejo
  district   TEXT NOT NULL,                 -- JKT | SBY | JBR1 | JBR2 | JBR3 | BTN
  area       TEXT NOT NULL,                 -- JKT | SBY | JBR | BTN
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── PROFILES (extends auth.users) ─────────────────────────
CREATE TABLE profiles (
  id                  UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name           TEXT NOT NULL,
  email               TEXT,
  role                TEXT NOT NULL CHECK (role IN (
                        'staff','asst_head_store','head_store',
                        'district_manager','area_manager','ops_manager',
                        'finance_supervisor','sc_supervisor'
                      )),
  branch_id           UUID REFERENCES branches,       -- untuk store-level roles
  managed_districts   TEXT[] DEFAULT '{}',            -- untuk DM: ['JKT']
  managed_areas       TEXT[] DEFAULT '{}',            -- untuk AM: ['JBR']
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup (trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── EXPENSE CODES (master) ────────────────────────────────
CREATE TABLE expense_codes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code       TEXT UNIQUE NOT NULL,          -- e.g. BOH-101
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0
);

-- ── DAILY CHECKLISTS ──────────────────────────────────────
CREATE TABLE daily_checklists (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id    UUID REFERENCES branches NOT NULL,
  shift        TEXT CHECK (shift IN ('pagi','malam')) NOT NULL,
  tanggal      DATE NOT NULL,
  submitted_by UUID REFERENCES profiles NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  -- Auto-compute is_late based on WIB time
  -- Pagi deadline: 08:00 WIB = 01:00 UTC
  -- Malam deadline: 03:00 WIB next day = 20:00 UTC same day
  is_late BOOLEAN GENERATED ALWAYS AS (
    CASE
      WHEN shift = 'pagi' THEN
        (submitted_at AT TIME ZONE 'Asia/Jakarta')::time > '08:00:00'::time
      WHEN shift = 'malam' THEN
        -- After 03:00 WIB next day = after 20:00 UTC same day as tanggal
        submitted_at > (tanggal::timestamp + INTERVAL '20 hours')
      ELSE false
    END
  ) STORED,
  answers  JSONB NOT NULL DEFAULT '{}',    -- { item_key: boolean }
  photos   JSONB NOT NULL DEFAULT '{}',    -- { item_key: [url, ...] }
  item_oos TEXT[] DEFAULT '{}',
  notes    TEXT,
  UNIQUE(branch_id, shift, tanggal)
);

-- ── DAILY REPORTS ─────────────────────────────────────────
CREATE TABLE daily_reports (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id         UUID REFERENCES branches NOT NULL,
  tanggal           DATE NOT NULL,                -- tanggal operasional (bukan submit)
  net_sales         NUMERIC(14,2) NOT NULL DEFAULT 0,
  jumlah_staff      SMALLINT NOT NULL DEFAULT 0,
  jumlah_kunjungan  INTEGER NOT NULL DEFAULT 0,
  avg_spend         NUMERIC(14,2) GENERATED ALWAYS AS (
    CASE WHEN jumlah_kunjungan > 0 THEN net_sales / jumlah_kunjungan ELSE 0 END
  ) STORED,
  submitted_by      UUID REFERENCES profiles,
  submitted_at      TIMESTAMPTZ DEFAULT now(),
  -- Late if submitted after H+1 14:00 WIB = H+1 07:00 UTC
  is_late           BOOLEAN GENERATED ALWAYS AS (
    submitted_at > ((tanggal + INTERVAL '1 day')::timestamp + INTERVAL '7 hours')
  ) STORED,
  notes             TEXT,
  UNIQUE(branch_id, tanggal)
);

-- ── DAILY DEPOSITS (Setoran) ──────────────────────────────
CREATE TABLE daily_deposits (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id            UUID REFERENCES branches NOT NULL,
  tanggal              DATE NOT NULL,
  cash_pos             NUMERIC(14,2) NOT NULL,
  cash_disetorkan      NUMERIC(14,2) NOT NULL,
  selisih              NUMERIC(14,2) GENERATED ALWAYS AS (cash_pos - cash_disetorkan) STORED,
  alasan_selisih       TEXT,
  foto_bukti           TEXT[] DEFAULT '{}',
  -- DM approval flow
  status               TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  submitted_by         UUID REFERENCES profiles,
  submitted_at         TIMESTAMPTZ,
  approved_by          UUID REFERENCES profiles,
  approved_at          TIMESTAMPTZ,
  rejection_reason     TEXT,
  -- Finance audit flow
  finance_status       TEXT DEFAULT 'pending' CHECK (finance_status IN ('pending','audited','flagged')),
  finance_audited_by   UUID REFERENCES profiles,
  finance_audited_at   TIMESTAMPTZ,
  finance_notes        TEXT,
  UNIQUE(branch_id, tanggal)
);

-- ── OPERATIONAL EXPENSES ──────────────────────────────────
CREATE TABLE operational_expenses (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id      UUID REFERENCES branches NOT NULL,
  tanggal        DATE NOT NULL,
  code           TEXT NOT NULL,
  category       TEXT NOT NULL,
  item_name      TEXT NOT NULL,
  detail         TEXT,
  qty            NUMERIC(10,3) NOT NULL,
  harga_satuan   NUMERIC(14,2) NOT NULL,
  total          NUMERIC(14,2) GENERATED ALWAYS AS (qty * harga_satuan) STORED,
  foto_bukti     TEXT[] DEFAULT '{}',
  submitted_by   UUID REFERENCES profiles,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── DAILY VISITS ──────────────────────────────────────────
CREATE TABLE daily_visits (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id    UUID REFERENCES branches NOT NULL,
  tanggal      DATE NOT NULL,
  auditor_id   UUID REFERENCES profiles NOT NULL,
  total_score  INT,
  max_score    INT DEFAULT 110,
  grade        TEXT,
  catatan      TEXT,
  foto_kondisi TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── VISIT SCORES (per audit item) ─────────────────────────
CREATE TABLE visit_scores (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id  UUID REFERENCES daily_visits ON DELETE CASCADE NOT NULL,
  item_key  TEXT NOT NULL,
  score     INT NOT NULL CHECK (score BETWEEN 1 AND 5),
  photos    TEXT[] DEFAULT '{}',
  UNIQUE(visit_id, item_key)
);

-- ── KPI TARGETS ───────────────────────────────────────────
CREATE TABLE kpi_targets (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id            UUID REFERENCES branches NOT NULL,
  bulan                DATE NOT NULL,                  -- first day of month
  sales_target         NUMERIC(14,2) NOT NULL,
  beban_ratio_target   NUMERIC(5,2) DEFAULT 15,        -- % max dari net_sales
  selisih_threshold    NUMERIC(10,2) DEFAULT 50000,
  configured_by        UUID REFERENCES profiles,
  UNIQUE(branch_id, bulan)
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE branches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checklists     ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_deposits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_visits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_scores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_targets          ENABLE ROW LEVEL SECURITY;

-- ── Helper functions ──────────────────────────────────────

CREATE OR REPLACE FUNCTION my_branch() RETURNS UUID AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION my_role() RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION my_districts() RETURNS TEXT[] AS $$
  SELECT COALESCE(managed_districts, '{}') FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION my_areas() RETURNS TEXT[] AS $$
  SELECT COALESCE(managed_areas, '{}') FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Apakah branch ini di-manage oleh user saat ini?
CREATE OR REPLACE FUNCTION can_access_branch(b_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM branches b
    WHERE b.id = b_id AND (
      -- Store-level: hanya branch sendiri
      (my_role() IN ('staff','asst_head_store','head_store') AND b.id = my_branch())
      -- DM: semua branch di district-nya
      OR (my_role() = 'district_manager' AND b.district = ANY(my_districts()))
      -- AM: semua branch di area-nya
      OR (my_role() = 'area_manager' AND b.area = ANY(my_areas()))
      -- OM + Finance: semua
      OR my_role() IN ('ops_manager','finance_supervisor','sc_supervisor')
    )
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Policies: branches ─────────────────────────────────────
CREATE POLICY "branches_read_all" ON branches FOR SELECT TO authenticated USING (true);

-- ── Policies: profiles ─────────────────────────────────────
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT TO authenticated USING (
  id = auth.uid() OR my_role() IN ('ops_manager','district_manager','area_manager')
);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- ── Policies: expense_codes ────────────────────────────────
CREATE POLICY "expense_codes_read" ON expense_codes FOR SELECT TO authenticated USING (true);

-- ── Policies: daily_checklists ────────────────────────────
CREATE POLICY "checklists_select" ON daily_checklists FOR SELECT TO authenticated
  USING (can_access_branch(branch_id));

CREATE POLICY "checklists_insert" ON daily_checklists FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN ('staff','asst_head_store','head_store')
    AND branch_id = my_branch()
  );

CREATE POLICY "checklists_update" ON daily_checklists FOR UPDATE TO authenticated
  USING (
    my_role() IN ('staff','asst_head_store','head_store')
    AND branch_id = my_branch()
  );

-- ── Policies: daily_reports ───────────────────────────────
CREATE POLICY "reports_select" ON daily_reports FOR SELECT TO authenticated
  USING (can_access_branch(branch_id));

CREATE POLICY "reports_insert" ON daily_reports FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN ('staff','asst_head_store','head_store','district_manager','area_manager','ops_manager')
    AND can_access_branch(branch_id)
  );

CREATE POLICY "reports_update" ON daily_reports FOR UPDATE TO authenticated
  USING (can_access_branch(branch_id));

-- ── Policies: daily_deposits ──────────────────────────────
CREATE POLICY "deposits_select" ON daily_deposits FOR SELECT TO authenticated
  USING (can_access_branch(branch_id) OR my_role() = 'finance_supervisor');

CREATE POLICY "deposits_insert" ON daily_deposits FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN ('staff','asst_head_store','head_store','district_manager','area_manager')
    AND can_access_branch(branch_id)
  );

CREATE POLICY "deposits_update" ON daily_deposits FOR UPDATE TO authenticated
  USING (can_access_branch(branch_id) OR my_role() IN ('finance_supervisor','ops_manager'));

-- ── Policies: operational_expenses ───────────────────────
CREATE POLICY "opex_select" ON operational_expenses FOR SELECT TO authenticated
  USING (can_access_branch(branch_id));

CREATE POLICY "opex_insert" ON operational_expenses FOR INSERT TO authenticated
  WITH CHECK (
    my_role() IN ('staff','asst_head_store','head_store','district_manager','area_manager','ops_manager')
    AND can_access_branch(branch_id)
  );

-- ── Policies: daily_visits ────────────────────────────────
CREATE POLICY "visits_select" ON daily_visits FOR SELECT TO authenticated
  USING (can_access_branch(branch_id));

CREATE POLICY "visits_insert" ON daily_visits FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('district_manager','area_manager','ops_manager'));

CREATE POLICY "visits_update" ON daily_visits FOR UPDATE TO authenticated
  USING (auditor_id = auth.uid() OR my_role() = 'ops_manager');

-- ── Policies: visit_scores ────────────────────────────────
CREATE POLICY "visit_scores_select" ON visit_scores FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_visits dv
      WHERE dv.id = visit_scores.visit_id AND can_access_branch(dv.branch_id)
    )
  );

CREATE POLICY "visit_scores_insert" ON visit_scores FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('district_manager','area_manager','ops_manager'));

CREATE POLICY "visit_scores_delete" ON visit_scores FOR DELETE TO authenticated
  USING (my_role() IN ('district_manager','area_manager','ops_manager'));

-- ── Policies: kpi_targets ─────────────────────────────────
CREATE POLICY "kpi_select" ON kpi_targets FOR SELECT TO authenticated
  USING (can_access_branch(branch_id));

CREATE POLICY "kpi_manage" ON kpi_targets FOR ALL TO authenticated
  USING (my_role() = 'ops_manager')
  WITH CHECK (my_role() = 'ops_manager');

-- ============================================================
-- SEED DATA: Branches (30 toko Bagi Kopi)
-- ============================================================

INSERT INTO branches (store_id, name, district, area) VALUES
  ('BK-0001','Bagi Kopi Margorejo',      'SBY',  'SBY'),
  ('BK-0002','Bagi Kopi Pengumben',      'JKT',  'JKT'),
  ('BK-0003','Bagi Kopi Buah Batu',      'JBR2', 'JBR'),
  ('BK-0004','Bagi Kopi Kemang Utara',   'JKT',  'JKT'),
  ('BK-0005','Bagi Kopi Kiara Artha',    'JBR2', 'JBR'),
  ('BK-0006','Bagi Kopi Bintaro',        'BTN',  'BTN'),
  ('BK-0007','Bagi Kopi Kota Wisata',    'JBR1', 'JBR'),
  ('BK-0008','Bagi Kopi Lenteng Agung',  'JBR1', 'JBR'),
  ('BK-0009','Bagi Kopi Cilandak Barat', 'JKT',  'JKT'),
  ('BK-0010','Bagi Kopi Kayu Putih',     'JKT',  'JKT'),
  ('BK-0011','Bagi Kopi Ciumbuleuit',    'JBR3', 'JBR'),
  ('BK-0012','Bagi Kopi Cimahi',         'JBR3', 'JBR'),
  ('BK-0013','Bagi Kopi Margonda',       'JBR1', 'JBR'),
  ('BK-0014','Bagi Kopi Melong',         'JBR3', 'JBR'),
  ('BK-0015','Bagi Kopi Lebak Bulus',    'JKT',  'JKT'),
  ('BK-0016','Bagi Kopi Ciledug',        'BTN',  'BTN'),
  ('BK-0017','Bagi Kopi Citraland',      'SBY',  'SBY'),
  ('BK-0018','Bagi Kopi Pekayon',        'JBR1', 'JBR'),
  ('BK-0019','Bagi Kopi Kalimalang',     'JKT',  'JKT'),
  ('BK-0020','Bagi Kopi Jatinangor',     'JBR2', 'JBR'),
  ('BK-0021','Bagi Kopi Ujung Berung',   'JBR2', 'JBR'),
  ('BK-0022','Bagi Kopi Pamulang',       'BTN',  'BTN'),
  ('BK-0023','Bagi Kopi Ciputat Jombang','BTN',  'BTN'),
  ('BK-0024','Bagi Kopi Peta',           'JBR3', 'JBR'),
  ('BK-0025','Bagi Kopi Metro',          'JBR2', 'JBR'),
  ('BK-0026','Bagi Kopi Ciputat Juanda', 'BTN',  'BTN'),
  ('BK-0027','Bagi Kopi Kranggan',       'JBR1', 'JBR'),
  ('BK-0028','Bagi Kopi Setu Cipayung',  'JKT',  'JKT'),
  ('BK-0029','Bagi Kopi Cawang',         'JKT',  'JKT'),
  ('BK-0030','Bagi Kopi Karawaci',       'BTN',  'BTN');
