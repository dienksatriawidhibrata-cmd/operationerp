-- ── ANNOUNCEMENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT NOT NULL,
  body         TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "announcements_select" ON announcements
  FOR SELECT TO authenticated USING (true);

-- Only ops_manager and support_spv can write
CREATE POLICY "announcements_insert" ON announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ops_manager', 'support_spv')
    )
  );

CREATE POLICY "announcements_update" ON announcements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ops_manager', 'support_spv')
    )
  );

CREATE POLICY "announcements_delete" ON announcements
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ops_manager', 'support_spv')
    )
  );
