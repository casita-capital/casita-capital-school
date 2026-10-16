-- Migration: Add recurring_config to subjects, subject_overrides to weekly_planner_settings, and create math_syllabus table

-- 1. Add recurring_config to school.subjects
ALTER TABLE school.subjects
ADD COLUMN IF NOT EXISTS recurring_config JSONB DEFAULT NULL;

-- 2. Add subject_overrides to school.weekly_planner_settings
ALTER TABLE school.weekly_planner_settings
ADD COLUMN IF NOT EXISTS subject_overrides JSONB DEFAULT '{}'::jsonb;

-- 3. Create school.math_syllabus table
CREATE TABLE IF NOT EXISTS school.math_syllabus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number INT UNIQUE NOT NULL,
  semester INT NOT NULL DEFAULT 1,
  workbook TEXT NOT NULL DEFAULT '',
  textbook TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  materials TEXT NOT NULL DEFAULT '',
  fast_facts TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE school.math_syllabus ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE school.math_syllabus TO authenticated, service_role, anon;

DROP POLICY IF EXISTS "Allow read math_syllabus" ON school.math_syllabus;
CREATE POLICY "Allow read math_syllabus" ON school.math_syllabus FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write math_syllabus" ON school.math_syllabus;
CREATE POLICY "Allow write math_syllabus" ON school.math_syllabus FOR ALL USING (true) WITH CHECK (true);
