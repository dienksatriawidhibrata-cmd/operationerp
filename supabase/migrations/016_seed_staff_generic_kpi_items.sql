-- ============================================================
-- Seed KPI Personal items for generic staff role
-- Migration 016
-- ============================================================

INSERT INTO kpi_personal_items
  (role, item_key, item_name, target, contribution, cara_penilaian, source_type,
   score_1, score_2, score_3, score_4, score_5, sort_order)
VALUES
  ('staff','checklist_completion','Checklist Harian - Completion Rate','>=90%',20,
   'Auto dari daily_checklists (shift yang ditugaskan)','auto_checklist',
   '<60%','<70%','<80%','<90%','>=90%',1),
  ('staff','preparation_completion','Preparation Harian - Completion Rate','>=90%',15,
   'Auto dari daily_preparation sesuai shift','auto_preparation',
   '<60%','<70%','<80%','<90%','>=90%',2),
  ('staff','kualitas_kerja','Kualitas Kerja','Sesuai SOP',20,
   'Penilaian Head Store sesuai SOP area kerja','manual',
   'Sangat kurang','Kurang','Cukup','Baik','Sangat baik',3),
  ('staff','kecepatan_kerja','Kecepatan & Respons Kerja','Cepat & tepat',15,
   'Observasi Head Store saat operasional','manual',
   'Sangat lambat','Lambat','Cukup','Cepat','Sangat cepat & sigap',4),
  ('staff','kebersihan_area','Kebersihan Area Kerja','Bersih',10,
   'Penilaian Head Store / Audit DM','manual',
   'Sangat kotor','Kotor','Cukup bersih','Bersih','Sangat bersih',5),
  ('staff','kedisiplinan','Kedisiplinan & Kehadiran','>=95%',10,
   'Data absensi / catatan Head Store','manual',
   '<80%','<85%','<90%','<95%','>=95%',6),
  ('staff','peer_review_360','Penilaian 360° Rekan Kerja','>=4.0',10,
   'Rata-rata skor dari rekan kerja satu toko (anonim)','auto_360',
   '<2.0','<2.5','<3.0','<4.0','>=4.0',7)
ON CONFLICT (role, item_key) DO UPDATE
SET
  item_name = EXCLUDED.item_name,
  target = EXCLUDED.target,
  contribution = EXCLUDED.contribution,
  cara_penilaian = EXCLUDED.cara_penilaian,
  source_type = EXCLUDED.source_type,
  score_1 = EXCLUDED.score_1,
  score_2 = EXCLUDED.score_2,
  score_3 = EXCLUDED.score_3,
  score_4 = EXCLUDED.score_4,
  score_5 = EXCLUDED.score_5,
  is_active = true,
  sort_order = EXCLUDED.sort_order;
