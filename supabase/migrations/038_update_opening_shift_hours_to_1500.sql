-- Standardize opening shifts that still use 06:30 - 14:30.
-- This keeps saved schedule rows aligned with the frontend shift config.

update shift_schedules
set shift_hour = '06:30 - 15:00'
where shift_type = 'OPENING'
  and shift_hour = '06:30 - 14:30';
