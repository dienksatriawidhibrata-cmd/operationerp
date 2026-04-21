-- Migration 012: Add 'middle' shift support to daily_checklists
-- The original table only allowed shift IN ('pagi','malam').
-- Middle shift deadline: 14:00 WIB = 07:00 UTC

-- 1. Drop the generated is_late column (cannot ALTER a generated column directly)
ALTER TABLE daily_checklists DROP COLUMN is_late;

-- 2. Drop the old shift check constraint
ALTER TABLE daily_checklists DROP CONSTRAINT IF EXISTS daily_checklists_shift_check;

-- 3. Add new shift constraint including 'middle'
ALTER TABLE daily_checklists
  ADD CONSTRAINT daily_checklists_shift_check
  CHECK (shift IN ('pagi', 'middle', 'malam'));

-- 4. Re-add is_late as a generated column with middle shift logic
--    Deadlines (WIB):
--      pagi   → 08:00 WIB = 01:00 UTC
--      middle → 14:00 WIB = 07:00 UTC
--      malam  → 03:00 WIB next day = 20:00 UTC same day as tanggal
ALTER TABLE daily_checklists
  ADD COLUMN is_late BOOLEAN GENERATED ALWAYS AS (
    CASE
      WHEN shift = 'pagi' THEN
        (submitted_at AT TIME ZONE 'Asia/Jakarta')::time > '08:00:00'::time
      WHEN shift = 'middle' THEN
        (submitted_at AT TIME ZONE 'Asia/Jakarta')::time > '14:00:00'::time
      WHEN shift = 'malam' THEN
        submitted_at > (tanggal::timestamp + INTERVAL '20 hours')
      ELSE false
    END
  ) STORED;
