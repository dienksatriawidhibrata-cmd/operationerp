-- ============================================================
-- Migration 002: Prevent duplicate daily_visits per branch per day
-- ============================================================
-- Without this constraint, if two DMs submit a visit for the same
-- branch+date concurrently, .maybeSingle() throws an error that the
-- frontend silently ignores, making the form appear empty and allowing
-- a third (orphaned) visit to be inserted.
-- ============================================================

ALTER TABLE daily_visits
  ADD CONSTRAINT daily_visits_branch_tanggal_unique
  UNIQUE (branch_id, tanggal);
