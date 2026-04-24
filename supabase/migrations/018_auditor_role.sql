-- ── ROLE: auditor ──────────────────────────────────────────────────────────
-- Role read-only yang hanya bisa mengakses halaman Status Toko (/dm/stores).
-- Tidak bisa mengisi, edit, atau hapus data apapun.

-- 1. Perluas CHECK constraint profiles.role agar menerima 'auditor'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'staff','barista','kitchen','waitress',
  'asst_head_store','head_store',
  'district_manager','area_manager','ops_manager',
  'support_spv','support_admin',
  'finance_supervisor','trainer',
  'sc_supervisor','purchasing_admin','warehouse_admin',
  'picking_spv','qc_spv','distribution_spv','warehouse_spv',
  'auditor'
));

-- 2. Perbarui can_access_branch() agar auditor bisa akses semua branch
CREATE OR REPLACE FUNCTION can_access_branch(b_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM branches b
    WHERE b.id = b_id AND (
      (my_role() IN ('staff','barista','kitchen','waitress','asst_head_store','head_store')
       AND b.id = my_branch())
      OR (my_role() = 'district_manager' AND b.district = ANY(my_districts()))
      OR (my_role() = 'area_manager'    AND b.area    = ANY(my_areas()))
      OR my_role() IN ('ops_manager','finance_supervisor','sc_supervisor',
                       'support_spv','support_admin','auditor')
    )
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Perbarui policy daily_preparation SELECT agar auditor bisa baca semua
DROP POLICY IF EXISTS "prep_store_select" ON daily_preparation;
CREATE POLICY "prep_store_select" ON daily_preparation FOR SELECT TO authenticated
  USING (
    branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
    OR my_role() IN (
      'ops_manager','support_spv','support_admin',
      'district_manager','area_manager','auditor'
    )
  );

-- 4. Update handle_new_user trigger agar menerima 'auditor' dari metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'User Baru'),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'staff') IN (
        'staff','barista','kitchen','waitress',
        'asst_head_store','head_store',
        'district_manager','area_manager','ops_manager',
        'support_spv','support_admin',
        'finance_supervisor','trainer',
        'sc_supervisor','purchasing_admin','warehouse_admin',
        'picking_spv','qc_spv','distribution_spv','warehouse_spv',
        'auditor'
      ) THEN COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
      ELSE 'staff'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
