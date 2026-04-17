-- ============================================================
-- BAGI KOPI OPS — Supply Chain Module
-- Migration 002: Warehouse → Store delivery flow
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Add new roles to profiles CHECK constraint ──────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'staff','asst_head_store','head_store',
  'district_manager','area_manager','ops_manager',
  'finance_supervisor','sc_supervisor',
  'purchasing_admin','warehouse_admin',
  'picking_spv','qc_spv','distribution_spv','warehouse_spv'
));

-- ── 2. Update can_access_branch() to include SC roles ──────
CREATE OR REPLACE FUNCTION can_access_branch(b_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM branches b
    WHERE b.id = b_id AND (
      (my_role() IN ('staff','asst_head_store','head_store') AND b.id = my_branch())
      OR (my_role() = 'district_manager' AND b.district = ANY(my_districts()))
      OR (my_role() = 'area_manager' AND b.area = ANY(my_areas()))
      OR my_role() IN (
        'ops_manager','finance_supervisor','sc_supervisor',
        'warehouse_admin','warehouse_spv','purchasing_admin'
      )
    )
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 3. Update profiles_read_own to include SC roles ────────
DROP POLICY IF EXISTS "profiles_read_own" ON profiles;
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT TO authenticated USING (
  id = auth.uid()
  OR my_role() IN (
    'ops_manager','district_manager','area_manager',
    'sc_supervisor','warehouse_admin','warehouse_spv','purchasing_admin'
  )
);

-- ── 4. Supply Orders ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supply_orders (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number   TEXT UNIQUE NOT NULL,
  branch_id      UUID REFERENCES branches NOT NULL,
  tanggal_po     DATE NOT NULL,
  status         TEXT DEFAULT 'draft' CHECK (status IN (
                   'draft','picking','qc','distribution','sj_ready','shipped','completed','cancelled'
                 )),
  catatan        TEXT,
  created_by     UUID REFERENCES profiles,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ── 5. Supply Order Items ───────────────────────────────────
CREATE TABLE IF NOT EXISTS supply_order_items (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id     UUID REFERENCES supply_orders ON DELETE CASCADE NOT NULL,
  sku_code     TEXT NOT NULL,
  sku_name     TEXT NOT NULL,
  qty_ordered  NUMERIC(12,3) NOT NULL,
  unit         TEXT NOT NULL DEFAULT 'PCS',
  unit_price   NUMERIC(14,2),
  catatan      TEXT
);

-- ── 6. Stage Confirmations (picking / qc / distribution) ───
CREATE TABLE IF NOT EXISTS supply_confirmations (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      UUID REFERENCES supply_orders ON DELETE CASCADE NOT NULL,
  stage         TEXT NOT NULL CHECK (stage IN ('picking','qc','distribution')),
  confirmed_by  UUID REFERENCES profiles,
  confirmed_at  TIMESTAMPTZ,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed')),
  catatan       TEXT,
  UNIQUE(order_id, stage)
);

-- ── 7. Confirmation Items ───────────────────────────────────
CREATE TABLE IF NOT EXISTS supply_confirmation_items (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  confirmation_id  UUID REFERENCES supply_confirmations ON DELETE CASCADE NOT NULL,
  order_item_id    UUID REFERENCES supply_order_items NOT NULL,
  qty_confirmed    NUMERIC(12,3) NOT NULL,
  catatan          TEXT
);

-- ── 8. Surat Jalan ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS surat_jalan (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sj_number    TEXT UNIQUE NOT NULL,
  order_id     UUID REFERENCES supply_orders NOT NULL,
  branch_id    UUID REFERENCES branches NOT NULL,
  tanggal_kirim DATE NOT NULL,
  pengirim     TEXT,
  issued_by    UUID REFERENCES profiles,
  issued_at    TIMESTAMPTZ,
  status       TEXT DEFAULT 'draft' CHECK (status IN ('draft','issued','shipped','delivered')),
  catatan      TEXT,
  foto_sj      TEXT[] DEFAULT '{}'
);

-- ── 9. Surat Jalan Items ────────────────────────────────────
CREATE TABLE IF NOT EXISTS surat_jalan_items (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sj_id         UUID REFERENCES surat_jalan ON DELETE CASCADE NOT NULL,
  order_item_id UUID REFERENCES supply_order_items NOT NULL,
  sku_code      TEXT NOT NULL,
  sku_name      TEXT NOT NULL,
  qty_kirim     NUMERIC(12,3) NOT NULL,
  unit          TEXT NOT NULL
);

-- ── 10. Enable RLS ──────────────────────────────────────────
ALTER TABLE supply_orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_confirmations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_confirmation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE surat_jalan              ENABLE ROW LEVEL SECURITY;
ALTER TABLE surat_jalan_items        ENABLE ROW LEVEL SECURITY;

-- ── SC role helper ──────────────────────────────────────────
-- Returns true for all roles that can access SC module
CREATE OR REPLACE FUNCTION is_sc_role() RETURNS BOOLEAN AS $$
  SELECT my_role() IN (
    'ops_manager','sc_supervisor','warehouse_admin','warehouse_spv',
    'purchasing_admin','picking_spv','qc_spv','distribution_spv'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Policies: supply_orders ─────────────────────────────────
CREATE POLICY "supply_orders_select" ON supply_orders FOR SELECT TO authenticated
  USING (is_sc_role());

CREATE POLICY "supply_orders_insert" ON supply_orders FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('warehouse_admin','warehouse_spv','purchasing_admin','ops_manager','sc_supervisor'));

CREATE POLICY "supply_orders_update" ON supply_orders FOR UPDATE TO authenticated
  USING (my_role() IN ('warehouse_admin','warehouse_spv','ops_manager','sc_supervisor',
                       'picking_spv','qc_spv','distribution_spv'));

-- ── Policies: supply_order_items ───────────────────────────
CREATE POLICY "soi_select" ON supply_order_items FOR SELECT TO authenticated
  USING (is_sc_role());

CREATE POLICY "soi_insert" ON supply_order_items FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('warehouse_admin','warehouse_spv','purchasing_admin','ops_manager','sc_supervisor'));

CREATE POLICY "soi_update" ON supply_order_items FOR UPDATE TO authenticated
  USING (my_role() IN ('warehouse_admin','warehouse_spv','ops_manager','sc_supervisor'));

CREATE POLICY "soi_delete" ON supply_order_items FOR DELETE TO authenticated
  USING (my_role() IN ('warehouse_admin','warehouse_spv','ops_manager','sc_supervisor'));

-- ── Policies: supply_confirmations ─────────────────────────
CREATE POLICY "sc_confirm_select" ON supply_confirmations FOR SELECT TO authenticated
  USING (is_sc_role());

CREATE POLICY "sc_confirm_insert" ON supply_confirmations FOR INSERT TO authenticated
  WITH CHECK (is_sc_role());

CREATE POLICY "sc_confirm_update" ON supply_confirmations FOR UPDATE TO authenticated
  USING (
    (stage = 'picking'      AND my_role() IN ('picking_spv','warehouse_admin','warehouse_spv','ops_manager','sc_supervisor'))
    OR (stage = 'qc'        AND my_role() IN ('qc_spv','warehouse_admin','warehouse_spv','ops_manager','sc_supervisor'))
    OR (stage = 'distribution' AND my_role() IN ('distribution_spv','warehouse_admin','warehouse_spv','ops_manager','sc_supervisor'))
  );

-- ── Policies: supply_confirmation_items ────────────────────
CREATE POLICY "sci_select" ON supply_confirmation_items FOR SELECT TO authenticated
  USING (is_sc_role());

CREATE POLICY "sci_insert" ON supply_confirmation_items FOR INSERT TO authenticated
  WITH CHECK (is_sc_role());

CREATE POLICY "sci_update" ON supply_confirmation_items FOR UPDATE TO authenticated
  USING (is_sc_role());

CREATE POLICY "sci_delete" ON supply_confirmation_items FOR DELETE TO authenticated
  USING (is_sc_role());

-- ── Policies: surat_jalan ───────────────────────────────────
CREATE POLICY "sj_select" ON surat_jalan FOR SELECT TO authenticated
  USING (is_sc_role() OR can_access_branch(branch_id));

CREATE POLICY "sj_insert" ON surat_jalan FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('warehouse_admin','warehouse_spv','ops_manager','sc_supervisor'));

CREATE POLICY "sj_update" ON surat_jalan FOR UPDATE TO authenticated
  USING (my_role() IN ('warehouse_admin','warehouse_spv','distribution_spv','ops_manager','sc_supervisor',
                       'staff','asst_head_store','head_store'));

-- ── Policies: surat_jalan_items ────────────────────────────
CREATE POLICY "sji_select" ON surat_jalan_items FOR SELECT TO authenticated
  USING (is_sc_role() OR EXISTS (
    SELECT 1 FROM surat_jalan sj WHERE sj.id = surat_jalan_items.sj_id AND can_access_branch(sj.branch_id)
  ));

CREATE POLICY "sji_insert" ON surat_jalan_items FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('warehouse_admin','warehouse_spv','ops_manager','sc_supervisor'));

CREATE POLICY "sji_delete" ON surat_jalan_items FOR DELETE TO authenticated
  USING (my_role() IN ('warehouse_admin','warehouse_spv','ops_manager','sc_supervisor'));

-- ── 11. Auto-update updated_at on supply_orders ────────────
CREATE OR REPLACE FUNCTION update_supply_order_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER supply_orders_updated_at
  BEFORE UPDATE ON supply_orders
  FOR EACH ROW EXECUTE FUNCTION update_supply_order_timestamp();
