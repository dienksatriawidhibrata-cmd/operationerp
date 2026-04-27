-- ============================================================
-- MIGRATION 026: Tambah kolom hadir ke oje_batch_items
-- Jalankan setelah: 025_hr_oje_access.sql
-- ============================================================

ALTER TABLE oje_batch_items
  ADD COLUMN IF NOT EXISTS hadir BOOLEAN NOT NULL DEFAULT true;
