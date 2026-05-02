-- Add Dummy Branch for Testing/Sandbox
INSERT INTO branches (id, store_id, name, district, area, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000000', 
  'LAB-01', 
  'Bagi Kopi - Lab', 
  'Labs', 
  'Labs', 
  true
) ON CONFLICT (id) DO NOTHING;

-- Note: The UUID above is a placeholder or can be used as a fixed ID for the lab.
-- To allow a specific user to be a "Super Tester":
-- We can't insert into auth.users easily, so we assume the user will sign up first.
