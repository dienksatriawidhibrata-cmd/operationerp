-- ============================================================
-- 028 — POS Sales Detail: item-level + hourly breakdown
-- Tambahan untuk Data Explorer ops_manager (7 query baru)
-- ============================================================

-- ── POS_SALES_ITEMS ───────────────────────────────────────
-- Monthly breakdown by outlet × category × item × size × sales_type
CREATE TABLE IF NOT EXISTS pos_sales_items (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  outlet_name  TEXT NOT NULL,
  branch_id    UUID REFERENCES branches ON DELETE SET NULL,
  year         INT NOT NULL,
  month        INT NOT NULL,
  category     TEXT NOT NULL DEFAULT '',
  item         TEXT NOT NULL DEFAULT '',
  size         TEXT NOT NULL DEFAULT '',  -- 'L'=Large, 'S'=Small, ''=no size
  sales_type   TEXT NOT NULL DEFAULT '',
  net_sales    NUMERIC NOT NULL DEFAULT 0,
  quantity     NUMERIC NOT NULL DEFAULT 0,
  txn_count    INT NOT NULL DEFAULT 0,
  synced_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (outlet_name, year, month, category, item, size, sales_type)
);

-- ── POS_SALES_HOURLY ──────────────────────────────────────
-- Daily breakdown by outlet × date × hour_bucket
CREATE TABLE IF NOT EXISTS pos_sales_hourly (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  outlet_name  TEXT NOT NULL,
  branch_id    UUID REFERENCES branches ON DELETE SET NULL,
  sale_date    DATE NOT NULL,
  year         INT NOT NULL,
  month        INT NOT NULL,
  hour_bucket  TEXT NOT NULL,  -- 'pagi','siang','malam','dinihari','other'
  net_sales    NUMERIC NOT NULL DEFAULT 0,
  txn_count    INT NOT NULL DEFAULT 0,
  synced_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (outlet_name, sale_date, hour_bucket)
);

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS pos_sales_items_outlet_ym
  ON pos_sales_items (outlet_name, year, month);
CREATE INDEX IF NOT EXISTS pos_sales_items_item_ym
  ON pos_sales_items (item, year, month);
CREATE INDEX IF NOT EXISTS pos_sales_items_size
  ON pos_sales_items (size, sales_type);
CREATE INDEX IF NOT EXISTS pos_sales_hourly_outlet_date
  ON pos_sales_hourly (outlet_name, sale_date);
CREATE INDEX IF NOT EXISTS pos_sales_hourly_date
  ON pos_sales_hourly (sale_date);
CREATE INDEX IF NOT EXISTS pos_sales_hourly_bucket
  ON pos_sales_hourly (hour_bucket);

-- ── RLS ───────────────────────────────────────────────────
ALTER TABLE pos_sales_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sales_hourly  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops_manager can read pos_sales_items"
  ON pos_sales_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'ops_manager'
        AND profiles.is_active = true
    )
  );

CREATE POLICY "ops_manager can read pos_sales_hourly"
  ON pos_sales_hourly FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'ops_manager'
        AND profiles.is_active = true
    )
  );
