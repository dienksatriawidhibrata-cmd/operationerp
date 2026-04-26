-- ============================================================
-- 022 — POS Sales & Complaints untuk AI Agent
-- Tabel ADDITIVE ONLY — zero ALTER ke tabel existing
-- ============================================================

-- ── POS_SALES_MONTHLY ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_sales_monthly (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  outlet_name  TEXT NOT NULL,
  branch_id    UUID REFERENCES branches ON DELETE SET NULL,
  year         INT NOT NULL,
  month        INT NOT NULL,
  net_sales    NUMERIC NOT NULL DEFAULT 0,
  gross_sales  NUMERIC NOT NULL DEFAULT 0,
  discounts    NUMERIC NOT NULL DEFAULT 0,
  transactions INT NOT NULL DEFAULT 0,
  synced_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (outlet_name, year, month)
);

-- ── POS_COMPLAINTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_complaints (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  outlet_name    TEXT NOT NULL,
  branch_id      UUID REFERENCES branches ON DELETE SET NULL,
  complaint_date DATE NOT NULL,
  year           INT NOT NULL,
  month          INT NOT NULL,
  app            TEXT,
  topic          TEXT,
  priority       TEXT,
  complaint_text TEXT,
  follow_up      TEXT,
  synced_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pos_sales_monthly_outlet_period
  ON pos_sales_monthly (outlet_name, year, month);
CREATE INDEX IF NOT EXISTS pos_sales_monthly_branch
  ON pos_sales_monthly (branch_id, year, month);
CREATE INDEX IF NOT EXISTS pos_complaints_outlet_period
  ON pos_complaints (outlet_name, year, month);
CREATE INDEX IF NOT EXISTS pos_complaints_branch
  ON pos_complaints (branch_id, complaint_date);

-- ── RLS ───────────────────────────────────────────────────
ALTER TABLE pos_sales_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_complaints    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops_manager can read pos_sales_monthly"
  ON pos_sales_monthly FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'ops_manager'
        AND profiles.is_active = true
    )
  );

CREATE POLICY "ops_manager can read pos_complaints"
  ON pos_complaints FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'ops_manager'
        AND profiles.is_active = true
    )
  );
