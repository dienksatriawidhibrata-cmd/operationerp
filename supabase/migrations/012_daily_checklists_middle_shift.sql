-- Migration 012: Add 'middle' shift to daily_checklists
-- Replaces the GENERATED ALWAYS AS is_late column (which used AT TIME ZONE —
-- a STABLE function, illegal in generated columns) with a trigger-based approach.
--
-- Deadlines (WIB / UTC+7):
--   pagi   → 08:00 WIB = 01:00 UTC  → submitted_at > tanggal + 01:00 UTC
--   middle → 14:00 WIB = 07:00 UTC  → submitted_at > tanggal + 07:00 UTC
--   malam  → 03:00 WIB next day = 20:00 UTC same day → submitted_at > tanggal + 20:00 UTC

-- 1. Drop the generated column
ALTER TABLE daily_checklists DROP COLUMN is_late;

-- 2. Drop old shift check constraint
ALTER TABLE daily_checklists
  DROP CONSTRAINT IF EXISTS daily_checklists_shift_check;

-- 3. Add new shift constraint that includes 'middle'
ALTER TABLE daily_checklists
  ADD CONSTRAINT daily_checklists_shift_check
  CHECK (shift IN ('pagi', 'middle', 'malam'));

-- 4. Add is_late as a plain boolean column (set by trigger)
ALTER TABLE daily_checklists
  ADD COLUMN is_late BOOLEAN NOT NULL DEFAULT false;

-- 5. Create trigger function (STABLE/VOLATILE allowed in triggers)
CREATE OR REPLACE FUNCTION set_checklist_is_late()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  deadline TIMESTAMPTZ;
BEGIN
  CASE NEW.shift
    WHEN 'pagi' THEN
      -- 08:00 WIB = 01:00 UTC on tanggal
      deadline := (NEW.tanggal::timestamp + INTERVAL '1 hour') AT TIME ZONE 'UTC';
    WHEN 'middle' THEN
      -- 14:00 WIB = 07:00 UTC on tanggal
      deadline := (NEW.tanggal::timestamp + INTERVAL '7 hours') AT TIME ZONE 'UTC';
    WHEN 'malam' THEN
      -- 03:00 WIB next day = 20:00 UTC on tanggal
      deadline := (NEW.tanggal::timestamp + INTERVAL '20 hours') AT TIME ZONE 'UTC';
    ELSE
      deadline := NULL;
  END CASE;
  NEW.is_late := deadline IS NOT NULL AND NEW.submitted_at > deadline;
  RETURN NEW;
END;
$$;

-- 6. Attach trigger (fires on INSERT and UPDATE)
DROP TRIGGER IF EXISTS trg_checklist_is_late ON daily_checklists;
CREATE TRIGGER trg_checklist_is_late
  BEFORE INSERT OR UPDATE ON daily_checklists
  FOR EACH ROW EXECUTE FUNCTION set_checklist_is_late();
