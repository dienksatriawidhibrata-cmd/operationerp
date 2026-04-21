-- ============================================================
-- KPI PERSONAL + 360° PEER REVIEW
-- Migration 013
-- ============================================================

-- ── KPI PERSONAL ITEMS (config table) ─────────────────────
CREATE TABLE kpi_personal_items (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role           TEXT NOT NULL,
  item_key       TEXT NOT NULL,
  item_name      TEXT NOT NULL,
  target         TEXT NOT NULL,
  contribution   INT NOT NULL CHECK (contribution > 0),
  cara_penilaian TEXT NOT NULL,
  source_type    TEXT NOT NULL CHECK (source_type IN (
                   'auto_checklist', 'auto_preparation', 'auto_360', 'manual'
                 )),
  score_1        TEXT NOT NULL,
  score_2        TEXT NOT NULL,
  score_3        TEXT NOT NULL,
  score_4        TEXT NOT NULL,
  score_5        TEXT NOT NULL,
  is_active      BOOLEAN DEFAULT true,
  sort_order     INT DEFAULT 0,
  UNIQUE (role, item_key)
);

-- ── KPI 360° ITEMS (config table) ─────────────────────────
CREATE TABLE kpi_360_items (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_type   TEXT NOT NULL CHECK (group_type IN ('store', 'manager')),
  item_key     TEXT NOT NULL,
  item_name    TEXT NOT NULL,
  description  TEXT NOT NULL,
  score_1      TEXT NOT NULL,
  score_2      TEXT NOT NULL,
  score_3      TEXT NOT NULL,
  score_4      TEXT NOT NULL,
  score_5      TEXT NOT NULL,
  is_active    BOOLEAN DEFAULT true,
  sort_order   INT DEFAULT 0,
  UNIQUE (group_type, item_key)
);

-- ── KPI PERSONAL SCORES ────────────────────────────────────
CREATE TABLE kpi_personal_scores (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id     UUID REFERENCES profiles NOT NULL,
  branch_id    UUID REFERENCES branches NOT NULL,
  period_month TEXT NOT NULL,
  item_key     TEXT NOT NULL,
  auto_value   NUMERIC(6,2),
  score        INT CHECK (score BETWEEN 1 AND 5),
  notes        TEXT,
  scored_by    UUID REFERENCES profiles,
  verified_by  UUID REFERENCES profiles,
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (staff_id, period_month, item_key)
);

-- ── KPI 360° SUBMISSIONS ───────────────────────────────────
CREATE TABLE kpi_360_submissions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluator_id UUID REFERENCES profiles NOT NULL,
  evaluatee_id UUID REFERENCES profiles NOT NULL,
  branch_id    UUID REFERENCES branches,
  group_type   TEXT NOT NULL CHECK (group_type IN ('store', 'manager')),
  period_month TEXT NOT NULL,
  catatan      TEXT CHECK (char_length(catatan) <= 1000),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT no_self_eval CHECK (evaluator_id != evaluatee_id),
  UNIQUE (evaluator_id, evaluatee_id, period_month)
);

-- ── KPI 360° SCORES ───────────────────────────────────────
CREATE TABLE kpi_360_scores (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES kpi_360_submissions ON DELETE CASCADE NOT NULL,
  item_key      TEXT NOT NULL,
  score         INT NOT NULL CHECK (score BETWEEN 1 AND 5),
  UNIQUE (submission_id, item_key)
);

-- ── RLS ────────────────────────────────────────────────────

ALTER TABLE kpi_personal_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_360_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_personal_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_360_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_360_scores      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_personal_items_select" ON kpi_personal_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kpi_360_items_select" ON kpi_360_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kpi_scores_select" ON kpi_personal_scores
  FOR SELECT TO authenticated
  USING (
    staff_id = auth.uid()
    OR (my_role() IN ('head_store','asst_head_store') AND branch_id = my_branch())
    OR my_role() IN ('district_manager','area_manager','ops_manager','support_spv','trainer')
  );

CREATE POLICY "kpi_scores_insert" ON kpi_personal_scores
  FOR INSERT TO authenticated
  WITH CHECK (my_role() = 'head_store' AND branch_id = my_branch());

CREATE POLICY "kpi_scores_update" ON kpi_personal_scores
  FOR UPDATE TO authenticated
  USING (
    (my_role() = 'head_store' AND branch_id = my_branch() AND verified_at IS NULL)
    OR my_role() IN ('district_manager','area_manager','ops_manager')
  );

CREATE POLICY "360_sub_insert" ON kpi_360_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    evaluator_id = auth.uid()
    AND (
      (group_type = 'store'   AND my_role() IN ('barista','kitchen','waitress','asst_head_store','head_store'))
      OR (group_type = 'manager' AND my_role() IN ('head_store','district_manager','area_manager'))
    )
  );

CREATE POLICY "360_sub_update" ON kpi_360_submissions
  FOR UPDATE TO authenticated
  USING (evaluator_id = auth.uid());

CREATE POLICY "360_sub_select" ON kpi_360_submissions
  FOR SELECT TO authenticated
  USING (
    evaluatee_id = auth.uid()
    OR evaluator_id = auth.uid()
    OR my_role() IN ('head_store','district_manager','area_manager','ops_manager','support_spv','trainer')
  );

CREATE POLICY "360_scores_select" ON kpi_360_scores
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kpi_360_submissions s
      WHERE s.id = submission_id
        AND (
          s.evaluatee_id = auth.uid()
          OR s.evaluator_id = auth.uid()
          OR my_role() IN ('head_store','district_manager','area_manager','ops_manager','support_spv','trainer')
        )
    )
  );

CREATE POLICY "360_scores_insert" ON kpi_360_scores
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kpi_360_submissions s
      WHERE s.id = submission_id AND s.evaluator_id = auth.uid()
    )
  );

CREATE POLICY "360_scores_update" ON kpi_360_scores
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kpi_360_submissions s
      WHERE s.id = submission_id AND s.evaluator_id = auth.uid()
    )
  );

-- ── SEED: KPI PERSONAL ITEMS ───────────────────────────────

INSERT INTO kpi_personal_items
  (role, item_key, item_name, target, contribution, cara_penilaian, source_type,
   score_1, score_2, score_3, score_4, score_5, sort_order)
VALUES
  -- BARISTA (total: 100%)
  ('barista','checklist_completion','Checklist Harian — Completion Rate','≥90%',13,
   'Auto dari daily_checklists (shift yang ditugaskan)','auto_checklist',
   '<60%','<70%','<80%','<90%','≥90%',1),
  ('barista','prep_bar_completion','Preparation Bar — Completion Rate','≥90%',13,
   'Auto dari daily_preparation section Bar','auto_preparation',
   '<60%','<70%','<80%','<90%','≥90%',2),
  ('barista','kualitas_minuman','Kualitas Minuman','Sesuai SOP',18,
   'Penilaian Head Store (rasa, tampilan, takaran)','manual',
   'Tidak Sesuai SOP','Kadang Tidak Sesuai','Cukup Sesuai','Sesuai','Sangat Sesuai & Konsisten',3),
  ('barista','kecepatan_penyajian','Kecepatan Penyajian','≤5 menit',13,
   'Penilaian Head Store (observasi langsung)','manual',
   '>8 mnt','>7 mnt','>6 mnt','>5 mnt','≤5 mnt',4),
  ('barista','kebersihan_bar','Kebersihan Area Bar','Bersih',13,
   'Penilaian Head Store / Audit DM','manual',
   'Sangat Kotor','Kotor','Cukup Bersih','Bersih','Sangat Bersih',5),
  ('barista','waste_spoil_bar','Waste & Spoil Area Bar','0 kejadian',10,
   'LOG Waste dari Head Store','manual',
   '>4 kejadian','3 kejadian','2 kejadian','1 kejadian','0 kejadian',6),
  ('barista','kedisiplinan','Kedisiplinan & Kehadiran','≥95%',10,
   'Data absensi / catatan Head Store','manual',
   '<80%','<85%','<90%','<95%','≥95%',7),
  ('barista','peer_review_360','Penilaian 360° Rekan Kerja','≥4.0',10,
   'Rata-rata skor dari rekan kerja satu toko (anonim)','auto_360',
   '<2.0','<2.5','<3.0','<4.0','≥4.0',8),

  -- KITCHEN (total: 100%)
  ('kitchen','checklist_completion','Checklist Harian — Completion Rate','≥90%',13,
   'Auto dari daily_checklists (shift yang ditugaskan)','auto_checklist',
   '<60%','<70%','<80%','<90%','≥90%',1),
  ('kitchen','prep_kitchen_completion','Preparation Kitchen — Completion Rate','≥90%',13,
   'Auto dari daily_preparation section Kitchen','auto_preparation',
   '<60%','<70%','<80%','<90%','≥90%',2),
  ('kitchen','kualitas_makanan','Kualitas Makanan','Sesuai SOP',18,
   'Penilaian Head Store (rasa, tampilan, porsi)','manual',
   'Tidak Sesuai SOP','Kadang Tidak Sesuai','Cukup Sesuai','Sesuai','Sangat Sesuai & Konsisten',3),
  ('kitchen','kecepatan_penyajian','Kecepatan Penyajian Makanan','≤10 menit',13,
   'Penilaian Head Store (observasi langsung)','manual',
   '>15 mnt','>13 mnt','>12 mnt','>11 mnt','≤10 mnt',4),
  ('kitchen','kebersihan_kitchen','Kebersihan Area Kitchen','Bersih',13,
   'Penilaian Head Store / Audit DM','manual',
   'Sangat Kotor','Kotor','Cukup Bersih','Bersih','Sangat Bersih',5),
  ('kitchen','waste_spoil_kitchen','Waste & Spoil Area Kitchen','0 kejadian',10,
   'LOG Waste dari Head Store','manual',
   '>4 kejadian','3 kejadian','2 kejadian','1 kejadian','0 kejadian',6),
  ('kitchen','kedisiplinan','Kedisiplinan & Kehadiran','≥95%',10,
   'Data absensi / catatan Head Store','manual',
   '<80%','<85%','<90%','<95%','≥95%',7),
  ('kitchen','peer_review_360','Penilaian 360° Rekan Kerja','≥4.0',10,
   'Rata-rata skor dari rekan kerja satu toko (anonim)','auto_360',
   '<2.0','<2.5','<3.0','<4.0','≥4.0',8),

  -- WAITRESS (total: 100%, tanpa upselling)
  ('waitress','checklist_completion','Checklist Harian — Completion Rate','≥90%',15,
   'Auto dari daily_checklists (shift yang ditugaskan)','auto_checklist',
   '<60%','<70%','<80%','<90%','≥90%',1),
  ('waitress','kualitas_pelayanan','Kualitas Pelayanan','Sesuai SOP',25,
   'Penilaian Head Store (greeting, speed, attitude)','manual',
   'Tidak Sesuai SOP','Kadang Tidak Sesuai','Cukup Sesuai','Sesuai','Sangat Sesuai',2),
  ('waitress','kebersihan_area','Kebersihan Area & Meja','Bersih & Rapi',20,
   'Penilaian Head Store / Audit DM','manual',
   'Sangat Kotor','Kotor','Cukup Bersih','Bersih','Sangat Bersih & Rapi',3),
  ('waitress','complain_handling','Complain Handling','0 komplain',15,
   'Jumlah komplain pelanggan per bulan','manual',
   '>3 komplain','3 komplain','2 komplain','1 komplain','0 komplain',4),
  ('waitress','kedisiplinan','Kedisiplinan & Kehadiran','≥95%',10,
   'Data absensi / catatan Head Store','manual',
   '<80%','<85%','<90%','<95%','≥95%',5),
  ('waitress','peer_review_360','Penilaian 360° Rekan Kerja','≥4.0',15,
   'Rata-rata skor dari rekan kerja satu toko (anonim)','auto_360',
   '<2.0','<2.5','<3.0','<4.0','≥4.0',6),

  -- ASST_HEAD_STORE (total: 100%)
  ('asst_head_store','checklist_monitoring','Checklist Monitoring Toko','≥90%',8,
   'Auto: rata-rata completion rate semua staff toko','auto_checklist',
   '<60%','<70%','<80%','<90%','≥90%',1),
  ('asst_head_store','prep_monitoring','Preparation Monitoring Toko','≥90%',8,
   'Auto: rata-rata completion rate preparation semua shift','auto_preparation',
   '<60%','<70%','<80%','<90%','≥90%',2),
  ('asst_head_store','pencapaian_sales','Pencapaian Sales KPI Toko','100%',20,
   'Target Sales Daily Tercapai (dari KPI Toko)','manual',
   '<80%','<85%','<90%','<95%','≥100%',3),
  ('asst_head_store','coaching_briefing','Coaching & Briefing Staff','≥4 sesi/bulan',13,
   'Jumlah sesi coaching terdokumentasi (LOG)','manual',
   '0 sesi','1 sesi','2 sesi','3 sesi','≥4 sesi',4),
  ('asst_head_store','stock_fifo','Stock Accuracy & FIFO','FIFO & Cukup',13,
   'Audit Head Store / DM Mingguan','manual',
   'Tidak FIFO & Kosong','Tidak FIFO & Banyak','Tidak FIFO & Cukup','FIFO & Kurang','FIFO & Cukup',5),
  ('asst_head_store','opex_control','Opex Control','≤3%',10,
   'Deviasi OPEX vs Budget','manual',
   '>4.5%','>4%','>3.5%','>3%','≤3%',6),
  ('asst_head_store','sop_kebersihan','SOP & Kebersihan Toko','Baik',8,
   'Penilaian Head Store / Audit DM','manual',
   'Sangat Kurang','Kurang','Cukup','Baik','Sangat Baik',7),
  ('asst_head_store','kedisiplinan','Kedisiplinan & Kehadiran','≥95%',10,
   'Data absensi / catatan Head Store','manual',
   '<80%','<85%','<90%','<95%','≥95%',8),
  ('asst_head_store','peer_review_360','Penilaian 360° Rekan Kerja','≥4.0',10,
   'Rata-rata skor dari rekan kerja satu toko (anonim)','auto_360',
   '<2.0','<2.5','<3.0','<4.0','≥4.0',9);

-- ── SEED: KPI 360° ITEMS ───────────────────────────────────

INSERT INTO kpi_360_items
  (group_type, item_key, item_name, description,
   score_1, score_2, score_3, score_4, score_5, sort_order)
VALUES
  ('store','kerjasama_tim','Kerjasama Tim',
   'Mau membantu rekan, tidak egois, solid saat sibuk',
   'Tidak pernah membantu','Jarang membantu','Cukup kooperatif','Kooperatif','Sangat solid & proaktif membantu',1),
  ('store','komunikasi_sikap','Komunikasi & Sikap',
   'Cara bicara, bahasa tubuh, respek ke sesama rekan',
   'Sering konflik/kasar','Kurang sopan','Cukup baik','Komunikatif & sopan','Sangat positif & memotivasi',2),
  ('store','inisiatif','Inisiatif & Proaktif',
   'Bertindak tanpa harus disuruh, cari solusi sendiri',
   'Tidak pernah inisiatif','Jarang inisiatif','Kadang inisiatif','Sering inisiatif','Selalu proaktif',3),
  ('store','kedisiplinan','Kedisiplinan',
   'Tepat waktu, sesuai jadwal, tidak sering izin mendadak',
   'Sangat tidak disiplin','Kurang disiplin','Cukup disiplin','Disiplin','Sangat disiplin & jadi contoh',4),
  ('store','tanggung_jawab','Tanggung Jawab Kerja',
   'Menyelesaikan tugas, tidak lempar tanggung jawab',
   'Sering tidak selesai','Sering tidak tuntas','Kadang tidak tuntas','Selalu tuntas','Sangat bertanggung jawab & bisa diandalkan',5),

  ('manager','kepemimpinan','Kepemimpinan & Pengambilan Keputusan',
   'Tegas, adil, dan cepat dalam mengambil keputusan',
   'Tidak mampu memimpin','Kurang tegas','Cukup baik','Tegas & adil','Inspiratif & visioner',1),
  ('manager','komunikasi_arahan','Komunikasi & Arahan',
   'Instruksi jelas, tidak ambigu, mudah dipahami tim',
   'Tidak jelas sama sekali','Sering ambigu','Cukup jelas','Jelas & terstruktur','Sangat jelas & efektif',2),
  ('manager','coaching_tim','Coaching & Pengembangan Tim',
   'Aktif membimbing, memberi feedback, dorong pertumbuhan',
   'Tidak pernah coaching','Jarang coaching','Kadang coaching','Rutin coaching','Sangat aktif & berdampak',3),
  ('manager','integritas','Integritas & Konsistensi',
   'Konsisten antara ucapan dan tindakan, jujur, bisa dipercaya',
   'Sering tidak konsisten','Kurang konsisten','Cukup konsisten','Konsisten','Sangat integritas & jadi teladan',4),
  ('manager','kolaborasi','Kolaborasi Antar Divisi/Toko',
   'Terbuka bekerja sama lintas toko atau divisi',
   'Sangat tertutup','Kurang kooperatif','Cukup kooperatif','Kooperatif','Sangat kolaboratif & membangun sinergi',5);
