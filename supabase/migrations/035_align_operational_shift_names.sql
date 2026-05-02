-- Align operational modules to the 4-shift naming convention:
-- opening, middle, malam, closing

-- Normalize existing checklist data before re-applying the constraint.
ALTER TABLE daily_checklists DROP CONSTRAINT IF EXISTS daily_checklists_shift_check;

UPDATE daily_checklists
SET shift = 'opening'
WHERE shift NOT IN ('opening', 'middle', 'malam', 'closing');

ALTER TABLE daily_checklists
  ADD CONSTRAINT daily_checklists_shift_check
  CHECK (shift IN ('opening', 'middle', 'malam', 'closing'));

-- Refresh the checklist lateness trigger so it understands the new shift names.
CREATE OR REPLACE FUNCTION set_checklist_is_late()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  deadline TIMESTAMPTZ;
BEGIN
  CASE NEW.shift
    WHEN 'opening' THEN
      -- 08:00 WIB = 01:00 UTC on tanggal
      deadline := (NEW.tanggal::timestamp + INTERVAL '1 hour') AT TIME ZONE 'UTC';
    WHEN 'middle' THEN
      -- 15:30 WIB = 08:30 UTC on tanggal
      deadline := (NEW.tanggal::timestamp + INTERVAL '8 hours 30 minutes') AT TIME ZONE 'UTC';
    WHEN 'malam' THEN
      -- 19:30 WIB = 12:30 UTC on tanggal
      deadline := (NEW.tanggal::timestamp + INTERVAL '12 hours 30 minutes') AT TIME ZONE 'UTC';
    WHEN 'closing' THEN
      -- 04:00 WIB next day = 21:00 UTC on tanggal
      deadline := (NEW.tanggal::timestamp + INTERVAL '21 hours') AT TIME ZONE 'UTC';
    ELSE
      deadline := NULL;
  END CASE;
  NEW.is_late := deadline IS NOT NULL AND NEW.submitted_at > deadline;
  RETURN NEW;
END;
$$;

-- Normalize existing preparation data before re-applying the constraint.
ALTER TABLE daily_preparation DROP CONSTRAINT IF EXISTS daily_preparation_shift_check;

UPDATE daily_preparation
SET shift = 'opening'
WHERE shift NOT IN ('opening', 'middle', 'malam', 'closing');

ALTER TABLE daily_preparation
  ADD CONSTRAINT daily_preparation_shift_check
  CHECK (shift IN ('opening', 'middle', 'malam', 'closing'));
