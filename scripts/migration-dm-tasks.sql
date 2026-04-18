CREATE TABLE IF NOT EXISTS dm_tasks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  due_date    date,
  is_done     boolean NOT NULL DEFAULT false,
  done_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE dm_tasks ENABLE ROW LEVEL SECURITY;

-- ops_manager can read/write everything
CREATE POLICY "dm_tasks_ops_all" ON dm_tasks
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ops_manager')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ops_manager')
  );

-- assigned user can read their own tasks
CREATE POLICY "dm_tasks_assignee_select" ON dm_tasks
  FOR SELECT TO authenticated
  USING (assigned_to = auth.uid());

-- assigned user can toggle is_done / done_at only
CREATE POLICY "dm_tasks_assignee_update" ON dm_tasks
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());
