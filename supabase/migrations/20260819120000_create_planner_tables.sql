-- Migration: Create tables for Weekly Planner, Subjects, Parental Assignments, Notes, Holidays, Habits, and Settings
CREATE SCHEMA IF NOT EXISTS school;

-- 1. school.subjects
CREATE TABLE IF NOT EXISTS school.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  color TEXT DEFAULT '#0C74E4',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. school.parental_assignments
CREATE TABLE IF NOT EXISTS school.parental_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES school.subjects(id) ON DELETE CASCADE,
  assignment_date DATE NOT NULL,
  description TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. school.parental_notes
CREATE TABLE IF NOT EXISTS school.parental_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_date DATE,
  week_start_date DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. school.holidays
CREATE TABLE IF NOT EXISTS school.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  category TEXT CHECK (category IN ('governmental', 'religious', 'custom')) DEFAULT 'governmental',
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. school.habits
CREATE TABLE IF NOT EXISTS school.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. school.weekly_planner_settings
CREATE TABLE IF NOT EXISTS school.weekly_planner_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE UNIQUE NOT NULL,
  todos JSONB DEFAULT '[]'::jsonb,
  priorities JSONB DEFAULT '[]'::jsonb,
  for_next_month TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE school.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.parental_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.parental_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.weekly_planner_settings ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated, anon, service_role
GRANT ALL ON ALL TABLES IN SCHEMA school TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA school TO anon;

-- Policies for subjects
DROP POLICY IF EXISTS "Allow read subjects" ON school.subjects;
CREATE POLICY "Allow read subjects" ON school.subjects FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write subjects" ON school.subjects;
CREATE POLICY "Allow write subjects" ON school.subjects FOR ALL USING (auth.role() = 'authenticated');

-- Policies for parental_assignments
DROP POLICY IF EXISTS "Allow read parental_assignments" ON school.parental_assignments;
CREATE POLICY "Allow read parental_assignments" ON school.parental_assignments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write parental_assignments" ON school.parental_assignments;
CREATE POLICY "Allow write parental_assignments" ON school.parental_assignments FOR ALL USING (auth.role() = 'authenticated');

-- Policies for parental_notes
DROP POLICY IF EXISTS "Allow read parental_notes" ON school.parental_notes;
CREATE POLICY "Allow read parental_notes" ON school.parental_notes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write parental_notes" ON school.parental_notes;
CREATE POLICY "Allow write parental_notes" ON school.parental_notes FOR ALL USING (auth.role() = 'authenticated');

-- Policies for holidays
DROP POLICY IF EXISTS "Allow read holidays" ON school.holidays;
CREATE POLICY "Allow read holidays" ON school.holidays FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write holidays" ON school.holidays;
CREATE POLICY "Allow write holidays" ON school.holidays FOR ALL USING (auth.role() = 'authenticated');

-- Policies for habits
DROP POLICY IF EXISTS "Allow read habits" ON school.habits;
CREATE POLICY "Allow read habits" ON school.habits FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write habits" ON school.habits;
CREATE POLICY "Allow write habits" ON school.habits FOR ALL USING (auth.role() = 'authenticated');

-- Policies for weekly_planner_settings
DROP POLICY IF EXISTS "Allow read weekly_planner_settings" ON school.weekly_planner_settings;
CREATE POLICY "Allow read weekly_planner_settings" ON school.weekly_planner_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write weekly_planner_settings" ON school.weekly_planner_settings;
CREATE POLICY "Allow write weekly_planner_settings" ON school.weekly_planner_settings FOR ALL USING (auth.role() = 'authenticated');
